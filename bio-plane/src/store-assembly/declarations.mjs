/* store-assembly R83 (was plane R68; K4168, K4189): THE ASSEMBLY OF THE OWNERS' OP DECLARATIONS. Each module that declares ops
   exports `DECLARED_OPS` beside its ops map; the assembly takes them by its own static imports of the modules it composes,
   never through `test-support`'s collector (`declaredOpsOf`, which imports later modules by path and is test tooling only,
   P4), and hands them once, before any table is read, to `op-declarations`' and `op-grades`' registration (their R80, R49).
   An op declared by two modules stops the start naming the op and both modules; an owner's row that disagrees with a hand
   row stops it with the op named, as the registrations refuse it. The assembly's own rows (`./declared.mjs`, R84) and those of
   its owner map (`./owner-ops.mjs`, R85) are one owner's, `store-assembly`.
   ES modules cannot list their imports, so the import lines below are the list; `declarations.test.mjs` holds them to
   `build/modules.json` (every module whose source exports `DECLARED_OPS` is here, or the test names it). */
import { registerDeclaredOps as registerOpDeclarations } from "../op-declarations/index.mjs";
import { registerDeclaredOps as registerOpGrades } from "../op-grades/index.mjs";
import { DECLARED_OPS as ASSEMBLY_DECLARED_OPS } from "./declared.mjs";
import { OWNER_MAP_DECLARED_OPS } from "./owner-ops.mjs";
import { DECLARED_OPS as recordCore } from "../record-core/index.mjs";
import { DECLARED_OPS as membership } from "../membership/index.mjs";
import { DECLARED_OPS as aiAccounts } from "../ai-accounts/index.mjs";
import { DECLARED_OPS as promotion } from "../promotion/index.mjs";
import { DECLARED_OPS as attestation } from "../attestation/ops.mjs";
import { DECLARED_OPS as provenanceRoutes } from "../provenance-routes/ops.mjs";
import { DECLARED_OPS as capture } from "../capture/index.mjs";
import { DECLARED_OPS as doorbell } from "../doorbell/index.mjs";
import { DECLARED_OPS as sources } from "../sources/index.mjs";
import { DECLARED_OPS as extraction } from "../extraction/index.mjs";
import { DECLARED_OPS as content } from "../content/ops.mjs";
import { DECLARED_OPS as entities } from "../entities/index.mjs";
import { DECLARED_OPS as events } from "../events/index.mjs";
import { DECLARED_OPS as lines } from "../lines/index.mjs";
import { DECLARED_OPS as localFacts } from "../local-facts/index.mjs";
import { DECLARED_OPS as observationLog } from "../observation-log/index.mjs";
import { DECLARED_OPS as standards } from "../standards/index.mjs";
import { DECLARED_OPS as progressions } from "../progressions/index.mjs";
import { DECLARED_OPS as money } from "../money/index.mjs";
import { DECLARED_OPS as duties } from "../duties/index.mjs";
import { DECLARED_OPS as people } from "../people/index.mjs";
import { DECLARED_OPS as explore } from "../explore/ops.mjs";
import { DECLARED_OPS as bias } from "../bias/index.mjs";
import { DECLARED_OPS as retrieval } from "../retrieval/index.mjs";
import { DECLARED_OPS as calculations } from "../calculations/index.mjs";
import { DECLARED_OPS as workbooks } from "../workbooks/ops.mjs";
import { DECLARED_OPS as hypotheses } from "../hypotheses/index.mjs";
import { DECLARED_OPS as basisVersions } from "../basis-versions/index.mjs";
import { DECLARED_OPS as strength } from "../strength/index.mjs";
import { DECLARED_OPS as contradiction } from "../contradiction/index.mjs";
import { DECLARED_OPS as aiUse } from "../ai-use/index.mjs";
import { DECLARED_OPS as aiRuns } from "../ai-runs/index.mjs";
import { DECLARED_OPS as readingGuides } from "../reading-guides/index.mjs";
import { DECLARED_OPS as answers } from "../answers/ops.mjs";
import { DECLARED_OPS as intent } from "../intent/index.mjs";
import { DECLARED_OPS as reevaluation } from "../reevaluation/index.mjs";
import { DECLARED_OPS as corpusExport } from "../corpus-export/index.mjs";
import { DECLARED_OPS as caseCarriage } from "../case-carriage/index.mjs";
import { DECLARED_OPS as caseTensions } from "../case-tensions/index.mjs";
import { DECLARED_OPS as publishSchedule } from "../publish-schedule/index.mjs";
import { DECLARED_OPS as docket } from "../docket/index.mjs";
import { DECLARED_OPS as publicRead } from "../public-read/index.mjs";
import { DECLARED_OPS as networkNotices } from "../network-notices/index.mjs";
import { DECLARED_OPS as ratification } from "../ratification/index.mjs";
import { DECLARED_OPS as conformance } from "../conformance/index.mjs";
import { DECLARED_OPS as consequences } from "../consequences/index.mjs";
import { DECLARED_OPS as actionRecords } from "../action-records/index.mjs";
import { DECLARED_OPS as actions } from "../actions/index.mjs";
import { DECLARED_OPS as actionHolds } from "../action-holds/index.mjs";
import { DECLARED_OPS as actionClocks } from "../action-clocks/index.mjs";
import { DECLARED_OPS as escalation } from "../escalation/ops.mjs";
import { DECLARED_OPS as actionPlans } from "../action-plans/index.mjs";
import { DECLARED_OPS as planWork } from "../plan-work/index.mjs";
import { DECLARED_OPS as following } from "../following/index.mjs";
import { DECLARED_OPS as translations } from "../translations/index.mjs";
import { DECLARED_OPS as memberRoster } from "../member-roster/index.mjs";
import { DECLARED_OPS as projectRoster } from "../project-roster/index.mjs";
import { DECLARED_OPS as credentials } from "../credentials/index.mjs";
import { DECLARED_OPS as provenance } from "../provenance/ops.mjs";
import { DECLARED_OPS as captureSources } from "../capture-sources/ops.mjs";
import { DECLARED_OPS as fileSafety } from "../file-safety/index.mjs";
import { DECLARED_OPS as connections } from "../connections/index.mjs";
import { DECLARED_OPS as inquiry } from "../inquiry/index.mjs";
import { DECLARED_OPS as citation } from "../citation/index.mjs";
import { DECLARED_OPS as runProductions } from "../run-productions/index.mjs";
import { DECLARED_OPS as captureRequests } from "../capture-requests/index.mjs";
import { DECLARED_OPS as investigation } from "../investigation/ops.mjs";
import { DECLARED_OPS as caseImport } from "../case-import/index.mjs";
import { DECLARED_OPS as caseInputs } from "../case-inputs/index.mjs";
import { DECLARED_OPS as caseAuthoring } from "../case-authoring/index.mjs";
import { DECLARED_OPS as review } from "../review/index.mjs";
import { DECLARED_OPS as filings } from "../filings/index.mjs";
import { DECLARED_OPS as monitoring } from "../monitoring/index.mjs";
import { DECLARED_OPS as linkSweep } from "../link-sweep/index.mjs";
import { DECLARED_OPS as wizardScripts } from "../wizard-scripts/index.mjs";
import { DECLARED_OPS as tasks } from "../tasks/index.mjs";
import { DECLARED_OPS as queue } from "../queue/index.mjs";
import { DECLARED_OPS as instanceSetup } from "../setup.mjs";
import { DECLARED_OPS as storeDoor } from "../store-door/dispatch.mjs";
import { DECLARED_OPS as signinDoor } from "../signin-door/index.mjs";

/* module id → that module's `DECLARED_OPS`, in `build/modules.json`'s order */
export const OWNERS = Object.freeze({
  "member-roster": memberRoster,
  "record-core": recordCore,
  membership: membership,
  "project-roster": projectRoster,
  "ai-accounts": aiAccounts,
  credentials: credentials,
  promotion: promotion,
  provenance: provenance,
  attestation: attestation,
  "provenance-routes": provenanceRoutes,
  "capture-sources": captureSources,
  capture: capture,
  doorbell: doorbell,
  "file-safety": fileSafety,
  sources: sources,
  extraction: extraction,
  content: content,
  entities: entities,
  events: events,
  lines: lines,
  "local-facts": localFacts,
  connections: connections,
  "observation-log": observationLog,
  standards: standards,
  progressions: progressions,
  money: money,
  duties: duties,
  people: people,
  explore: explore,
  bias: bias,
  retrieval: retrieval,
  calculations: calculations,
  workbooks: workbooks,
  inquiry: inquiry,
  hypotheses: hypotheses,
  citation: citation,
  "basis-versions": basisVersions,
  strength: strength,
  contradiction: contradiction,
  "ai-use": aiUse,
  "ai-runs": aiRuns,
  "run-productions": runProductions,
  "capture-requests": captureRequests,
  "reading-guides": readingGuides,
  answers: answers,
  intent: intent,
  investigation: investigation,
  reevaluation: reevaluation,
  "corpus-export": corpusExport,
  "case-carriage": caseCarriage,
  "case-tensions": caseTensions,
  "publish-schedule": publishSchedule,
  docket: docket,
  "public-read": publicRead,
  "network-notices": networkNotices,
  ratification: ratification,
  "case-import": caseImport,
  "case-inputs": caseInputs,
  "case-authoring": caseAuthoring,
  review: review,
  conformance: conformance,
  consequences: consequences,
  "action-records": actionRecords,
  actions: actions,
  "action-holds": actionHolds,
  "action-clocks": actionClocks,
  filings: filings,
  escalation: escalation,
  "action-plans": actionPlans,
  "plan-work": planWork,
  monitoring: monitoring,
  following: following,
  "link-sweep": linkSweep,
  "wizard-scripts": wizardScripts,
  tasks: tasks,
  queue: queue,
  translations: translations,
  "instance-setup": instanceSetup,
  "store-door": storeDoor,
  "signin-door": signinDoor,
  /* R83, R85: the assembly's own rows and its owner map's, under this module's name (no longer `control-plane` or `plane`) */
  "store-assembly": Object.freeze({ ...ASSEMBLY_DECLARED_OPS, ...OWNER_MAP_DECLARED_OPS }),
});

/** R83: every owner's declaration handed to both registrations, in order. `owners` is `{module id: DECLARED_OPS}` (this
 *  module's own `OWNERS` by default); `registrars` the registrations to call (the two above by default; a test hands its
 *  own). Refused before any registration is called, naming the op and both modules, when an op is in two modules' rows;
 *  a registration's own refusal (a disagreement with a hand row, a late call) passes through unchanged. Answers `owners`. */
export function assembleDeclaredOps(owners = OWNERS, registrars = [registerOpDeclarations, registerOpGrades]) {
  const held = new Map();
  for (const [id, ops] of Object.entries(owners)) {
    for (const op of Object.keys(ops && typeof ops === "object" ? ops : {})) {
      if (held.has(op)) throw new TypeError(`store-assembly: ${op}: declared by two modules, ${held.get(op)} and ${id} (R83)`);
      held.set(op, id);
    }
  }
  for (const register of registrars) register(owners);
  return owners;
}
