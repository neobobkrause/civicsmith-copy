/* agent-steps — the level sub-sessions (R22–R26, R40; moved from `agent-worker`). */
/* Requirement ids in the comments below are `agent-worker`'s, as they stood when this code moved (T51, K3850); `build/requirements/agent-steps.md` maps them to this module's. */
import { checkReport, LOOKED_STATES } from "../../agent-harness/src/subsession.mjs";
import { subsessionSystem, subsessionOpening, subsessionTools } from "../../agent-model/src/model.mjs";
import { LEVELS } from "../../agent-harness/src/harness.mjs";
import { talk, SUBSESSION_ROLE, subsessionNeed } from "./talk.mjs";
import { checkCondition } from "../../bio-plane/src/run-rules/index.mjs";
import { toolContent } from "./reads.mjs";
import { loggable, conditionFault } from "./entries.mjs";
import { planeAnswer, meaningRead } from "./plane.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/** agent-harness R7 — THE SUB-SESSIONS. Each gets a fresh transcript (nothing shared with the parent or another level), its
 *  frozen contract, the contract's `scope` as its only plane tool, and `report` as its answer. Its look is logged
 *  at its level, and that entry's address is the report's `observed_at`. A sub-session that returns no report is
 *  named, never read as an absence. */
/* R52 (T53; AIR28): a report taken before a stop is held in the published state, marked with its pass, so the re-run of
   the step asks only the levels without one; the mark is gone once the step completes. */
export const PARTIAL_MARK = "partial_pass";
export async function runSubsessions(call, state, runId, model, logSeq, contracts, held = []) {
  const reports = [...held], refused = [], dropped = [];
  const done = new Set(held.map((r) => r.level));
  /* agent-harness R18 (T50; N1169): WHAT EACH LEVEL'S SUB-SESSION READ, set here and nowhere else, from the plane's own
     four-level statement of each read it made (`retrieval` R13: `scope.documents`), never from a report's words and never
     by a judgement. `reads` counts the reads that answered; `documents` is the greatest the statements gave (R118), and is left out
     when none stated one, so the table (which fails closed) writes no absence for that level. */
  const scope = {};
  for (const contract of contracts) {
    if (done.has(contract.level)) continue;
    /* R23, R50, R54: as a sub-session, choosing by cost `low`, its turns keyed by the step and the level. */
    const got = await talk(model, {
      role: SUBSESSION_ROLE, need: model.provider ? subsessionNeed() : null, mode: state.mode,
      idem: `${runId}:${Number(state.pass) || 0}:${state.step}:${contract.level}:turn`,
      /* R61: the contract's fields from the record (the run, its context, mode, skill) reach the sub-session only as
         `read_facts`' result (`subsessionOpening`); its system carries the pack and the table's own fields. */
      system: subsessionSystem(model.pack, contract),
      messages: subsessionOpening(contract),
      tools: subsessionTools(contract),
      finalTool: "report",
      /* R94 (agent-model R18): the report is checked as `checkReport` will check it, less its location (the log gives
         that after, so its absence is never handed back), and a refusal goes back once with its detail to be rewritten. */
      checkFinal: (input) => {
        const notObject = input == null || typeof input !== "object" || Array.isArray(input);
        const { observed_at: _located, ...said } = notObject ? {} : input;
        const bad = checkReport(notObject ? input : { ...said, level: contract.level, observed_at: "log:0" });
        /* R117: and a `condition` the record has no word for is handed back once, after the report's shape. */
        return bad ? { code: bad.code, detail: bad.detail } : conditionFault(notObject ? {} : input);
      },
      onTool: async (name, input) => {
        if (!contract.scope.includes(name))
          return { content: localize("agent-steps.subsessions.string_is_not_in_this", "'{String}' is not in this sub-session's scope ({scope})", { String: String(String(name)), scope: String(contract.scope.join(", ")) }), error: true };
        const lim = Math.min(50, Math.max(1, Math.floor(Number(input.limit)) || 20));
        /* R96: `ids` limits a read to named records: at most 20, each a non-empty string, others dropped. */
        const ids = (Array.isArray(input.ids) ? input.ids : [])
          .filter((x) => typeof x === "string" && x.length > 0).slice(0, 20);
        const r = await meaningRead(call, { q: String(input.q ?? ""), rows: String(input.rows ?? ""), limit: lim,
                                            ids: ids.length ? ids : null });
        if (r.silent) return { halt: { planeSilent: r.silent } };
        if (!r.refused) {
          const seen = (scope[contract.level] ??= { reads: 0, documents: null });
          const documents = r.result?.scope?.documents;
          seen.reads += 1;
          /* R118: the greatest `documents` any read stated; a read that stated none adds nothing. */
          if (Number.isInteger(documents) && documents >= 0) seen.documents = seen.documents === null ? documents : Math.max(seen.documents, documents);
        }
        /* R61, R63: what the plane answers reaches the sub-session only as this tool's result, text only. */
        const told = toolContent(r.refused ? (r.refused.plane ?? { code: r.refused.code }) : r.result);
        dropped.push(...told.dropped.map((d) => ({ ...d, path: `${contract.level}: ${d.path}` })));
        return r.refused ? { content: told.content, error: true } : { content: told.content };
      },
    });
    if (got.roleUnknown) return { roleUnknown: got.roleUnknown };
    /* R52: the step stops at its boundary; the reports already taken stay in the log and in the state they were ticked with. */
    if (got.aiStop) return { aiStop: got.aiStop };
    if (got.planeSilent) return { silent: got.planeSilent };
    if (got.silent || got.refused) return { model: got };
    if (got.stopped) return { stopped: got.stopped };
    if (!got.answer) {
      refused.push({ level: contract.level, code: "SUBSESSION_NO_REPORT",
                     detail: "the sub-session ended without calling report; its level is UNDETERMINED, not empty" });
      continue;
    }
    const { observed_at: _ignored, ...said } = got.answer;
    const report = { ...said, level: contract.level };
    /* R117: a second `condition` outside the vocabulary is taken as none; `loggable` below says what was stated. */
    const statedCondition = typeof report.condition === "string" ? report.condition : null;
    if (statedCondition && checkCondition(statedCondition) !== null) report.condition = null;
    if (LOOKED_STATES.has(String(report.state))) {
      const seq = logSeq ? logSeq.next() : null;
      /* R92: in the record's own words (`loggable`); a governed definitive look is LOOKED_INDETERMINATE, and the report
         located at it says the same, so no absence is written off a look our own pacing held. */
      const { entry, governedDowngrade } = loggable({
        level: contract.level, subject: `sub-session ${contract.level} -> report`,
        state: report.state === "PRESENT" ? "LOOKED_INDETERMINATE" : report.state,
        governed: report.governed === true, condition: statedCondition,
        terminal: false, bound: null,
        detail: String(typeof report.summary === "string" ? report.summary : "").slice(0, 500),
        /* R56: the entry for a report names the conversation that produced it */
        ...(got.label && typeof got.label === "object" ? { produced_by: [got.label] } : {}),
      });
      if (governedDowngrade && report.state === governedDowngrade) report.state = "LOOKED_INDETERMINATE";
      /* R52: on the T53 provider, the tick also publishes the state at this step with the reports taken so far */
      const partial = typeof logSeq?.partialState === "function"
        ? logSeq.partialState({ ...state, reports: sortByLevel([...reports, { ...report, ...(seq != null ? { observed_at: `log:${seq}` } : {}) }])
            .map((r) => ({ ...r, [PARTIAL_MARK]: Number(state.pass) || 0 })) })
        : null;
      const tick = planeAnswer(await call("airuntick", null,
        { run: runId, log: [entry], ...(logSeq?.wall ? { consume: { wallclock: logSeq.wall.spend() } } : {}),
          ...(partial ? { state: partial } : {}) }), "airuntick");
      if (tick.silent) return { silent: tick.silent };
      const t = tick.result ?? {};
      const bad = Array.isArray(t.refused) ? t.refused : [];
      /* R26: a tick answered `found: false` (no such run) appended nothing, so it is refused, never landed; (R92) so is
         a tick refused whole (`ticked: false` with its code). */
      const whole = t.found === false || (t.ticked === false && t.code != null);
      if (tick.refused || bad.length || whole) {
        for (const r of tick.refused ? [tick.refused] : whole ? [t] : bad)
          logSeq?.refused({ at: "airuntick.log", step: "fanout", to: "collect", level: contract.level,
                            code: r?.code ?? r?.reason ?? null, check: r?.check ?? null, plane: r?.plane ?? r ?? null });
      } else {
        logSeq?.landed();
        if (seq != null) report.observed_at = `log:${seq}`;
      }
    }
    reports.push(report);
  }
  return { reports: sortByLevel(reports).map(({ [PARTIAL_MARK]: _p, ...r }) => r), refused, dropped,
           scope: Object.fromEntries(Object.entries(scope).map(([level, v]) =>
             [level, { reads: v.reads, ...(v.documents !== null ? { documents: v.documents } : {}) }])) };
}

const sortByLevel = (list) => [...list].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
