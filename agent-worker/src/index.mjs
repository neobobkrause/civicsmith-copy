/* agent-worker — the SECOND member of the function-specific Worker fleet (I8).
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A SECOND `pdf-worker`. The plane stays a
 * lean control/record Worker. An investigative session (INVESTIGATIVE-SESSION.md)
 * is long, dependency-laden and mostly spent WAITING on model responses, so it
 * moves into a dedicated Worker the plane calls over a service binding — a fleet,
 * not a monolith.
 *
 * But it is a different SHAPE from `pdf-worker`, and that is the whole reason I8
 * is its own registry entry. `pdf-worker` is a pure function of bytes: it is
 * called, it answers, it needs nothing from anybody. **This member CALLS BACK.**
 * It consumes the plane's op surface while it works, which makes it the first
 * component in this system that is both called by the plane and a caller of it.
 * Every rule below follows from that one fact.
 *
 * WHAT IT DOES. `/run` DRIVES THE RUN HARNESS — `agent-harness`' deterministic
 * control-flow table (IS-9; moved there by copy at T33-54, and this file now
 * imports it). It takes the run identity, the
 * namespace and the `ai` credential the plane hands it; asks the plane who that
 * credential is; reads the run's MODE and BUDGET from the record and its own
 * OBSERVATION LOG (so a resumed run continues rather than restarting); then
 * walks the table, performing each row's plane call and appending an observation
 * entry for every step it takes: the walk itself is `agent-steps`' (R119), which this file hands the host it needs.
 *
 * WHAT IT GAINED AT FL-5 (IS-9(a), §14b.1). The fan-out now composes a SPAWN
 * CONTRACT per level — read-only, one level each, sharing no state, with no field
 * for the bias manifest to arrive in — and the returns are held to a RETURN
 * CONTRACT: a REPORT with a citation, never documents, with the parent re-reading
 * each citation BY ADDRESS through the one meaning reader it already had. Both
 * contracts are `agent-harness`' `subsession.mjs` and both are pure. The rule they enforce is
 * the design's own: *a sub-session that returns documents rather than reports has
 * defeated the architecture* — so a return that breaks the contract is REFUSED
 * and NAMED, and its level goes UNDETERMINED rather than becoming an absence.
 *
 * **WHEN IT RUNS MODEL TURNS, AND IT SAYS WHICH ON THE WIRE (R28, R58).** It
 * runs model turns through `agent-model` exactly when the Claude account that
 * serves the member's act arrived with the call (R6: the member's own, a
 * project's (R71), or the group's API key, as `credentials.accountFor` answers
 * it, K1755) and the run's mode has turns to run: an API key goes to the
 * Messages API, the member's own sign-in (or a one-member project's, which is
 * that member's own) to Claude Code in a cloud session that `agent-runner`'s remote class creates on it, through
 * the Durable Object binding `REMOTE` (R35, R109); the local container is reached by no path, and until a member's
 * check has passed (R110, R111) a call on a sign-in is refused `ASSISTANT_REMOTE_NOT_READY`. A segment whose caller
 * supplied the judgements (`judgements` in the body, the stubbed path) runs no
 * turn. The answer's `turns_run` counts the turns that actually ran and
 * `judgement_source` says whose judgements the table applied (`model` or
 * `body`), so a table-driven walk is never presented as a model run, nor the
 * reverse. `POST /ask` (R54) is a member's question, answered through the same
 * module under the account that serves that member's ask and an ask grant, and
 * handed to the plane's `answers` checks before anything is returned. `POST
 * /draft` (R59) is a member's labelled draft of their own words, made the same
 * way, read only under a grant the door sends when the draft may read, and
 * checked by the door before the member sees it. `POST /transcribe` (R72–R75)
 * runs turns the same way, one conversation per page under the account that
 * serves the member's `transcribe` act (an API key or, since T46, the member's own sign-in), handing the model only the page's
 * picture the plane rendered, as a tool's result, and answers the AI's reading
 * of each page: no plane call. `POST /signin` (R66, R67, R81–R84)
 * relays one step of a member's own Claude sign-in to that member's own
 * remote instance on the same `REMOTE` binding and holds nothing of it:
 * no plane call, no model turn; the token the sign-in mints passes to the door
 * once, only under its `hold` (R81), and comes back on each act as the `signin`
 * account's `secret` (R82). (T48; R87) `/ask`, `/run`, `/draft` and
 * `/transcribe` pass the door's `x-civicsmith-trace` and
 * `x-civicsmith-member-ref`, when sent in `/signin`'s shapes (R83), to every
 * `agent-model` conversation they hold, so a member's runner receives them on
 * its upgrade (`agent-model` R16); nothing else changes with them.
 *
 * WHAT IT MUST NOT DO (fleet rules 2/3, inherited from I6 and asserted in the
 * suite behaviourally, at this member's interface — what it reads from `env`,
 * what it touches on its one binding, and what reaches the plane and the model
 * (`test/inprocess.mjs`, N421)):
 *
 *   - WRITE ANYTHING DIRECTLY, BY ANY ROUTE. It holds no STORE (Durable Object)
 *     binding and no R2 binding at all — not CAPTURES and above all not
 *     PUBLISHED. Every change to the record is made BY THE PLANE, under a
 *     credential a MEMBER minted with a declared scope, at an op the plane's own
 *     `aiTaskScope` admitted; a hop a component can hand us is a hop a component
 *     can invent (D-112), and none of the provenance is this member's to write.
 *
 *     **FL-2 SAID "IT CALLS NO MUTATING OP" AND THAT SENTENCE WAS TIGHTER THAN
 *     THE RULE IT WAS ENFORCING — CORRECTED HERE RATHER THAN EXEMPTED.** FL-2
 *     performed one read and could honestly promise it; the FLEET plan row's own
 *     words are *"writes nothing DIRECTLY"* and PL-11's `ai` credential class is
 *     specified as *"writes ONLY PL-3's endpoint and PL-4's table"* — a scope
 *     with no consumer if the member that holds the credential may never name
 *     those ops. FL-3's acceptance cannot be reached without them: a budget
 *     exhaustion must WRITE `runtime-ceiling-reached` and a refusal must be
 *     followed by an ADJUSTED submission. So the fence moves from "no mutating
 *     op" to its true shape — **an EXACT PINNED SET, floor and ceiling both, in
 *     which every mutating member is one PL-11's credential scope can declare**
 *     — and the suite's arms are corrected to match, each with a comment saying
 *     why the old one was wrong. The property FL-2 was actually protecting is
 *     untouched: no binding but the plane, no write this member performs itself,
 *     and no op it may name that somebody did not decide to give it.
 *   - HOLD A CREDENTIAL (R36). It has no token of its own and no secret binding.
 *     The `ai` credential, an ask's grant and the account that serves the
 *     member's act (the member's own reference, or the group's API key, held
 *     sealed in `credentials`, K1755) arrive PER CALL and are never stored,
 *     logged or echoed, so this member cannot act except while somebody is
 *     asking it to; so does the code from Anthropic's page a member's own
 *     sign-in takes (R66, R67), sent only to that member's own runner instance,
 *     and the token that sign-in mints (R81, R82), relayed to the door once and
 *     arriving per call as a `signin` account's `secret`.
 *     The copy binds no Claude credential in its environment.
 *   - JUDGE ITS OWN SCOPE. D-199 (2): what an agent may reach is a row a member
 *     AUTHORED, read from the record at the plane's gate by `aiTaskScope`. A copy
 *     of that judgement here would be a second enforcement point that drifts from
 *     the first, and a scope compiled into a Worker is precisely the settings row
 *     D-199 refused. There is no op allow-list, no scope and no class in this
 *     file. `ops.mjs`' `PLANE_OPS` is a DECLARATION of what the table's rows
 *     do and grants nothing — naming an op the credential does not declare gets
 *     the plane's `AI_BEYOND_TASK_SCOPE` refusal, passed through verbatim. It is
 *     pinned as an exact set by the suite — floor and ceiling both — so a call
 *     this member gains is a call somebody decided to give it.
 *
 *   - DECIDE ITS OWN CONTROL FLOW FROM A JUDGEMENT. §14b.4: loops, fan-out and
 *     gates are deterministic and judgement happens INSIDE a step. The pass
 *     counter, the loop's termination, the budget, the mode and the step are
 *     refused to a judgement by `applyJudgement`, by name.
 *   - RE-WORD A REFUSAL. The plane's refusal carries its C-number and its DEC-49
 *     canned translation; this member passes it through UNCHANGED. A component
 *     that paraphrases a refusal is thirteen surfaces inventing wording, which is
 *     the drift DEC-49's guard exists to close.
 *   - BE REACHED BY ANYTHING BUT THE PLANE. No member-facing surface, no token
 *     classes of its own. The plane's op layer is the authorisation boundary.
 *
 * It versions and deploys SEPARATELY (fleet rule 4), so `GET /version` exists:
 * a verification must establish which build ANSWERED, for the member as well as
 * the plane (D-108's second face), and a member that cannot name its own build
 * makes that unverifiable.
 */

/* ---------------------------------------------------------------- THE BINDING
 *
 * The plane is reached on `env.PLANE` and by NO other route. This is measured,
 * not preferred: FL-1 (MEASUREMENTS.md, 2026-08-08) found that a Worker CANNOT
 * fetch another Worker on this account's own `*.workers.dev` name — 404, body
 * `error code: 1042`, in 7 ms, EVERY time — while the service binding to the same
 * script answered 200 in 1,885 ms with a 1,500 ms delay honoured. Two probe
 * passes were lost to that: the arms looked like a CPU story and were a routing
 * story. So there is no URL for the plane anywhere in this file, and the suite
 * asserts the absence rather than trusting it. */
const PLANE_ORIGIN = "http://plane"; /* a binding ignores the host; this names the
                                        request, it does not route it. */

/* R4, R37, R55 — what this member names to the plane: its namespaces, a run's ops, the meaning arm, an ask's reach. */
import { NAMESPACES } from "./ops.mjs";
/* R119 — THE STEPS: the segment driver, a step, a sub-session and the readers they share are `agent-steps`', which this
 * shell hands the host of its R43 and otherwise only reads from. */
import {
  driveHarness, MAX_STEPS, planeAnswer, publishedPack, loadableLayers, loadLayer, modelHalf, SEGMENT_END_BY,
} from "../../agent-steps/src/index.mjs";
/* R54–R56 — `POST /ask`, in its own file. */
import { handleAsk } from "./ask.mjs";
/* R59 — `POST /draft`, in its own file. */
import { handleDraft } from "./draft.mjs";
/* R66, R67 — `POST /signin`, the relay of a member's own sign-in to their own runner instance, in its own file. */
import { handleSignin, doorTrace, TRACE_HEADER, MEMBER_REF_HEADER } from "./signin.mjs";
/* R72–R75 — `POST /transcribe`, the AI's reading of a page's picture the plane rendered, in its own file. */
import { handleTranscribe } from "./transcribe.mjs";
/* R109, R110 — the one road to a runner (`env.REMOTE`), and whether it may be taken yet. */
import { remoteOf, remoteVersion, remoteReady } from "./remote.mjs";
/* Plan rule 6 — a member-facing sentence is read by key, never written here. */
import { word, localize } from "../../bio-plane/src/setup-words/index.mjs";

/* R32, R33, R71 (K1502, K1755, K2373) — WHICH ACCOUNT SERVES THE ACT: the one that arrived, judged at its own level
 * (`project`, `member` or `group`), in its own file and pure. The account arrives PER CALL beside the `ai` credential and is retained exactly
 * as long: not at all (R36). */
import {
  resolveClaudeCascade, cascadeToken, CASCADE_NO_ACCOUNT, ACCOUNT_KINDS, CASCADE_ORDER, LEVEL_KINDS,
} from "./cascade.mjs";

/* THE MODEL HALF (`agent-model`, T33-55; R58). It runs a judgement's turns inside a step, under the account that serves
 * the member's act and the model its mode names (`MODEL_FOR_MODE`), and decides no step; the table still decides every one. */
import { DEFAULT_MAX_SEGMENT_BYTES, SEGMENT_BYTES_SOURCE, segmentMeter, converse } from "../../agent-model/src/model.mjs";

/* R48 — THE PACK A RUN'S MODEL IS INSTRUCTED BY is the one the plane renders and serves apart on `op=agentpack`
 * (`pack`, control-plane R41: `skills.renderPack` over the composed machine fences), never read from the untargeted
 * `op=affordances` answer (N695). A run, an ask and a draft all read it there. This member renders nothing and
 * imports neither the check catalogue nor `skills`' code (N157, §1a), so its bundle carries what it runs; it holds the
 * pack's version to the one the run recorded. */

/* ------------------------------------------------------ THE SEGMENT BOUND
 *
 * 120 TURNS, AND THE CEILING IT KEEPS CLEAR OF IS CPU — NOT MEMORY. D-312 (2026-09-25,
 * measurements/M-168.md) re-checked this bound, because it was first sized on a misreading:
 * FL-1's `memoryUsageBytesP99 = 120.4 MB at 200 turns` was read with 128 MB as its
 * denominator, as a wall ~200 turns away. The metric is not a share of anything (CPDF-15:
 * 132–240 MB on invocations the platform marks `success`, the kill at 278.7 MB reported;
 * INTERFACES.md §"The memory bound, and how it is expressed"), and walking the same loop up
 * until refused found NO memory wall:
 *
 *   turns (scratch corpus)   400     800     1,200    1,400    — every invocation `success`
 *   transcript               0.68 MB 1.34 MB 2.00 MB  2.34 MB
 *   memoryUsageBytesP99      120.9   107.8   122.7    94.7 MB  — FLAT while the work grows 3.5x
 *   billed CPU / invocation  1.06 s  3.85 s  12.59 s  15.75 s  — ~7-10 ms per MB re-serialised
 *
 * CPU is spent RE-SERIALISING THE TRANSCRIPT every turn, so it grows with the CUMULATIVE
 * BYTES SENT (~turns^2 x bytes per turn), and this member runs under the 30 s DEFAULT (its
 * wrangler.jsonc sets no `limits`): ~3-4 GB re-serialised fits. At FL-1's payload size
 * (~7.2 KB of transcript per turn) that is ~900-1,050 turns; 120 turns there cost ~0.3 s.
 * So 120 is SAFE and carries ~8x headroom — not the ~1.7x its first reading claimed. It is
 * kept, not raised: the payload size of a REAL run is unmeasured and a larger one moves the
 * ceiling down as its square root. A turn count is the wrong UNIT for a CPU bound that
 * scales with bytes (D-611 names the fix: bound the segment on bytes re-serialised).
 *
 * The other two FL-1 numbers that bear on this member, recorded so nobody
 * re-derives them: waiting is effectively free (~0.16 ms billed CPU per awaited
 * subrequest, INDEPENDENT of how long the wait lasts — 25 subrequests held open
 * 2 s each cost 4.29 ms across 50.0 seconds of wall time), so a run that spends
 * its life waiting on model responses is not what bounds a segment; and at least
 * 160 external subrequests per invocation were reached with no refusal, which is
 * a FLOOR on that ceiling rather than the ceiling, because the walk stopped at
 * its own cap. */
const DEFAULT_MAX_TURNS_PER_SEGMENT = 120;
const BOUND_SOURCE = "FL-1 2026-08-08 curve, re-checked by D-312 2026-09-25 (M-168): CPU binds, not memory; "
  + "120 turns is ~1/8 of the ~1,000 the 30 s CPU default fits at FL-1's payload size";

/* The `ai` credential's shape (PL-11). Checked ONLY so an absent or obviously
   malformed credential is refused here instead of costing a round trip — this is
   a shape test and NOT an authorisation test. Whether the credential is live,
   revoked, or scoped to the work being asked for is the PLANE's judgement, read
   from the record, and it is never duplicated here. */
const AI_TOKEN_SHAPE = /^aik-[0-9a-f]{64}$/;

/* D-462, R4 — THE NAMESPACES THIS MEMBER WILL NAME TO THE PLANE: `NAMESPACES` in `ops.mjs`, exactly `bio` or
 * `scratch`, exported there (a Worker entry may export only handlers) so control-plane pins it to its namespace gate
 * (N402). A named namespace outside it is refused here, before the cascade and before any plane call is spent. NOT
 * NAMING ONE is a different condition and keeps its old code, BAD_STORE: the plane defaults an ABSENT `store=`, and
 * this member deliberately does not (see the refusal below). */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    /* R47: no `access-control-allow-origin`. Nothing but the plane's service binding reaches this member, and
       a header inviting a browser origin was an invitation to a caller it must never have. */
    headers: { "content-type": "application/json" },
  });

/* Every refusable condition answers through THIS helper, with the code passed as
   a STRING LITERAL at the site.

   NO DEC-49 CHECK FAMILY IS OWED HERE, AND THAT IS A DECISION RATHER THAN AN
   OMISSION. DEC-49's reach is "every code a SURFACE can receive", which the
   guard's own header records as SMALLER than every refusal code in the plane. No
   member ever receives these codes: this Worker has no member-facing surface and
   its only caller is the plane. DEC-49's guard has never walked the fleet —
   correct for the same reason, and why `pdf-worker`'s BAD_SHA/NOT_FOUND carry
   no rows.

   The convention is followed anyway because it costs nothing and it is what gives
   the guard teeth the day it is pointed here: a local helper taking the code in a
   VARIABLE is invisible to a walk over literals, which is how seven of thirteen
   governed sites once read 776 lines and compared zero codes. The day any surface
   renders one of these verbatim to a member — which FL-3/FL-4 could do while
   composing a run's failure — a family is owed, and so is a check that reads
   these codes. */
const refusal = (code, detail, status, extra) =>
  json({ ok: false, reason: code, code, detail, worker: "agent-worker", ...(extra || {}) }, status);

/* ---------------------------------------------------------------- THE SURFACE
 *
 * What this member answers, as data (R34): `fleet-member.json` names this export,
 * and the suites hold it to the routes the handler actually serves.
 *
 * `mutating` is a property of THIS WORKER and not of what the plane may do
 * downstream, and for a fleet member it must be `false` on every row — fleet
 * rule 2, a member ASSERTS nothing. That is not left to discipline: the suites
 * fail a member that declares a mutating surface op. */
export const SURFACE = {
  run:     { method: "POST", mutating: false },
  ask:     { method: "POST", mutating: false },
  draft:   { method: "POST", mutating: false },
  signin:  { method: "POST", mutating: false },
  /* R34 (T42; N832): the AI's reading of the pages the plane rendered (R72). */
  transcribe: { method: "POST", mutating: false },
  version: { method: "GET",  mutating: false },
};

/* --------------------------------------------------------------- THE ONE CALL
 *
 * Everything this member learns, it learns here. The credential is forwarded
 * exactly as handed over and is never stored, logged or echoed.
 *
 * R60 (F1; K1874): THE CREDENTIAL TRAVELS IN THE `Authorization: Bearer` HEADER
 * AND NOWHERE ELSE. An address is logged, cached and echoed by every hop it
 * passes; a header is not part of it. So the address carries only `op`, `store`
 * and the op's own arguments, a body only the op's own fields, and there is no
 * query form kept as a fallback: the plane reads the header from admission's T35
 * merge, and both ship in one release. A call with no credential (a draft that
 * may read nothing, R59) sends no header at all.
 *
 * REC-52's rule, one layer out: a failure to ANSWER is not an answer. If the
 * plane could not be reached, this member says the plane was silent — it does not
 * convert its own failure into a statement about the record or about who the
 * caller is. */
async function askPlane(env, op, credential, store, query = null, body = null) {
  /* An ask that names no namespace sends none, and the plane's default applies (K1601 (5)); a run always names one (R4). */
  let url = `${PLANE_ORIGIN}/?op=${op}${store == null ? "" : `&store=${encodeURIComponent(store)}`}`;
  for (const [k, v] of Object.entries(query || {}))
    if (v != null && v !== "") url += `&${k}=${encodeURIComponent(String(v))}`;
  const headers = credential ? { authorization: `Bearer ${credential}` } : {};
  let res;
  try {
    res = await env.PLANE.fetch(url, body == null ? { headers } : {
      method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body),
    });
  } catch (e) {
    return { reached: false, detail: String((e && e.message) || e).slice(0, 200) };
  }
  let parsed = null;
  try { parsed = await res.json(); } catch { parsed = null; }
  if (parsed == null) return { reached: false, detail: localize("agent-worker.index.the_plane_answered_status_with", "the plane answered {status} with a body this member could not read as JSON", { status: String(res.status) }) };
  return { reached: true, status: res.status, body: parsed };
}

const modelSilent = (silent, runId) => refusal("MODEL_SILENT",
  localize("agent-worker.index.the_model_api_could_not", "the model API could not be reached, so no judgement was made at this step and the segment stopped. The run is resumable; nothing the table did before this step is lost."), 502,
  { run_id: runId, detail_from_model: silent?.detail ?? null });

const modelRefused = (refused, runId) => refusal("MODEL_REFUSED",
  localize("agent-worker.index.the_model_api_refused_the", "the model API refused the call, or the model declined, so no judgement was made at this step and the segment stopped. The API's own error type and status are beside this, unchanged."), 502,
  { run_id: runId, model_status: refused?.status ?? null, model_error: refused?.type ?? null,
    model_message: refused?.message ?? null });

const planeSilent = (asked) => refusal("PLANE_SILENT",
  localize("agent-worker.index.the_plane_could_not_be", "the plane could not be reached, so this member knows nothing about the record and says so. A failure to answer is not an answer, and reporting one as the other would make this member's own fault read as a fact about the record."), 502, { detail_from_binding: asked.detail });

const planeRefused = (runId, store, asked) =>
  json({ ok: false, reason: "PLANE_REFUSED", worker: "agent-worker", run_id: runId, store,
         detail: localize("agent-worker.index.the_plane_refused_this_members", "the plane refused this member's call under the credential it was handed. Its refusal is passed through exactly as the plane worded it."),
         plane_status: asked.status, plane: asked.body }, 403);

/* R119, agent-steps R43 — WHAT THE STEPS REACH OF THIS SHELL, and nothing else: the one call to the plane, the shell's
   refusal helper and its four fixed refusals, which carry this member's name and words. */
const STEPS_HOST = { askPlane, refusal, planeSilent, planeRefused, modelSilent, modelRefused };

/** R6, R32, R57 (K1502, K1503, K1755) — the account a call carries: `{account, cascade}` or `{refusal}`. `account` is
 *  the account that serves the act of the member who started the run (or asked; a standing question's author), as
 *  `credentials.accountFor` answers it for that act (its R35), with that member and the switch that governs it:
 *  `{kind, level, secret, member, project?, suggestions?}`, `level` `member` (the member's own reference), `group`
 *  (the group's API key, which serves that member's act and is still that member's act) or (T40, T41; R71, K2373)
 *  `project` (a project's account, `credentials` R54, R56: its API key, serving the member's act as the group's does,
 *  or, while the project has one member, that member's own sign-in), `project` the project's id (never a secret),
 *  required at that level and carried at no other. A body still carrying the old cascade's `claude_accounts` is
 *  refused naming that field, and a member whom no account serves has no assistant, refused by name before any plane
 *  call (D-260 as K1503 reads it). The secret is read here for the call it serves and goes no further than
 *  `agent-model` (R36). (T38; N785, K2200) A `signin` account, the member's own sign-in (or a one-member project's,
 *  which is that member's own), is (T47, R82; K3060 D10) `{kind: "signin", level: "member" | "project", member, secret,
 *  suggestions?}`, `secret` the token `credentials` holds for that member: one with no non-empty `secret` is refused
 *  409 `SIGNIN_NOT_HELD` before any plane call or model turn, and one whose `secret` is not a string `BAD_ACCOUNT`.
 *  (T46; N897 (3); credentials R55) Its `suggestions` is the sign-in's own switch, honoured as a reference's is (R56):
 *  absent is off, and one that is not a boolean is refused `BAD_ACCOUNT`. (T41; N796, K2425) Whether a sign-in may serve a standing question's AI half is
 *  `credentials`' (its R32, R55, the sign-in's `standing` use): this module refuses nothing of its own for a sign-in. */
/** R71: a project's id as the account carries it, a short name and never a secret. */
const PROJECT_ID_MAX = 200;
async function accountOf(body) {
  if (body.claude_accounts !== undefined)
    return { refusal: refusal("BAD_ACCOUNT",
      localize("agent-worker.index.claude_accounts_is_the_retired", "claude_accounts is the retired three-level cascade's field: there is no instance Claude account. A call carries the one account that serves the member's act, as account."), 400, { field: "claude_accounts" }) };
  const a = body.account;
  if (a === undefined || a === null)
    return { refusal: refusal("NO_ACCOUNT", word("refusal.NO_ACCOUNT"), 409, { capability: "unavailable" }) };
  if (typeof a !== "object" || Array.isArray(a) || !ACCOUNT_KINDS.includes(a.kind)
      || !CASCADE_ORDER.includes(a.level) || !LEVEL_KINDS[a.level].includes(a.kind)
      || typeof a.member !== "string" || !a.member
      || (a.level === "project"
        ? !(typeof a.project === "string" && a.project && a.project.length <= PROJECT_ID_MAX)
        : a.project !== undefined)
      || (a.kind === "signin" && ((a.secret !== undefined && a.secret !== null && typeof a.secret !== "string")
        || (a.suggestions !== undefined && typeof a.suggestions !== "boolean"))))
    return { refusal: refusal("BAD_ACCOUNT",
      localize("agent-worker.index.account_is_the_account_that", "account is the account that serves the member's act: {shape}, kind one of {kinds}, level one of {levels} (the team's account an API key only), and member the member whose act it serves; a project's account names its project, and no other does; a signin account is the member's own, its secret the token held for that member, and its suggestions switch, when sent, is true or false. What arrived is not one, and this member judges only what it is handed.", { shape: "{kind, level, secret, member}", kinds: ACCOUNT_KINDS.join(", "), levels: CASCADE_ORDER.join(", ") }),
      400, { field: "account" }) };
  /* R82 (T47; K3060 D10): a sign-in serves an act only on the token `credentials` holds for the member; with none held
     (every connection made before T47 among them) the member connects again, and nothing was done. */
  if (a.kind === "signin" && !(typeof a.secret === "string" && a.secret.length > 0))
    return { refusal: refusal("SIGNIN_NOT_HELD", word("refusal.SIGNIN_NOT_HELD"), 409, { capability: "unavailable" }) };
  const cascade = await resolveClaudeCascade(a);
  if (!cascade.available)
    return { refusal: refusal(CASCADE_NO_ACCOUNT, cascade.detail, 409,
      { capability: "unavailable", levels: cascade.levels }) };
  return { account: a, cascade };
}

async function handleRun(req, env) {
  if (typeof env.PLANE?.fetch !== "function")
    return refusal("PLANE_NOT_CONFIGURED",
      localize("agent-worker.index.this_member_reaches_the_record", "this member reaches the record only through the plane service binding, and the binding is absent. It holds no store binding and no credential of its own, so with no plane there is nothing it can do and nothing it could pretend to have done."), 503);

  const body = await req.json().catch(() => null);
  if (body == null)
    return refusal("BAD_BODY", localize("agent-worker.index.the_request_body_could_not", "the request body could not be read as JSON."), 400);

  const checked = await checkRun(body, env);
  if (checked.refusal) return checked.refusal;
  const { runId, store, credential } = checked;

  /* THE ROUND TRIP. One op, non-mutating, under the credential we were handed.
     Whatever this member reports about the credential is the PLANE's statement,
     never this member's inference — D-199 (4) makes the principal the VIEWER the
     credential's reads compile under, so a member-side guess would be a claim
     about who acted, produced by the party least entitled to make it. */
  const asked = await askPlane(env, "whoami", credential, store);
  if (!asked.reached)
    return refusal("PLANE_SILENT",
      localize("agent-worker.index.the_plane_could_not_be_2", "the plane could not be reached, so this member knows nothing about the credential it was handed and says so. A failure to answer is not an answer, and reporting one as the other would make this member's own fault read as a fact about the record."), 502, { detail_from_binding: asked.detail });

  /* A plane REFUSAL is passed through UNCHANGED — its code, its check number and
     its canned translation are the plane's, and re-wording them here is the
     thirteen-surfaces drift DEC-49's guard exists to close. */
  if (asked.status !== 200 || asked.body?.ok !== true)
    return json({ ok: false, reason: "PLANE_REFUSED", worker: "agent-worker",
                  run_id: runId, store,
                  detail: localize("agent-worker.index.the_plane_refused_this_members_2", "the plane refused this member's call under the credential it was handed. Its refusal is passed through exactly as the plane worded it."),
                  plane_status: asked.status, plane: asked.body }, 403);

  /* R110: past R1–R8's checks and before any segment, write or model call (the run stays as it was). A segment whose
     caller supplies the judgements (the stubbed path) takes no model turn and reaches no runner (R28, R58), so there is
     nothing for the gate to hold back. */
  const blocked = Array.isArray(body.judgements) ? null : await assistantReady(env, checked.account);
  if (blocked) return blocked;

  /* R91 — THE SEGMENT OUTLIVES ITS CALLER. With the segment driver bound, the segment is handed to the run's own
     Durable Object, which runs it from an alarm whether or not the plane is still connected, and this answers 202 at
     once (ai-runs R82 waits only for this). With none bound (an instance not yet installed with it), the segment runs
     on this request and answers R28, as it always did; both paths end with the `segment_end` tick. */
  if (segmentsBound(env)) {
    let before;
    try {
      before = await segmentAnswer(env, checked, body, asked.body, doorTrace(req), null, true);
    } catch (e) {
      /* Before any step: no segment started, so nothing is written for it (R10, R57). */
      return refusal("SEGMENT_THREW", localize("agent-worker.index.the_segment_could_not_be", "the segment could not be started for an error of this member's own; the run stays as it was and is resumable."), 500,
        { run_id: runId, detail_from_worker: String((e && e.message) || e).slice(0, 200) });
    }
    if (!before.ready) return before.response;
    let res;
    try {
      const stub = env.SEGMENTS.get(env.SEGMENTS.idFromName(runId));
      const traced = doorTrace(req);
      res = await stub.fetch("http://segment/start", { method: "POST", headers: {
        "content-type": "application/json",
        ...(traced.trace ? { [TRACE_HEADER]: traced.trace } : {}),
        ...(traced.memberRef ? { [MEMBER_REF_HEADER]: traced.memberRef } : {}) },
        body: JSON.stringify({ body, whoami: asked.body }) });
    } catch (e) {
      return refusal("SEGMENT_NOT_ACCEPTED",
        localize("agent-worker.index.the_segment_driver_could_not", "the segment driver could not be reached, so no segment was started and the run stays as it was; it is resumable."), 502, { run_id: runId, detail_from_binding: String((e && e.message) || e).slice(0, 200) });
    }
    if (res.status === 202) return json({ accepted: true, run_id: runId }, 202);
    return res;
  }
  return runSegment(env, checked, body, asked.body, doorTrace(req));
}

/** R2–R7 — the body's own checks, before any plane call: `{refusal}` or the segment's inputs. Pure but for the
 *  account's judgement (R32). */
async function checkRun(body, env) {
  const runId = typeof body.run_id === "string" ? body.run_id : "";
  const store = typeof body.store === "string" ? body.store : "";
  const credential = typeof body.credential === "string" ? body.credential : "";

  /* The run's identity is the PLANE's. This member mints none — a component that
     invents an identifier the record will later cite is a component inventing a
     hop (D-112), and the run log is the plane's own object. */
  if (!runId || runId.length > 200)
    return { refusal: refusal("BAD_RUN_ID",
      localize("agent-worker.index.a_run_is_identified_by", "a run is identified by the plane and this member mints no identity of its own; the caller must say which run this segment belongs to."), 400) };

  if (typeof body.store !== "string")
    return { refusal: refusal("BAD_STORE",
      localize("agent-worker.index.a_run_happens_inside_one", "a run happens inside one namespace and this member guesses none: the caller must say which. A default namespace here would let a run touch the real record while its caller believed it was working in a scratch one."), 400) };
  /* D-462: a NAMED namespace that is not exactly one of NAMESPACES — `biosmoke`, `Scratch`, an empty string — is
     refused by the plane's own code, with the plane's `asked`/`namespaces` beside it, and nothing was called. */
  if (!NAMESPACES.includes(store))
    return { refusal: refusal("NAMESPACE_UNKNOWN", word("refusal.NAMESPACE_UNKNOWN"), 400,
      { asked: store.slice(0, 80), namespaces: [...NAMESPACES] }) };

  /* A SHAPE test, never an authorisation test — see AI_TOKEN_SHAPE above. */
  if (!credential)
    return { refusal: refusal("NO_CREDENTIAL",
      localize("agent-worker.index.this_member_holds_no_credential", "this member holds no credential of its own and cannot act except under one it is handed. There is no fallback identity here by design: a worker that could act unattended would be acting as nobody, and nothing it did could be attributed."), 401) };
  if (!AI_TOKEN_SHAPE.test(credential))
    return { refusal: refusal("BAD_CREDENTIAL_SHAPE",
      localize("agent-worker.index.the_credential_handed_to_this", "the credential handed to this member is not shaped like one this plane issues. Whether a well-shaped credential is live, withdrawn, or scoped to this work is the plane's judgement and is never made here."), 400) };

  /* R6, R32, R57 (K1502, K1503) — THE MEMBER'S OWN ACCOUNT, JUDGED BEFORE ANY PLANE CALL IS SPENT ON THIS RUN. */
  const acct = await accountOf(body);
  if (acct.refusal) return { refusal: acct.refusal };
  const { account, cascade } = acct;

  /* R7: a positive number, else 120 — `Number(x) || 120` let a negative setting become the bound. */
  const bound = Number(env.MAX_TURNS_PER_SEGMENT) > 0 ? Number(env.MAX_TURNS_PER_SEGMENT) : DEFAULT_MAX_TURNS_PER_SEGMENT;
  const requested = body.turns == null ? bound : Number(body.turns);
  if (!Number.isFinite(requested) || requested < 1)
    return { refusal: refusal("BAD_TURNS", localize("agent-worker.index.turns_must_be_a_positive", "turns must be a positive number of model turns for this segment."), 400) };
  /* REFUSED rather than silently clamped. A caller that asked for 400 turns and
     got 120 without being told believes it saw a whole run; the same reasoning
     that makes the plane's read bounds refuse rather than truncate. */
  if (requested > bound)
    return { refusal: refusal("SEGMENT_OVER_BOUND",
      localize("agent-worker.index.a_segment_is_bounded_at", "a segment is bounded at {bound} model turns and {requested} were asked for. The bound is not a policy choice: it keeps the segment clear of the isolate's CPU ceiling, measured (M-168), which a longer segment would meet. Split the run across segments — resuming is what segments are for.", { bound: String(bound), requested: String(requested) }),
      400, { turns_requested: requested, turns_bound: bound, bound_source: BOUND_SOURCE }) };

  return { runId, store, credential, account, cascade, bound, requested };
}

/** R91 — ONE SEGMENT, run to its end: on the request when no driver is bound, or from the run's Durable Object's alarm
 *  (`SegmentDriver`). It answers R28 or the refusal that ended it, and, whatever ended it, first sends the plane one
 *  `op=airuntick` carrying `segment_end: {by, done, refusals, error?}` (`SEGMENT_END_BY`), so the plane learns every segment's
 *  end even when nobody is left to read the answer. `deadline` is the segment's wall bound, when it has one. `beforeEnd` (R93)
 *  is called once the segment's end is known and before that tick is sent: the driver marks the segment not running there,
 *  so the next segment the plane dispatches from inside the tick (ai-runs R84) is accepted. */
async function runSegment(env, checked, body, whoami, traced, deadline = null, beforeEnd = null) {
  const { runId, store, credential } = checked;
  let answer;
  try {
    answer = await segmentAnswer(env, checked, body, whoami, traced, deadline);
  } catch (e) {
    /* An error is a segment's end whenever it came, the run having been handed to this segment. */
    answer = { response: refusal("SEGMENT_THREW",
      localize("agent-worker.index.the_segment_stopped_on_an", "the segment stopped on an error of this member's own, so it ended where it stood; what it already logged and wrote stays, and the plane is told the segment ended."), 500,
      { run_id: runId, detail_from_worker: String((e && e.message) || e).slice(0, 200) }),
      end: { by: SEGMENT_END_BY.error, done: false, refusals: [], error: "SEGMENT_THREW" } };
  }
  if (beforeEnd) await beforeEnd();
  /* The plane's answer to this tick changes nothing here: the segment has already ended. */
  if (answer.end)
    await askPlane(env, "airuntick", credential, store, null, { run: runId, segment_end: answer.end })
      .catch(() => null);
  return answer.response;
}

/** R91: the codes of R28's `refusals`, each named once, in order. */
const refusalCodes = (list) => [...new Set((list || []).map((r) => r && (r.code ?? r.reason))
  .filter((c) => typeof c === "string" && c))];

async function segmentAnswer(env, checked, body, whoami, traced, deadline, preflight = false) {
  const { runId, store, credential, account, cascade, bound, requested } = checked;
  const progress = { started: false };

  /* ------------------------------------------------------- FL-3: DRIVE THE TABLE
   *
   * Everything below is `agent-harness`' decision and this function's plumbing.
   * The split is deliberate and it is the item: the TABLE is pure and a suite
   * walks it with no network at all, and this driver is the part that turns a
   * row into a plane call. A driver that decided anything would be a second
   * control flow nobody could exhaust. */
  /* R58 — MODEL TURNS RUN, through `agent-model`, when the account that serves the member's act arrived (it always has,
     past R6) and the caller supplied no judgements; `judgements` in the body is the stubbed path, in which no turn is taken. The
     reference is handed to `agent-model` for the calls it serves and kept by nothing here (R33, R36). A sign-in's
     turns reach `agent-runner` through the Container Durable Object binding (R35), passed as it is bound. */
  const bytesBound = Number(env.MAX_SEGMENT_BYTES) > 0 ? Number(env.MAX_SEGMENT_BYTES) : DEFAULT_MAX_SEGMENT_BYTES;
  const meter = segmentMeter({ turnsBound: requested, bytesBound });
  const modelMode = !Array.isArray(body.judgements);
  const model = modelMode
    ? modelHalf({ reference: (await cascadeToken(account)).reference, runner: remoteOf(env), meter,
                  suggestions: account.suggestions, traced })
    : null;

  const drive = await driveHarness(STEPS_HOST, env, {
    runId, store, credential, account, model, preflight,
    judgements: Array.isArray(body.judgements) ? body.judgements : [],
    maxSteps: Number(body.max_steps) > 0 ? Math.min(Number(body.max_steps), MAX_STEPS) : MAX_STEPS,
    deadline, progress,
  });
  if (drive.ready) return { ready: true };
  /* R91: a refusal that ended the segment is answered as it always was, and its code ends the segment's `segment_end`.
     One before the first step (R8–R11, R48: the run, its payer, its pack, its log) is a segment that never started, and
     nothing is written for it (R10, R57: the run stays as it was). */
  if (drive.refusal) {
    const said = await drive.refusal.clone().json().catch(() => ({}));
    return { response: drive.refusal, end: progress.started
      ? { by: SEGMENT_END_BY.refusal, done: false, refusals: refusalCodes([said]) } : null };
  }

  return { end: { ...drive.segmentEnd, refusals: refusalCodes(drive.refusals) }, response: json({
    ok: true,
    run_id: runId,
    store,
    /* WHAT WAS ACTUALLY DONE, NAMED (R28, R58). `stage: "harness"` says the deterministic table ran; `turns_run` is the
       number of model turns this segment actually ran through `agent-model` (0 when none ran), and `judgement_source`
       says whose judgements the table applied: `model` (the turns') or `body` (the caller's, the stubbed path). The
       two never mix in one segment: supplied judgements turn the model half off for it. */
    stage: "harness",
    turns_run: meter.turns,
    judgement_source: modelMode ? "model" : "body",
    judgement_note: modelMode
      ? localize("agent-worker.index.the_control_flow_table_ran", "the control-flow table ran and the judgements inside its steps were made by model turns run through agent-model ({turns}), under the Claude account that serves the member's act ({v1}) and the skill pack the run names; the sub-sessions ran one per level and returned REPORTS", { turns: String(meter.turns), v1: String(cascade.level === "group" ? "the team's API key" : cascade.level === "project" ? "the project's"
          : "the member's own") })
      : localize("agent-worker.index.the_control_flow_table_ran_2", "the control-flow table ran and its judgements arrived from the caller (the body), so no model turn was taken (turns_run: 0). Stated rather than presented as a model run."),
    /* R29 — WHICH ACCOUNT, secret-free by construction: its kind, its level (the member's own, a project's, R71, or the
       group's API key, K1755), the member whose act it serves and, for a project's, the project (an id). A call with
       none never reaches here (R6 refused it by name before any step). */
    claude_account: { available: true, kind: cascade.kind, level: cascade.level, member: cascade.member,
                      ...(cascade.level === "project" ? { project: cascade.project } : {}) },
    mode: drive.mode,
    trace: drive.trace,
    passes: drive.passes,
    ended: drive.ended,
    logged: drive.logged,
    /* REC-100 / IC-130 — WHAT THE LOG DID NOT TAKE, AND WHAT IT TOOK AS LESS.
       `log_refused` names every step entry the plane refused (also in
       `refusals`), so `logged` + `log_refused.length` is what this segment SENT;
       `present_unbacked` counts steps where the model judged PRESENT and the
       entry could name nothing, so it was recorded LOOKED_INDETERMINATE. */
    log_refused: drive.logRefused,
    present_unbacked: drive.presentUnbacked,
    submitted: drive.submitted,
    refusals: drive.refusals,
    adjusted: drive.adjusted,
    verbatim_resubmits: drive.verbatimResubmits,
    resumed_from: drive.resumedFrom,
    /* FL-11: the question this run's readings default to, and WHY (`runContextTarget`) — published so a
       reader can check it against the run's context rather than take it on this member's word. */
    target: drive.target,

    /* FL-5 / IS-9(a) ON THE WIRE. `fanout.contracts` is exactly what each
       sub-session was handed — the party protected by §14's fence can be read
       from outside instead of trusting this member's own summary of itself.
       `reports_refused` names every return that broke the contract, because a
       sub-session that returns documents has defeated the architecture and that
       is a fact about the run, not a detail of its plumbing. */
    fanout: drive.fanout,
    reports_taken: drive.reportsTaken,
    reports_refused: drive.reportsRefused,
    citations_reread: drive.citationsReread,
    /* D-220 ON THE WIRE. `citations_reread` counts READS; this counts DOCUMENTS,
       each once with its versions, by the record's own chain — the figure a
       reader may take as what the run held. */
    holdings: drive.holdings,
    budget: drive.budget,
    /* D-611: the segment's two bounds and what it spent against each; `stopped` names the one that ended the
       SEGMENT (never the run, whose `ended` stays null), or null. */
    segment: { turns_requested: requested, turns_bound: bound, bound_source: BOUND_SOURCE,
               turns_run: meter.turns, bytes_sent: meter.bytes, bytes_bound: bytesBound,
               bytes_source: SEGMENT_BYTES_SOURCE, stopped: drive.segmentStopped ?? null },

    /* THE PLANE'S STATEMENT ABOUT THE CREDENTIAL, COPIED AND NOT INTERPRETED.
       What the plane publishes here is the class it resolved the credential to
       and the namespace it confined the call to. Both are facts the plane
       decided; this member re-derives neither. */
    plane_says: {
      token_class: whoami?.result?.tokenClass ?? whoami?.tokenClass ?? null,
      store: whoami?.store ?? null,
      session: whoami?.result?.session ?? null,
    },

    /* AND THE PART THAT IS UNDETERMINED, STATED RATHER THAN GUESSED OR OMITTED.
       D-199 (4) makes the PRINCIPAL the credential's operative identity — the
       viewer its reads compile under, `member:<id>` or `class:ai` — and FL-6 has
       to record it beside the model account that paid. **No read op an agent can
       call publishes its OWN principal**: `op=whoami` answers `tokenClass: "ai"`,
       `member: null`, and names no principal at all (measured against
       `bio-plane/src/index.mjs` at FL-2). So this member says the principal is
       unpublished and names why, rather than defaulting it, inferring it from the
       class, or dropping the field — a run that quietly reported no principal
       cannot be told from one acting for nobody. */
    principal: null,
    principal_source: "UNPUBLISHED — no read op an ai credential may call states its own principal (D-199 (4))",

    plane: { version: whoami?.version ?? null, op: "whoami" },
    worker: { name: "agent-worker", version: env.VERSION || "0.0.0" },
  }) };
}

/* Fleet rule 4: each member versions and rolls out on its own, so "a deploy
   verified is not a build serving" (D-108) has a second face — the plane can be
   current while the sibling it calls is still serving the previous build, and
   that window is invisible to both. A verification must establish which build
   ANSWERED. This is how this member answers that question about itself. */
async function handleVersion(env) {
  return json({ ok: true, name: "agent-worker", version: env.VERSION || "0.0.0", model_turns: MODEL_TURNS,
                runner: (await remoteVersion(env)).answered });
}

/** R110 — THE GATE: until the remote path works on a copy, that copy's assistant does not run (K3610). A member's own
 *  sign-in is the only account that reaches `REMOTE`; for one, the call proceeds only when the remote class answers its
 *  version and the member's last `check` (R111) passed at that version: otherwise 503 `ASSISTANT_REMOTE_NOT_READY`,
 *  its `detail` the record's word (DEC-301; R64), `why` naming `absent`, `silent` or `unchecked`. An API-key account
 *  is unchanged (it never reaches `REMOTE`; K3347). Null when the call may go on. Made after R1–R8's shape checks and
 *  before any plane write, model call or segment, so a refused `/run` leaves its run as it was (R57). */
async function assistantReady(env, account) {
  if (account?.kind !== "signin") return null;
  const got = await remoteReady(env, account.member);
  if (got.ready) return null;
  return refusal("ASSISTANT_REMOTE_NOT_READY", word("refusal.ASSISTANT_REMOTE_NOT_READY"), 503,
                 { capability: "unavailable", why: got.why });
}

/* R91 (R085-8; K3477; WALK-085 F2) — THE SEGMENT DRIVER: one Durable Object per run (`SEGMENTS`, named by the run id), so
   a segment outlives the request that started it. Live, the plane dropped `/run` after 30 s and the segment, living
   only on that connection, died with it, its answer never read; `waitUntil` would hold it 30 s more and no longer.

   It holds the segment's inputs IN MEMORY ONLY, from the `/start` that hands them over to the alarm that runs them:
   the credential and the account are never written to storage (R36), only the alarm's time is. An object evicted in
   between runs nothing, and the plane's lease ends the run (ai-runs R83). The alarm runs the segment under a wall
   bound (`MAX_SEGMENT_MS`, else 10 minutes) clear of an alarm's own 15-minute limit, so a long segment ends as a
   segment bound and the plane dispatches the next (ai-runs R84), never as a killed handler. A second segment of a run
   whose segment is still held or running is refused `SEGMENT_RUNNING`: two would race the run's published state. */
const DEFAULT_SEGMENT_WALL_MS = 10 * 60 * 1000;
const segmentsBound = (env) => typeof env.SEGMENTS?.idFromName === "function" && typeof env.SEGMENTS?.get === "function";
const segmentWallMs = (env) => (Number(env.MAX_SEGMENT_MS) > 0 ? Number(env.MAX_SEGMENT_MS) : DEFAULT_SEGMENT_WALL_MS);

export class SegmentDriver {
  constructor(state, env) { this.state = state; this.env = env; this.pending = null; this.running = false; }

  async fetch(req) {
    if (this.pending || this.running)
      return refusal("SEGMENT_RUNNING",
        localize("agent-worker.index.a_segment_of_this_run", "a segment of this run is still running, so no second one was started; the plane is told when it ends."), 409);
    const got = await req.json().catch(() => null);
    if (!got || typeof got.body !== "object" || got.body === null)
      return refusal("BAD_BODY", localize("agent-worker.index.the_request_body_could_not_2", "the request body could not be read as JSON."), 400);
    const checked = await checkRun(got.body, this.env);
    if (checked.refusal) return checked.refusal;
    this.pending = { checked, body: got.body, whoami: got.whoami ?? null, traced: doorTrace(req) };
    await this.state.storage.setAlarm(Date.now());
    return json({ accepted: true, run_id: checked.runId }, 202);
  }

  async alarm() {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    this.running = true;
    let released = false;
    /* R93: the segment is over before the plane hears it: its `segment_end` tick may dispatch the run's next segment
       within that very call, and that `/run` must find this object free, not `SEGMENT_RUNNING`. */
    const release = () => { released = true; this.running = false; };
    try {
      await runSegment(this.env, p.checked, p.body, p.whoami, p.traced, Date.now() + segmentWallMs(this.env), release);
    } finally {
      if (!released) this.running = false;
    }
  }
}

/* R110, R111 (BOB's K3693) — THE MEMBER'S CHECK RECORD, in this member's own storage: one instance per member (`CHECKS`),
   holding the version at which that member's last `check` passed and the time, and nothing else (R36). `GET /check`
   answers `{ok: true, checked, version}`; `POST /check` with `{version}` records a pass (R111's `check` step makes it).
   Only the gate reads it (`remoteReady`); it is not a store of the record and writes nothing of it. */
export class CheckRecord {
  constructor(state) { this.state = state; }

  async fetch(req) {
    if (new URL(req.url).pathname !== "/check") return refusal("UNKNOWN", localize("agent-worker.index.get_or_post_check_only", "GET or POST /check only."), 404);
    if (req.method === "GET") {
      const held = await this.state.storage.get("check");
      return json({ ok: true, checked: !!held, version: held?.version ?? null });
    }
    if (req.method === "POST") {
      const got = await req.json().catch(() => null);
      if (!(got && typeof got.version === "string" && got.version && got.version.length <= 200))
        return refusal("BAD_BODY", localize("agent-worker.index.a_check_is_recorded_with", "a check is recorded with the version it passed at: a non-empty string."), 400);
      await this.state.storage.put("check", { version: got.version, at: Date.now() });
      return json({ ok: true });
    }
    return refusal("UNKNOWN", localize("agent-worker.index.get_or_post_check_only_2", "GET or POST /check only."), 404);
  }
}

/* R54, R59 — what `/ask` (ask.mjs) and `/draft` (draft.mjs) use of this shell: one route to the plane, one refusal
   helper, one account judgement. */
const ASK_DEPS = { refusal, json, askPlane, planeAnswer, publishedPack, accountOf, cascadeToken, modelHalf,
                   loadableLayers, loadLayer, converse, segmentMeter, NAMESPACES, DEFAULT_MAX_SEGMENT_BYTES,
                   assistantReady };

/* R58 — ONE TRUTH FOR MODEL TURNS, the sentence this member states about itself on `GET /version`, and the same one its
   header and its `/run` answer state. */
const MODEL_TURNS = "run through agent-model exactly when the Claude account that serves the member's act (the "
  + "member's own reference or sign-in, a project's account, or the team's API key) arrives with the call and the mode of the run (/run), ask (/ask), "
  + "draft (/draft) or transcription (/transcribe) has turns to run; a segment whose caller supplies the judgements runs none";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/+/, "");
    if (req.method === "GET" && path === "version") return await handleVersion(env);
    if (req.method === "POST" && (path === "run" || path === "")) return handleRun(req, env);
    if (req.method === "POST" && path === "ask") return handleAsk(req, env, ASK_DEPS);
    if (req.method === "POST" && path === "draft") return handleDraft(req, env, ASK_DEPS);
    if (req.method === "POST" && path === "signin") return handleSignin(req, env, ASK_DEPS);
    if (req.method === "POST" && path === "transcribe") return handleTranscribe(req, env, ASK_DEPS);
    return refusal("UNKNOWN", localize("agent-worker.index.post_run_post_ask_post", "POST /run, POST /ask, POST /draft, POST /signin, POST /transcribe or GET /version only."),
      404);
  },
};
