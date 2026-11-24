/* answer-envelope: THE COMPOSED CATALOGUE (R2, R7, `control-plane` R41; K585 (1), N245, N272, N337, N403, N414). Copied
   whole from `control-plane/families.mjs` at the split (T35-80; K1907, K1974). Every DEC-49 family a refusal can be
   decorated from: every product module's own families in the order of `build/modules.json`, then this module's own,
   last and alone (the check catalogue, which once came first, ended with `control-plane` R43, now R7, at T19). Each
   source is read as a NAMESPACE and its families found by the reserved `_CHECKS` suffix, so a family a module adds to
   a file listed here is found with no edit; a module that opens a NEW file of families is not, and `CHECK_FAMILY_FILES`
   gains it. A module test walks every product module's files for an exported family and fails on one this list does
   not reach, so the list cannot go stale silently.

   `CHECK_FAMILIES` is `{FAMILY: {code: row}}` with each code ONCE: the first source that holds a row for it with a canned
   translation keeps it, else the first that holds it at all. A code held in two places is the DEC-49 guard's arm A to
   refuse, not this composition's to choose, and a family name two sources share (a row held twice for a tranche, K529)
   is one family here. `dec49Row` (R2) and the published fences (`control-plane` R41, `skills.machineFences` over it)
   read this one object. */
import * as RECORD_GRAMMAR_ACTS from "../record-grammar/acts.mjs";
import * as TEXT_CHAIN from "../textchain.mjs";
import * as RECORD_CORE from "../record-core/checks.mjs";
import * as MEMBERSHIP from "../membership/checks.mjs";
/* N783 (T38-25; K2270, K2278): project-roster's rows, split from membership's file with the project acts (C-56.5, C-33.28,
   C-70.4 and the whole C-95 family), in its place in the module order (directly after membership, before credentials).
   No code is in both files, so no row moves. */
import * as PROJECT_ROSTER from "../project-roster/checks.mjs";
/* R17 (T48; N996, K3101; `extraction/credentials-split.md` §2, §7): ai-accounts' rows (`AI_ACCOUNT_CHECKS`: the C-29 rows that
   moved from credentials' file, each code, number and translation unchanged, `DISCLOSURE_DUE`'s C-29.40 among them), in its
   place in the module order (directly before credentials). */
import * as AI_ACCOUNTS from "../ai-accounts/checks.mjs";
import * as CREDENTIALS from "../credentials/checks.mjs";
import * as PROMOTION from "../promotion/checks.mjs";
import * as PROVENANCE from "../provenance/checks.mjs";
/* N512 (K1193; T25): provenance's split. attestation's C-89 and provenance-routes' C-34, each read from its new
   module's own file in its place in the module order (provenance, attestation, provenance-routes); provenance's file
   no longer holds either family. */
import * as ATTESTATION from "../attestation/checks.mjs";
import * as PROVENANCE_ROUTES from "../provenance-routes/checks.mjs";
import * as CAPTURE_SOURCES from "../capture-sources/credentials.mjs";
import * as ACQUISITION from "../acquisition/checks.mjs";
import * as CAPTURE from "../capture/checks.mjs";
/* R12 (T43-14; N851, K2609, K2697): doorbell's rows (`DOORBELL_CHECKS`: C-118.2, .3, .4, .7; `KNOCK_CHECKS`: C-85.1–C-85.5),
   which moved with their raisers from capture's file (capture R37, doorbell R21), in its place in the module order
   (directly after capture, before file-safety). No code is in both files, so each reads the row R7 pins. */
import * as DOORBELL from "../doorbell/checks.mjs";
/* K2130, K2103 (T36-47; red 11): file-safety's C-140 rows (`FILE_SAFETY_CHECKS`), in its place in the module order
   (directly after capture, before sources). K2103 re-coded the three codes earlier families held, so no row moves. */
import * as FILE_SAFETY from "../file-safety/checks.mjs";
import * as SOURCES from "../sources/checks.mjs";
import * as CALIBRATION from "../calibration/checks.mjs";
import * as EXTRACTION from "../extraction/checks.mjs";
import * as CONTENT from "../content/checks.mjs";
import * as CONTENT_EXTENT from "../content/extent.mjs";
import * as ENTITIES from "../entities/checks.mjs";
/* T33-89 (K1581, K1585, K1607, K1609, K1643): T33's new families, each in its module's place: events', money-checks' and
   duties' (C-133) in layer 5, hypotheses' (C-134) and answers' (C-135) in layer 6, case-tensions' C-92 (moved from
   publication) in layer 8; and the order T33 gave layer 5 (local-facts and standards moved in, observation-log after
   connections). */
import * as EVENTS from "../events/checks.mjs";
import * as LOCAL_FACTS from "../local-facts/checks.mjs";
import * as CONNECTIONS from "../connections/checks.mjs";
import * as CONNECTIONS_THEMES from "../connections/themes.mjs";
import * as OBSERVATION_LOG from "../observation-log/checks.mjs";
/* K1961, K1974 (red 26): law-relations' nine C-112 rows, split from standards with `law.mjs`, in its place in the module
   order (directly before standards). */
import * as LAW_RELATIONS from "../law-relations/checks.mjs";
import * as STANDARDS from "../standards/checks.mjs";
import * as PROGRESSIONS from "../progressions/checks.mjs";
import * as MONEY_CHECKS from "../money-checks/checks.mjs";
import * as DUTIES from "../duties/checks.mjs";
import * as BIAS from "../bias/checks.mjs";
import * as RETRIEVAL from "../retrieval/checks.mjs";
import * as INQUIRY_GRAMMAR from "../inquiry-grammar/checks.mjs";
/* R7 (N522, K1310): accepted-work's C-21.4 and C-21.5, in its place in the module order (after inquiry-grammar). */
import * as ACCEPTED_WORK from "../accepted-work/checks.mjs";
import * as INQUIRY from "../inquiry/index.mjs";
import * as HYPOTHESES from "../hypotheses/checks.mjs";
/* T41 (R10; K2405, K2418, K2480, K2487, K2488, K2532, K2566; N820): T41's new families, each in its module's place in the
   module order: steps' C-142 (after hypotheses, before citation), ai-use's C-143 (after run-rules, before
   run-productions; ai-runs between them holds no file of families), reading-guides' C-144 (after capture-requests, before
   skills), question-explorer's C-145 (after skills, before answers), investigation's C-146 (after intent, before
   reevaluation) and publish-schedule's C-122.5 (moved from publication with its raiser; directly after publication,
   before docket). A code an earlier family already holds keeps that family's row (steps' C-142.3, investigation's
   C-146.10); no new family takes a code from a later one. R11 (T42; N843, K2651, K2656): hypotheses' C-134.22, C-134.23,
   steps' C-142.28 and investigation's C-146.21, C-146.26 are re-coded in place, so each decorates with its own row and
   action-plans' `PROPOSAL_NO_RUN` and intent's `NO_SUCH_PROPOSAL` read their pinned rows again. */
import * as STEPS from "../steps/checks.mjs";
import * as CITATION from "../citation/checks.mjs";
import * as BASIS_VERSIONS from "../basis-versions/checks.mjs";
import * as STRENGTH from "../strength/checks.mjs";
import * as CONTRADICTION from "../contradiction/checks.mjs";
import * as RUN_RULES from "../run-rules/checks.mjs";
import * as AI_USE from "../ai-use/checks.mjs";
import * as RUN_PRODUCTIONS from "../run-productions/checks.mjs";
import * as CAPTURE_REQUESTS from "../capture-requests/checks.mjs";
import * as READING_GUIDES from "../reading-guides/checks.mjs";
import * as SKILLS from "../skilldoctrine.mjs";
import * as QUESTION_EXPLORER from "../question-explorer/checks.mjs";
import * as ANSWERS from "../answers/checks.mjs";
import * as INTENT from "../intent/checks.mjs";
import * as INVESTIGATION from "../investigation/checks.mjs";
import * as REEVALUATION from "../reevaluation/checks.mjs";
/* K2226 (T37-50; R7): case-carriage's C-141 (`CASE_CARRIAGE_CHECKS`, the refusals of `obscuremark` and, since T39,
   `copyBatch`'s C-141.11), in its place in the module order (directly after reevaluation, before case-tensions). Since
   T38 (K2311) its machine refusal is its own `MACHINE_CANNOT_MARK_PHOTO`, so no code is in both its family and an
   earlier one, and sources' `MACHINE_CANNOT_MARK` keeps C-121.7: no earlier row moves. */
import * as CASE_CARRIAGE from "../case-carriage/checks.mjs";
import * as CASE_TENSIONS from "../case-tensions/checks.mjs";
import * as PUBLICATION from "../publication/checks.mjs";
import * as PUBLISH_SCHEDULE from "../publish-schedule/checks.mjs";
/* K1280, N526, N533, K1331 (R7): docket's C-129, in its place in the module order (directly after publication). Its
   pressure codes are its own since N526 and N533 (`MACHINE_CANNOT_MARK_DOCKET_PRESSURE`, `DOCKET_PRESSURE_MARKED`,
   `DOCKET_PRESSURE_REFUSED`; C-129.10, .12, .13), so no code is in both docket's and action-grammar's families, and
   reading docket before action-grammar moves no code's row. */
import * as DOCKET from "../docket/checks.mjs";
import * as PUBLIC_READ from "../public-read/checks.mjs";
/* K1150 (R7): network-notices' C-127, in its place in the module order (after public-read and project-stage). */
import * as NETWORK_NOTICES from "../network-notices/checks.mjs";
import * as RATIFICATION from "../ratification/checks.mjs";
/* R7 (N520): case-import's C-130, in its place in the module order (after ratification and case-checker, which holds no
   family: it answers results, not refusals). */
import * as CASE_IMPORT from "../case-import/checks.mjs";
/* N529, K1333 (R7): case-disclosures' C-120 (`CASE_DISCLOSURE_CHECKS`), moved whole from case-authoring's file, in its
   place in the module order (after case-import, directly before case-authoring). */
import * as CASE_DISCLOSURES from "../case-disclosures/checks.mjs";
/* T45-49 (K2834; R2, R7): T45's new families, each in its module's place in the module order: case-account's C-153
   (directly after case-disclosures, before case-authoring), case-check's C-148 (after review, before conformance),
   action-holds' C-149 (after action-grammar, `actions` holding no file of families, before action-clocks; the rows moved
   from actions' C-117 with their raisers), action-replies' C-150 (after action-clocks, before filing-templates) and
   plan-work's C-151 (after action-plans, before monitoring). */
import * as CASE_ACCOUNT from "../case-account/checks.mjs";
/* R15 (T47; N908 §5; `case-inputs` R12): case-inputs' rows (`STATEMENT_ACK_CHECKS` C-82.2–C-82.8, `CARRIED_OUTCOME_CHECKS`
   C-136.3–C-136.8), split from case-authoring's file with their raisers, in its place in the module order (directly after
   case-account, before case-authoring). No code is in both files, so each reads the row R7 pins (C-136.5 as case-inputs
   R17 re-words it under DEC-199). `action-records` holds no family of its own (its rows are action-grammar's). */
import * as CASE_INPUTS from "../case-inputs/checks.mjs";
import * as CASE_AUTHORING from "../case-authoring/checks.mjs";
import * as REVIEW from "../review/checks.mjs";
import * as CASE_CHECK from "../case-check/checks.mjs";
import * as CONFORMANCE from "../conformance/checks.mjs";
import * as CONSEQUENCES from "../consequences/checks.mjs";
/* K835, K837, K914: the action layer's eight families are action-grammar's, read from there; `actions` holds no file of
   them (its re-export was deleted, K914). */
import * as ACTION_GRAMMAR from "../action-grammar/checks.mjs";
import * as ACTION_HOLDS from "../action-holds/checks.mjs";
import * as ACTION_CLOCKS from "../action-clocks/checks.mjs";
import * as ACTION_REPLIES from "../action-replies/checks.mjs";
/* K921 (R7): filing-templates' C-125 and local-facts' C-126, each in its place in the module order. */
import * as FILING_TEMPLATES from "../filing-templates/checks.mjs";
import * as FILINGS from "../filings/checks.mjs";
import * as ESCALATION from "../escalation/checks.mjs";
import * as ACTION_PLANS from "../action-plans/checks.mjs";
import * as PLAN_WORK from "../plan-work/checks.mjs";
import * as MONITORING from "../monitoring/checks.mjs";
/* K1836 (T34-70, T34-60): following's C-137, in its place in the module order (after monitoring, before link-sweep). */
import * as FOLLOWING from "../following/checks.mjs";
/* K1207 (N506, R7): link-sweep's C-18.16–C-18.18 (`SWEEP_CHECKS`), moved from monitoring's file with the sweep, in its
   place in the module order (after monitoring). */
import * as LINK_SWEEP from "../link-sweep/checks.mjs";
/* N528 (R7): wizard-scripts' family, in its place in the module order (first in layer 11, after link-sweep). */
import * as WIZARD_SCRIPTS from "../wizard-scripts/checks.mjs";
import * as TASKS from "../tasks/checks.mjs";
import * as QUEUE from "../queue/checks.mjs";
import * as ADMISSION from "../admission/checks.mjs";
import * as TRANSLATIONS from "../translations/checks.mjs";
import * as INSTANCE_SETUP from "../setup.mjs";
import * as OWN from "./checks.mjs";

/* R18 (T48; N1039, K3147; the `court-citations` R11 form): importing this module builds none of its tables. Each exported
   table is a plain binding to a proxy over an empty target of the right kind; the first operation on it fills the target,
   freezes it, and every operation after is forwarded to the filled, frozen target, so a read answers value for value as
   before (entries, `length`, `Array.isArray`, frozenness, a write refused in strict code). */
function lazyTable(target, fill) {
  let ready = false;
  const get = () => { if (!ready) { fill(target); Object.freeze(target); ready = true; } return target; };
  const forward = (op) => (_t, ...args) => Reflect[op](get(), ...args);
  return new Proxy(target, {
    get: (_t, key) => Reflect.get(get(), key),
    has: forward("has"), ownKeys: forward("ownKeys"), getOwnPropertyDescriptor: forward("getOwnPropertyDescriptor"),
    getPrototypeOf: forward("getPrototypeOf"), isExtensible: forward("isExtensible"),
    set: forward("set"), defineProperty: forward("defineProperty"), deleteProperty: forward("deleteProperty"),
    setPrototypeOf: forward("setPrototypeOf"), preventExtensions: forward("preventExtensions"),
  });
}

/* The sources, in the order a code is resolved: `[path under bio-plane/, namespace]`. */
const FILE_LIST = [
  ["src/record-grammar/acts.mjs", RECORD_GRAMMAR_ACTS],
  ["src/textchain.mjs", TEXT_CHAIN],
  ["src/record-core/checks.mjs", RECORD_CORE],
  ["src/membership/checks.mjs", MEMBERSHIP],
  ["src/project-roster/checks.mjs", PROJECT_ROSTER],
  ["src/ai-accounts/checks.mjs", AI_ACCOUNTS],
  ["src/credentials/checks.mjs", CREDENTIALS],
  ["src/promotion/checks.mjs", PROMOTION],
  ["src/provenance/checks.mjs", PROVENANCE],
  ["src/attestation/checks.mjs", ATTESTATION],
  ["src/provenance-routes/checks.mjs", PROVENANCE_ROUTES],
  ["src/capture-sources/credentials.mjs", CAPTURE_SOURCES],
  ["src/acquisition/checks.mjs", ACQUISITION],
  ["src/capture/checks.mjs", CAPTURE],
  ["src/doorbell/checks.mjs", DOORBELL],
  ["src/file-safety/checks.mjs", FILE_SAFETY],
  ["src/sources/checks.mjs", SOURCES],
  ["src/calibration/checks.mjs", CALIBRATION],
  ["src/extraction/checks.mjs", EXTRACTION],
  ["src/content/checks.mjs", CONTENT],
  ["src/content/extent.mjs", CONTENT_EXTENT],
  ["src/entities/checks.mjs", ENTITIES],
  ["src/events/checks.mjs", EVENTS],
  ["src/local-facts/checks.mjs", LOCAL_FACTS],
  ["src/connections/checks.mjs", CONNECTIONS],
  ["src/connections/themes.mjs", CONNECTIONS_THEMES],
  ["src/observation-log/checks.mjs", OBSERVATION_LOG],
  ["src/law-relations/checks.mjs", LAW_RELATIONS],
  ["src/standards/checks.mjs", STANDARDS],
  ["src/progressions/checks.mjs", PROGRESSIONS],
  ["src/money-checks/checks.mjs", MONEY_CHECKS],
  ["src/duties/checks.mjs", DUTIES],
  ["src/bias/checks.mjs", BIAS],
  ["src/retrieval/checks.mjs", RETRIEVAL],
  ["src/inquiry-grammar/checks.mjs", INQUIRY_GRAMMAR],
  ["src/accepted-work/checks.mjs", ACCEPTED_WORK],
  ["src/inquiry/index.mjs", INQUIRY],
  ["src/hypotheses/checks.mjs", HYPOTHESES],
  ["src/steps/checks.mjs", STEPS],
  ["src/citation/checks.mjs", CITATION],
  ["src/basis-versions/checks.mjs", BASIS_VERSIONS],
  ["src/strength/checks.mjs", STRENGTH],
  ["src/contradiction/checks.mjs", CONTRADICTION],
  ["src/run-rules/checks.mjs", RUN_RULES],
  ["src/ai-use/checks.mjs", AI_USE],
  ["src/run-productions/checks.mjs", RUN_PRODUCTIONS],
  ["src/capture-requests/checks.mjs", CAPTURE_REQUESTS],
  ["src/reading-guides/checks.mjs", READING_GUIDES],
  ["src/skilldoctrine.mjs", SKILLS],
  ["src/question-explorer/checks.mjs", QUESTION_EXPLORER],
  ["src/answers/checks.mjs", ANSWERS],
  ["src/intent/checks.mjs", INTENT],
  ["src/investigation/checks.mjs", INVESTIGATION],
  ["src/reevaluation/checks.mjs", REEVALUATION],
  ["src/case-carriage/checks.mjs", CASE_CARRIAGE],
  ["src/case-tensions/checks.mjs", CASE_TENSIONS],
  ["src/publication/checks.mjs", PUBLICATION],
  ["src/publish-schedule/checks.mjs", PUBLISH_SCHEDULE],
  ["src/docket/checks.mjs", DOCKET],
  ["src/public-read/checks.mjs", PUBLIC_READ],
  ["src/network-notices/checks.mjs", NETWORK_NOTICES],
  ["src/ratification/checks.mjs", RATIFICATION],
  ["src/case-import/checks.mjs", CASE_IMPORT],
  ["src/case-disclosures/checks.mjs", CASE_DISCLOSURES],
  ["src/case-account/checks.mjs", CASE_ACCOUNT],
  ["src/case-inputs/checks.mjs", CASE_INPUTS],
  ["src/case-authoring/checks.mjs", CASE_AUTHORING],
  ["src/review/checks.mjs", REVIEW],
  ["src/case-check/checks.mjs", CASE_CHECK],
  ["src/conformance/checks.mjs", CONFORMANCE],
  ["src/consequences/checks.mjs", CONSEQUENCES],
  ["src/action-grammar/checks.mjs", ACTION_GRAMMAR],
  ["src/action-holds/checks.mjs", ACTION_HOLDS],
  ["src/action-clocks/checks.mjs", ACTION_CLOCKS],
  ["src/action-replies/checks.mjs", ACTION_REPLIES],
  ["src/filing-templates/checks.mjs", FILING_TEMPLATES],
  ["src/filings/checks.mjs", FILINGS],
  ["src/escalation/checks.mjs", ESCALATION],
  ["src/action-plans/checks.mjs", ACTION_PLANS],
  ["src/plan-work/checks.mjs", PLAN_WORK],
  ["src/monitoring/checks.mjs", MONITORING],
  ["src/following/checks.mjs", FOLLOWING],
  ["src/link-sweep/checks.mjs", LINK_SWEEP],
  ["src/wizard-scripts/checks.mjs", WIZARD_SCRIPTS],
  ["src/tasks/checks.mjs", TASKS],
  ["src/queue/checks.mjs", QUEUE],
  ["src/translations/checks.mjs", TRANSLATIONS],
  ["src/setup.mjs", INSTANCE_SETUP],
  ["src/admission/checks.mjs", ADMISSION],
  ["src/answer-envelope/checks.mjs", OWN],
];
export const CHECK_FAMILY_FILES = lazyTable([], (t) => { for (const e of FILE_LIST) t.push(Object.freeze(e)); });

const translated = (row) => !!row && typeof row === "object" && typeof row.translation === "string" && row.translation !== "";

/* Fills `out` (the target of `CHECK_FAMILIES`) from the sources: each code once, in its first-holding family. */
function compose(out) {
  const first = new Map();   /* code → [family, row], the row that keeps the code */
  for (const [, source] of FILE_LIST)
    for (const family of Object.keys(source).sort()) {
      if (!/_CHECKS$/.test(family)) continue;
      const rows = source[family];
      if (!rows || typeof rows !== "object" || Array.isArray(rows)) continue;
      for (const [code, row] of Object.entries(rows)) {
        if (!row || typeof row !== "object") continue;
        const held = first.get(code);
        if (!held || (!translated(held[1]) && translated(row))) first.set(code, [family, row]);
      }
    }
  for (const [code, [family, row]] of first) (out[family] ??= {})[code] = row;
  for (const f of Object.keys(out)) Object.freeze(out[f]);
}

export const CHECK_FAMILIES = lazyTable({}, compose);

/* R2: a code's row, `{check, translation}`, or null when no source holds one with a canned translation. Read on first use (R18). */
let ROWS = null;
export function dec49Row(code) {
  ROWS ??= new Map(Object.values(CHECK_FAMILIES).flatMap((rows) => Object.entries(rows))
    .filter(([, row]) => translated(row)).map(([code, row]) => [code, { check: row.check ?? null, translation: row.translation }]));
  const row = ROWS.get(code);
  return row ? { ...row } : null;
}
