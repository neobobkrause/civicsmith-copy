/* admission: WHO MAY CALL AN OP, judged before the op runs (R1–R22). The namespace a request addresses, the class its
   credential gives, the agent credential's confinement and task scope, the session's reach and capabilities, and the
   fences a bearer meets. It decides whether a caller is admitted and as whom, and answers a refusal that names why; it
   never runs an op or answers one.

   Copied from `control-plane/index.mjs` at the control-plane split (T18, K617, K624 (1), (2)): `classify`, `scopeFor`,
   the namespace gates, the agent credential's resolution, confinement and task scope, `resolveSession`, `sessionOpGate`,
   the admission region of `makeFetch` (as `admit`), the bearer fences (as `bearerFence`) and the mint's declarations.
   Control-plane's own T18 job, after this module merged, deleted its copy; its door calls these (control-plane R28).

   THE SHAPE OF AN ANSWER. A gate answers `null` to admit, or a REFUSAL: `{ status, body }`, `body` the whole refusal
   (`ok: false`, the code as `reason` and `code`, its row's `check` and `translation`, and the gate's own fields), which
   the door answers at `status` as given, in its envelope. Each code is a STRING LITERAL at its site inside its DEC-49
   region, and each refusal is built whole there: no caller adds a field to it or reads its code from a variable, so
   every verdict is stated where it is minted (N411: the door's `...scoped.error` spread, which inherited the agent
   gate's code at the admission region, is gone). A store this module asks (the agent credential's row, a session) is
   asked through the door's reader, `doAnswer`, passed in, and a store that does not answer is a SILENCE,
   `{ silent: { op, correlation? } }`, which the door answers as its own 502 (R6; control-plane R23) and never as a
   statement about the caller.

   T35 (T35-71; F1, F4, F12, N703, K1934 (5)): every gate judges the credential `presentedCredential` answers (R20: the
   `Authorization` header's, else the JSON body's), the binding classes are compared as digests in constant time (R5),
   an expired agent credential is refused by name (R10), the credential-free ops meet one window per source (R21), and
   the refusals R22 names are counted in credentials' security tally.

   T38 (T38-24; N792, K2247): with no `KNOCK_FINGERPRINT_KEY` binding, `sourceOf` asks the store's `doorwindow` with
   `count: false` for the fingerprint under the instance's key, so `setpassword` and `login` count as one source (R21).

   T36 (T36-36; F1's tail, K2111, K2129; N711, K1936 Q3; N744, K2038): a credential or secret in the address is refused
   by name, `CREDENTIAL_IN_ADDRESS` (R20, C-38.10, `credentialAddressGate`, its one site), and never read from there; the
   shared member key is retired, a live `MEMBER_TOKEN` refused `MEMBER_TOKEN_RETIRED` (R5, C-38.11); and R22's tally
   reaches credentials through the store's internal route `securitycount` (credentials R50).

   T41 (T41-59, was T40-18a; N797, K2394; DEC-188 (8)): `handlecheck` is a public op that addresses scratch (R3) and its
   `NO_SUCH_INVITATION` is counted as a refused key (R22); `groupswitchset`, retired to `accountusesset`
   (op-declarations R24, R41), is no longer among R19's session-only ops (no code here named it: R19 is read from the
   op table).

   T47 (T47-77; K3043, K3084; credentials R63, R65, R66, R71): an `ai` credential minted for one segment of a run
   writes only to that run (R23); a locked session is admitted only to `unlock`, `reauth` and `signout`, any other op
   answered credentials' `SESSION_LOCKED` as given (R24); and an act op-declarations' `REAUTH_ACTS` names is admitted
   only while the session's password re-ask window is open, else answered credentials' `REAUTH_DUE` as given (R25).
   Both codes are credentials' rows, minted there once (K231): this module relays them and mints neither.

   T49 (T49-18; D24, K1881, K3333, K3366, K3368): a public read presenting a live session is counted in that session's own
   window, `SESSION_WINDOW` (R27), and every other request to a public op stays in its source's (R21); the sentence of
   every refusal is the word `refusal.<CODE>` read through setup-words' `word`, the rows (checks.mjs) holding only
   their check id and site (R28).

   T50 (T50-79; N1179, N1186, N1146; K3747, K3557; DEC-278): an administrator's own act that `REAUTH_ACTS` names, asked
   by a session whose member is not an administrator, is refused membership's `NOT_AN_ADMIN` before the password is
   asked (R29); the viewer of an `ai` credential minted in a project carries that project (R30); the key list R28 reads
   is the design's regenerated one (R31).

   T51 fix round 10 (K5170; ratification R60): the session read and, for an act that asks the password again, the
   question whether it is due are issued together, one hop in the door's chain (R33). */
import { liveToken, sha256hex } from "../tokens.mjs";
import { storeStub } from "../store-place.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { MACHINE_CLASS_PREFIX } from "../record-grammar/index.mjs";
import { OPS, SESSION_OPS, NEEDS, UNATTENDED_BY_DECISION, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS, CUSTODIAL_ACTIONS,
         OP_FAMILIES } from "../op-declarations/index.mjs";
import * as OP_DECLARATIONS from "../op-declarations/index.mjs";
import { Credentials } from "../credentials/index.mjs";
import { notAnAdmin, projectViewer } from "../membership/index.mjs";
import { ADMISSION_CHECKS, NAMESPACE_CHECKS, AI_SCOPE_CHECKS, OPERATOR_FENCE_CHECKS, GROUP_IDENTITY_FENCE_CHECKS } from "./checks.mjs";

export const SCRATCH = "scratch";
/* D-456 (C-78.1): the namespaces, exact and case-sensitive (a Durable Object name is an exact string). */
export const NAMESPACES = Object.freeze(["bio", SCRATCH]);

/* A row's DEC-49 fields: the code, its check id (the one row, in checks.mjs) and the member's sentence, which is the
   word `refusal.<CODE>` read through setup-words' `word` (R28), `vars` its placeholders. It THROWS rather than returning
   a partial row: DEC-49 exists because a refusal once shipped `translation: undefined` to a member, and a throw is a
   loud failure where a missing sentence is a silent one that reaches a person. `word` itself throws for a key the list
   does not hold, so a code with no sentence behind it cannot reach a member either. */
function rowOf(table, family, code, vars = {}, key = `refusal.${code}`) {
  const row = table[code];
  if (!row || typeof row.check !== "string" || !row.check)
    throw new Error(`admission: ${code} has no ${family} row (DEC-49). A code with no row must not reach a member.`);
  return { code, check: row.check, translation: word(key, vars) };
}
const admissionRow = (code, vars, key) => rowOf(ADMISSION_CHECKS, "ADMISSION_CHECKS", code, vars, key);
const namespaceRow = (code) => rowOf(NAMESPACE_CHECKS, "NAMESPACE_CHECKS", code);
const aiScopeRow = (code) => rowOf(AI_SCOPE_CHECKS, "AI_SCOPE_CHECKS", code);
const operatorFenceRow = (code) => rowOf(OPERATOR_FENCE_CHECKS, "OPERATOR_FENCE_CHECKS", code);
const identityFenceRow = (code) => rowOf(GROUP_IDENTITY_FENCE_CHECKS, "GROUP_IDENTITY_FENCE_CHECKS", code);

/* ===================================================================================================================
 * NAMESPACES, BEFORE ANY CREDENTIAL IS JUDGED (R1–R4)
 * =================================================================================================================== */

/* R1 (D-456, C-78.1) — A NAMESPACE THAT DOES NOT EXIST IS REFUSED BY NAME, FOR EVERY CALLER, AT THE FRONT DOOR.
   `store=biosmoke-pdf`, `store=Scratch` and an empty `store=` once all addressed the REAL record, and a live
   verification whose no-write guarantee is naming its namespace (D-325) wrote production while believing it was
   elsewhere. This runs once, before a credential is classified, so every class and the no-credential path meet one
   refusal from one governed span. `store=` absent is not a refusal. Nothing is read or written when this answers. */
export function namespaceGate(url) {
  if (!url.searchParams.has("store")) return null;
  const asked = url.searchParams.get("store");
  if (NAMESPACES.includes(asked)) return null;
  /* DEC-49 REGION is-namespace-gate */
  return { status: 400, body: { ok: false, reason: "NAMESPACE_UNKNOWN", ...namespaceRow("NAMESPACE_UNKNOWN"),
           error: `no namespace ${JSON.stringify(asked.slice(0, 80))} exists on this instance`,
           asked: asked.slice(0, 80), namespaces: [...NAMESPACES] } };
  /* END DEC-49 REGION is-namespace-gate */
}

/* R3 (D-461, C-78.2) — A PUBLIC OP THAT ALWAYS ANSWERS FROM `bio` REFUSES `store=scratch` BY NAME. `op=knock&store=scratch`
   once filed a knock in the REAL record's inbox and answered `ok`. Refuse, never redirect: the caller is told. THE SET
   IS INVERTED ON PURPOSE: it lists the public ops that DO address scratch (each reads `store=` itself), so a public op
   added later is refused `store=scratch` until somebody makes it answer from scratch and lists it here — the unlisted
   default is the refusal, never the real record. Gated ops take their namespace from `scopeFor`.
   T34 (DEC-133, DEC-132; R3 as amended): the two doors and `groupdescription` join, since each namespace holds its own
   website key, join link and description, as it holds its own invitations and identity.
   T41 (T41-59, was T40-18a; N797, K2394; op-declarations R42, membership R123): `handlecheck` joins, since it reads an
   invitation as `invitelook` does, and each namespace holds its own invitations. */
export const SCRATCH_ADDRESSING_PUBLIC_OPS = Object.freeze(["invitelook", "enroll", "instancegroup", "groupidentity",
                                                            "websiteinvite", "joinlinkinvite", "groupdescription",
                                                            "handlecheck"]);
export function pinnedNamespaceGate(url, op, spec) {
  if (spec.classes !== null || SCRATCH_ADDRESSING_PUBLIC_OPS.includes(op)) return null;
  if (url.searchParams.get("store") !== SCRATCH) return null;
  /* DEC-49 REGION is-pinned-namespace-gate */
  return { status: 400, body: { ok: false, reason: "NAMESPACE_PINNED", ...namespaceRow("NAMESPACE_PINNED"),
           error: `op=${op} always answers from the bio namespace and has no ${SCRATCH} counterpart; nothing was read or written`,
           op, asked: SCRATCH, pinned: "bio" } };
  /* END DEC-49 REGION is-pinned-namespace-gate */
}

/* R17, R19 — WHAT A REQUEST'S QUERY MAY NOT CARRY, judged once, after R1 and before the agent credential is looked up
   (R6) or its confinement applied (R2). It never refuses and answers `null`; it removes from the URL what the op takes
   from the request's BODY ONLY, so no later reader of the URL (the door's relay, a reader of `store=`, a log of the
   address) can take it from there, and a secret is never kept in an address:
     - the DOORS (`websiteinvite`, the group's website's call; `joinlinkinvite`, the join page's call; R17) are admitted
       with no credential, and whoever calls, nothing about the caller reaches the act: the caller's `token` is removed
       too, so no credential is looked up, no confinement applies and no reader sees a caller; the act is recorded only
       as its door's (`membership` R105). The key or link and the cover are the body's; one sent in the query is gone,
       and the call answers as `membership` answers a missing key or link. The daily cap is `membership`'s (its R101,
       R104), relayed by the door; admission's one limit is R21's per-source window, over every public op alike.
     - `groupkeyset` (R19): the group's API key is the body's; one sent in the query is gone, and the call answers as
       `credentials` answers an empty key (`NO_SECRET`). The session's `token` stays: the act is a session's own.
     - `handlecheck` (R20, T41; K2576, op-declarations R42): its invitation and handle are the body's, so an invitation
       is never kept in an address; one sent in the query is gone, and the call answers as `membership` answers a
       missing invitation (`NO_SUCH_INVITATION`, its R123), as the doors answer a missing key. A member asking without
       an invitation keeps its session (the token travels in the header or body, R20).
   Every other op's URL is left as it came. */
export const PUBLIC_DOORS = Object.freeze(["joinlinkinvite", "websiteinvite"]);
export const BODY_ONLY_FIELDS = Object.freeze({
  websiteinvite: Object.freeze(["cover", "key"]),
  joinlinkinvite: Object.freeze(["cover", "link"]),
  groupkeyset: Object.freeze(["key"]),
  handlecheck: Object.freeze(["handle", "invite"]),
});
/* R20 (T36) — and a query `token` or `secret` is removed whatever the op: no credential is read from the address
   (`credentialAddressGate` has refused a request that names one before this runs), so none is kept there for a later
   reader of the URL to read, compare, pass on or log. `credential`, the door's `presentedCredential` answer, is taken
   for the callers that pass it and changes nothing. */
export function queryGate(url, op, credential = null) {
  void credential;
  const fields = Object.hasOwn(BODY_ONLY_FIELDS, op) ? BODY_ONLY_FIELDS[op] : [];
  for (const k of fields) url.searchParams.delete(k);
  for (const k of ADDRESS_CREDENTIALS) url.searchParams.delete(k);
  return null;
}

/* R2 (D-463, C-78.3) — A CREDENTIAL MINTED CONFINED TO `scratch` ADDRESSES `scratch` ON EVERY CALL IT MAKES.
   The per-call discipline of naming `store=scratch` failed twice where it was measured (D-456, D-461), so the property
   is the credential's ROW, judged here ONCE, ahead of the public ops, of `classify` and of `scopeFor`, and the door
   keeps that order (control-plane R28). Two arms, both the confinement:
     - a `store=` NAMED as anything but `scratch` is REFUSED BY NAME (`bio` with the rest);
     - a `store=` ABSENT is SET to `scratch` on the URL, so every later reader of the namespace (`scopeFor`'s answer, a
       public op reading `store=` itself) reads `scratch`, and the answer's `store` says so. A confined caller reaching
       a bio-pinned public op then meets R3, which is why R2 runs first.
   NOT CONFINED, AND MEASURED SO: the credential's own row and a session are read from `bio` (resolving who a caller is
   is not addressing the record's content), and the four binding classes have no row to carry the property. */
export function confinedNamespaceGate(url, cred) {
  if (!cred || cred.confinedTo !== SCRATCH) return null;
  if (url.searchParams.has("store") && url.searchParams.get("store") !== SCRATCH) {
    /* DEC-49 REGION is-confined-namespace-gate */
    return { status: 403, body: { ok: false, reason: "NAMESPACE_CONFINED", ...namespaceRow("NAMESPACE_CONFINED"),
             error: `credential '${String(cred.tokenId).slice(0, 60)}' is confined to the ${SCRATCH} `
                  + `namespace for its whole life and cannot address `
                  + `${JSON.stringify(String(url.searchParams.get("store")).slice(0, 80))}; nothing was read or written`,
             tokenId: cred.tokenId, asked: String(url.searchParams.get("store")).slice(0, 80),
             confinedTo: SCRATCH } };
    /* END DEC-49 REGION is-confined-namespace-gate */
  }
  url.searchParams.set("store", SCRATCH);
  return null;
}

/* R4 — WHERE AN ADMITTED CALLER LANDS. `{ name }` or `{ error }` (answered by `admit` as SCOPE_REFUSED, C-38.6). The
   probe class is confined to `scratch` by REFUSAL, never by silent redirection, and an absent `store=` is `scratch`
   for it; every other class lands in `scratch` when `store=scratch` is given, else `bio`. THE DAEMON CLASS IS NOT
   CONFINED, BY DECISION (REC-33): its two verbs write the REAL record's reachability and bytes, so what bounds it is
   the op table, not the namespace. A `store=` naming no namespace is refused here too (D-456), should a caller skip R1. */
export function scopeFor(cls, url) {
  const named = url.searchParams.has("store");
  const asked = url.searchParams.get("store");
  if (named && !NAMESPACES.includes(asked))
    return { error: `no namespace ${JSON.stringify(asked)} exists on this instance; the namespaces are ${NAMESPACES.join(" and ")}` };
  if (cls === "probe") return named && asked !== SCRATCH ? { error: `probe class is confined to the ${SCRATCH} namespace, refused request for ${JSON.stringify(asked)}` } : { name: SCRATCH };
  return { name: asked === SCRATCH ? SCRATCH : "bio" };
}

/* ===================================================================================================================
 * AUTHENTICATION (R5–R7)
 * =================================================================================================================== */

/* R20 (F1; K1874; K2111) — WHERE A CREDENTIAL IS READ: a request's header or body, never its address. `{ token,
   secret, inAddress }`, and it never throws, whatever `req`, `url` and `body` are:
     - `token` (a session token, an `aik-` credential, an ask's grant, a binding token): the `Authorization` header when
       it is exactly `Bearer <value>` (the scheme in any case, one space, printable characters and no space), else a JSON
       object body's non-empty string `token`. A header in any other form presents no token of its own.
     - `secret` (a review or template grant's): the JSON body's string `secret`.
     - `inAddress`: true exactly when the address names a `token` or a `secret` parameter, whatever its value and
       whether or not the header or body carries one too. Nothing is read from there: `credentialAddressGate` refuses
       the request.
   `body` is what the door parsed once (a GET has none). */
const BEARER = /^bearer ([\x21-\x7e]+)$/i;
const ADDRESS_CREDENTIALS = Object.freeze(["token", "secret"]);
function addressNames(url) {
  try {
    const q = url && url.searchParams ? url.searchParams : null;
    return q ? ADDRESS_CREDENTIALS.filter((k) => q.has(k)) : [];
  } catch { return []; }
}
export function presentedCredential({ req = null, url = null, body = null } = {}) {
  let token = null, secret = null;
  try {
    const h = req && req.headers && typeof req.headers.get === "function" ? req.headers.get("authorization") : null;
    const m = typeof h === "string" ? BEARER.exec(h) : null;
    if (m) token = m[1];
  } catch { token = null; }
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : null;
  if (!token && b && typeof b.token === "string" && b.token !== "") token = b.token;
  if (b && typeof b.secret === "string") secret = b.secret;
  return { token, secret, inAddress: addressNames(url).length > 0 };
}

/* R20 (F1; K2111, K2129) — A CREDENTIAL IN THE ADDRESS IS REFUSED BY NAME, 400 `CREDENTIAL_IN_ADDRESS` (C-38.10), the
   code's one site (K231): `control-plane` runs this directly after R1 (its R28), before any credential is judged, any
   public op runs or the store is asked. An address is kept in logs and browser history, so a credential placed there
   is no longer only its holder's; the request is refused rather than served, and the value is never compared, looked
   up, passed on or logged. The refusal names the parameters the address named (`named`, `token` and/or `secret`) and
   neither the value nor its digest (R15). `credential` is the door's `presentedCredential` answer when it has one;
   either way the address is judged. `null` or the refusal. */
export const CREDENTIAL_IN_ADDRESS = "CREDENTIAL_IN_ADDRESS";
export function credentialAddressGate(url, credential = null) {
  const named = addressNames(url);
  if (!named.length && !(credential && typeof credential === "object" && credential.inAddress === true)) return null;
  /* DEC-49 REGION is-credential-in-address */
  return { status: 400, body: { ok: false, reason: "CREDENTIAL_IN_ADDRESS", ...admissionRow("CREDENTIAL_IN_ADDRESS"),
    error: "a credential was sent in the request's address; send it in the Authorization header or the body",
    detail: `this request's web address names ${named.length ? named.map((k) => `'${k}'`).join(" and ") : "a credential"}, `
      + `and a credential or a secret is read only from the request's Authorization header (\`Bearer <value>\`) or `
      + `its JSON body, never from its address, where it is kept in logs and browser history. It was not read, `
      + `compared or looked up, and nothing was read or written.`,
    named } };
  /* END DEC-49 REGION is-credential-in-address */
}

/* The credential a gate judges: the door's `presentedCredential` answer when it passes one, else what the URL alone
   presents, which is none (R20: never the address). */
const credentialOf = (credential, url) =>
  credential && typeof credential === "object" ? credential : presentedCredential({ url });

/* R5 (REC-33, DEC-37; T35, F12) — THE BINDING CLASSES. A token equal to a binding gives its class only while the
   binding is LIVE (set, and never a published value: runtime-limits `liveToken`). Checked in the order admin, member,
   probe, daemon, so one value bound twice gives the WIDER class rather than a silent narrowing. The daemon class is the
   unattended path, not the monitor: a later unattended consumer belongs here, not in a fifth class.
   IN CONSTANT TIME: the presented value and each binding are compared as their SHA-256 digests (equal length whatever
   was sent), every byte of all four, with no early exit, and every binding's liveness is asked, so the time taken says
   neither whether a binding matched, nor which, nor where two values first differ.
   T36 (N711; K1936 Q3): NO BINDING CLASS `member` EXISTS. `MEMBER_TOKEN` stays in `BINDINGS` only as the name R5
   refuses: a value equal to a live one is `RETIRED` (`bindingOf`), gives no class (`classify` answers `null`), and is
   refused `MEMBER_TOKEN_RETIRED` by `admit`. It is still compared with the other three, so the time taken does not tell
   whether a `MEMBER_TOKEN` is bound. */
const digestOf = async (v) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(v))));
function sameDigest(a, b) {
  let d = 0;
  for (let i = 0; i < 32; i++) d |= a[i] ^ b[i];
  return d === 0;
}
const RETIRED = "retired";
const BINDINGS = Object.freeze([["ADMIN_TOKEN", "admin"], ["MEMBER_TOKEN", RETIRED], ["PROBE_TOKEN", "probe"],
                                ["DAEMON_TOKEN", "daemon"]]);
/* The binding a token is equal to, as its class, or `RETIRED` for a live `MEMBER_TOKEN`, or `null`. */
async function bindingOf(token, env) {
  if (typeof token !== "string" || token === "") return null;
  const presented = await digestOf(token);
  const verdicts = [];
  for (const [k] of BINDINGS) {
    const bound = env ? env[k] : undefined;
    const equal = sameDigest(presented, await digestOf(typeof bound === "string" ? bound : ""));
    const live = await liveToken(bound);
    verdicts.push(equal && live);
  }
  let cls = null;
  for (let i = BINDINGS.length - 1; i >= 0; i--) if (verdicts[i]) cls = BINDINGS[i][1];
  return cls;
}
export async function classify(token, env) {
  const b = await bindingOf(token, env);
  return b === RETIRED ? null : b;
}

/* The presented shape of an agent credential. Deliberately NOT the 64-hex of a session token, so "an agent credential
   that did not resolve" and "a session that did not resolve" stay two answers. */
export const AI_TOKEN_SHAPE = /^aik-[0-9a-f]{64}$/;
const SESSION_TOKEN_SHAPE = /^[0-9a-f]{64}$/;
/* G83 (K4746, K4747; runtime-limits R28): the team's room is obtained through the one helper, which passes its location
   hint and names it by its generation, so every store call of this module reaches the same room. */
const bioStore = (env) => storeStub(env, "bio");

/* R6, R20 (K2038) — HOW A LOOKUP REACHES THE STORE: in a header, never the address. `x-bio-session` carries the token
   `session` resolves, `x-bio-credential-sha` the digest `aicredentiallook` resolves; `store-door` hands each to
   credentials' map (its R9), so nothing of the credential is in the address of the store's request. */
const lookup = (env, route, header, value, query = "") =>
  bioStore(env).fetch(new Request(`http://do/${route}${query}`, { method: "GET", headers: { [header]: value } }));

/* R6 (D-199 (2), D-463) — THE PRESENTED `ai` CREDENTIAL, RESOLVED ONCE PER REQUEST against `bio`'s credential rows,
   through `credentials.aiCredentialLook` (its R15) by the store's route `aicredentiallook`, by its SHA-256 (the value
   never crosses to the store, and the digest travels in a header). Once, because the confinement (R2) needs the row before
   anything else runs and two lookups could disagree across a revocation. The SHAPE is checked before the store is
   asked. `{ cred }` (null when none is presented or none is known) or `{ silent }` (REC-52: a store that did not
   answer is not "this credential is unknown"). `credential` is the door's `presentedCredential` answer (R20); `op`,
   when given, lets a public door (R17) present nothing: whoever calls it, no credential of theirs is looked up. */
export async function aiCredentialPresented(url, env, doAnswer, { credential = null, op = null } = {}) {
  if (op !== null && PUBLIC_DOORS.includes(op)) return { cred: null };
  const t = credentialOf(credential, url).token;
  if (!t || !AI_TOKEN_SHAPE.test(t)) return { cred: null };
  const out = await doAnswer(lookup(env, "aicredentiallook", "x-bio-credential-sha", await sha256hex(t)));
  if (!out.answered) return { silent: { op: "aicredentiallook", correlation: out.correlation } };
  return { cred: out.result?.found ? out.result.credential : null };
}

/* R6 — A SIGNED-IN SESSION, RESOLVED THROUGH `credentials.session` (its R5, which owns sessions since T19, K637)
   against `bio` by the store's route `session`, the token in a header (R20). `{ sess }` (null for none) or
   `{ silent }`. (T47; credentials R65, R71 (7)) `background`, the door's mark of a request the page makes on its own
   timer, is passed on as `background=1`, so the read is no activity; it is not a credential and names none. */
async function sessionPresented(t, env, doAnswer, background = false) {
  const out = await doAnswer(lookup(env, "session", "x-bio-session", t, background === true ? "?background=1" : ""));
  if (!out.answered) return { silent: { op: "session", correlation: out.correlation } };
  return { sess: out.result?.session ?? null };
}

/* R32 (G119; K4814 (4), K4817) — ONE SESSION READ PER REQUEST. The three places that read a session (`admit`, `readerOf` and
   `liveSessionDigest`, the window's) are handed the door's one `presentedCredential` answer for the request, so that
   object is the request's key: the first read is kept, as the promise of its answer (a silence included), and the others
   of the same request take it. It holds only what the first read asked, the token, `background` and the `env` and
   `doAnswer` it was asked with; a different token, `background` mark, `env` or reader is its own read. Weakly held, so it
   lives no longer than the request; a credential presented without the door's object has nothing to key on and is read
   each time. A read that fails is dropped from the memo. `doorwindow` is not read here and stays asked (K1881). */
const sessionReads = new WeakMap();
function sessionRead(credential, t, env, doAnswer, background) {
  const bg = background === true;
  if (!credential || typeof credential !== "object") return sessionPresented(t, env, doAnswer, bg);
  const memo = sessionReads.get(credential);
  if (memo && memo.t === t && memo.bg === bg && memo.env === env && memo.doAnswer === doAnswer) return memo.looked;
  const looked = sessionPresented(t, env, doAnswer, bg);
  const kept = { t, bg, env, doAnswer, looked };
  sessionReads.set(credential, kept);
  looked.catch(() => { if (sessionReads.get(credential) === kept) sessionReads.delete(credential); });
  return looked;
}

/* REC-132 / D-422 — WHO A SESSION IS, IN TWO HALVES KEPT APART. `viewer` is what it may SEE (the founder's is the bare
   `admin`, `viewerPredicate`'s root-administrator spelling; every other session `member:<id>`); `identity` is WHO it is
   (`member:<id>`, the founder's `member:admin`), for authorship, ownership and positional facts; `member` the folded
   id. The founder is told apart by the session's ROLE, never by the folded name (`memberAdd` reserves the id). */
export function resolveSession(sess) {
  const r = sess && typeof sess.role === "string" ? sess.role : "";
  const member = r.startsWith("member:") ? r.slice(7) : r;
  return {
    viewer: r === "admin" ? "admin" : `member:${member}`,
    identity: `member:${member}`,
    member,
  };
}

/* ===================================================================================================================
 * THE AGENT CREDENTIAL'S REACH (R10, R13)
 * =================================================================================================================== */

/* THE FLOOR, AND IT IS THE WHOLE FENCE (PL-4): an `ai` credential reaches only where a MEMBER class is admitted, one
   property of the op table read live. The unattended verbs carry no member class by construction, so they are outside
   every scope anybody can author, and no row of the table names `ai` (op-declarations R2), so this is the only door.
   D-586: an act R12 refuses to every bearer (the §4 governance acts, the group-identity acts) is a named
   administrator's own session act, so no agent reaches it. REC-159: a row that bounds machine credentials by
   `machineClasses` hands an agent nothing. A public op (`classes: null`) answers false: the fail-closed direction. */
export function aiReachesAsMember(spec, op) {
  if (GOVERNANCE_ACTIONS.includes(op) || IDENTITY_ACTIONS.includes(op)) return false;
  return !!spec && Array.isArray(spec.classes) && spec.classes.includes("member")
    && !Array.isArray(spec.machineClasses);
}

/* R26: the reads that answer who a source is (`sources` R1, R9); an agent reaches them only by a declared scope. */
const WHO_A_SOURCE_IS = Object.freeze(["sourceof", "sourcerung"]);

/* R10 — THE GATE ON EVERY CALL. READS ARE THE FLOOR AND WRITES ARE THE DECLARATION: an agent reaches every non-mutating
   op a member reaches (what it SEES is bounded by the viewer stamped from its principal), and a mutating op must also
   be among its declared writes. The floor is re-evaluated here on every call, with the gate's own code, because a row
   can outlive the rule that admitted it. THERE IS NO OP NAME IN THIS FUNCTION: the fence is a shape. `{ refusal }`
   (built whole, `op` and `cls` included, so the admission passes it on unchanged: N411) or `{ ok, viewer }`.
   T47 (R23; K3043, credentials R63): a credential whose row carries a `run` (minted for one segment of a member's run)
   writes only to that run: a mutating op is admitted only when the request names that run, and every place it names
   one (`named`, the body's `run` and the query's) names the same; a write naming another run, or none, is refused
   AI_BEYOND_TASK_SCOPE. Its reads are the floor above, as every agent's. */
export function aiTaskScope(cred, op, spec, { named = [] } = {}) {
  /* DEC-49 REGION is-ai-task-scope */
  if (cred.revoked)
    return { refusal: { status: 403, body: { ok: false, reason: "AI_CREDENTIAL_REVOKED", ...aiScopeRow("AI_CREDENTIAL_REVOKED"),
      detail: `credential '${String(cred.tokenId).slice(0, 60)}' was withdrawn on ${cred.revokedAt} by `
      + `${cred.revokedBy}. The entry and the date are kept rather than deleted, so what it did while `
      + `it was live stays readable.`,
      tokenId: cred.tokenId, revokedAt: cred.revokedAt, op, cls: "ai" } } };

  /* T35 (K1934 (5); credentials R42): an EXPIRED credential is refused by name, as a revoked one is, before any scope
     is judged; one both revoked and expired was answered above. 401: it no longer authenticates anybody. */
  if (cred.expired === true)
    return { refusal: { status: 401, body: { ok: false, reason: "AI_CREDENTIAL_EXPIRED", ...aiScopeRow("AI_CREDENTIAL_EXPIRED"),
      detail: `credential '${String(cred.tokenId).slice(0, 60)}' expired on ${cred.expiresAt}. An agent credential `
      + `lives for the days it was minted with and is never renewed: a member mints a new one to replace it, and `
      + `the entry stays, so what it did while it was live stays readable.`,
      tokenId: cred.tokenId, expiresAt: cred.expiresAt ?? null, op, cls: "ai" } } };

  if (!aiReachesAsMember(spec, op))
    return { refusal: { status: 403, body: { ok: false, reason: "AI_BEYOND_TASK_SCOPE", ...aiScopeRow("AI_BEYOND_TASK_SCOPE"),
      detail: localize("admission.index.no_member_of_this_team", "no member of this team reaches '{String}', so no declared scope reaches it either. An agent is confined to what a member could do themselves, which is a property of the operation rather than a list kept anywhere.", { String: String(String(op).slice(0, 60)) }),
      op, tokenId: cred.tokenId, taskScope: cred.taskScope, declared: cred.writes, cls: "ai" } } };

  /* R26 (T48; N1045; K3150): a read that answers WHO A SOURCE IS is no part of the floor. A member's reach alone never
     admits an agent to it; the credential's declared scope must name the op (R13), as a write must. */
  if (!spec.mutating && WHO_A_SOURCE_IS.includes(op) && !cred.writes.includes(op))
    return { refusal: { status: 403, body: { ok: false, reason: "AI_BEYOND_TASK_SCOPE", ...aiScopeRow("AI_BEYOND_TASK_SCOPE"),
      detail: `'${String(op).slice(0, 60)}' answers who a source is, so a member's reach alone does not hand it `
      + `to an agent: credential '${String(cred.tokenId).slice(0, 60)}' declares the task scope `
      + `'${cred.taskScope}', which does not name it. Naming it is an authored, dated act by a member on the `
      + `record (D-199 (2)/(3)), not something the agent holding it can ask for.`,
      op, tokenId: cred.tokenId, taskScope: cred.taskScope, declared: cred.writes, cls: "ai" } } };

  if (spec.mutating && !cred.writes.includes(op))
    return { refusal: { status: 403, body: { ok: false, reason: "AI_BEYOND_TASK_SCOPE", ...aiScopeRow("AI_BEYOND_TASK_SCOPE"),
      detail: `credential '${String(cred.tokenId).slice(0, 60)}' declares the task scope '${cred.taskScope}', `
      + `whose writes are ${cred.writes.length ? cred.writes.join(", ") : "(none)"}. Widening it is an `
      + `authored, dated act by a member on the record (D-199 (2)/(3)), not something the agent holding `
      + `it can ask for.`,
      op, tokenId: cred.tokenId, taskScope: cred.taskScope, declared: cred.writes, cls: "ai" } } };

  if (spec.mutating && boundRun(cred) !== null && !namesOnly(named, boundRun(cred)))
    return { refusal: { status: 403, body: { ok: false, reason: "AI_BEYOND_TASK_SCOPE", ...aiScopeRow("AI_BEYOND_TASK_SCOPE"),
      detail: `credential '${String(cred.tokenId).slice(0, 60)}' was made for one run, and writes only to it. This `
      + `request ${named.length ? "names another run" : "names no run"}, so nothing was written. A run's `
      + `credential is made by the plane when the member starts that run, and ends with it.`,
      op, tokenId: cred.tokenId, taskScope: cred.taskScope, declared: cred.writes, cls: "ai", run: boundRun(cred) } } };
  /* END DEC-49 REGION is-ai-task-scope */

  return { ok: true, viewer: aiViewerOf(cred) };
}

/* R30 (T50; N1186, K3557; credentials R79, membership R149) — THE VIEWER AN `ai` CREDENTIAL IS SEEN WITH. A credential
   minted in a project makes the viewer `credentials.aiCredentialLook` answers: `membership.projectViewer` of the
   principal's own viewer, so what the caller reads is what membership R149 admits within that project. The look already
   answers it as the principal; this spells it once more from the `project` beside it, which changes nothing a look has
   already carried (R149: a viewer that carries a project is never re-scoped) and keeps a credential row whose principal
   came without it from being read wider than its project. No project, or a principal R149 leaves alone (an
   organisation key's `class:ai`): the principal as it is. */
export function aiViewerOf(cred) {
  const principal = cred.principal;
  return typeof cred.project === "string" && cred.project !== "" ? projectViewer(principal, cred.project) : principal;
}

/* R23: the run a credential's row is bound to, or null for a credential bound to none. */
const boundRun = (cred) => (cred && typeof cred.run === "string" && cred.run !== "" ? cred.run : null);
/* R23: true exactly when at least one run is named and every one named is `run`. */
const namesOnly = (named, run) => Array.isArray(named) && named.length > 0 && named.every((n) => n === run);
/* R23: every run a request names, the body's `run` and the query's (a body's value that is not a string is named
   as itself, so it never equals a run). Absent, null or empty names none. */
export function runsNamed({ url = null, body = null } = {}) {
  const out = [];
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : null;
  if (b && Object.hasOwn(b, "run") && b.run !== null && b.run !== undefined && b.run !== "")
    out.push(b.run);
  try {
    const q = url && url.searchParams ? url.searchParams.getAll("run") : [];
    for (const v of q) if (v !== "") out.push(v);
  } catch { /* an address that cannot be read names none */ }
  return out;
}

/* R13 — THE DECLARATION, judged once when a member AUTHORS it, apart from the gate (PL-4: one predicate at two points
   leaves one code unreachable). An op no spec declares is a sentence nothing enforces (C-29.8); an op no member
   reaches is outside every scope (C-29.9), the governance and identity acts included. `{ refusal }` or `{ writes }`
   (trimmed, de-duplicated, sorted). The detail for C-29.9 says which property of the op's row refused it (REC-162). */
export function aiScopeDeclaration(writes) {
  const asked = Array.isArray(writes) ? writes.map((w) => String(w ?? "").trim()).filter(Boolean) : [];

  /* DEC-49 REGION is-ai-scope-declaration */
  for (const op of asked) {
    if (!Object.prototype.hasOwnProperty.call(OPS, op))
      return { refusal: { status: 403, body: { ok: false, reason: "AI_SCOPE_UNKNOWN_OP", ...aiScopeRow("AI_SCOPE_UNKNOWN_OP"),
        detail: `'${op.slice(0, 60)}' is not an operation this instance performs. A scope naming something `
        + `nothing recognises would sit in the record looking like a permission and meaning nothing, `
        + `which is exactly what declaring the scope on the record rather than in a settings row is `
        + `for (D-199 (2)).`, op } } };
    if (!aiReachesAsMember(OPS[op], op))
      return { refusal: { status: 403, body: { ok: false, reason: "AI_SCOPE_BEYOND_MEMBER_REACH", ...aiScopeRow("AI_SCOPE_BEYOND_MEMBER_REACH"),
        detail: Array.isArray(OPS[op].machineClasses)
          ? `'${op.slice(0, 60)}' is reached by a member only from that member's own signed-in `
            + `session, and no agent credential is among the credentials it admits, so it cannot be `
            + `handed to an agent. This is a property of the operation and not a list of forbidden `
            + `ones: its OPS row names the credentials that reach it, and an agent's is not one.`
          : localize("admission.index.op_is_not_reachable_by", "'{op}' is not reachable by a member of this team, so it cannot be handed to an agent. This is a property of the operation and not a list of forbidden ones: the unattended worker's own verbs carry no member class by construction, so they are outside every scope anybody can author.", { op: String(op.slice(0, 60)) }),
        op, classes: Array.isArray(OPS[op].classes) ? OPS[op].classes : null } } };
  }
  /* END DEC-49 REGION is-ai-scope-declaration */

  return { writes: [...new Set(asked)].sort() };
}

/* R13 (D-463, C-29.10) — WHAT MAY BE WRITTEN AS A CONFINEMENT. `scratch` is the only one, matched EXACTLY (nothing
   trimmed or folded); `bio` is refused with the rest, because a row "confined to bio" would be a fence that holds
   nothing. ABSENT (omitted, null, undefined) is the only silence and mints an unconfined credential; a present empty
   string is a value and is refused. `{ refusal }` or `{ confinedTo }`. */
export function aiConfinementDeclaration(confinedTo) {
  if (confinedTo === null || confinedTo === undefined) return { confinedTo: null };
  const asked = String(confinedTo);

  /* DEC-49 REGION is-ai-confinement-declaration */
  if (asked !== SCRATCH)
    return { refusal: { status: 403, body: { ok: false, reason: "AI_CONFINEMENT_NOT_SCRATCH", ...aiScopeRow("AI_CONFINEMENT_NOT_SCRATCH"),
      detail: `'${asked.slice(0, 80)}' is not a confinement a credential can carry. The one namespace a credential `
      + `may be bound to for its whole life is ${JSON.stringify(SCRATCH)}; ${JSON.stringify("bio")} is where `
      + `every unconfined credential already lands, so recording it as a confinement would put a fence in the `
      + `record that holds nothing (D-199 (2)). The name is matched exactly, so a capital letter or a stray space `
      + `is a different name. Leave the field out altogether to mint an unconfined credential.`,
      asked: asked.slice(0, 80), confinements: [SCRATCH] } } };
  /* END DEC-49 REGION is-ai-confinement-declaration */

  return { confinedTo: SCRATCH };
}

const hexOf = (raw) => [...raw].map((x) => x.toString(16).padStart(2, "0")).join("");

/* R13 — THE MINT'S HALF THAT IS ADMISSION'S. The declaration and the confinement are judged BEFORE anything is written
   (a scope the gate would refuse must not enter the record at all), then the credential's value is generated HERE:
   `aik-` and 32 random bytes in hex. The door forwards `secretSha` and the normalised `writes` and `confinedTo` (never
   the caller's spelling) to credentials' mint (its R12) and returns `secret` once, in the minting answer only; the
   store never holds the value. `{ refusal }` (with `op` and `cls`) or `{ secret, secretSha, writes, confinedTo }`. */
export async function aiCredentialMint(asked, cls) {
  const a = asked && typeof asked === "object" && !Array.isArray(asked) ? asked : {};
  const declared = aiScopeDeclaration(a.writes);
  if (declared.refusal) return { refusal: { status: declared.refusal.status, body: { ...declared.refusal.body, op: "aicredentialmint", cls } } };
  const confinement = aiConfinementDeclaration(a.confinedTo);
  if (confinement.refusal) return { refusal: { status: confinement.refusal.status, body: { ...confinement.refusal.body, op: "aicredentialmint", cls } } };
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const secret = `aik-${hexOf(raw)}`;
  return { secret, secretSha: await sha256hex(secret), writes: declared.writes, confinedTo: confinement.confinedTo };
}

/* R13 (REC-126, DEC-31) — A REVIEW GRANT'S READ SECRET, on the agent credential's rule: 32 random bytes, base64url,
   behind a version prefix; generated here, returned once in the granting answer, passed on only as its SHA-256. It is a
   READ credential only: `classify` never admits it. */
export async function reviewGrantSecret() {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const secret = "rv1_" + btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { secret, secretSha: await sha256hex(secret) };
}

/* ===================================================================================================================
 * ADMISSION, IN ORDER (R8–R11)
 * =================================================================================================================== */

/* R8 (D-270, REC-162) — THE SESSION GATE, three sentences where one was false for two. A REFUSAL MAY STATE ONLY WHAT
   THE SYSTEM CAN SUPPORT, ordered from most to least supportable: (b) another session's set holds the op — about THIS
   caller, always sayable, naming which session reaches it (`SESSION_OPS.admin` is the founder's password session
   alone; an enrolled administrator signs in as a member); (a) a recorded decision reserves it to a credential — a
   design claim, sayable only with its citation in `recorded`; (c) neither — the fact, and no invented rationale, since
   a false rationale suppresses its own bug report. `error` keeps the legacy sentence beside each code. `capture`'s GET
   is a read. Not one op moves between sets here: only what a caller is TOLD. `null` or a refusal. `tables` are
   op-declarations' own (`SESSION_OPS`, `UNATTENDED_BY_DECISION`), frozen data (its R5); a caller may hand in others of
   the same shape, so an arrangement the declared tables do not hold today (an op only a member's set holds) is still
   driven. */
const DECLARED = Object.freeze({ SESSION_OPS, UNATTENDED_BY_DECISION });
export function sessionOpGate(kind, op, spec, method, tables = DECLARED) {
  const { SESSION_OPS, UNATTENDED_BY_DECISION } = tables;
  if (!spec.mutating || (op === "capture" && method === "GET") || SESSION_OPS[kind].has(op))
    return null;

  /* DEC-49 REGION is-session-op-gate */
  if (SESSION_OPS.admin.has(op))
    return { status: 403, body: { ok: false, reason: "SESSION_ROLE_CANNOT_REACH_OP", ...admissionRow("SESSION_ROLE_CANNOT_REACH_OP"),
      error: "this operation is reserved to the founder's session",
      detail: `'${String(op).slice(0, 60)}' is reachable from a signed-in session, but only the founder's: `
      + `the password session made when this instance was claimed with its root credential. This is `
      + `a member's session, which is what every enrolled member signs in with, an administrator of `
      + `this team included — so an administrator's session is refused this exactly as this one is, `
      + `and nothing here says whether you are one. There is no machine credential to go and find: `
      + `the founder performs this from their own browser.`,
      op, session: kind, reachedBy: "founder" } };
  if (SESSION_OPS.member.has(op))
    return { status: 403, body: { ok: false, reason: "SESSION_ROLE_CANNOT_REACH_OP", ...admissionRow("SESSION_ROLE_CANNOT_REACH_OP"),
      error: "this operation is reserved to a member's own session",
      detail: `'${String(op).slice(0, 60)}' is reachable from a signed-in session, but only a member's `
      + `own, and this is the founder's session. There is no machine credential to go and find: `
      + `a member performs this from their own browser.`,
      op, session: kind, reachedBy: "member" } };
  const recorded = UNATTENDED_BY_DECISION[op];
  if (recorded)
    return { status: 403, body: { ok: false, reason: "MACHINE_CREDENTIAL_REQUIRED", ...admissionRow("MACHINE_CREDENTIAL_REQUIRED"),
      error: "this operation requires a machine credential, not a signed-in session",
      detail: localize("admission.index.string_is_on_the_unattended", "'{String}' is on the unattended path. No signed-in session of any role reaches it, the founder's included; it answers to a credential held in the hosting account. This instance holds a decision on record saying so, cited in 'recorded' so you can check it. Nothing here says a machine is trusted more than a person (DEC-52 rules the opposite): it says which credential this verb is addressed to.", { String: String(String(op).slice(0, 60)) }),
      op, recorded } };
  return { status: 403, body: { ok: false, reason: "SESSION_ROUTE_NOT_RECORDED", ...admissionRow("SESSION_ROUTE_NOT_RECORDED"),
    error: "no signed-in session reaches this operation, and no decision on record says why",
    detail: `'${String(op).slice(0, 60)}' is reachable by no session of any role, and this instance holds `
    + `no recorded decision that it is not meant for a person. The plane will not invent one: a `
    + `member told an absence is a decision stops reporting it as the gap it may well be. If you `
    + `expected to perform this, that expectation is worth filing rather than working around.`,
    op } };
  /* END DEC-49 REGION is-session-op-gate */
}

/* R11 (C-38.5) — THE ONE SITE OF `NOT_CAPABLE`. A session missing the capability an act needs, naming `needs` and the
   capabilities it holds (sorted), with a sentence that names no capability (the surface renders `needs`). Both of its
   conditions answer through here: the op's own `NEEDS` (`admit`) and a project's creation (`projectCreationGate`). */
function notCapable(op, needs, caps, detail) {
  /* DEC-49 REGION is-not-capable */
  return { status: 403, body: { ok: false, reason: "NOT_CAPABLE", ...admissionRow("NOT_CAPABLE"),
           op, needs, held: [...caps].sort(), detail } };
  /* END DEC-49 REGION is-not-capable */
}

/* R11 (section 5) — A PROJECT IS CREATED BY PROMOTING A BUNDLE WITH NO BASE WHOSE TYPE IS `project`, so there is no op
   for `NEEDS` to name: the door asks this in op=promote's stamp block, from the payload, for a session's creation.
   `caps` is the session's capability set (`caller.caps`). `null` when it holds `create_projects`. */
export function projectCreationGate(caps) {
  if (caps && caps.has("create_projects")) return null;
  return notCapable("promote", "create_projects", caps || [],
    "creating a project needs the create-projects capability. This account may still "
    + "contribute to projects it has been invited to, if it holds contribute.");
}

/* R5–R11 — THE ADMISSION (REC-79, C-38): every refusal a caller meets before their op runs, in this order, for a gated
   op (`spec.classes` a list; the namespace gates R1–R3 and the public ops come first, at the door):
     a binding class (R5; the retired member key refused MEMBER_TOKEN_RETIRED), else the presented agent credential (R6, `presented` from `aiCredentialPresented`), else a
     session token resolved (R6) and judged: `export` refused to any session but the founder's (R8's ROOT_OF_TRUST_REQUIRED, section 8.1), then the
     session gate (R8); no class (R7); the agent's task scope (R10) or the class list (R9: `machineClasses` for a caller
     not arriving by a session, where the spec gives it); the session's capability (R11); the landing (R4).
   Answers `{ refusal }`, `{ silent }` (the session lookup's store did not answer) or `{ caller }`:
     `{ cls, viaSession, member, viewer, identity, rights, caps, aiCred, storeName }` — the session's halves and
     capabilities only for a session (`caps` a Set), `aiCred` only for an agent, `storeName` the namespace it lands in.
   `tables`, as `sessionOpGate`'s. `credential` is the door's `presentedCredential` answer (R20), the one credential
   judged here; absent, the URL's alone.
   T47 (R23–R25): `body` is the request's parsed JSON body, which the door already reads (R20), for the run a write
   names (R23) and the argument that makes an act ask the password again (R25); `background` marks a request the page
   makes on its own timer (the session read is then no activity, credentials R71 (7)); `reauthActs` is
   op-declarations' `REAUTH_ACTS` (its R58), and a caller may hand in another of the same shape, as `tables`. In order,
   after the session resolves: a locked session asking any op but `unlock`, `reauth` and `signout` is answered
   credentials' `SESSION_LOCKED` (R24), before `export`'s refusal and the session gate; after the capability (R11), an
   act `reauthActs` names with its argument is answered credentials' `REAUTH_DUE` unless the session's re-ask window is
   open (R25), asked of the store as `reauthdue` with the token in a header, a silence when it does not answer. */
export async function admit({ url, env, op, spec, method, presented, doAnswer, tables = DECLARED, credential = null,
                              body = null, background = false, reauthActs = declaredReauthActs() }) {
  const t = credentialOf(credential, url).token;
  const bound = await bindingOf(t, env);
  let cls = bound === RETIRED ? null : bound;
  let viaSession = false, sess = null, halves = { member: null, viewer: null, identity: null };
  let aiCred = null, dueEarly = null;
  if (!cls && bound !== RETIRED && presented?.cred) { cls = "ai"; aiCred = presented.cred; }

  /* DEC-49 REGION is-admission
     A store silence in here (`{ silent }`) is not an admission refusal: the plane declines to say anything about who
     somebody is when it could not look (REC-52), and the door answers it with its own code. */
  /* R5 (T36; N711, K1936 Q3): the shared member key is retired. A live `MEMBER_TOKEN` presented gives no class and is
     refused by name, before anything is looked up, read or written; a value once held and no longer bound is any
     unknown credential (R7). 401: it authenticates nobody. */
  if (bound === RETIRED)
    return { refusal: { status: 401, body: { ok: false, reason: "MEMBER_TOKEN_RETIRED", ...admissionRow("MEMBER_TOKEN_RETIRED"),
      error: "the shared member key is retired",
      detail: "this request presented the team's shared member key, which is retired: it no longer signs anybody in, "
            + "and nothing was read or written. A member signs in with their own password, and an agent uses an "
            + "agent credential a member creates for it." } } };
  if (!cls) {
    if (t && SESSION_TOKEN_SHAPE.test(t)) {
      /* R33 (fix round 10; K5170; ratification R60): an act that asks the password again asks the store whether it is due
         in the same hop as the session read, the two issued together, not one after the other. It is asked only for an
         act R29 does not put to the roster first (a member who may not take that act is never asked, so those keep their
         order); its answer is used only if the gates between the session and R25 let the request on, and a request one
         of them refuses has the answer dropped unread. */
      const dueAsked = reauthAsked(reauthActs, op, { url, body }) && !administratorsOwnActs().has(op)
        ? reauthDuePresented(t, env, doAnswer) : null;
      if (dueAsked) dueAsked.catch(() => {});
      const looked = await sessionRead(credential, t, env, doAnswer, background);
      if (looked.silent) return { silent: looked.silent };
      if (looked.sess) {
        const kind = looked.sess.role === "admin" ? "admin" : "member";
        /* R24 (K3084; credentials R65, R71 (1)): a locked session serves only its unlocking and its signing out; any
           other op, a read included, is answered credentials' refusal as it gives it. 401: the session authenticates
           nobody for it until it is unlocked. */
        if (looked.sess.locked === true && !LOCKED_SESSION_OPS.includes(op))
          return { refusal: { status: 401, body: Credentials.sessionLockedRefusal() } };
        /* Section 8.1 (Membership v2 §4.6; R8), before the session gate so the answer states the actual rule: the root of
           trust has two forms, the ADMIN_TOKEN holder's bearer (admitted by R9, never here) and the founder's session,
           the one the claim made from that token (session kind `admin`). Every other session, an enrolled
           administrator's included, is refused. */
        if (op === "export" && kind !== "admin")
          return { refusal: { status: 403, body: { ok: false, reason: "ROOT_OF_TRUST_REQUIRED", ...admissionRow("ROOT_OF_TRUST_REQUIRED"), op,
            detail: "a full working-corpus export needs the root of trust: the ADMIN_TOKEN-class credential, or the "
                  + "founder's own session, which the claim made from it. A member's session is neither, and "
                  + "neither is in-app administrator status: an administrator signs in as a member. The "
                  + "published record needs no credential at all: see op=publishedmanifest." } } };
        const gated = sessionOpGate(kind, op, spec, method, tables);
        if (gated) return { refusal: gated };
        cls = kind;
        sess = looked.sess;
        halves = resolveSession(sess);
        viaSession = true;
        dueEarly = dueAsked;
      }
    }
  }
  if (!cls) return { refusal: { status: 401, body: { ok: false, reason: "NOT_AUTHENTICATED", ...admissionRow("NOT_AUTHENTICATED"),
    error: "unauthenticated" } } };
  /* PL-11 / D-199 (1): CLASS PLUS SCOPE, and for the `ai` class the scope is the whole of it (no row names `ai`). Its
     refusal is built whole inside `aiTaskScope`'s own region and passed on as it is (N411). */
  if (cls === "ai") {
    const scoped = aiTaskScope(aiCred, op, spec, { named: runsNamed({ url, body }) });
    if (scoped.refusal) return { refusal: scoped.refusal };
  } else if (!(viaSession || !Array.isArray(spec.machineClasses) ? spec.classes : spec.machineClasses).includes(cls)) {
    /* REC-159: a row carrying `machineClasses` judges a caller that did NOT arrive by a session against THAT list. */
    return { refusal: { status: 403, body: { ok: false, reason: "CLASS_FORBIDDEN", ...admissionRow("CLASS_FORBIDDEN"),
      error: "forbidden for token class", op, cls } } };
  }
  /* Section 5: only a SESSION carries capabilities; a binding class holds none and is bounded by the class list.
     `capture`'s GET is a read. */
  const caps = viaSession ? new Set(sess.capabilities || []) : null;
  if (viaSession) {
    const needs = NEEDS[op];
    if (needs && !(op === "capture" && method === "GET") && !caps.has(needs))
      return { refusal: notCapable(op, needs, caps,
        `this account does not hold the ${needs} capability. Capabilities are set by an `
        + `administrator, so ask one to grant it rather than looking for another route.`) };
    /* R25 (K3084; credentials R66, R71 (2); op-declarations R58): the password asked again */
    if (reauthAsked(reauthActs, op, { url, body })) {
      /* R29 (T50; N1179; membership R84): an administrator's own act is asked of the roster first, so a member who may not
         take it is never asked to sign in again for it. Membership's one answer, `NOT_AN_ADMIN`; nothing is asked of the store. */
      if (sess.administer !== true && administratorsOwnActs().has(op))
        return { refusal: { status: 403, body: notAnAdmin(halves.member, op) } };
      const due = await (dueEarly ?? reauthDuePresented(t, env, doAnswer));
      if (due.silent) return { silent: due.silent };
      if (due.refusal) return { refusal: { status: 403, body: due.refusal } };
    }
  }
  const scope = scopeFor(cls, url);
  if (scope.error) return { refusal: { status: 403, body: { ok: false, reason: "SCOPE_REFUSED", ...admissionRow("SCOPE_REFUSED"),
    error: scope.error, tokenClass: cls } } };
  /* END DEC-49 REGION is-admission */

  return { caller: { cls, viaSession, member: halves.member, viewer: halves.viewer, identity: halves.identity,
                     rights: sess, caps, aiCred, storeName: scope.name } };
}

/* R24 — THE OPS A LOCKED SESSION IS ADMITTED TO: its unlocking with the password, the password asked again (which
   also unlocks, credentials R71 (2)) and its signing out. */
export const LOCKED_SESSION_OPS = Object.freeze(["unlock", "reauth", "signout"]);

/* R25 — WHICH ACTS ASK THE PASSWORD AGAIN: op-declarations' `REAUTH_ACTS` (its R58, R62, R63; K3143), read live from
   its module (a namespace import, so this module loads whether or not the table is declared yet), an empty table
   while it declares none. An entry is `op → null` (every call of the op asks) or `op → { field, values }` (the body's
   `field`, else the query's, being one of `values`; `values: null` the field given at all, any value). */
function declaredReauthActs() {
  const t = OP_DECLARATIONS.REAUTH_ACTS;
  return t && typeof t === "object" ? t : {};
}
function argumentOf({ url, body }, field) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : null;
  if (b && Object.hasOwn(b, field) && b[field] !== null && b[field] !== undefined && b[field] !== "") return b[field];
  try {
    const q = url && url.searchParams ? url.searchParams.get(field) : null;
    return q !== null && q !== "" ? q : undefined;
  } catch { return undefined; }
}
/* R25: true exactly when `acts` names `op` with the request's argument. Never throws: an entry of any other shape asks
   the password (the weighty reading). */
export function reauthAsked(acts, op, { url = null, body = null } = {}) {
  if (!acts || typeof acts !== "object" || typeof op !== "string" || !Object.hasOwn(acts, op)) return false;
  const e = acts[op];
  try {
    if (e && typeof e === "object" && typeof e.field === "string") {
      const v = argumentOf({ url, body }, e.field);
      if (v === undefined) return false;
      return !Array.isArray(e.values) || e.values.map(String).includes(String(v));
    }
  } catch { return true; }
  return true;
}
/* R29 (T50; N1179; op-declarations R58, R62) — THE ADMINISTRATOR'S OWN ACTS, read from op-declarations and held nowhere
   here: `GOVERNANCE_ACTIONS` and `CUSTODIAL_ACTIONS`, and every op its families declare of kind `admin` or `roster` (an act
   its owner asks of the roster, `NOT_AN_ADMIN`). An op added to any of them is covered with no change here. */
function administratorsOwnActs() {
  const own = new Set([...GOVERNANCE_ACTIONS, ...CUSTODIAL_ACTIONS]);
  for (const f of Object.values(OP_FAMILIES))
    for (const [op, kind] of Object.entries(f.kinds)) if (kind === "admin" || kind === "roster") own.add(op);
  return own;
}
/* R25: credentials' `reauthDue({token})` (its R71 (2)), asked of `bio`'s store by the internal route `reauthdue`, the
   session's token in the `x-bio-session` header and nothing in the address (R20). `{ refusal }` (credentials' row as
   it gives it), `{}` while the window is open, or `{ silent }` when the store does not answer or answers in no form
   credentials gives (REC-52: never taken as the window open). */
async function reauthDuePresented(t, env, doAnswer) {
  const out = await doAnswer(lookup(env, "reauthdue", "x-bio-session", t));
  if (!out.answered || !out.result || typeof out.result !== "object" || !Object.hasOwn(out.result, "due"))
    return { silent: { op: "reauthdue", correlation: out.correlation } };
  const due = out.result.due;
  if (due === null) return {};
  if (due && typeof due === "object" && due.ok === false && due.code === "REAUTH_DUE") return { refusal: due };
  return { silent: { op: "reauthdue", correlation: out.correlation } };
}

/* R12 (D-136 applying D-421; REC-164) — THE BEARER FENCES. A bearer (any caller not arriving by a session) asking for a
   §4 governance act is refused C-32.17, and for a group-identity act C-64.4, each naming its class. THE PREDICATE IS HOW
   THE CALLER ARRIVED, NOT WHICH TOKEN IT HELD, so every bearer class, and one added tomorrow, is refused, and no class
   list appears here to go stale. A fence and not only the roster's NOT_AN_ADMIN, because that refusal's sentence would
   be false here: a token is not a member who failed to be an administrator. The door asks this after `admit` and
   before any handler (control-plane R28). `null` or a refusal. */
export function bearerFence(op, caller) {
  if (caller.viaSession) return null;
  const cls = caller.cls;
  /* DEC-49 REGION is-operator-governance-act */
  if (GOVERNANCE_ACTIONS.includes(op))
    return { status: 403, body: { ok: false, reason: "OPERATOR_TOKEN_CANNOT_GOVERN",
      ...operatorFenceRow("OPERATOR_TOKEN_CANNOT_GOVERN"), op, tokenClass: cls,
      detail: `section 4 governance is a named administrator's own act, delivered through that `
            + `administrator's own signed-in session. The credential that asked is the operator's `
            + `\`${cls}\`-class bearer token, which holds no position on the roster: it cannot be `
            + `one of the administrators whose consensus §4.7 requires, and a vote it delivered `
            + `would be attributed to whoever the caller named. Sign in as the administrator and `
            + `do it there (D-136, applying D-421).` } };
  /* END DEC-49 REGION is-operator-governance-act */
  /* DEC-49 REGION is-group-identity-session */
  if (IDENTITY_ACTIONS.includes(op))
    return { status: 403, body: { ok: false, reason: "GROUP_IDENTITY_NEEDS_SESSION",
      ...identityFenceRow("GROUP_IDENTITY_NEEDS_SESSION"), op, tokenClass: cls,
      detail: `the team's display name and its domain claim are set by a named administrator's own signed-in `
            + `session, and the record names who set each one (Publication §7). The credential that asked is the `
            + `operator's \`${cls}\`-class bearer token, which holds no place on the roster. Nothing was changed.` } };
  /* END DEC-49 REGION is-group-identity-session */
  return null;
}

/* ===================================================================================================================
 * WHO IS ASKING, FOR THE DOOR'S STAMPS AND THE PUBLIC READS
 * =================================================================================================================== */

/* THE VIEWER AN ADMITTED CALLER IS STAMPED WITH (D-15, D-199 (4)): a session's viewer; an agent's PRINCIPAL (a
   member-scoped key sees what its member sees, an organisation key what an instance credential sees); a binding class
   `class:<cls>`. N407 (K649 (4)): an agent's viewer CARRIES ITS CREDENTIAL, `{ stamp, aiCred }`, because a member-scoped
   agent's stamp is its minter's (`member:<minter>`) and cannot be told from the member by its stamp; ratification R18's
   pre-flight reads `aiCred` and holds the agent to the machine fences. `carry: false` answers the stamp alone (a query
   parameter is a string). */
export function callerViewer(caller, { carry = true } = {}) {
  if (caller.viaSession) return caller.viewer;
  if (caller.cls === "ai") return carry ? { stamp: aiViewerOf(caller.aiCred), aiCred: caller.aiCred } : aiViewerOf(caller.aiCred);
  return `${MACHINE_CLASS_PREFIX}${caller.cls}`;
}

/* REC-130 / REC-163 — WHO IS ASKING, FOR A PUBLIC OP THAT ANSWERS WORKING MATERIAL ONLY TO SOME (op=instancegroup's
   whole row, op=groupidentity's claim, an unsigned case document, a review copy read without a secret). IT NEVER
   REFUSES: an absent, unknown, expired or out-of-scope credential is no one (`""`), so a caller without standing cannot
   tell "unsigned" from "absent". A binding class stands as `class:<cls>` only when `OPS.index` admits it and R4 lands it
   in the store this op reads (so `daemon`, two verbs, and `probe` outside scratch read as strangers); a session as its
   viewer; an agent as its principal when R10 admits it to `index`. `cls` beside the viewer names the class the caller
   would carry through the gate. The only non-answer is a store silence, `{ silent }`. `presented` is the front door's
   `aiCredentialPresented` answer's `cred` (one lookup, one row); `undefined` asks the store here. `credential`, as
   `admit`'s (R20). */
export async function readerOf(url, env, storeName, presented, doAnswer, credential = null, { background = false } = {}) {
  const c = credentialOf(credential, url);
  const t = c.token;
  if (!t) return { viewer: "" };
  const bound = await bindingOf(t, env);
  /* R5 (T36): the retired member key is no one, and nothing is looked up for it */
  if (bound === RETIRED) return { viewer: "" };
  const cls = bound;
  if (cls) {
    const scope = scopeFor(cls, url);
    const inScope = OPS.index.classes.includes(cls) && !scope.error && scope.name === storeName;
    return { viewer: inScope ? `${MACHINE_CLASS_PREFIX}${cls}` : "", cls };
  }
  if (AI_TOKEN_SHAPE.test(t)) {
    let cred = presented;
    if (cred === undefined) {
      const looked = await aiCredentialPresented(url, env, doAnswer, { credential: c });
      if (looked.silent) return { silent: looked.silent };
      cred = looked.cred;
    }
    const scoped = cred ? aiTaskScope(cred, "index", OPS.index) : null;
    return { viewer: scoped && !scoped.refusal ? scoped.viewer : "", cls: "ai" };
  }
  if (SESSION_TOKEN_SHAPE.test(t)) {
    const looked = await sessionRead(credential, t, env, doAnswer, background);
    if (looked.silent) return { silent: looked.silent };
    /* R24 (T47): a locked session reads nothing until it is unlocked, so it is no one here */
    if (!looked.sess || looked.sess.locked === true) return { viewer: "" };
    return { viewer: resolveSession(looked.sess).viewer, cls: looked.sess.role === "admin" ? "admin" : "member" };
  }
  return { viewer: "" };
}

/* ===================================================================================================================
 * WHO IS CALLING, AND THE DOOR'S WINDOW (R21); THE SECURITY TALLY (R22)
 * =================================================================================================================== */

/* R21 (F4; K1881; DEC-166) — WHO IS CALLING IS KNOWN ONLY AS A COUNTRY AND A KEYED FINGERPRINT. `countryOf` answers
   Cloudflare's two-character label for the request (`request.cf.country`), or `null`; nothing else of where the
   request came from is read. */
export function countryOf(req) {
  try {
    const c = req && req.cf ? req.cf.country : null;
    return typeof c === "string" && /^[A-Z0-9]{2}$/.test(c) ? c : null;
  } catch { return null; }
}

/* R21 — THE WINDOW'S BOUND, BOB's under K1881 (a protective limit that refuses only abuse): at most `limit` requests
   to the public ops per source in any `windowMs`, estimated by `capture` R31's two buckets. `stated` is composed from
   the same constants, so the sentence and the gate cannot drift apart. */
export const DOOR_WINDOW = Object.freeze({ limit: 300, windowMs: 10 * 60 * 1000 });
export const DOOR_WINDOW_STATED =
  `at most ${DOOR_WINDOW.limit} requests from one source in any ${DOOR_WINDOW.windowMs / 60000} minutes`;

/* R27 (T49; D24; K1881, a protective limit, BOB's) — A SIGNED-IN SESSION'S OWN WINDOW, for the public reads
   (`classes: null`, `mutating: false`) it makes: at most `limit` per session in any `windowMs`, estimated as R21's is
   (the same two buckets, `doorWindowEstimate`). A member's ordinary page loads (`bootstrap`, `groupidentity`, ...) are
   public reads that a signed-in page makes several times each, and would otherwise meet the source's 300. 3,000 was
   confirmed at START against M-T49-4 (at most 5 public requests per signed-in load; 400 loads in 10 minutes fit
   with room). `stated` is composed from the same constants. */
export const SESSION_WINDOW = Object.freeze({ limit: 3000, windowMs: 10 * 60 * 1000 });
export const SESSION_WINDOW_STATED =
  `at most ${SESSION_WINDOW.limit} requests from one signed-in session in any ${SESSION_WINDOW.windowMs / 60000} minutes`;

/* R21: the two-bucket sliding estimate, `prev × (1 − elapsed/W) + cur`, `elapsedFrac` the share of the current
   bucket's window already gone. */
export function doorWindowEstimate({ prev = 0, cur = 0, elapsedFrac = 0 } = {}) {
  const f = Math.min(1, Math.max(0, Number(elapsedFrac) || 0));
  return (Number(prev) || 0) * (1 - f) + (Number(cur) || 0);
}

/* R21: how long, in whole seconds (at least 1), until a refused source's estimate is under the bound again. A refused
   request is not counted, so the estimate only falls: within this bucket as `prev` ages out, else in the next bucket
   as `cur` (then the previous) ages out. */
export function doorRetryAfter({ prev = 0, cur = 0, elapsedFrac = 0, limit = DOOR_WINDOW.limit,
                                 windowMs = DOOR_WINDOW.windowMs } = {}) {
  const f = Math.min(1, Math.max(0, Number(elapsedFrac) || 0));
  const p = Number(prev) || 0, c = Number(cur) || 0;
  let waitFrac;
  if (c < limit && p > 0) waitFrac = Math.max(0, 1 - (limit - c) / p - f);
  else if (c >= limit) waitFrac = (1 - f) + Math.max(0, 1 - limit / c);
  else waitFrac = 0;
  /* The estimate must be strictly under the bound, so a wait landing exactly on it is a tick longer. */
  return Math.max(1, Math.ceil((waitFrac * windowMs) / 1000) + 1);
}

/* R21, R27 — THE REFUSAL: 429, the bound in `stated`, the wait in `retryAfter` (whole seconds) and, for the member's
   sentence (R28: `refusal.DOOR_RATE_LIMITED` holds `{minutes}`), in `minutes`. It names no address, fingerprint or
   credential, and says nothing of who the caller is (R15): the window knows neither. `session` is the session's own
   window (R27); the code and the row are the one row's (C-38.9, K3333), the session's sentence the word
   `refusal.DOOR_RATE_LIMITED.session` (DEC-262). */
export function doorRateLimited(retryAfter, { session = false } = {}) {
  const wait = Math.max(1, Math.ceil(Number(retryAfter) || 1));
  const minutes = Math.ceil(wait / 60);
  const where = session ? "this signed-in session" : "one source";
  /* DEC-49 REGION is-door-window */
  return { status: 429, body: { ok: false, reason: "DOOR_RATE_LIMITED", ...admissionRow("DOOR_RATE_LIMITED", { minutes },
      session ? "refusal.DOOR_RATE_LIMITED.session" : undefined),
    detail: localize("admission.index.too_many_requests_to_the", "too many requests to the operations anyone may call reached this team's Civicsmith from {where} in a short time, so this one was turned away before the operation ran; nothing was read or written. Try again in {wait} seconds.", { where: String(where), wait: String(wait) }),
    stated: session ? SESSION_WINDOW_STATED : DOOR_WINDOW_STATED, retryAfter: wait, minutes } };
  /* END DEC-49 REGION is-door-window */
}

/* R21 — WHO IS CALLING, AS A KEYED FINGERPRINT: the connecting address as Cloudflare states it (`CF-Connecting-IP`),
   digested as `doorbell` R12 digests it (HMAC-SHA-256, its first 16 bytes in hex, under the same key; T43, K2708). In
   the Worker that key is at hand only when the `KNOCK_FINGERPRINT_KEY` binding is set; otherwise it is the doorbell's
   instance key, held in the store, and (T38; N792, K2247) the store makes the fingerprint: asked through `doorwindow` with `count: false`, which
   counts, refuses and writes nothing, so for one address `setpassword`'s `source` (stamped from here, control-plane R68)
   equals `login`'s (the window's, `doorWindowGate`) with or without the binding. A store that cannot be asked, or does
   not answer, gives `null`, named in the log by correlation id only; this never throws. A request that states no address
   is one shared source of its own (`UNSTATED_SOURCE`, not a digest, so it never equals one). The address is read here,
   digested or handed to the store in a request's body, and dropped; it is never kept, logged or answered. */
export const UNSTATED_SOURCE = "unstated";
function connectingAddress(req) {
  try {
    const a = req && req.headers && typeof req.headers.get === "function" ? req.headers.get("cf-connecting-ip") : null;
    return typeof a === "string" && a.trim() !== "" ? a.trim() : null;
  } catch { return null; }
}
export async function sourceOf(req, env) {
  const address = connectingAddress(req);
  if (address === null) return UNSTATED_SOURCE;
  const bound = env && typeof env.KNOCK_FINGERPRINT_KEY === "string" && env.KNOCK_FINGERPRINT_KEY ? env.KNOCK_FINGERPRINT_KEY : null;
  if (!bound) return storeSource(address, env);
  const te = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", te.encode(bound), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, te.encode(address)));
  return hexOf(mac).slice(0, 32);
}

/* R21 (T38): the store's fingerprint of `address` under the doorbell's instance key (its R12), by `doorwindow` with
   `count: false`, the address in the body of a POST to `bio`'s store and nothing in its address. The reply is read on the door's contract
   (`ok: true` with a string `source` is an answer; anything else, unreadable included, is not), and the store's own
   internal error is named in the log by its correlation id alone. `null` when there is no answer. */
const CORRELATION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function storeSource(address, env) {
  let out = null;
  try {
    if (env && env.STORE && typeof env.STORE.get === "function") {
      const r = await bioStore(env).fetch(new Request("http://do/doorwindow", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, count: false }) }));
      out = await r.json();
    }
  } catch { out = null; }
  const source = out && typeof out === "object" && out.ok === true && out.result && typeof out.result === "object"
    && typeof out.result.source === "string" && out.result.source !== "" ? out.result.source : null;
  if (source === null)
    console.warn(`admission: the caller's source was not read from the store; it is stamped null (correlation ${
      out && typeof out === "object" && typeof out.correlation === "string" && CORRELATION.test(out.correlation) ? out.correlation : "none"})`);
  return source;
}

/* R27 — THE LIVE SESSION A PUBLIC READ PRESENTS, as the digest its own window is kept under, or `null` for a request
   that is counted by source: one presenting no credential or one that is not a session's shape; a binding token (a
   64-hex binding is no session); an `aik-` credential; a session the store does not know, or ended, or locked
   (readerOf reads a locked session as no one); and a session the store could not be asked about (R6's silence, named in
   the log by correlation id only). `credential` is the door's `presentedCredential` answer (R20: the header's token,
   else the body's); absent, the header of `req` alone. `background` marks a request the page makes on its own timer
   (credentials R71 (7)), so this read of the session is no activity; absent, the request's own `background=1`. The
   token itself goes nowhere but the session lookup's header (R20); the digest is all that is kept. */
const backgroundOf = (req) => {
  try { return new URL(req.url).searchParams.get("background") === "1"; } catch { return false; }
};
async function liveSessionDigest({ req, env, doAnswer, credential, background }) {
  const t = (credential && typeof credential === "object" ? credential : presentedCredential({ req })).token;
  if (typeof t !== "string" || !SESSION_TOKEN_SHAPE.test(t) || typeof doAnswer !== "function") return null;
  try {
    if ((await bindingOf(t, env)) !== null) return null;
    const looked = await sessionRead(credential, t, env, doAnswer, background === null ? backgroundOf(req) : background === true);
    if (looked.silent) {
      console.warn(`admission: the session was not read for the door's window; the request is counted by source (correlation ${
        typeof looked.silent.correlation === "string" ? looked.silent.correlation : "none"})`);
      return null;
    }
    if (!looked.sess || looked.sess.locked === true) return null;
    return await sha256hex(t);
  } catch { return null; }
}

/* R21, R27 — THE WINDOW, AS THE FIRST GATE OF THE PUBLIC OPS (control-plane R28's order): every request to an op whose
   spec is public (`classes: null`), whoever calls and whatever it presents, is asked of a window in the store
   (`doorwindow`, this module's store map, `window.mjs`), the connecting address in the request's body. A public READ
   (`mutating: false`) presenting a live session (`liveSessionDigest`) is counted in that session's own window
   (R27, `SESSION_WINDOW`), the digest of its token in the body beside the address, which the store uses for the
   fingerprint the stamps need and counts nowhere else; every other request is counted in its source's. A request to any
   other op is never counted or refused here. Answers `{ refusal }` (R21's or R27's 429, nothing of the op read or
   written) or `{ source }` (the fingerprint the store answered, for the door's stamps; `null` when it could not be
   read). A window that cannot be read or written ADMITS the request (it fails open, so a fault in it never refuses a
   caller) and is named in the log by its correlation id only. `credential` and `background`, the door's (R27). */
export async function doorWindowGate({ req = null, env = null, spec = null, doAnswer = null, now = null,
                                       credential = null, background = null } = {}) {
  if (!spec || spec.classes !== null) return { source: null };
  let out = null;
  try {
    const body = { address: connectingAddress(req) };
    if (now !== null) body.now = now;
    if (spec.mutating === false) {
      const digest = await liveSessionDigest({ req, env, doAnswer, credential, background });
      if (digest !== null) body.session = digest;
    }
    const asked = bioStore(env).fetch(new Request("http://do/doorwindow", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    out = typeof doAnswer === "function" ? await doAnswer(asked) : null;
  } catch { out = null; }
  if (!out || !out.answered || !out.result || typeof out.result !== "object") {
    console.warn(`admission: the door's window was not read; the request is admitted (correlation ${
      out && typeof out.correlation === "string" ? out.correlation : "none"})`);
    return { source: null };
  }
  const r = out.result;
  if (r.refused === true) return { refusal: doorRateLimited(r.retryAfter, { session: r.window === "session" }) };
  return { source: typeof r.source === "string" ? r.source : null };
}

/* R22 (N703; K1875; DEC-165, DEC-166; credentials R44) — THE REFUSALS COUNTED IN THE SECURITY TALLY, and their kind.
   T41 (T41-59; N797, K2394; membership R123): `op=handlecheck` answered `NO_SUCH_INVITATION` is a refused key, as
   `invitelook`'s is; its own pause (`HANDLE_CHECK_PAUSED`) is membership's and is not counted. */
const CREDENTIAL_REFUSED_ANYWHERE = Object.freeze(["AI_CREDENTIAL_REVOKED", "AI_CREDENTIAL_EXPIRED", "MEMBER_TOKEN_RETIRED"]);
/* The refusals whose credential names no member, whatever its shape: the retired key is the group's shared one (its
   64-hex shape is a session's, but it is nobody's). */
const NAMES_NO_MEMBER = Object.freeze(["MEMBER_TOKEN_RETIRED"]);
const CREDENTIAL_REFUSED_AT = Object.freeze({
  invitelook: Object.freeze(["NO_SUCH_INVITATION"]),
  enroll: Object.freeze(["NO_SUCH_INVITATION"]),
  handlecheck: Object.freeze(["NO_SUCH_INVITATION"]),
  websiteinvite: Object.freeze(["WEBSITE_KEY_UNKNOWN"]),
  joinlinkinvite: Object.freeze(["NO_SUCH_JOIN_LINK"]),
});
const RATE_REFUSED = Object.freeze(["DOOR_RATE_LIMITED", "WEBSITE_DAILY_CAP", "JOIN_LINK_DAILY_CAP"]);

/* An answer's refusal code, however the door holds it: a refusal `{status, body}`, a body, or a relayed result. */
function refusalCode(answer) {
  if (!answer || typeof answer !== "object") return null;
  const b = answer.body && typeof answer.body === "object" ? answer.body : answer;
  if (b.ok === true) return null;
  const c = typeof b.code === "string" ? b.code : typeof b.reason === "string" ? b.reason : null;
  return c;
}

/* `presented`: what the refused request presented — the door's `presentedCredential` answer (`token`), and the agent
   credential's row when one was looked up (`cred`). It names a member when it is a session (a session token's shape)
   or an agent credential whose principal is a member; then no country is placed (DEC-166 (2)). */
function namesMember(presented) {
  const p = presented && typeof presented === "object" ? presented : {};
  const cred = p.cred && typeof p.cred === "object" ? p.cred : null;
  if (cred && typeof cred.principal === "string" && cred.principal.startsWith("member:")) return true;
  return typeof p.token === "string" && SESSION_TOKEN_SHAPE.test(p.token);
}

/* R22: the kind a refusal is counted as, or null for one that is not counted. Pure. */
export function securityKindOf({ op = null, answer = null, presented = null } = {}) {
  const code = refusalCode(answer);
  if (!code) return null;
  if (RATE_REFUSED.includes(code)) return "rate";
  if (CREDENTIAL_REFUSED_ANYWHERE.includes(code)) return "credential";
  if (typeof op === "string" && Object.hasOwn(CREDENTIAL_REFUSED_AT, op) && CREDENTIAL_REFUSED_AT[op].includes(code))
    return "credential";
  /* an `aik-`-shaped credential no row knows: refused as no one (R7), counted as a refused key */
  const p = presented && typeof presented === "object" ? presented : {};
  if (code === "NOT_AUTHENTICATED" && typeof p.token === "string" && AI_TOKEN_SHAPE.test(p.token) && !p.cred)
    return "credential";
  return null;
}

/* R22 — ONE COUNT PER REFUSAL, through `credentials.securityCount({kind, country})` (its R44). This module answers
   it for each refusal it gives and `control-plane` calls it for each refusal it relays. Only the kind and the country
   cross: no address, fingerprint, credential, handle, role, op or time.
   T36 (N744, K2038; credentials R50): THE COUNT IS WRITTEN through the store's internal route `securitycount`, which
   no caller reaches (op-declarations R6), POSTed to `bio`'s store (the instance's one tally) with `{kind, country}` in
   its body and nothing in its address, and read through the door's reader `doAnswer` when it is handed one. `env` is
   the Worker's; without a store there is nowhere to write and nothing is sent. It answers `{ kind, country }`, what it
   counted, or `null` for a refusal not counted; a count that cannot be written is dropped (named in the log by
   correlation id only), it never throws and never changes the refusal. */
export async function securityTally({ op = null, answer = null, presented = null, req = null, env = null, doAnswer = null } = {}) {
  let counted = null;
  try {
    const kind = securityKindOf({ op, answer, presented });
    if (!kind) return null;
    const anyone = NAMES_NO_MEMBER.includes(refusalCode(answer));
    counted = { kind, country: !anyone && namesMember(presented) ? null : countryOf(req) };
  } catch { return null; }
  try {
    if (env && env.STORE && typeof env.STORE.get === "function") {
      const asked = bioStore(env).fetch(new Request("http://do/securitycount", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(counted) }));
      const out = typeof doAnswer === "function" ? await doAnswer(asked) : { answered: !!(await asked) };
      if (!out || !out.answered)
        console.warn(`admission: a security count was not written and is dropped (correlation ${
          out && typeof out.correlation === "string" ? out.correlation : "none"})`);
    }
  } catch { console.warn("admission: a security count was not written and is dropped (correlation none)"); }
  return counted;
}
