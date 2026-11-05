/* signin-door: THE SUBSCRIPTION SIGN-IN DOOR (R1–R6; T47-91; N1001; connect §3), split by copy from `control-plane`
   (its R65, R78, R85–R87; K617, K624). This file is the door's Worker half: what `control-plane` calls when it routes
   `subscriptionsignin`, `signintrace`, a member's revocation and an ask's or draft's answer.
   The store's half (the in-plane `credentials` calls and the bounded trace) is `ops.mjs`, a store-internal map.

   R1 (was control-plane R65; N708, DEC-156): A MEMBER'S OWN CLAUDE SIGN-IN, RELAYED TO THEIR OWN RUNNER. A step reaches
   agent-worker's `POST /signin` through the `AGENT_WORKER` binding as `{member, step, code?}`: `member` the door's stamp
   (the session's `by`), never a value the caller sends; `step` and `code` the request body's alone. Who reaches the op
   (a member's own session only) is `admission`'s, before this module is asked. `start` and `code` are refused while the
   group keeps its material away (`ai-accounts.aiKeptAway()`, its R7, asked through the store-internal `aikeptaway`), nothing
   sent. The runner's answer is relayed as given, status and body; a `code` answer carrying `connected: true` for that
   member and no token is recorded through `ai-accounts.subscriptionConnected` (its R18; `subscriptionconnected`), and only then.
   A member's revocation sends `step: "signout"` for that member, and a runner that cannot be reached changes nothing of
   the act's answer (the member's own `subscriptiondisconnect` is retired, notice op-declarations:95). The code is never logged, stored, echoed or answered here.
   `agent-worker`'s `RUNNER_NOT_CONFIGURED` is relayed unchanged, with a `translation` read by key.
   R2 (was R78; N981, K231): `start` is refused `DISCLOSURE_DUE` as `ai-accounts.disclosureDue({member})` answers it (its R23),
   relayed as given, after the keep-away refusal and before anything is sent; this module holds no row for the code.
   R3 (was R85): each request gets a `trace`, sent with `member_ref` in headers; one log line `signin.door`; `trace` in
   every answer.
   R4 (was R86; K3060 D10): on `code` the door sends `hold: true`; a `token` answered is handed to
   `ai-accounts.subscriptionTokenHold` (its R19) and its result read; `token` and `valid_for` never leave this module; the answer
   says `held: true`, or `held: false` with the fact's code. `state` is answered from
   `ai-accounts.accountsOf`' member's own issued account (the store's `accountsof`, F1; nothing sent to the runner). Disconnect and revocation drop the
   token through `ai-accounts` (its own acts, R18, R27, R19) and send `signout`. An ask or draft answered
   `SIGNIN_TOKEN_REFUSED` calls `ai-accounts.subscriptionTokenRefused`.
   R5 (was R87): on a test instance only, a bounded trace answers `op=signintrace`; elsewhere `SIGNINTRACE_NOT_TEST`.

   THE INTERFACE. `store(path, init)` is the caller's ask of its record store, answered in `answer-envelope`'s
   `doAnswer` shape (`{answered, refused, result, reply, correlation}`); every answer here is `{status, body}`, which the
   door sends as JSON (`answer-envelope` decorates a refusal with its row). `log(line)` writes one log line (default
   `console.log` of the JSON). Nothing here throws. */
import { storeSilent } from "../answer-envelope/index.mjs";
import { hasWord, localize, word } from "../setup-words/index.mjs";

export const SIGNIN_STEPS = Object.freeze(["start", "code", "state", "signout"]);
/* R1 (K2200 (9)): the steps that start or complete a sign-in, refused under keep-away. */
const KEPT_AWAY_STEPS = Object.freeze(["start", "code"]);
/* R2: the step refused while the disclosure is due. */
const DISCLOSURE_STEPS = Object.freeze(["start"]);
/* R1: the door's member words under the UX stream's keys, read by key until `words.json` holds them. */
export const SIGNIN_WORDS = Object.freeze({
  "ai.refused.signinabsent": hasWord("ai.refused.signinabsent") ? word("ai.refused.signinabsent")
    : localize("signin-door.index.signing_in_with_claude_is", "Signing in with Claude is not installed in your team's Civicsmith yet. Whoever installed your team's Civicsmith can add it."),
});
/* R6 retired, F3 (coordinator ruling 5 Nov 08:01; op-grades R57: a retired op is in no table): `subscriptionsignin` is
   retired and replaced by `aisignin` (ai-accounts, op-declarations R90), so this module declares no op. The export stays,
   empty and frozen, so the assembly still finds the module's DECLARED_OPS. */
export const DECLARED_OPS = Object.freeze({});
/* R3 (`agent-worker` R83): the two headers the door sends, and no other of its own. */
export const TRACE_HEADER = "x-civicsmith-trace";
export const MEMBER_REF_HEADER = "x-civicsmith-member-ref";
/* R3: how many hex characters of the digest name a member in a log. */
export const MEMBER_REF_HEX = 12;
/* R5: how many lines the trace keeps. */
export const SIGNIN_TRACE_MAX = 200;
/* R5: the fields a trace line may hold, and no other (no token, secret or code can be one of them). */
export const TRACE_FIELDS = Object.freeze(["event", "at", "trace", "step", "member_ref", "outcome", "code", "status",
  "ms_total", "ms_agent_worker", "held"]);
/* The store-internal routes of `ops.mjs` this half asks, and `ai-accounts`' own T53 read `accountsof` (its R2; F1: the
   retired `accountreference` has no alias, ai-accounts R35, R10). Notice op-declarations:95 (its R30, R20, R24, R41 restated
   for T53): the member's own `subscriptiondisconnect` is retired with no alias (ai-accounts R35), so no route asks it. */
export const STORE_ROUTES = Object.freeze({ keptAway: "aikeptaway", connected: "subscriptionconnected",
  disclosureDue: "signindisclosuredue", hold: "signintokenhold", refused: "signintokenrefused",
  traceKeep: "signintracekeep", traceRead: "signintraceread", state: "accountsof" });
/* Notice op-declarations:95: the op this door served and op-declarations R30 retired (ai-accounts R35); the store's own
   envelope for an op it does not serve (answer-envelope's `unknown op: <op>`, 400) is what it answers. */
export const RETIRED_DISCONNECT = "subscriptiondisconnect";
/* F1: the means of a member's subscription account (ai-accounts R19, R42: an issued account of the subscription plan). */
const SUBSCRIPTION_MEANS = "issued";
/* agent-worker R66's refusal when it holds no runner, relayed in member words. */
const RUNNER_ABSENT = "RUNNER_NOT_CONFIGURED";
/* R4: Anthropic's refusal of a held token, as agent-worker relays it (`SIGNIN_CODES`). */
export const TOKEN_REFUSED = "SIGNIN_TOKEN_REFUSED";
/* R4 (`agent-worker` R85): a start's attempt id, passed with a code when the body's is a string this long or shorter. */
const ATTEMPT_MAX = 200;
/* R4: the fields of a runner's answer that never leave this module. */
const TOKEN_FIELDS = Object.freeze(["token", "valid_for"]);

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const defaultLog = (line) => { try { console.log(JSON.stringify(line)); } catch { /* a log never changes an answer */ } };
const codeOf = (b) => (isObject(b) ? (typeof b.code === "string" ? b.code : typeof b.reason === "string" ? b.reason : null) : null);

/** R5, R3: whether this is a test instance, a fact of the deployment alone (`ai-runs` R78's): the Worker environment's
 *  `CIVICSMITH_TEST_INSTANCE` a string equal to its `INSTANCE_NAME`, both non-empty; false when either cannot be read. */
export function testInstanceOf(env) {
  try {
    const flag = env?.CIVICSMITH_TEST_INSTANCE, name = env?.INSTANCE_NAME;
    return typeof flag === "string" && typeof name === "string" && flag !== "" && name !== "" && flag === name;
  } catch { return false; }
}

/** R3: a fresh trace for one request. */
export function mintTrace() {
  return crypto.randomUUID();
}

/** R3: how a log names a member: the first 12 hex characters of `sha256(instance salt + by)`, the salt the instance's
 *  name (`INSTANCE_NAME`, empty when unset); the bare `by` on a test instance. Null for no member. */
export async function memberRefOf(env, by) {
  if (typeof by !== "string" || by === "") return null;
  if (testInstanceOf(env)) return by;
  const salt = typeof env?.INSTANCE_NAME === "string" ? env.INSTANCE_NAME : "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + by));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, MEMBER_REF_HEX);
}

/** A store answer that is not an answer, as the door answers one (`answer-envelope` R3), `trace` added. */
async function unreadAnswer(op, out, trace) {
  if (out && out.refused && out.reply) return { status: out.reply.status, body: { ...out.reply.body, trace } };
  let body;
  try { body = await storeSilent(op, out?.correlation).json(); } catch { body = { ok: false, reason: "STORE_DID_NOT_ANSWER", op }; }
  return { status: 502, body: { ...body, trace } };
}

/* Ask the store, never throwing: a throw is a silence. */
async function ask(store, path, init = { method: "POST", body: "{}" }) {
  try { return (await store(path, init)) || { answered: false }; } catch { return { answered: false }; }
}

const unbound = () => ({ status: 503, body: { ok: false, reason: "AGENT_WORKER_UNBOUND",
  detail: localize("signin-door.index.your_teams_civicsmith_has_no", "your team's Civicsmith has no assistant bound to it, so nothing was sent to your sign-in.") } });
const silent = (why) => ({ status: 502, body: { ok: false, reason: "AGENT_WORKER_SILENT",
  detail: `the assistant member ${why}. Nothing was kept.` } });

/** One step sent to agent-worker's `/signin` (R1, R3): `{status, body}` as the runner answered it, or the door's own. */
async function send(env, payload, headers) {
  const w = env && env.AGENT_WORKER;
  if (!w || typeof w.fetch !== "function") return unbound();
  let res;
  try {
    res = await w.fetch("https://agent-worker/signin", { method: "POST",
      headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload) });
  } catch { return silent("did not answer"); }
  let body;
  try { body = await res.json(); } catch { return silent("answered no JSON"); }
  if (!isObject(body)) return silent("answered no JSON object");
  if (body.ok === false && codeOf(body) === RUNNER_ABSENT && body.translation === undefined)
    return { status: res.status, body: { ...body, translation: SIGNIN_WORDS["ai.refused.signinabsent"] } };
  return { status: res.status, body };
}

/** R3, R5: write the request's one `signin.door` line, and keep it on a test instance (best effort). */
async function writeLine({ env, store, log, line }) {
  const kept = Object.fromEntries(TRACE_FIELDS.filter((k) => line[k] !== undefined).map((k) => [k, line[k]]));
  try { (log || defaultLog)(kept); } catch { /* a log never changes an answer */ }
  if (testInstanceOf(env))
    await ask(store, STORE_ROUTES.traceKeep, { method: "POST", headers: { "content-type": "application/json" },
                                               body: JSON.stringify({ line: kept }) });
}

/** `op=subscriptionsignin` (R1–R4). `member` is the door's stamp (the session's `by`); `asked` the request's parsed
 *  body (the address is never read); `store(path, init)` the caller's store. Answers `{status, body}`, `body.trace`
 *  always set. */
export async function subscriptionSignin({ env, member, asked, store, log = defaultLog }) {
  const t0 = Date.now();
  const trace = mintTrace();
  const a = isObject(asked) ? asked : {};
  const step = typeof a.step === "string" && SIGNIN_STEPS.includes(a.step) ? a.step : null;
  const memberRef = await memberRefOf(env, member);
  let msAgent;
  const done = async (answer, outcome, extra = {}) => {
    const body = { ...answer.body, trace };
    for (const k of TOKEN_FIELDS) delete body[k];
    await writeLine({ env, store, log, line: { event: "signin.door", at: new Date().toISOString(), trace, step,
      member_ref: memberRef, outcome, code: body.ok === false ? codeOf(body) ?? undefined : undefined,
      status: answer.status, ms_total: Date.now() - t0, ms_agent_worker: msAgent, ...extra } });
    return { status: answer.status, body };
  };

  if (KEPT_AWAY_STEPS.includes(step)) {
    /* fail closed: a store that refuses the question or does not answer sends nothing */
    const kept = await ask(store, STORE_ROUTES.keptAway);
    if (kept.refused || !kept.answered) return done(await unreadAnswer("subscriptionsignin", kept, trace), "refused_local");
    const k = kept.result;
    if (!isObject(k) || k.ok !== true) return done({ status: 403, body: { ok: false, ...(isObject(k) ? k : {}) } }, "refused_local");
  }
  if (DISCLOSURE_STEPS.includes(step)) {
    /* R2: `credentials.disclosureDue`'s answer, as given; fail closed as the keep-away question is */
    const due = await ask(store, `${STORE_ROUTES.disclosureDue}?by=${encodeURIComponent(member)}`);
    if (due.refused || !due.answered) return done(await unreadAnswer("subscriptionsignin", due, trace), "refused_local");
    const d = due.result;
    if (!isObject(d) || d.ok !== true) return done({ status: 409, body: { ok: false, ...(isObject(d) ? d : {}) } }, "refused_local");
  }
  if (step === "state") {
    /* R4, F1: answered from ai-accounts' T53 read of the member's own accounts (`accountsof`, owner `member:<id>`, viewer
       the stamp), nothing sent to the runner; the subscription is her own first issued account, connected while its
       token is held. A failed read is said, never "not connected". */
    const owner = typeof member === "string" && member.startsWith("member:") ? member : `member:${member}`;
    const st = await ask(store, `${STORE_ROUTES.state}?owner=${encodeURIComponent(owner)}&viewer=${encodeURIComponent(member)}`,
                         { method: "GET" });
    if (st.refused || !st.answered) return done(await unreadAnswer("subscriptionsignin", st, trace), "refused_local");
    const r = st.result;
    if (!isObject(r) || r.ok !== true) return done({ status: 403, body: { ok: false, ...(isObject(r) ? r : {}) } }, "refused_local");
    const own = (Array.isArray(r.accounts) ? r.accounts : [])
      .find((x) => isObject(x) && x.means === SUBSCRIPTION_MEANS && x.owner === owner) ?? null;
    const held = !!(own && own.held === true);
    const sub = { connected: held, since: held ? own.set_at ?? null : null, held, account_id: own ? own.account_id ?? null : null };
    return done({ status: 200, body: { ok: true, step: "state", member, ...sub } }, "answered");
  }

  /* agent-worker R66 judges `step` and `code` (BAD_STEP, BAD_CODE); the door sends `code` only for its step */
  const payload = { member, step: a.step ?? null };
  if (step === "code") {
    payload.code = a.code;
    payload.hold = true;   /* R4 (agent-worker R81) */
    if (typeof a.attempt === "string" && a.attempt.length <= ATTEMPT_MAX) payload.attempt = a.attempt;
  }
  const headers = { [TRACE_HEADER]: trace, ...(memberRef ? { [MEMBER_REF_HEADER]: memberRef } : {}) };
  const tSend = Date.now();
  const out = await send(env, payload, headers);
  msAgent = Date.now() - tSend;
  const b = out.body;
  const own = b.member === undefined || b.member === member;

  if (step === "code" && b.ok === true && Object.hasOwn(b, "token")) {
    /* R4: the token is handed to the hold and nowhere else; its result is read */
    const { token, valid_for: validFor, ...rest } = b;
    let held = false, fact;
    if (!own) fact = { code: "NOT_THIS_MEMBER" };
    else {
      const h = await ask(store, `${STORE_ROUTES.hold}?by=${encodeURIComponent(member)}`, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ token, validFor: validFor ?? null }) });
      if (h.answered && isObject(h.result) && h.result.ok === true) { held = true; if (h.result.since) rest.since = h.result.since; }
      else fact = { code: h.answered && isObject(h.result) ? codeOf(h.result) ?? "SIGNIN_NOT_HELD"
                                                           : h.refused ? codeOf(h.reply?.body) ?? "STORE_DID_NOT_ANSWER" : "STORE_DID_NOT_ANSWER" };
    }
    return done({ status: out.status, body: { ...rest, held, ...(held ? {} : { fact }) } }, "relayed", { held });
  }
  if (step === "code" && b.ok === true && b.connected === true && own) {
    /* R1 (ai-accounts R18): the fact only, the member alone; a record that fails changes nothing of the answer */
    await ask(store, `${STORE_ROUTES.connected}?by=${encodeURIComponent(member)}`);
  }
  return done(out, out.body.reason === "AGENT_WORKER_UNBOUND" || out.body.reason === "AGENT_WORKER_SILENT" ? "refused_local" : "relayed");
}

/** The member a store answer of the door's forward signs out (R1, R4): the revoked member on `memberset` to `revoked`
 *  and on a carried `adminremove`; else null. The retired `subscriptiondisconnect` (notice op-declarations:95) names nobody:
 *  removing an issued account drops its token in `ai-accounts` itself (its R19).
 *  `asked` is the request's body, `result` the store's answered result, `by` the door's stamp for the caller. */
export function leaverOf(op, asked, result, by) {
  if (!isObject(result) || result.ok !== true) return null;
  const a = isObject(asked) ? asked : {};
  const memberOf = (id) => (typeof id === "string" && id.trim() !== "" ? (id.startsWith("member:") ? id : `member:${id}`) : null);
  if (op === "memberset" && a.status === "revoked") return memberOf(result.memberId ?? a.memberId);
  if (op === "adminremove" && result.removed === true) return memberOf(result.memberId ?? a.memberId);
  return null;
}

/** R1, R4: `step: "signout"` for a member who left (`leaverOf`), best effort: nothing it answers reaches the act's
 *  caller. The token was dropped by `ai-accounts`' own act (revocation R27; its R19). */
export async function signoutLeaver(env, member) {
  if (!member) return;
  try {
    const trace = mintTrace(), ref = await memberRefOf(env, member);
    await send(env, { member, step: "signout" }, { [TRACE_HEADER]: trace, ...(ref ? { [MEMBER_REF_HEADER]: ref } : {}) });
  } catch { /* never changes the act's answer */ }
}

/** `op=subscriptiondisconnect`, retired (notice op-declarations:95; its R30; ai-accounts R35, no alias): kept as a name
 *  only because the door still routes it, it asks no store route and sends nothing to the runner. It answers in
 *  `doAnswer`'s shape the store's own refusal of an op it does not serve (`unknown op: subscriptiondisconnect`, 400),
 *  which the door relays as every store refusal is. A member disconnects their subscription by removing the issued
 *  account (`aiaccountremove`, ai-accounts R61), which drops its token (R19). Never throws. */
export async function subscriptionDisconnect() {
  const body = { ok: false, error: `unknown op: ${RETIRED_DISCONNECT}` };
  return { answered: false, refused: true, result: undefined, reply: { status: 400, body } };
}

/** R4: an ask's or a draft's answer naming `SIGNIN_TOKEN_REFUSED` (at the top level or in `result`) for `member`'s
 *  held sign-in: `ai-accounts.subscriptionTokenRefused` drops it (the store's `signintokenrefused`). Answers whether it
 *  was asked; never changes the answer it reads, never throws. */
export async function tokenRefusedSeen({ member, answer, store }) {
  const b = isObject(answer) ? answer : null;
  const refusedHere = (x) => isObject(x) && x.ok === false && codeOf(x) === TOKEN_REFUSED;
  if (!member || !b || !(refusedHere(b) || refusedHere(b.result))) return false;
  await ask(store, `${STORE_ROUTES.refused}?by=${encodeURIComponent(member)}`);
  return true;
}

/** `op=signintrace` (R5; its handler, named as the op): on a test instance the trace's last lines, as the store's `signintraceread` answers them;
 *  elsewhere `SIGNINTRACE_NOT_TEST` and nothing asked. Who reaches the op is admission's (an administrator's session). */
export async function signintrace({ env, store }) {
  /* DEC-49 REGION is-signintrace-test-instance
     C-69.7 (`answer-envelope`'s DISPATCH_CHECKS row, K3143): the one site of the code (K231). */
  if (!testInstanceOf(env))
    return { status: 403, body: { ok: false, reason: "SIGNINTRACE_NOT_TEST", detail: localize("signin-door.index.the_sign_in_trace_is", "the sign-in trace is kept only on a test instance of Civicsmith, and your team's Civicsmith is not one. Nothing was read.") } };
  /* END DEC-49 REGION is-signintrace-test-instance */
  const out = await ask(store, STORE_ROUTES.traceRead, { method: "GET" });
  if (out.refused || !out.answered) return unreadAnswer("signintrace", out, undefined);
  return { status: 200, body: isObject(out.result) ? out.result : { ok: true, lines: [] } };
}
