/* R66, R67, R81–R84 — `POST /signin`: THE RELAY OF A MEMBER'S OWN CLAUDE SIGN-IN TO THAT MEMBER'S OWN RUNNER INSTANCE
 * (N708; DEC-156; K1819, K2134, K2200; T47: N1001, K3060 D10, K1874).
 *
 * WHAT IT IS. A member connects their own Claude subscription by signing in on Anthropic's own page (DEC-156). The
 * sign-in is Claude Code's own (`claude setup-token` since T47, `agent-runner` R27), run unmodified in that member's own
 * `agent-runner` container instance. The plane's door routes `subscriptionsignin` here (`control-plane`) with the member
 * it stamped (`by`, never a value of the member's choosing) and one step: `start` (the binary's sign-in begins, and its
 * sign-in address comes back with the attempt's id), `code` (the code Anthropic's page showed the member, delivered to
 * that sign-in; the binary's token comes back once, R81), `state` (whether an attempt waits) or `signout` (any waiting
 * attempt ends). This member sends the step to the `RUNNER` instance named by the member, and no other, and answers the
 * runner's answer unchanged but for `trace` (R43, R84).
 *
 * THE TOKEN (R81; K3060 D10). Since T47 the token the binary mints is held by `credentials`, not on the container's disk:
 * a `code` answer carries it, and this member relays it only when the door's request states `hold: true` (the door's
 * statement that it hands the token to `credentials` and keeps it from the member's browser). Without that statement the
 * token and its `valid_for` are removed and the answer says `held: false`, so no token reaches a browser through a door
 * that does not hold it. It exists here only between reading the runner's body and writing the answer.
 *
 * WHAT IT IS NOT. It holds nothing of the sign-in (R36, R67): the code is read from this request's body only, sent only
 * in the body of the one request to that member's own instance, and never logged, stored, echoed or put in an answer;
 * the sign-in address reaches no answer but the `start` answer the runner gives. It makes no plane call and needs no
 * `PLANE` binding. Which member is connected is `credentials`', told by the door; this member records nothing.
 *
 * WHAT IT SAYS ABOUT ITSELF (R83, R84). Each request writes exactly one JSON line, `signin.worker`, of named non-secret
 * fields only, joined to the door's and the runner's lines by `trace` (the door's `x-civicsmith-trace`, else minted
 * here) and `member_ref` (the door's `x-civicsmith-member-ref`, never the bare member id); both headers are passed on
 * to the runner. Every answer carries `trace`, and every refusal this member makes carries a `detail` written for the
 * member in DEC-149's words (R64). */

import { remoteOf } from "./remote.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/** The steps, and the `agent-runner` route each is sent to (its R17, R18, R19, R20). */
export const SIGNIN_ROUTES = Object.freeze({
  start: "/signin",
  code: "/signin/code",
  state: "/signin/state",
  signout: "/signout",
});
/** `agent-runner` R17's member: a non-empty string of at most 200 characters. */
export const MEMBER_MAX = 200;
/** R83: the two headers this member reads from the door and passes on to the runner, and no other. */
export const TRACE_HEADER = "x-civicsmith-trace";
export const MEMBER_REF_HEADER = "x-civicsmith-member-ref";
/** R83: how much of a runner answer that is not JSON is told, after R29's scrub. */
export const TEXT_HEAD_MAX = 120;

/** R84: this member's own refusals of `/signin`. */
const OWN_CODES = Object.freeze(["RUNNER_NOT_CONFIGURED", "BAD_BODY", "BAD_MEMBER", "BAD_STEP", "BAD_CODE", "RUNNER_SILENT"]);
/** R84: the codes `agent-runner`'s sign-in routes answer (its R17–R20, R26–R28, R31), and the two a held token's
 *  conversation answers, which the member is told in the same words (`credentials` C4). */
const RUNNER_CODES = Object.freeze([
  "BAD_REQUEST", "BAD_MEMBER", "NOT_THIS_MEMBER", "SIGNIN_ADDRESS_UNEXPECTED", "SIGNIN_UNAVAILABLE", "NO_SIGNIN_WAITING",
  "BAD_CODE", "SIGNIN_REFUSED", "SIGNOUT_FAILED", "RUNNER_NOT_STARTED", "ATTEMPT_SUPERSEDED",
  "SIGNIN_NOT_HELD", "SIGNIN_TOKEN_REFUSED",
]);
/** R84 — every code `/signin` can answer, for the design stream's `refusal.<code>` words (checked against it at L11). */
export const SIGNIN_CODES = Object.freeze([...new Set([...OWN_CODES, ...RUNNER_CODES])].sort());

/* A binding ignores the host; this names the request, it does not route it (as `agent-model`'s `RUNNER_URL`). */
const RUNNER_ORIGIN = "https://agent-runner";
/* R83: a trace or member reference the door sends is a short name; anything else is not used (a trace is then minted,
   a reference is then null), so a header can carry nothing into a log line but a name. */
const TRACE_SHAPE = /^[A-Za-z0-9._:-]{1,128}$/;
const MEMBER_REF_SHAPE = /^[\x21-\x7e]{1,200}$/;
/* R85 (`agent-runner` R31): a start's attempt id, passed on unchanged with a code when the door sends a string of at
   most this many characters; another shape is not passed, and the runner's own check answers. */
const ATTEMPT_MAX = 200;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** R87 (T48; N1015) — the door's two headers on `/ask`, `/run`, `/draft` and `/transcribe`, read in R83's shapes for
 *  `agent-model` (`converse({…, trace, memberRef})`, its R16): each present only when the door sent it in its shape,
 *  else absent. Unlike `/signin`, nothing is minted and nothing is refused for want of one. */
export function doorTrace(req) {
  const t = req.headers.get(TRACE_HEADER);
  const r = req.headers.get(MEMBER_REF_HEADER);
  return { ...(typeof t === "string" && TRACE_SHAPE.test(t) ? { trace: t } : {}),
           ...(typeof r === "string" && MEMBER_REF_SHAPE.test(r) ? { memberRef: r } : {}) };
}

/** R83 (`agent-runner` R29's scrub): text with every copy of the code, every URL query and anything token-shaped
 *  (`sk-ant-…`, a JWT, any run of 32 or more `[A-Za-z0-9._-]`) removed. */
export function scrub(text, code) {
  let s = String(text ?? "");
  if (typeof code === "string" && code) s = s.split(code).join("[the code]");
  return s
    .replace(/\?[^\s"'<>]*/g, "?[query]")
    .replace(/sk-ant-[A-Za-z0-9._-]*/g, "[token]")
    .replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, "[token]")
    .replace(/[A-Za-z0-9._-]{32,}/g, "[token]");
}
const textHead = (text, code) => scrub(text, code).slice(0, TEXT_HEAD_MAX);

/* R84: the member's words for this member's own refusals (DEC-149: "your group's Civicsmith", never the place). */
const WORDS = {
  RUNNER_NOT_CONFIGURED: localize("agent-worker.signin.your_teams_civicsmith_cannot_connect", "Your team's Civicsmith cannot connect a Claude account yet: the part that runs a member's own Claude sign-in is not installed. Nothing was sent. An administrator can install it."),
  BAD_BODY: localize("agent-worker.signin.your_teams_civicsmith_could_not", "Your team's Civicsmith could not read this sign-in request, so nothing was sent. Try again from your settings."),
  BAD_MEMBER: localize("agent-worker.signin.your_teams_civicsmith_could_not_2", "Your team's Civicsmith could not tell whose sign-in this is, so nothing was sent. Sign in to your team's Civicsmith again, then try again."),
  BAD_STEP: localize("agent-worker.signin.your_teams_civicsmith_did_not", "Your team's Civicsmith did not recognise this sign-in step, so nothing was sent. Try again from your settings."),
  BAD_CODE: localize("agent-worker.signin.the_code_from_anthropics_page", "The code from Anthropic's page was missing, so nothing was sent. Paste the whole code Anthropic's page shows you, including any part after a # sign, and try again."),
  RUNNER_SILENT: localize("agent-worker.signin.your_teams_civicsmith_could_not_3", "Your team's Civicsmith could not reach the part that runs your Claude sign-in, so what happened to this step is not known. Wait a minute and try again; if it keeps happening, tell an administrator the reference."),
};

/** `POST /signin`. `deps` are the shell's own pieces (index.mjs): the refusal and answer helpers. */
export async function handleSignin(req, env, deps) {
  const { refusal, json, now = () => Date.now(), log = (line) => console.log(line), mint = () => crypto.randomUUID() } = deps;
  /* R83: the door's two headers, read once; the trace minted when none usable arrived. */
  const sent = doorTrace(req);
  const trace = sent.trace ?? mint();
  const memberRef = sent.memberRef ?? null;

  /* R83: exactly one line per request, of these fields only: never the code, address, token, body or another header. */
  const line = { event: "signin.worker", trace, step: null, member_ref: memberRef, outcome: null,
                 runner_status: null, runner_content_type: null, ms_runner: null, runner_text_bytes: null };
  const written = (response, fields) => { log(JSON.stringify({ ...line, ...fields })); return response; };
  /* R84: this member's own refusal, with its member's words and the trace; `failed` when the step's outcome is unknown. */
  const own = (code, status, extra = {}, outcome = "refused") =>
    written(refusal(code, WORDS[code], status, { trace, ...extra }), { outcome, code, ...lineOf(extra) });
  const lineOf = (extra) => ("runner_text_head" in extra ? { runner_text_head: extra.runner_text_head } : {});

  /* R66, F2: with no `RUNNER` bound every step answers RUNNER_NOT_CONFIGURED. */
  const runner = remoteOf(env);
  if (!runner) return own("RUNNER_NOT_CONFIGURED", 503, {}, "failed");
  const body = await req.json().catch(() => null);
  if (!isObject(body)) return own("BAD_BODY", 400);
  const { member, step } = body;
  if (!(typeof member === "string" && member.trim().length > 0 && member.length <= MEMBER_MAX))
    return own("BAD_MEMBER", 400);
  if (!Object.hasOwn(SIGNIN_ROUTES, step)) return own("BAD_STEP", 400);
  line.step = step;
  const code = step === "code" ? body.code : undefined;
  if (step === "code" && !(typeof code === "string" && code.length > 0)) return own("BAD_CODE", 400);
  /* R81: the door's statement that it holds the token; only `true` is one. */
  const hold = body.hold === true;

  /* R66, agent-runner R21: the instance named by this member and no other. The code goes in this one request's body
     and nowhere else (R67); `agent-runner` R31's attempt rides beside it when the door sends one. */
  const payload = step === "code"
    ? { member, code, ...(typeof body.attempt === "string" && body.attempt.length <= ATTEMPT_MAX ? { attempt: body.attempt } : {}) }
    : { member };
  const headers = { "content-type": "application/json", [TRACE_HEADER]: trace, ...(memberRef ? { [MEMBER_REF_HEADER]: memberRef } : {}) };
  let res, text;
  const started = now();
  try {
    const stub = runner.get(runner.idFromName(member));
    res = await stub.fetch(`${RUNNER_ORIGIN}${SIGNIN_ROUTES[step]}`, { method: "POST", headers, body: JSON.stringify(payload) });
    text = await res.text();
  } catch (e) {
    line.ms_runner = Math.max(0, now() - started);
    return own("RUNNER_SILENT", 502, { runner_status: res?.status ?? null, detail_from_binding: textHead(e?.message ?? e, code) },
      "failed");
  }
  line.ms_runner = Math.max(0, now() - started);
  line.runner_status = res.status;
  line.runner_content_type = (res.headers.get("content-type") ?? "").slice(0, 100) || null;
  line.runner_text_bytes = new TextEncoder().encode(text).length;

  let answer;
  try { answer = JSON.parse(text); } catch { answer = undefined; }
  /* R84: an answer this member cannot add `trace` to (not JSON, or JSON that is not an object) is not one it can relay;
     R83: its status and its scrubbed head are told, in the line and the answer. */
  if (!isObject(answer))
    return own("RUNNER_SILENT", 502, { runner_status: res.status, runner_text_head: textHead(text, code) }, "failed");

  /* R81: a token is relayed only under the door's hold; without it, it and its validity are removed, `held: false`. */
  let out = answer, held;
  if (step === "code" && Object.hasOwn(answer, "token")) {
    if (hold) held = true;
    else {
      const { token: _token, valid_for: _validFor, ...rest } = answer;
      out = { ...rest, held: false };
      held = false;
    }
  }
  /* R43, R84: the runner's answer, status and body, unchanged but for `trace` (kept as the runner gave it when it did). */
  const relayed = typeof out.trace === "string" ? out : { ...out, trace };
  const refused = !(res.status >= 200 && res.status < 300) || answer.ok === false;
  return written(json(relayed, res.status), {
    outcome: refused ? "refused" : "ok",
    ...(refused && typeof answer.code === "string" && /^[A-Z][A-Z0-9_]{0,59}$/.test(answer.code) ? { code: answer.code } : {}),
    ...(held !== undefined ? { held } : {}),
  });
}
