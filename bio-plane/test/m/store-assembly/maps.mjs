/* store-assembly's copy of plane's `maps.mjs` (K624: by copy). R6's statement, for the tests: each module's own ops map, built on a host as its module offers it, in the order the
   assembled store's route map spreads them (today's order: `src/store-assembly/assemble.mjs`' `routes`, then instance-setup's, admission's, the owner map's (`owner-ops.mjs`, R86), then store-door's, K2043). The pending ledger's map is labelled `store-assembly` and the owner map `owner-map` (plane called them `plane` and `control-plane`). */
import { actionsOf, actionsOps } from "../../../src/actions/index.mjs";
import { actionClocksOf, actionClocksOps } from "../../../src/action-clocks/index.mjs";
import { actionHoldsOf, actionHoldsOps } from "../../../src/action-holds/index.mjs";
import { actionRepliesOf, actionRepliesOps } from "../../../src/action-replies/index.mjs";
import { planWorkOf, planWorkOps } from "../../../src/plan-work/index.mjs";
import { caseCheckOf, caseCheckOps } from "../../../src/case-check/index.mjs";
import { localFactsOf, localFactsOps } from "../../../src/local-facts/index.mjs";
import { filingTemplatesOf, filingTemplatesOps } from "../../../src/filing-templates/index.mjs";
import { standardsOf, standardsOps } from "../../../src/standards/index.mjs";
import { conformanceOf, conformanceOps } from "../../../src/conformance/index.mjs";
import { consequencesModule, consequencesOps } from "../../../src/consequences/index.mjs";
import { filingsOf, filingsOps } from "../../../src/filings/index.mjs";
import { escalationOf, escalationOps } from "../../../src/escalation/index.mjs";
import { actionPlansOf, actionPlansOps } from "../../../src/action-plans/index.mjs";
import { promotionOf, promotionOps } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { provenanceOps } from "../../../src/provenance/ops.mjs";
import { provenanceRoutesOf, provenanceRouteOps } from "../../../src/provenance-routes/index.mjs";
import { membershipOf, membershipOps, viewerPredicate } from "../../../src/membership/index.mjs";
import { projectRosterOf, projectRosterOps } from "../../../src/project-roster/index.mjs";
import { credentialsOf, credentialsOps } from "../../../src/credentials/index.mjs";
import { aiAccountsOf, aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { observationLogOf, observationLogOps, OBSERVATION_LOG_MODULE } from "../../../src/observation-log/index.mjs";
import { runProductionsOf, runProductionsOps } from "../../../src/run-productions/index.mjs";
import { captureRequestsOf, captureRequestsOps } from "../../../src/capture-requests/index.mjs";
import { recordOf, recordCoreOps } from "../../../src/record-core/index.mjs";
import { governorOf, governorRoutes } from "../../../src/host-governor/index.mjs";
import { acquireTimingsOps } from "../../../src/store-assembly/acquire-timings.mjs";
import { pendingOf, pendingOps } from "../../../src/store-assembly/pending.mjs";
import { acquisitionOf } from "../../../src/acquisition/index.mjs";
import { captureOf, captureOps } from "../../../src/capture/index.mjs";
import { doorbellOf, doorbellOps } from "../../../src/doorbell/index.mjs";
import { mailDoorOf, mailDoorOps } from "../../../src/mail-door/index.mjs";
import { registersOf, registersOps } from "../../../src/registers/index.mjs";
import { monitoringOf, monitoringOps } from "../../../src/monitoring/index.mjs";
import { linkSweepOf, linkSweepOps } from "../../../src/link-sweep/index.mjs";
import { connectionsOf, connectionsOps } from "../../../src/connections/index.mjs";
import { inquiryOf, inquiryOps } from "../../../src/inquiry/index.mjs";
import { citationOf, citationOps } from "../../../src/citation/index.mjs";
import { extractionOf, extractionOps } from "../../../src/extraction/index.mjs";
import { entitiesOf, entitiesOps } from "../../../src/entities/index.mjs";
import { basisVersionsOf, basisVersionsOps } from "../../../src/basis-versions/index.mjs";
import { contradictionOf, contradictionOps } from "../../../src/contradiction/index.mjs";
import { calibrationOf, calibrationOps } from "../../../src/calibration/index.mjs";
import { progressionsOf, progressionOps } from "../../../src/progressions/index.mjs";
import { intentOf, intentOps } from "../../../src/intent/index.mjs";
import { strengthOf, strengthOps } from "../../../src/strength/index.mjs";
import { reevaluationOf, reevaluationOps } from "../../../src/reevaluation/index.mjs";
import { reviewOf, reviewOps } from "../../../src/review/index.mjs";
import { caseAuthoringOf, caseAuthoringOps } from "../../../src/case-authoring/index.mjs";
import { signinDoorOps } from "../../../src/signin-door/ops.mjs";
import { caseInputsOf, caseInputsOps } from "../../../src/case-inputs/index.mjs";
import { actionRecordsOf, actionRecordsOps } from "../../../src/action-records/index.mjs";
import { caseAccountOf, caseAccountOps } from "../../../src/case-account/index.mjs";
import { ratificationOf, ratificationOps } from "../../../src/ratification/index.mjs";
import { publicationOf, publicationOps } from "../../../src/publication/index.mjs";
import { docketOf, docketOps } from "../../../src/docket/index.mjs";
import { caseCarriageOps } from "../../../src/case-carriage/index.mjs";
import { caseImportOf, caseImportOps } from "../../../src/case-import/index.mjs";
import { publicReadOf, publicReadOps } from "../../../src/public-read/index.mjs";
import { projectStageOf, projectStageOps } from "../../../src/project-stage/index.mjs";
import { networkNoticesOf, networkNoticesOps } from "../../../src/network-notices/index.mjs";
import { corpusExportOf, corpusExportOps, wholeExportOps } from "../../../src/corpus-export/index.mjs";
import { biasOf, biasOps } from "../../../src/bias/index.mjs";
import { aiRunsOf, aiRunsOps } from "../../../src/ai-runs/index.mjs";
import { contentOf, contentOps } from "../../../src/content/index.mjs";
import { retrievalOf, retrievalRoutes } from "../../../src/retrieval/index.mjs";
import { wizardScriptsOf, wizardScriptsOps } from "../../../src/wizard-scripts/index.mjs";
import { instanceSetupOf, instanceSetupOps } from "../../../src/setup.mjs";
import { translationsOf, translationsOps } from "../../../src/translations/index.mjs";
import { controlPlaneRoutes } from "../../../src/store-door/dispatch.mjs";
import { admissionOf, admissionOps } from "../../../src/admission/window.mjs";
import { eventsOf, eventsOps } from "../../../src/events/index.mjs";
import { linesOf, linesOps } from "../../../src/lines/index.mjs";
import { moneyOf, moneyOps } from "../../../src/money/index.mjs";
import { moneyChecksOf, moneyChecksOps } from "../../../src/money-checks/index.mjs";
import { dutiesOf, dutiesOps } from "../../../src/duties/index.mjs";
import { peopleOf, peopleOps } from "../../../src/people/index.mjs";
import { exploreOf, exploreOps } from "../../../src/explore/index.mjs";
import { calculationsOf, calculationsOps } from "../../../src/calculations/index.mjs";
import { workbooksOf, workbooksOps } from "../../../src/workbooks/index.mjs";
import { legEarningOf, legEarningOps } from "../../../src/leg-earning/index.mjs";
import { hypothesesOf, hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { answersOf, answersOps } from "../../../src/answers/index.mjs";
import { caseTensionsOf, caseTensionsOps } from "../../../src/case-tensions/index.mjs";
import { followingOf, followingOps } from "../../../src/following/index.mjs";
import { fileSafetyOf, fileSafetyOps } from "../../../src/file-safety/index.mjs";
import { aiUseOf, aiUseOps } from "../../../src/ai-use/index.mjs";
import { readingGuidesOf, readingGuidesOps } from "../../../src/reading-guides/index.mjs";
import { publishScheduleOps } from "../../../src/publish-schedule/index.mjs";
import { ownerOps } from "../../../src/store-assembly/owner-ops.mjs";
import { ownerGettersOf } from "../../../src/store-assembly/owners.mjs";
import { stepsOf } from "../../../src/steps/index.mjs";
import { investigationOf } from "../../../src/investigation/index.mjs";
import { investigationOps } from "../../../src/investigation/ops.mjs";
import { captureSourcesOps } from "../../../src/capture-sources/ops.mjs";
import { credentialsOf as captureCredentialsOf } from "../../../src/capture-sources/credentials.mjs";
import { questionExplorerOf } from "../../../src/question-explorer/index.mjs";

export const MODULE_MAPS = [
  ["membership", (c, u, b, e) => membershipOps(membershipOf(c), u, b, e)],
  ["project-roster", (c, u, b, e) => projectRosterOps(projectRosterOf(c), u, b, e)],   /* N783 (K2270): directly after membership's */
  /* R40 (T48; ai-accounts R32): ai-accounts' map directly before credentials' */
  ["ai-accounts", (c, u, b, e) => aiAccountsOps(aiAccountsOf(c), u, b, e)],
  ["credentials", (c, u, b, e) => credentialsOps(credentialsOf(c), u, b, e)],
  /* R37 (T47): signin-door's store-internal map, beside credentials' */
  ["signin-door", (c, u, b, e) => signinDoorOps(credentialsOf(c), u, b, e)],
  /* K2042 (acquisition R43): the group's co-archive setting, acquisition's two acts. acquisition exports no ops map of
     its own (its ops are reached through capture's and control-plane's doors), so the pair is named here as the module's
     whose methods answer them: the plane adds no behaviour, only the entry (plane R9). */
  ["acquisition", (c, u, b) => ({ coarchiveset: () => acquisitionOf(c).coArchiveSet({ on: b ? b.on : undefined, by: u.searchParams.get("by") }),
                                  coarchivestate: () => acquisitionOf(c).coArchiveState(),
                                  ...acquireTimingsOps(c, u) })],   /* R60 (K4231): acquisition's stage times of a running call */
  /* R62 (T51 fix round 4; K4429): the plane's own store-internal route, `pendingadd`, directly after acquisition's pair: the door's
     deferred reading (control-plane R120) written down for the object's alarm. R62 amends R9 for it and for `pending-work`. */
  ["store-assembly", (c, u) => pendingOps(pendingOf(c), u)],
  ["capture", (c, u, b, e) => captureOps(captureOf(c), u, b, e)],
  ["doorbell", (c, u, b) => doorbellOps(doorbellOf(c), u, b)],   /* R32: directly after capture's */
  ["mail-door", (c, u, b) => mailDoorOps(mailDoorOf(c), u, b)],   /* R47: directly after doorbell's */
  ["file-safety", (c, u, b, e) => fileSafetyOps(fileSafetyOf(c), u, b, e)],   /* R24: directly after doorbell's */
  ["calibration", (c, u, b) => calibrationOps(calibrationOf(c), u, b)],
  ["bias", (c, u, b) => biasOps(biasOf(c), u, b)],
  ["extraction", (c, u, b, e) => extractionOps(extractionOf(c), u, b, e)],
  ["connections", (c, u, b, e) => connectionsOps(connectionsOf(c), u, b, e)],
  ["inquiry", (c, u, b) => inquiryOps(inquiryOf(c), u, b)],
  ["leg-earning", (c, u) => legEarningOps(legEarningOf(c), u)],
  ["hypotheses", (c, u, b) => hypothesesOps(hypothesesOf(c), u, b)],
  ["citation", (c, u, b) => citationOps(citationOf(c), u, b)],
  ["observation-log", (c, u, b) => observationLogOps(observationLogOf(c), u, b)],
  ["run-productions", (c, u, b) => runProductionsOps(runProductionsOf(c), u, b)],
  ["entities", (c, u, b) => entitiesOps(entitiesOf(c), u, b)],
  ["events", (c, u, b) => eventsOps(eventsOf(c), u, b)],
  ["lines", (c, u, b) => linesOps(linesOf(c), u, b)],
  ["money", (c, u, b) => moneyOps(moneyOf(c), u, b)],
  ["money-checks", (c, u, b) => moneyChecksOps(moneyChecksOf(c), u, b)],
  ["duties", (c, u, b) => dutiesOps(dutiesOf(c), u, b)],
  ["people", (c, u, b) => peopleOps(peopleOf(c), u, b)],
  ["explore", (c, u, b) => exploreOps(exploreOf(c), u, b)],
  ["calculations", (c, u, b) => calculationsOps(calculationsOf(c), u, b)],
  ["workbooks", (c, u, b) => workbooksOps(workbooksOf(c), u, b)],
  ["registers", (c, u, b) => registersOps(registersOf(c), u, b)],   /* R101: directly after workbooks' */
  ["contradiction", (c, u, b) => contradictionOps(contradictionOf(c), u, b)],
  ["progressions", (c, u, b) => progressionOps(progressionsOf(c), u, b)],
  ["intent", (c, u, b) => intentOps(intentOf(c), u, b)],
  ["basis-versions", (c, u, b) => basisVersionsOps(basisVersionsOf(c), u, b)],
  ["strength", (c, u, b) => strengthOps(strengthOf(c), u, b)],
  ["reevaluation", (c, u, b) => reevaluationOps(reevaluationOf(c), u, b)],
  /* R36 (T47): case-inputs' map directly before case-authoring's */
  ["case-inputs", (c, u, b) => caseInputsOps(caseInputsOf(c), u, b)],
  ["case-authoring", (c, u, b) => caseAuthoringOps(caseAuthoringOf(c), u, b)],
  /* R34 (T46; N935; case-account R15): case-account's own map, over the plane's one instance */
  ["case-account", (c, u, b) => caseAccountOps(caseAccountOf(c), u, b)],
  ["ratification", (c, u, b) => ratificationOps(ratificationOf(c), u, b)],
  ["case-import", (c, u, b) => caseImportOps(caseImportOf(c), u, b)],
  /* F4: corpus-export's own map and its whole-export arms (`wholeExportOps`, its R17, R18), both its own */
  ["corpus-export", (c, u) => ({ ...corpusExportOps(corpusExportOf(c), (k) => u.searchParams.get(k)),
                                 ...wholeExportOps(corpusExportOf(c), (k) => u.searchParams.get(k)) })],
  ["case-tensions", (c, u, b) => caseTensionsOps(caseTensionsOf(c), u, b)],
  ["publication", (c, u, b) => publicationOps(publicationOf(c), u, b)],
  /* R16 (T37; K2226): case-carriage's map, over the one instance publication's factory made */
  ["case-carriage", (c, u, b) => caseCarriageOps(publicationOf(c).caseCarriage, u, b)],
  /* R30 (N823): publish-schedule's map, over the one instance ratification's factory made */
  ["publish-schedule", (c, u, b) => publishScheduleOps(ratificationOf(c).publishSchedule, u, b)],
  ["docket", (c, u, b) => docketOps(docketOf(c), u, b)],
  ["public-read", (c, u) => publicReadOps(publicReadOf(c), u)],
  ["project-stage", (c, u) => projectStageOps(projectStageOf(c), u)],
  ["network-notices", (c, u, b) => networkNoticesOps(networkNoticesOf(c), u, b)],
  ["promotion", (c, u, b) => promotionOps(promotionOf(c), u, b)],
  ["record-core", (c, u, b) => recordCoreOps(recordOf(c), u, b, { sight: viewerPredicate })],
  ["provenance", (c, u, b) => provenanceOps(provenanceOf(c), u, b, { observer: OBSERVATION_LOG_MODULE })],
  ["provenance-routes", (c, u, b) => provenanceRouteOps(provenanceRoutesOf(c), u, b)],
  ["content", (c, u, b) => contentOps(contentOf(c), u, b)],
  ["capture-requests", (c, u, b) => captureRequestsOps(captureRequestsOf(c), u, b)],
  /* R45, R46 (K4213): capture-sources' and investigation's maps, directly after capture-requests' */
  ["capture-sources", (c, u, b) => captureSourcesOps(captureCredentialsOf(c), u, b)],
  ["investigation", (c, u, b) => investigationOps(investigationOf(c), u, b)],
  ["reading-guides", (c, u, b) => readingGuidesOps(readingGuidesOf(c), u, b)],   /* R31 */
  ["host-governor", (c, u, b) => governorRoutes(governorOf(c), u, b)],
  ["ai-use", (c, u, b) => aiUseOps(aiUseOf(c), u, b)],   /* R29 (K2488) */
  ["ai-runs", (c, u, b, e) => aiRunsOps(aiRunsOf(c, e), u, b)],
  ["answers", (c, u, b) => answersOps(answersOf(c), u, b)],
  ["retrieval", (c, u, b) => retrievalRoutes(retrievalOf(c), u, b)],
  /* R36 (T47): action-records' map directly before actions' */
  ["action-records", (c, u, b) => actionRecordsOps(actionRecordsOf(c), u, b)],
  ["actions", (c, u, b) => actionsOps(actionsOf(c), u, b)],
  ["action-holds", (c, u, b) => actionHoldsOps(actionHoldsOf(c), u, b)],   /* R34 (T45): directly after actions' */
  ["action-clocks", (c, u, b) => actionClocksOps(actionClocksOf(c), u, b)],
  ["action-replies", (c, u, b) => actionRepliesOps(actionRepliesOf(c), u, b)],   /* R34: after action-clocks' */
  /* R34 (T46; N935; local-facts R15): its own map, `grouprules` among it */
  ["local-facts", (c, u, b) => localFactsOps(localFactsOf(c), u, b)],
  ["standards", (c, u, b) => standardsOps(standardsOf(c), u, b)],
  ["conformance", (c, u, b) => conformanceOps(conformanceOf(c), u, b)],
  ["consequences", (c, u, b) => consequencesOps(consequencesModule(c), u, b)],
  ["filings", (c, u, b) => filingsOps(filingsOf(c), u, b)],
  ["filing-templates", (c, u, b) => filingTemplatesOps(filingTemplatesOf(c), u, b)],
  ["action-plans", (c, u, b) => actionPlansOps(actionPlansOf(c), u, b)],
  ["plan-work", (c, u, b) => planWorkOps(planWorkOf(c), u, b)],   /* R34: directly after action-plans' */
  ["escalation", (c, u, b) => escalationOps(escalationOf(c), u, b)],
  ["monitoring", (c, u, b) => monitoringOps(monitoringOf(c), u, b)],
  ["link-sweep", (c, u, b) => linkSweepOps(linkSweepOf(c), u, b)],
  ["following", (c, u, b) => followingOps(followingOf(c), u, b)],
  ["review", (c, u, b) => reviewOps(reviewOf(c), u, b)],
  ["case-check", (c, u, b) => caseCheckOps(caseCheckOf(c), u, b)],   /* R34 (K2839): after review's */
  ["wizard-scripts", (c, u, b) => wizardScriptsOps(wizardScriptsOf(c), u, b)],
  /* R42 (T50; translations R12): translations' nine routes before instance-setup's, which drops them (its own copy goes in T50-23) */
  ["translations", (c, u, b) => translationsOps(translationsOf(c), u, b)],
  ["instance-setup", (c, u, b, e) => Object.fromEntries(Object.entries(instanceSetupOps(instanceSetupOf(c, e), u, b))
    .filter(([op]) => !Object.hasOwn(translationsOps(translationsOf(c), u, b), op)))],
  ["admission", (c, u, b) => admissionOps(admissionOf(c), u, b)],
  /* R31 (K2585): control-plane's own map for owners with no arm (its R71, R72), over each owner's one instance */
  ["owner-map", (c, u, b, e) => ownerOps(ownerGettersOf(c, e), u, b)],   /* the getters the store hands (store-assembly/owners.mjs), not a copy of them (K4435) */
  ["store-door", (c, u, b) => controlPlaneRoutes(c, u, b)],
];

/** Each module's map on host `ctx` for one request, as `[module, map]`, in R6's order. */
export const ownMaps = (ctx, url, body, env = {}) => MODULE_MAPS.map(([m, f]) => [m, f(ctx, url, body, env)]);

/* K3268, R41, R43 (T51): a test never hand-lists an owner's ops. These read them from the owners' own maps (`ownMaps`), so an
   op added to an owner's map moves no list in a test. The ops below answer by a write the door's frame and a direct call
   cannot both make on a bare "nobody" address (a malformed internal row, a clock, an export's id, an empty body, a count each ask moves), so they
   are reached by their own tests and left out of the sweep. */
export const NOT_COMPARED = Object.freeze(new Set(["recordlinkverdict", "recordcpuprobestep", "grouplogo", "knock", "inboxlist", "export", "clockpropose", "renderadmit"]));

/** The ops `owners` (module names, as `MODULE_MAPS` names them) serve: `[[op, owner]]`, each from the owner's own map. */
export const opsServedBy = (ctx, url, env, owners) =>
  ownMaps(ctx, url, null, env).filter(([m]) => owners.includes(m)).flatMap(([m, map]) => Object.keys(map).map((op) => [op, m]));

/** Every op `owners` serve is in the route map (once), and through control-plane's door answers what the owner's own map
 *  answers called directly, on a twin store (instants masked). Answers the ops served, and each op that did not. */
export async function servedThroughDoor(x, twin, owners, { skip = NOT_COMPARED } = {}) {
  const u = new URL("http://do/");
  const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');
  const keys = Object.keys(x.s.routes(u, null));
  const served = opsServedBy(x.ctx, u, x.env, owners), failed = [];
  for (const [op, owner] of served) {
    if (!keys.includes(op)) { failed.push(`${op}: not in the route map`); continue; }
    if (skip.has(op)) continue;
    const path = `${op}?viewer=member:nobody&by=member:nobody&author=member:nobody&project=PROJ-2026-none&case=CASE-2026-none&edition=1&language=es&id=X-none&plan=PLAN-2026-none`;
    const res = await x.fetch(`/${path}`, { method: "POST", body: "{}" });
    const fn = MODULE_MAPS.find(([m]) => m === owner)[1];
    let direct;
    try { direct = await fn(twin.ctx, new URL(`http://do/${path}`), {}, twin.env)[op](); } catch (e) { direct = { threw: String(e) }; }
    const got = JSON.parse(mask(await res.text())), want = JSON.parse(mask(JSON.stringify({ ok: true, result: direct ?? null })));
    if (res.status !== 200 || JSON.stringify(got) !== JSON.stringify(want)) failed.push(`${op} (${owner}): ${res.status}`);
  }
  return { served, failed };
}
