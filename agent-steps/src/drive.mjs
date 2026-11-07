/* agent-steps — the segment driver (R1–R5, R14–R16, R34, R41–R43; moved from `agent-worker`). `host` is the shell's six functions (R43). */
/* Requirement ids in the comments below are `agent-worker`'s, as they stood when this code moved (T51, K3850); `build/requirements/agent-steps.md` maps them to this module's. */
import { FIRST_STEP, LEVELS, BUDGET_BOUNDS, passLimit, nextStep, stepLog, applyJudgement, runContextTarget, advance, publishableState, resumeFrom, PLAN_FLOW, PLAN_MAX_PASSES, OPTION_KEYS, flowFor, nextPlanStep, planAdvance, applyPlanJudgement, resumeTargets } from "../../agent-harness/src/harness.mjs";
import { SUBSESSION_OPS } from "../../agent-harness/src/subsession.mjs";
import { judgeTools, planJudgeTools, LOAD_LAYER, parentSystem, openRow, rowFacts } from "../../agent-model/src/model.mjs";
import { AI_RUN_STATE_MAX_BYTES } from "../../bio-plane/src/run-rules/index.mjs";
import { toolContent, droppedNote } from "./reads.mjs";
import { SEGMENT_END_BY } from "./names.mjs";
import { loggable, conditionFault, CONDITIONS, JUDGED_WITH_CONDITION, LOG_DETAIL_MAX } from "./entries.mjs";
import { planeAnswer, publishedPack, loadableLayers, loadLayer } from "./plane.mjs";
import { performStep, performPlanStep } from "./work.mjs";
import { talk, rowRole, gateOne } from "./talk.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/* THE ONLY BOUND ON THE DRIVER ITSELF, and it is not the run's budget.
 *
 * The run's budget (fetches, sub-sessions, wall time) is the RECORD's and is
 * spent through the plane. This is a different and smaller thing: a ceiling on
 * how many TABLE ROWS one invocation walks, so a table defect cannot spin an
 * isolate. It is deliberately not called a budget and it never appears as the
 * bound a run stopped on — a driver ceiling reported as a run's bound would be
 * this member's own fault read as a fact about the record, which is REC-52's
 * rule and the one this Worker already applies to a silent plane. */
export const MAX_STEPS = 400;

/* R99 — the clock `wallclock` is measured on: `env.CLOCK` when a function (a test injects one), else `Date.now`. */
/** R54: a write's `idem`, `<run>:<pass>:<step>:<n>`. `n` is the write's place among the step's writes and, after a dot,
 *  a digest of what it writes (its body or query less `idem`, `consume` and `usage`, the spend and the clock): a step
 *  re-run after a stop sends the same writes under the same keys, and a changed write (an adjusted candidate, a later
 *  visit of the same step in the pass) a new key, never one the plane would read as a repeat. Pure. */
export function idemKey(run, pass, step, n, content) {
  const { idem: _i, consume: _c, usage: _u, ...rest } = content && typeof content === "object" ? content : {};
  return `${run}:${pass}:${step}:${n}.${digest(stable(rest))}`;
}
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`
  : JSON.stringify(v ?? null));
/* FNV-1a, 32 bits, as eight hex digits: a key, not a seal. */
const digest = (text) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
};

/** R54: the ops whose calls are writes, each carrying its `idem`. */
export const WRITE_OPS = new Set(["airunspawn", "capturerequest", "suggest", "optionpropose", "airuntick", "airunclose"]);

/** R56 (T53; AIR25, BR29) — the label of the conversation that judged a row, on what that judgement produced: the
 *  targets a plan names, the candidates a compose forms (those the state did not hold before it) and the submission an
 *  adjust changes. `produced_by` is deduplicated, in order, each label copied unchanged. A candidate the table makes
 *  (`level-empty`, made after the judgement by the row's work) is never stamped. Pure. */
const sameLabel = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function withProducer(item, label) {
  if (!item || typeof item !== "object" || !label) return item;
  const list = Array.isArray(item.produced_by) ? item.produced_by : [];
  return list.some((l) => sameLabel(l, label)) ? item : { ...item, produced_by: [...list, label] };
}
function producedBy(state, prior, label, judgement) {
  const out = { ...state };
  const had = new Set(Array.isArray(prior?.candidates) ? prior.candidates : []);
  if (judgement && typeof judgement === "object" && Array.isArray(judgement.targets) && Array.isArray(state.targets))
    out.targets = state.targets.map((t) => withProducer(t, label));
  if (judgement && typeof judgement === "object" && Array.isArray(judgement.candidates) && Array.isArray(state.candidates))
    out.candidates = state.candidates.map((c) => (had.has(c) ? c : withProducer(c, label)));
  if (state.step === "adjust" && state.submission && state.submission !== prior?.submission)
    out.submission = withProducer(state.submission, label);
  return out;
}

export const wallNow = (env) => (typeof env?.CLOCK === "function" ? Number(env.CLOCK()) : Date.now());

/** FL-3's DRIVER. It turns each row of `agent-harness`' table into plane calls
 *  and appends an observation entry for EVERY step — including the last one, and
 *  including the steps of a run that ends badly (§14b.6: log-always).
 *
 *  IT DECIDES NOTHING. `nextStep` picks the step, `stopBecause` names the bound,
 *  `applyJudgement` polices what a judgement may touch, and `adjustedFrom`
 *  answers F10's precondition. Every one of those is in `agent-harness`, is pure,
 *  and is driven directly by the suite as well as through this function — so a
 *  decision made here instead would be a decision nothing exhaustive covers. */
export async function driveHarness(host, env, { runId, store, credential, judgements, maxSteps, account = null, model = null,
                                    deadline = null, progress = null, preflight = false }) {
  /* EVERY PLANE CALL IS COUNTED, AND THE COUNT IS WHAT SPENDS `runtime`.
     §14b.6 named `runtime-ceiling-reached` as a word the record had with no
     writer, and IS-9(d) as the item that builds the producer. This counter IS
     that producer: `runtime` is the platform's CPU/subrequest ceiling (D-54,
     D-56), a subrequest is what this member spends against it, and FL-1 measured
     the floor at 160 external subrequests per invocation. The harness spends;
     the PLANE decides the bound is exhausted and writes the condition at its own
     one exit. Nothing here emits the word. */
  let calls = 0;
  const { askPlane, refusal, planeSilent, planeRefused, modelSilent, modelRefused } = host;
  /* R54 (T53; AIR28, BR27) — RETRIED TURNS NEVER DUPLICATE WRITES. Every write a step makes carries `idem`
     `<run>:<pass>:<step>:<n>`, `n` its place among the step's writes, so a step re-run after a stop sends the same keys
     and the plane holds each write once; a write before the first step is the dispatch's. */
  const idem = { pass: 0, step: "dispatch", n: 0 };
  const call = (op, query, body) => {
    calls += 1;
    if (WRITE_OPS.has(op)) {
      idem.n += 1;
      const key = idemKey(runId, idem.pass, idem.step, idem.n, body ?? query);
      if (body != null) body = { ...body, idem: key }; else query = { ...(query || {}), idem: key };
    }
    return askPlane(env, op, credential, store, query, body);
  };
  /* R114: the plane calls a tick has already spent. A step's own tick spends the rest; a tick sent inside a step (a
     re-read's, R114) spends the calls since the last and moves this on. */
  const accounted = { at: 0 };
  const trace = [];
  const refusals = [];
  let logged = 0, submitted = 0, adjusted = 0, verbatimResubmits = 0;
  /* REC-100 / IC-130: every log entry the plane REFUSED, named with its step,
     and every step whose model-judged PRESENT was recorded as indeterminate
     because it could name nothing (`stepLog`'s note). Both are published. */
  const logRefused = [];
  let presentUnbacked = 0;

  /* THE RUN'S OWN FACTS COME FROM THE RECORD, NEVER FROM THE CALLER.
     The MODE above all: SK-4's gate is only a gate while the mode is the
     record's. A `mode` in the request body would be a gate the caller holds,
     which is the defect §14b.4 names one layer up. */
  const runRead = planeAnswer(await call("airun", { run: runId }), "airun");
  if (runRead.silent)
    return { refusal: planeSilent(runRead.silent) };
  /* D-276: this site DID check the answer, at the ENVELOPE. It is routed through
     `planeAnswer` so it also sees a refusal the control plane wrapped inside
     `result` — the shape the meaning read was actually refused in. A store-level
     refusal used to fall through here as a session-less body and be re-worded as
     this member's own NO_SUCH_RUN, which is a different sentence from the plane's
     and is the one thing a member may never do to a refusal (A6). */
  if (runRead.refused)
    return { refusal: planeRefused(runId, store,
      { status: 403, body: runRead.refused.plane ?? null }) };
  const session = runRead.result?.session ?? null;
  if (!session)
    return { refusal: refusal("NO_SUCH_RUN",
      localize("agent-steps.drive.the_plane_holds_no_run", "the plane holds no run under that id in this namespace, so there is nothing to continue. This member opens no run: a run's identity and its conditions are the plane's, and a member that could open one would be a machine deciding what it was formed under."), 404, { run_id: runId }) };

  /* R10, R57 (K1502, K1503, K1755) — THE MEMBER WHOSE ACT THE RUN RECORDS AND THE MEMBER WHOSE ACT THE ARRIVED ACCOUNT
     SERVES MUST BE THE SAME MEMBER. (T41; ai-runs R52, K2489) The run records the member whose act started it (a
     standing question's author) as `session.principal.ref` (`principal_claude_ref`, `member:<id>`) and the owner who
     pays as `session.principal.claude` (`member:<id>`, `project:<id>` or `group`), which is read here never: a run the
     group's or a project's key pays is still that member's act. This segment was handed the account that serves one
     member's act:
     that member's own reference, or the group's or a project's API key (`level: "group"`, `"project"`, R71), which
     serves that member's act and never the group's or the project's own, so the run stays that member's act. When the two members differ, driving on would spend one
     member's act on another's run, which K1502 forbids and nobody could audit. Refused before any step, naming both
     members (ids, never a secret); this member re-words neither. Every segment carries an account (R6), the stubbed
     `judgements` path included, so the check is made on every segment. */
  const recordedPayer = session.principal?.ref ?? null;
  if (account && recordedPayer !== account.member)
    return { refusal: refusal("RUN_NAMES_A_DIFFERENT_PAYER",
      localize("agent-steps.drive.the_runs_own_record_says", "the run's own record says it is the act of {stringify}, but the Claude account handed to this segment serves {stringify_2}'s act ({v1}). A run is continued only under the account that serves the member whose act started it, never another member's (K1502, K1755, D-260), so no step was taken and the run stays as it was. The caller handed the account for the wrong member, or the run recorded the wrong member.", { stringify: String(JSON.stringify(recordedPayer)), stringify_2: String(JSON.stringify(account.member)), v1: String(account.level === "group"
        ? localize("agent-steps.drive.the_team_s_api_key_serving", "the team's API key, serving that member") : account.level === "project"
        ? localize("agent-steps.drive.the_project_s_account_serving", "the project's account, serving that member") : localize("agent-steps.drive.that_member_s_own_reference", "that member's own reference")) }),
      409, { run_id: runId, recorded: recordedPayer, supplied: account.member }) };

  /* R2 (T53; AIR25, BR18) — AN ACCOUNT NEVER CHANGES SILENTLY. The paying owner and account may differ from those
     recorded at the open (after a hop, ai-runs R92, by design), but an arrived `account_id` that differs from the last
     row of `session.segments` (ai-runs R19, R91) is refused: a hop writes the next segment's row, with its `hop_in`, in the
     dispatch's own transaction (ai-runs R92), so a segment on another account with no row of its own is one no hop made. It is refused before any step, naming both ids.
     A record that publishes no segments, or an account carrying no id, gives nothing to compare. */
  const segs = Array.isArray(session.segments) ? session.segments.filter((x) => x && typeof x === "object") : [];
  const lastSeg = segs.length ? segs[segs.length - 1] : null;
  const arrivedId = account && typeof account.account_id === "string" && account.account_id ? account.account_id : null;
  if (lastSeg && arrivedId && typeof lastSeg.account_id === "string" && lastSeg.account_id !== arrivedId)
    return { refusal: refusal("ACCOUNT_CHANGE_UNRECORDED",
      localize("agent-steps.drive.account_change_unrecorded", "the account handed to this segment is not the one the run's last segment ran on, and the record holds no hop between them, so no step was taken: a run's account never changes silently."),
      409, { run_id: runId, recorded: lastSeg.account_id, supplied: arrivedId }) };

  /* R48 — THE PACK, AS THE PLANE PUBLISHED IT, HELD TO THE RUN'S RECORD, BEFORE ANY TURN. Only when model turns run:
     until then the pack instructs nothing and this changes nothing. */
  if (model) {
    const pub = planeAnswer(await call("agentpack"), "agentpack");
    if (pub.silent) return { refusal: planeSilent(pub.silent) };
    if (pub.refused) {
      const refused = planeRefused(runId, store, { status: 403, body: pub.refused.plane ?? null });
      await settleAtDispatch({ call, runId, session, code: pub.refused.code ?? "PLANE_REFUSED",
                               why: localize("agent-steps.drive.the_plane_refused_the_read_of", "the plane refused the read of the skill pack") });
      return { refusal: refused };
    }
    const pack = publishedPack(pub.result);
    const recordedSkill = session.principal?.skill ?? null;
    if (!pack.ok || recordedSkill !== pack.pack.version) {
      /* R107: the run cannot continue under another pack, and the plane's lease would lapse with its composed work unwritten. */
      const lapse = await settleAtDispatch({ call, runId, session, code: "SKILL_VERSION_MISMATCH",
        why: pack.ok ? localize("agent-steps.drive.the_run_recorded_recordedskill_and", "the run recorded {recordedSkill} and the plane publishes {version}", { recordedSkill: String(recordedSkill), version: String(pack.pack.version) })
          : localize("agent-steps.drive.the_plane_published_no_skill", "the plane published no skill pack this member can use ({why})", { why: String(pack.why) }) });
      return { refusal: refusal("SKILL_VERSION_MISMATCH",
        localize("agent-steps.drive.v1_no_turn_was_taken", "{v1} No turn was taken.{v2}", { v1: String(pack.ok
          ? localize("agent-steps.drive.the_run_s_record_says_it", "the run's record says it runs under one skill pack and the pack the plane publishes is another, so its model would be instructed by words the record does not name.")
          : localize("agent-steps.drive.the_plane_published_no_skill_instruct", "the plane published no skill pack this member can instruct a model with, so the pack's version is UNDETERMINED and cannot be held to the one the run recorded ({why}).", { why: String(pack.why) })), v2: String(lapse
          ? localize("agent-steps.drive.the_run_cannot_be_continued", " The run cannot be continued under another pack, so what it composed was written where the plane accepted it and the run was closed (R107).")
          : localize("agent-steps.drive.the_run_is_resumable", " The run is resumable once the two agree.")) }), 409,
        { run_id: runId, recorded: recordedSkill, rendered: pack.ok ? pack.pack.version : null,
          ...(pack.ok ? {} : { rendered_basis: "UNDETERMINED", pack_absent: pack.why }),
          ...(lapse ? { lapse } : {}) }) };
    }
    const { pack: held } = pack;
    model.pack = held;
    model.messages = [];
    model.system = parentSystem(held);
    /* R52: a plan-mode run judges with `optionPropose`'s fields only; every other mode with the search table's. */
    /* R56 (K1479, K1502, K1755): the `suggestions` layer is loadable only when the switch that governs the act is on. */
    model.layers = loadableLayers(held, model.suggestions);
    model.tools = [LOAD_LAYER(model.layers),
                   /* R117 (agent-model R23): the record's conditions, so the judging tools offer them and a model names one. */
                   ...(session.mode === "plan" ? planJudgeTools(OPTION_KEYS) : judgeTools(LEVELS, CONDITIONS))];
  }

  /* R51 (T53; AIR5, AD14) — GATE 1 PER PART, BEFORE ANY TURN: every role the mode's rows converse in has an entry of
     the account that passed the mode's part and serves the role's need. Refused at dispatch (R34). Only for a model
     half on the T53 provider: an earlier shell's account carries no entries to hold. */
  let gateLimits = [];
  if (model?.provider) {
    const gate = await gateOne(model, session.mode);
    if (gate.refused) {
      const g = gate.refused;
      const lapse = await settleAtDispatch({ call, runId, session, code: g.code,
        why: g.code === "PART_NOT_PASSED"
          ? localize("agent-steps.drive.no_entry_passed_part", "no entry of the account has passed the {part} part", { part: String(g.part) })
          : localize("agent-steps.drive.no_entry_serves_capability", "no entry of the account that passed the {part} part has {capability}", { part: String(g.part), capability: String(g.capability) }) });
      return { refusal: refusal(g.code, g.code === "PART_NOT_PASSED"
          ? localize("agent-steps.drive.part_not_passed_detail", "No entry of the account serving this run has passed the {part} part of the gate, so no turn was taken and nothing was written by this segment.", { part: String(g.part) })
          : localize("agent-steps.drive.capability_missing_detail", "No entry of the account serving this run that passed the {part} part has {capability}, which the {role} step needs, so no turn was taken.", { part: String(g.part), capability: String(g.capability), role: String(g.role) }),
        409, { run_id: runId, part: g.part, entries: g.entries, ...(g.capability !== undefined ? { capability: g.capability } : {}),
               ...(lapse ? { lapse } : {}) }) };
    }
    gateLimits = gate.limits;
  }

  /* §14b.7 — A RESUMED RUN READS ITS OWN LOG AND CONTINUES.
     The count is what the table needs; the entries are what a later reader
     needs. Both come from PL-5's `op=airunlog`, in `seq` order, which is why
     that read keeps ASCENDING order and cuts at the END. */
  const logRead = planeAnswer(await call("airunlog", { run: runId }), "airunlog");
  if (logRead.silent) return { refusal: planeSilent(logRead.silent) };
  /* D-276's CLASS. This read was TRANSPORT-checked only, so a refused
     `op=airunlog` left `entries` unreadable and `resumedFrom` at 0 — this member
     stating "there is no prior log" about a run whose log the record had just
     declined to show it, and then publishing that as `resumed_from`. It is
     treated exactly as a refused `op=airun` above is: a run's own facts are the
     record's, and a segment that cannot read them does not proceed on a guess. */
  if (logRead.refused)
    return { refusal: planeRefused(runId, store,
      { status: 403, body: logRead.refused.plane ?? null }) };
  const priorLog = logRead.result ?? {};
  const resumedFrom = Array.isArray(priorLog.entries) ? priorLog.entries.length : 0;
  /* R99 (R085-18; K3501 (e)): the wall time the `wallclock` bound measures. Each tick carries the milliseconds since the
     segment's previous tick (its start for the first), never negative; `env.CLOCK`, when a function, is the clock (a
     test's), else `Date.now`. */
  const wall = { last: wallNow(env), extra: 0,
                 /* a tick other than a step's spends wall time the table's copy of the budget has not seen: kept for the next
                    step's update of it */
                 spend() { const ms = this.take(); this.extra += ms; return ms; },
                 take() { const now = wallNow(env), ms = Math.max(0, Math.round(now - this.last)); this.last = now; return ms; } };
  /* THE ADDRESS OF A LOOK THIS SEGMENT WRITES: `log:<seq>`, the ordinal `op=airunlog` answers (agent-harness R7's reports
     cite it as `observed_at`). Knowable only from a whole log: a truncated read leaves it UNDETERMINED. */
  const logSeq = { wall, next: () => (priorLog.truncated === true ? null : resumedFrom + logged + 1),
                   landed: () => { logged += 1; },
                   refused: (named) => { logRefused.push(named); refusals.push(named); },
                   runtimeExtra: 0,
                   /* R52: a report taken in a step a stop may abandon is ticked with the state that holds it, so a
                      re-run asks only the levels without one (set below, once the table is known). */
                   partialState: null,
                   /* R114: one log entry in its own tick, sent the moment it is made, spending the plane calls made since the
                      last tick (itself included) and the wall time since. `{silent}` when the plane did not answer;
                      `{landed}` whether the entry was appended; `{ended}` when the plane ended the run by it. */
                   tickEntry: async (entry, at) => {
                     const spend = calls - accounted.at + 1;
                     const sent = await call("airuntick", null,
                       { run: runId, log: [loggable(entry).entry], consume: { runtime: spend, wallclock: wall.spend() } });
                     accounted.at = calls;
                     logSeq.runtimeExtra += spend;
                     if (!sent.reached) return { silent: sent };
                     const answer = planeAnswer(sent, "airuntick");
                     const t = answer.result ?? {};
                     const bad = Array.isArray(t.refused) ? t.refused : [];
                     /* R26, R92: a tick answered `found: false`, or refused whole, appended nothing. */
                     const whole = t.found === false || (t.ticked === false && t.code != null);
                     if (answer.refused || bad.length || whole) {
                       for (const r of answer.refused ? [answer.refused] : whole ? [t] : bad)
                         logSeq.refused({ at: "airuntick.log", step: at.step, to: at.to, code: r?.code ?? r?.reason ?? null,
                                          check: r?.check ?? null, plane: r?.plane ?? r ?? null });
                       return { landed: false };
                     }
                     logSeq.landed();
                     return { landed: true, ...(t.ended ? { ended: { bound: t.ended.bound ?? null,
                       condition: t.ended.condition ?? null, by: SEGMENT_END_BY.plane } } : {}) };
                   } };

  const budget = {};
  for (const b of Array.isArray(session.budget) ? session.budget : [])
    budget[String(b.bound)] = { allowed: Number(b.allowed) || 0, consumed: Number(b.consumed) || 0 };

  /* FL-11 (§11 item 5, RULE 1'S TARGET, BOB #28) — THE RUN'S TARGET IS SEEDED HERE, FROM THE RUN'S OWN
     CONTEXT AS THE RECORD HOLDS IT, and never from the request body or a judgement (`target` is
     NOT_JUDGEABLE). Before FL-11 nothing set it, so the empty-level candidates and dedup's read went out
     naming no question and the plane refused every table-made suggestion. `runContextTarget` says why it
     holds what it holds; a project run's target is UNDETERMINED there and stated, never the project id. */
  const seeded = runContextTarget(session);

  let state = {
    step: FIRST_STEP,
    mode: session.mode,
    target: seeded.target, targetBasis: seeded.basis,
    pass: 0,
    /* R50: mode `plan` walks one pass; R15's limit otherwise. */
    maxPasses: session.mode === "plan" ? PLAN_MAX_PASSES
      : passLimit(session.max_passes),
    /* R51: the plan a plan-mode run proposes to is the run's own (ai-runs R46, R19), never the caller's. */
    planId: typeof session.plan === "string" && session.plan ? session.plan : null,
    /* R78: a re-examination run's origin and the response it re-examines, the record's (ai-runs R77, R19), never the
       caller's. */
    origin: typeof session.origin === "string" ? session.origin : null,
    response: typeof session.response === "string" && session.response ? session.response : null,
    resumedFrom,
    budget,
    targets: [], reports: [], candidates: [], queue: [],
    refusal: null, adjusted: false, submission: null,
    level: null, observed: null, governed: false, condition: null,
  };
  /* R11, N153 — A RESUMED RUN CONTINUES AT THE STATE ITS LAST TICK PUBLISHED (ai-runs R19's `state`), and starts from
     the `resume` row when there is none. The gate still comes first: the published state names where the table goes
     AFTER `resume`, and carries only the table's own fields (`resumeFrom`), never the mode, target, limit or budget. */
  const FLOW = flowFor(session.mode);
  const planMode = FLOW === PLAN_FLOW;
  if (model?.provider) logSeq.partialState = (s) => {
    const p = publishableState(s, AI_RUN_STATE_MAX_BYTES, FLOW);
    /* agent-harness R23 (notice agent-harness:353): a state holding provider-held state is refused, never published. */
    return p.ok === false || p.restarted ? null : p.state;
  };
  const resumed = resumeFrom(session.state ?? null, FLOW);
  state = resumed.at
    ? { ...state, ...resumed.state, resumeAt: resumed.at, resumeBasis: null }
    : { ...state, resumeAt: null, resumeBasis: resumed.basis };

  /* Judgements are consumed IN ORDER and matched to the step that asks for one.
     A judgement offered for a step the table does not judge is refused by
     `applyJudgement` reaching nothing, and a step that judges with none supplied
     simply carries the state forward — an absent judgement is not an error, it
     is a run whose model had nothing to add. */
  let jx = 0;
  let ended = null, steps = 0, segmentStopped = null, closeRefused = false, aiStop = null;
  /* R91: the run's facts are read and held to the account and the pack: everything a refusal "before the segment
     starts" answers. `preflight` stops here, for `/run` to answer those refusals before it hands the segment over. */
  if (preflight) return { ready: true };
  if (progress) progress.started = true;
  wall.last = wallNow(env);

  while (steps < maxSteps) {
    /* R91: the segment's wall bound, met between steps (a durable segment runs inside an alarm, which has a wall limit
       of its own); the segment stops and the run does not, as at its turn or byte bound. */
    if (deadline != null && Date.now() >= deadline) { segmentStopped = "wall"; break; }
    steps += 1;
    accounted.at = calls;
    idem.pass = Number(state.pass) || 0; idem.step = String(state.step); idem.n = 0;
    const row = FLOW[state.step];

    /* THE JUDGEMENT, AND THE ONE DOOR IT COMES THROUGH. Supplied by the caller in order, or (R58; agent-model R1) made by
       a model turn at every judged row but `collect`, whose judgements are the sub-sessions' REPORTS (agent-harness R7). */
    let judgement;
    let factsDropped = [];
    /* R56: the label of the conversation that judged this row, when its provider answered one. */
    let judgedBy = null;
    if (row && row.judged && model && state.step !== "collect") {
      /* R61 (F5; agent-model R12): THE ROW'S FACTS ARE RECORD TEXT, AND REACH THE MODEL ONLY AS A TOOL'S RESULT.
         `openRow` appends the row's own prompt (the step and the row) and then the facts it judges over as the result of
         `read_facts` (which `converse` answers again from the transcript if the model calls it), text only (R63). */
      const { content: facts, dropped } = toolContent(rowFacts(state, LEVELS));
      factsDropped = dropped;
      openRow(model.messages, state.step, row, facts);
      /* R50, R52–R55, R57: through the one door, as the row's role (`<mode>:<row>`), its turns keyed by the step (R54). */
      const got = await talk(model, {
        role: rowRole(state.mode, state.step), mode: state.mode, system: model.system,
        messages: model.messages, tools: model.tools, finalTool: `judge_${state.step}`,
        idem: `${runId}:${Number(state.pass) || 0}:${state.step}:turn`,
        /* R117: a `condition` outside the record's vocabulary is handed back once, on the two rows that carry one. */
        checkFinal: JUDGED_WITH_CONDITION.has(state.step) ? conditionFault : undefined,
        onTool: async (name, input) => {
          if (name === "load_layer") return loadLayer(model, input);
          return { content: localize("agent-steps.drive.this_step_is_judged_by", "this step is judged by judge_{step}", { step: String(state.step) }), error: true };
        },
      });
      if (got.roleUnknown)
        return { refusal: refusal("AI_ROLE_UNKNOWN", localize("agent-steps.drive.ai_role_unknown", "The {role} step names a role the run's table holds no need for, so no model was asked.", { role: String(got.roleUnknown.role) }), 409,
          { run_id: runId, role: got.roleUnknown.role }) };
      /* R52: a stop at the step boundary: the step is abandoned before any write of its own and no tick carries it. */
      if (got.aiStop) { aiStop = got.aiStop; break; }
      if (got.silent) return { refusal: modelSilent(got.silent, runId) };
      if (got.refused) return { refusal: modelRefused(got.refused, runId) };
      if (got.stopped) { segmentStopped = got.stopped; break; }
      if (got.answer) judgement = got.answer;
      if (got.label && typeof got.label === "object") judgedBy = got.label;
    } else if (row && row.judged && !model && jx < judgements.length) {
      judgement = judgements[jx];
      jx += 1;
    }
    if (judgement !== undefined) {
      const prior = state;
      const applied = planMode ? applyPlanJudgement(state, judgement) : applyJudgement(state, judgement);
      if (!applied.ok)
        return { refusal: refusal("JUDGEMENT_OVERREACH", applied.detail, 400,
          { step: state.step, fields: applied.overreach }) };
      state = applied.state;
      /* R56: what this row's conversation produced names it: the targets a plan names (their capture requests), the
         candidates a compose forms, the submission an adjust changes. A table-made candidate names no AI. */
      if (judgedBy) state = producedBy(state, prior, judgedBy, judgement);
    }

    /* WHAT THE ROW DOES, IN PLANE CALLS. */
    const work = planMode ? await performPlanStep(call, state, runId)
      : await performStep(call, state, runId, model, logSeq);
    if (work.silent) return { refusal: planeSilent(work.silent) };
    /* R52: a sub-session stopped: the step is abandoned at its boundary (the reports it took stay in the log). */
    if (work.aiStop) { aiStop = work.aiStop; break; }
    if (work.roleUnknown)
      return { refusal: refusal("AI_ROLE_UNKNOWN", localize("agent-steps.drive.ai_role_unknown", "The {role} step names a role the run's table holds no need for, so no model was asked.", { role: String(work.roleUnknown.role) }), 409,
        { run_id: runId, role: work.roleUnknown.role }) };
    if (work.model?.silent) return { refusal: modelSilent(work.model.silent, runId) };
    if (work.model?.refused) return { refusal: modelRefused(work.model.refused, runId) };
    /* D-611: the segment's turns or bytes ran out inside the step. The SEGMENT stops; the run does not, and what
       the step already logged stays logged. */
    if (work.stopped) { segmentStopped = work.stopped; break; }
    /* R114: a tick sent inside the step (a re-read's) was answered by the plane ending the run: the segment is over. */
    if (work.planeEnded) { ended = work.planeEnded; state = work.state; break; }
    /* THE SPAWN CONTRACT COULD NOT BE COMPOSED, AND THE RUN STOPS RATHER THAN
       FANNING OUT ANYWAY. This is the §14 fence firing: the plane's search-half
       payload arrived carrying the lens, or carrying nothing at all. Continuing
       would mean a run that searched under a bias nobody can afterwards prove it
       did not use — so it refuses, names the level it was composing for, and
       passes the plane's payload nowhere. 502, because the fault is upstream of
       this member and reporting it as this member's would be REC-52's rule read
       backwards. */
    if (work.contract)
      return { refusal: refusal(work.contract.code, work.contract.detail, 502,
        { level: work.level ?? null, run_id: runId }) };
    /* D-276: THE PLANE REFUSED A CALL THIS STEP CANNOT CONTINUE WITHOUT, and its
       refusal is passed through in the plane's own words rather than re-worded
       into a statement about this member's inputs. */
    if (work.planeRefusal)
      return { refusal: planeRefused(runId, store,
        { status: 403, body: work.planeRefusal.plane ?? null }) };
    /* A STEP MAY REFUSE MORE THAN ONCE — see the acquisition loop and the
       citation re-reads. Publishing the last one only would make the run's own
       refusal list shorter than the run's refusals. */
    if (work.refused) refusals.push(...(Array.isArray(work.refused) ? work.refused : [work.refused]));
    state = work.state;
    if (work.submitted) submitted += 1;
    /* R52: the plane counts `proposals` (run-rules R13) and this member sends no figure for it; the copy here follows
       the plane's count so the table stops on the bound (R50), and the record's figure is read again next segment. */
    if (work.proposed && state.budget.proposals)
      state = { ...state, budget: { ...state.budget,
        proposals: { ...state.budget.proposals, consumed: state.budget.proposals.consumed + 1 } } };
    if (work.verbatim) verbatimResubmits += 1;
    if (state.step === "adjust" && state.adjusted) adjusted += 1;

    const decision = planMode ? nextPlanStep(state) : nextStep(state);
    /* R63: a drop of a file's bytes, from the row's facts or a sub-session's reads, is named in the step's trace. */
    const dropNote = droppedNote([...factsDropped, ...(work.dropped || [])]);
    const stepNote = [work.note, dropNote].filter(Boolean).join("; ");
    trace.push({ step: state.step, to: decision.step, why: decision.why,
                 ...(stepNote ? { note: stepNote } : {}) });

    /* LOG-ALWAYS, AND IT IS A TICK RATHER THAN A SEPARATE WRITE. The tick is
       ONE call that appends what was observed, spends the budget and extends
       the lease — PL-5's own ordering, chosen so partial results survive a
       death that happens next. Consuming through it is also why nothing here
       writes `runtime-ceiling-reached`: a tick that spends the last of a budget
       ends the run through the plane's one exit and the plane writes the
       condition. */
    const spentThisStep = calls - accounted.at + 1; /* +1: the tick is a subrequest too */
    const consume = { ...(work.consume || {}), runtime: spentThisStep, wallclock: wall.take() };
    /* R26, K148: the entry only when the step's judgement states a look; a step that looked at nothing still
       ticks, for its spend and its lease, and sends no entry. */
    /* R92: in the record's own words — a condition outside its vocabulary, or a governed definitive look, was refused
       per entry, so the log stayed empty (`loggable`). */
    const entry = loggable(stepLog(state, decision)).entry;
    /* R101: entries the step itself states beside its look (`dedup`'s drops), in the record's own words like the rest. */
    const stated = (Array.isArray(work.logEntries) ? work.logEntries : []).map((e) => loggable(e).entry);
    const sentEntries = [...(entry ? [entry] : []), ...stated];
    if (entry && state.observed === "PRESENT") presentUnbacked += 1;
    /* R11, N153: the tick also publishes where the table goes next, so a later segment continues there. The gate's
       tick publishes nothing: until `resume` has moved on, the resume point is the one the record already holds. */
    const after = planMode ? planAdvance(state, decision) : advance(state, decision);
    /* R49: the state stays within ai-runs' ceiling; one that would not is published as its pass restarted, and the
       step's trace says so (the answer's keys are R28's). */
    let published = null;
    if (resumeTargets(FLOW).includes(after.step)) {
      published = publishableState(after, AI_RUN_STATE_MAX_BYTES, FLOW);
      /* R55, agent-harness R23 (notice agent-harness:353): a state holding a provider's session, response, conversation
         or continuation id is refused by the table, so this tick publishes no state and the refusal is named in
         `refusals`, never a state quietly dropped; the record keeps the last state it published. */
      if (published.ok === false) {
        refusals.push({ at: "airuntick.state", code: published.code, key: published.key ?? null, detail: published.detail ?? null });
        published = null;
      } else if (published.restarted) {
        const last = trace[trace.length - 1];
        last.note = localize("agent-steps.drive.v1_the_tables_state_is", "{v1}the table's state is {bytes} bytes, over the {limit} a run's state may hold (ai-runs R45), so this tick publishes the pass restarted at '{at}' and a later segment re-does it rather than resume from a state the record refuses", { v1: String(last.note ? `${last.note}; ` : ""), bytes: String(published.restarted.bytes), limit: String(published.restarted.limit), at: String(published.restarted.at) });
      }
    }
    /* ai-runs R48: the usage of every model call since the last tick, counted for the member whose account carried it. */
    const usage = model ? model.drain() : [];
    const tick = await call("airuntick", null,
      { run: runId, log: sentEntries, consume, ...(published ? { state: published.state } : {}),
        ...(usage.length ? { usage } : {}) });
    if (!tick.reached) return { refusal: planeSilent(tick) };
    /* R26, R43 — D-276's class at the tick: a refusal of the whole tick nested in `result` is a refusal, never
       an entry that landed. */
    const tickAnswer = planeAnswer(tick, "airuntick");
    /* R26: a tick the plane answered `found: false` (no such run, `ai-runs`) appended nothing: it is a refusal of the
       tick in the plane's words, never an entry that landed (T41 B6: a run the plane never opened counted `logged`). */
    const noRun = !tickAnswer.refused && tickAnswer.result?.found === false;
    /* R92: a tick refused whole answers `ticked: false` with its code and no `ok` (ai-runs' gates, figures, state and
       usage), so it appended nothing: a refusal of the tick, never an entry that landed. */
    const tickRefused = !tickAnswer.refused && !noRun && tickAnswer.result?.ticked === false
      && tickAnswer.result?.code != null;
    if (noRun || tickRefused) {
      refusals.push({ at: "airuntick", code: tickAnswer.result.code ?? null, check: tickAnswer.result.check ?? null,
                      plane: tick.body ?? null });
    } else if (tickAnswer.refused) {
      /* R49: `AI_RUN_STATE_TOO_LARGE` (ai-runs R45) among them — a refusal of this tick, never the plane failing; the
         segment carries on. */
      refusals.push({ at: "airuntick", code: tickAnswer.refused.code, check: tickAnswer.refused.check,
                      plane: tickAnswer.refused.plane });
    } else {
      const t = tick.body.result ?? tick.body;
      /* REC-100 / IC-130 — A TICK THAT ANSWERED ok IS NOT AN ENTRY THAT LANDED.
         `op=airuntick` appends entry by entry and REFUSES per entry, returning
         `appended` and `refused[]` beside `ok: true` — §14b.7's partial results,
         so one bad entry cannot cost the budget spend or the lease. This site
         used to count `logged += 1` off the envelope alone, so a refused entry
         vanished: the run reported it logged and the record never held it. That
         is the D-276 class (a refusal inside a well-formed answer) at the one
         op whose refusals are PER ENTRY rather than per call.
         So: count what the plane says it APPENDED, and carry every refused entry
         into the run's own `refusals` (in the plane's words, never re-worded)
         and into `log_refused`, naming the step it came from. A plane that does
         not publish `appended` is read as having appended what it did not
         refuse, which is the plane's own contract (appended + refused = sent). */
      const refusedEntries = Array.isArray(t?.refused) ? t.refused : [];
      const appendedNow = t?.appended != null && Number.isFinite(Number(t.appended))
        ? Number(t.appended)
        : (t?.ticked === false ? 0 : Math.max(0, sentEntries.length - refusedEntries.length));
      logged += appendedNow;
      for (const r of refusedEntries) {
        const named = { at: "airuntick.log", step: state.step, to: decision.step,
                        code: r?.code ?? r?.reason ?? null, check: r?.check ?? null,
                        ...(r?.referent_fault ? { referent_fault: r.referent_fault } : {}),
                        plane: r ?? null };
        logRefused.push(named);
        refusals.push(named);
      }
      /* THE BUDGET AS THE RECORD NOW HOLDS IT. Re-read rather than decremented
         locally: a run resumes across invocations and a second copy of the
         count is a second answer that ages. */
      state = { ...state, budget: { ...state.budget } };
      for (const [k, v] of Object.entries(consume))
        if (state.budget[k]) state.budget[k] = { ...state.budget[k], consumed: state.budget[k].consumed + Number(v) };
      if (wall.extra && state.budget.wallclock)
        state.budget.wallclock = { ...state.budget.wallclock, consumed: state.budget.wallclock.consumed + wall.extra };
      wall.extra = 0;
      if (logSeq.runtimeExtra && state.budget.runtime)
        state.budget.runtime = { ...state.budget.runtime, consumed: state.budget.runtime.consumed + logSeq.runtimeExtra };
      logSeq.runtimeExtra = 0;
      /* THE PLANE ENDED IT. This is the `runtime` path above all: the harness
         spends and the plane decides, so an ending that arrives HERE rather than
         from the table is the record telling this member something it could not
         have known. It is recorded with WHO decided it, because "the table
         stopped" and "the plane stopped it" are different facts. */
      if (t && t.ended) {
        ended = { bound: t.ended.bound ?? null, condition: t.ended.condition ?? null,
                  by: SEGMENT_END_BY.plane };
        break;
      }
    }
    /* A LOOK BELONGS TO THE STEP THAT MADE IT: it is not carried into the next step's entry. */
    const look = { level: null, observed: null, governed: false, condition: null };
    state = { ...state, ...look };

    if (decision.step === "close") {
      /* THE ORDINARY EXIT, NAMING THE BOUND (C-22.5). The plane refuses a close
         that names none rather than inferring "completed" from silence, so the
         bound the TABLE computed is handed over explicitly. */
      const closed = planeAnswer(
        await call("airunclose", null, { run: runId, bound: decision.bound || "completed" }),
        "airunclose");
      if (closed.silent) return { refusal: planeSilent(closed.silent) };
      /* D-276's CLASS, AND THIS ONE IS A CLAIM ABOUT THE RECORD ITSELF. `ended`
         says the run ENDED and names who ended it; it used to be written from a
         transport check, so a REFUSED close published `ended: { bound, by: "the
         table" }` for a run the record still holds open. A run reported as
         terminated when the plane declined to terminate it is the record
         claiming more than it can support. The refusal is named and `ended`
         stays null, which is the honest "this segment did not end it". */
      /* The pass a close completes is counted (R50's one pass; `advance` leaves R15's count as it was). */
      if (closed.refused) { refusals.push(closed.refused); closeRefused = true; state = { ...state, step: "close", pass: after.pass }; break; }
      ended = { bound: decision.bound || "completed", by: SEGMENT_END_BY.table };
      state = { ...state, step: "close", pass: after.pass };
      break;
    }
    /* THE ONE PLACE THE REFUSAL IS CARRIED FORWARD, AND IT IS CARRIED TO EXACTLY
       ONE ROW. `adjust` needs both the refusal and the bytes that earned it, or
       `adjustedFrom` has nothing to compare and F10's precondition becomes a
       promise. Every other transition CLEARS them, so a stale refusal cannot
       route a later step into an adjust it did not earn.
       THE PASS COUNTER MOVES WHEN A PASS IS **DONE**, NOT WHEN ONE STARTS, AND
       THE DIFFERENCE IS OFF-BY-ONE IN THE DIRECTION THAT MATTERS. Counting on
       entry to `plan` makes `maxPasses: 1` mean ZERO completed passes — the run
       fans out over nothing and closes reporting `completed`, which is an empty
       run wearing a finished run's answer, and this suite's own empty-run arm is
       what distinguishes those. `next-pass` is the row that means "a pass
       finished", so it is the row that counts. Both are `advance`, the move the
       tick above published. */
    state = { ...after, budget: state.budget, ...look };
  }

  /* R52 (T53; AIR28): `ended.by` names the AI stop; the run itself goes on, resumable, at its last tick's state. */
  if (aiStop) ended = { bound: null, condition: null, by: SEGMENT_END_BY.ai, ai_stop: aiStop };
  return {
    mode: state.mode, trace, passes: state.pass, ended, logged, submitted,
    /* FL-11: the question this run's readings default to, and WHY — published so a reader can check it
       against the run's context rather than take it on this member's word. */
    target: { id: state.target ?? null, basis: state.targetBasis ?? null },
    refusals, adjusted, verbatimResubmits, resumedFrom, logRefused, presentUnbacked,
    /* FL-5's FACTS, PUBLISHED RATHER THAN HELD. FL-3 computed the fence's answer
       into a local nobody could read and asserted it by grepping a note — which
       measured nothing (see the fan-out step). What a suite, and a later reader,
       actually need is the object a sub-session WAS HANDED. So the contracts
       themselves go on the wire: whatever is true of the spawn contract can then
       be read off the answer rather than taken on the member's word. They are the
       LAST pass's, and the field says so. */
    fanout: {
      of_pass: state.pass, levels: LEVELS, scope: SUBSESSION_OPS,
      contracts: state.contracts || [],
    },
    reportsTaken: (state.reports || []).length,
    /* NAMED, NEVER A COUNT ALONE. A refused return is a component of this system
       breaking its contract; a bare number would say it happened and not what. */
    reportsRefused: state.reportsRefused || [],
    citationsReread: state.rereads || 0,
    /* D-220: the LAST pass's holdings, like `fanout`. Null when no `collect` ran,
       which is "nothing was counted", not "nothing is held". */
    holdings: state.holdings ?? null,
    budget: BUDGET_BOUNDS.map((b) => ({ bound: b, ...(state.budget[b] || { allowed: 0, consumed: 0 }) })),
    segmentStopped,
    /* R51: each entry the gate passed with limits, named, for the shell to state. */
    gateLimits,
    /* R52: the AI stop that ended the segment at a step boundary, or null. */
    aiStop,
    /* R91: how this segment ended, for its `segment_end`: the run ended (by the table or the plane's exit), the plane
       refused its close, or (`by` null) the segment met one of its own bounds (turns, bytes, wall, or `max_steps`). */
    segmentEnd: aiStop ? { by: SEGMENT_END_BY.ai, done: false, ai_stop: aiStop }
      : ended ? { by: ended.by, done: true }
      : closeRefused ? { by: SEGMENT_END_BY.refusal, done: false }
      : { by: null, done: false },
  };
}

/** R107 (R085; S4 N1, N4; K3557) — A RUN REFUSED AT DISPATCH DOES NOT LAPSE SILENTLY. The pack a run recorded at its open
 *  never comes back once the plane publishes another, so a segment refused for it (or for the read of it) can never be
 *  continued, and the plane's lease would end the run with what it composed unwritten and no word of why. After the payer
 *  check (a run that is not this account's is touched by nothing, R10), for a run that has done work: the candidates its
 *  published state holds and has not written are written through `op=suggest` where the plane accepts them (a refusal is
 *  named, not retried or adjusted), one tick logs the refusal by name, and the run is closed on `lease`, which stops it
 *  (status `stopped`, never `completed`). A run that has done nothing, a plan-mode run's proposals (not `suggest`'s) and a
 *  plane that does not answer are left as they were. Returns `{written, not_accepted, closed}` or null; it never throws. */
export async function settleAtDispatch({ call, runId, session, code, why }) {
  try {
    const flow = flowFor(session.mode);
    const resumed = resumeFrom(session.state ?? null, flow);
    const st = resumed.at ? resumed.state : null;
    if (!st) return null;
    const seeded = runContextTarget(session);
    /* what the state holds and has not written: before `dedup` has queued them, the composed list; after, the queue */
    const unwritten = flow === PLAN_FLOW ? []
      : (resumed.at === "dedup" ? st.candidates : st.queue).filter((c) => c && typeof c === "object");
    const written = [], notAccepted = [];
    for (const c of unwritten) {
      const res = await call("suggest", null, { ...c, target: c.target ?? seeded.target ?? null, run: runId });
      if (!res.reached) break;
      const a = res.body?.result ?? res.body ?? {};
      if (res.status === 200 && res.body?.ok === true && a.ok !== false && a.wrote !== false) written.push(String(c.name ?? ""));
      else notAccepted.push({ name: String(c.name ?? ""), code: a.code ?? a.reason ?? null });
    }
    const said = localize("agent-steps.drive.dispatch_refused_code_why_the", "dispatch refused {code} ({why}); the run cannot be continued, so {length} composed candidate(s) were written{v1}{v2} and the run was closed", { code: String(code), why: String(why), length: String(written.length), v1: String(written.length ? ` (${written.map((n) => `'${n}'`).join(", ")})` : ""), v2: String(notAccepted.length ? localize("agent-steps.drive.not_accepted_by_the_plane", ", {length} not accepted by the plane ({codes})", { length: String(notAccepted.length), codes: String(notAccepted.map((n) => n.code ?? "?").join(", ")) }) : "") });
    const { entry } = loggable({ level: "meaning", subject: "dispatch -> refused", state: "LOOKED_INDETERMINATE", governed: false,
                                 condition: null, terminal: false, bound: null, detail: said.slice(0, LOG_DETAIL_MAX) });
    await call("airuntick", null, { run: runId, log: [entry], consume: { runtime: 1 } });
    const closed = planeAnswer(await call("airunclose", null, { run: runId, bound: "lease" }), "airunclose");
    return { written, not_accepted: notAccepted, closed: !closed.silent && !closed.refused };
  } catch {
    return null;
  }
}
