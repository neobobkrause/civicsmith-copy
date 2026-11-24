/* store-assembly R1–R10, R99 (K5046 (a), K5052): THE ASSEMBLED STORE. `assembleStore(ctx, env, {deliver})` builds every
   module of the record store on one Durable Object's storage in the modules' order (R2), runs their migrations before
   any request (R3), hands the alarm to `scheduler`, and answers every store request through `store-door`'s `dispatch`
   over the one route map (R6, R7). It holds no construct of its own: no row but the owed-work ledger's, no refusal, no
   op (R97). It imports no platform module (R96), so it runs in plain node over a `node:sqlite` storage, which is how
   `storeWorld()` runs it (R90); `plane`'s `Store` hosts it as the Durable Object class and keeps the retirement of a
   room of another generation, the RPC methods, `alarm` and the headers. Copied, with its behaviour unchanged, from
   `plane/store.mjs`' constructor, `#migrate`, `routes`, `#dispatch`, `#nowMs` and `#ownNamespace` (K624: split by copy,
   then delete). The comments below keep the ids they were written under; each one's requirement here is the one that
   says "(was `plane` R<n>)". */
import "./register.mjs";   /* R83 (was plane R68; K4168): the owners' op declarations registered, before any table either registration keeps is read */
import { actionsOf, actionsOps } from "../actions/index.mjs";
import { actionClocksOf, actionClocksOps } from "../action-clocks/index.mjs";
import { actionHoldsOf, actionHoldsOps } from "../action-holds/index.mjs";
import { actionRepliesOf, actionRepliesOps } from "../action-replies/index.mjs";
import { planWorkOf, planWorkOps } from "../plan-work/index.mjs";
import { caseCheckOf, caseCheckOps } from "../case-check/index.mjs";
import { localFactsOf, localFactsOps } from "../local-facts/index.mjs";
import { caseInputsOf, caseInputsOps, registerCaseInputsPublicReads } from "../case-inputs/index.mjs";
import { signinDoorOps } from "../signin-door/ops.mjs";
import { actionRecordsOf, actionRecordsOps } from "../action-records/index.mjs";
import { filingTemplatesOf, filingTemplatesOps } from "../filing-templates/index.mjs";
import { standardsOf, standardsOps } from "../standards/index.mjs";
import { conformanceOf, conformanceOps } from "../conformance/index.mjs";
import { consequencesModule, consequencesOps } from "../consequences/index.mjs";
import { filingsOf, filingsOps } from "../filings/index.mjs";
import { escalationOf, escalationOps } from "../escalation/index.mjs";
import { actionPlansOf, actionPlansOps } from "../action-plans/index.mjs";
import { promotionOf, promotionOps } from "../promotion/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { provenanceOps } from "../provenance/ops.mjs";
import { attestationOf } from "../attestation/index.mjs";
import { provenanceRoutesOf, provenanceRouteOps } from "../provenance-routes/index.mjs";
import { membershipOf, membershipOps, viewerPredicate, MODULE_ORDER } from "../membership/index.mjs";
import { projectRosterOf, projectRosterOps } from "../project-roster/index.mjs";
import { credentialsOf, credentialsOps } from "../credentials/index.mjs";
import { aiAccountsOf, aiAccountsOps } from "../ai-accounts/index.mjs";
import { observationLogOf, observationLogOps, OBSERVATION_LOG_MODULE } from "../observation-log/index.mjs";
import { runProductionsOf, runProductionsOps } from "../run-productions/index.mjs";
import { captureRequestsOf, captureRequestsOps } from "../capture-requests/index.mjs";
import { recordOf, recordCoreOps, stampInstant } from "../record-core/index.mjs";
import { registerInquiryGrammar } from "../inquiry-grammar/index.mjs";
import { governorOf, governorRoutes } from "../host-governor/index.mjs";
import { acquisitionOf } from "../acquisition/index.mjs";
import { captureOf, captureOps } from "../capture/index.mjs";
import { acquireHandlerParts, acquireTimingsOps, traceStamped, ACQUIRE_STAGES_DDL } from "./acquire-timings.mjs";
import { pendingOf, pendingOps, administersOf } from "./pending.mjs";
import { storeId } from "../store-place.mjs";
import { doorbellOf, doorbellOps } from "../doorbell/index.mjs";
import { fileSafetyOf, fileSafetyOps } from "../file-safety/index.mjs";
import { monitoringOf, monitoringOps } from "../monitoring/index.mjs";
import { linkSweepOf, linkSweepOps } from "../link-sweep/index.mjs";
import { connectionsOf, connectionsOps } from "../connections/index.mjs";
import { inquiryOf, inquiryOps, inquiryLegGrades, inquiryFindings } from "../inquiry/index.mjs";
import { citationOf, citationOps } from "../citation/index.mjs";
import { extractionOf, extractionOps } from "../extraction/index.mjs";
import { entitiesOf, entitiesOps } from "../entities/index.mjs";
import { basisVersionsOf, basisVersionsOps } from "../basis-versions/index.mjs";
import { contradictionOf, contradictionOps } from "../contradiction/index.mjs";
import { calibrationOf, calibrationOps } from "../calibration/index.mjs";
import { schedulerOf } from "../scheduler/index.mjs";
import { progressionsOf, progressionOps } from "../progressions/index.mjs";
import { intentOf, intentOps } from "../intent/index.mjs";
import { strengthOf, strengthOps } from "../strength/index.mjs";
import { reevaluationOf, reevaluationOps } from "../reevaluation/index.mjs";
import { reviewOf, reviewOps } from "../review/index.mjs";
import { caseAuthoringOf, caseAuthoringOps } from "../case-authoring/index.mjs";
import { ratificationOf, ratificationOps } from "../ratification/index.mjs";
import { casefileSweepConsumer } from "./casesweep.mjs";
import { publicationOf, publicationOps } from "../publication/index.mjs";
import { docketOf, docketOps } from "../docket/index.mjs";
import { acceptedWorkOf } from "../accepted-work/index.mjs";
import { checkCaseFile, registerCaseCheckerPublicReads } from "../case-checker/index.mjs";
import { caseImportOf, caseImportOps } from "../case-import/index.mjs";
import { caseDisclosuresOf } from "../case-disclosures/index.mjs";
import { caseAccountOf, caseAccountOps } from "../case-account/index.mjs";
import { caseCarriageOps } from "../case-carriage/index.mjs";
import { publicReadOf, publicReadOps } from "../public-read/index.mjs";
import { projectStageOf, projectStageOps } from "../project-stage/index.mjs";
import { networkNoticesOf, networkNoticesOps } from "../network-notices/index.mjs";
import { corpusExportOf, corpusExportOps } from "../corpus-export/index.mjs";
import { biasOf, biasOps } from "../bias/index.mjs";
import { aiRunsOf, aiRunsOps } from "../ai-runs/index.mjs";
import { aiUseOf, aiUseOps } from "../ai-use/index.mjs";
import { stepsOf } from "../steps/index.mjs";
import { readingGuidesOf, readingGuidesOps } from "../reading-guides/index.mjs";
import { questionExplorerOf } from "../question-explorer/index.mjs";
import { investigationOf } from "../investigation/index.mjs";
import { investigationOps } from "../investigation/ops.mjs";
import { publishScheduleOps } from "../publish-schedule/index.mjs";
import { ownerGettersOf } from "./owners.mjs";
import { contentOf, contentOps } from "../content/index.mjs";
import { retrievalOf, retrievalRoutes } from "../retrieval/index.mjs";
import { queueOf, Queue } from "../queue/index.mjs";
import { queueProducersOf } from "../queue-producers/index.mjs";
import { machineryProducersOf } from "../machinery-producers/index.mjs";
import { actionProducersOf } from "../action-producers/index.mjs";
import { tasksOf } from "../tasks/index.mjs";
import { wizardScriptsOf, wizardScriptsOps, SCREEN_REGISTRY } from "../wizard-scripts/index.mjs";
import { translationsOf, translationsOps } from "../translations/index.mjs";
import { instanceSetupOf, instanceSetupOps, disclosureReadOf, DISCLOSURE_READER } from "../setup.mjs";
import { dispatch, controlPlaneRoutes } from "../store-door/dispatch.mjs";   /* K1907, K2041: the store's door */
import { promotionStep } from "../store-door/step.mjs";
import { registerOwnersCounts, registerStats, withDeepStats } from "./stats.mjs";
import { wizardRegistration } from "./wizards.mjs";
import { eventsOf, eventsOps } from "../events/index.mjs";
import { linesOf, linesOps } from "../lines/index.mjs";
import { moneyOf, moneyOps } from "../money/index.mjs";
import { moneyChecksOf, moneyChecksOps } from "../money-checks/index.mjs";
import { dutiesOf, dutiesOps } from "../duties/index.mjs";
import { peopleOf, peopleOps } from "../people/index.mjs";
import { exploreOf, exploreOps } from "../explore/index.mjs";
import { calculationsOf, calculationsOps } from "../calculations/index.mjs";
import { workbooksOf, workbooksOps } from "../workbooks/index.mjs";
import { legEarningOf, legEarningOps } from "../leg-earning/index.mjs";
import { hypothesesOf, hypothesesOps } from "../hypotheses/index.mjs";
import { answersOf, answersOps } from "../answers/index.mjs";
import { caseTensionsOf, caseTensionsOps } from "../case-tensions/index.mjs";
import { followingOf, followingOps } from "../following/index.mjs";
import { noticeProducersOf } from "../notice-producers/index.mjs";
import { draftUse, assistantGateOf } from "./ask.mjs";
import { admissionOf, admissionOps } from "../admission/window.mjs";
import { archiveUnpackConsumer } from "./unpack.mjs";
import { transcriberOf } from "./transcribe.mjs";
import { rosterSource } from "../../../roster-reader/index.mjs";
import { credentialsOf as captureCredentialsOf } from "../capture-sources/credentials.mjs";
import { captureSourcesOps } from "../capture-sources/ops.mjs";
import { registerReaders, rosterReads, ownHostsOf, officePorts, dutiesFactOf, retrievalTerms, sheetRecompute,
         ratificationWorker, frontDoorFinder, frontDoorPointer, projectReachReaders } from "./wiring.mjs";
import { ownerOps } from "./owner-ops.mjs";

/* The name store-door's promotion step (its R5, was control-plane R42) is registered under (K2037). */
const STEP = "store-door";

/* R2, R10: the first module of layer 11 in the modules' total order. `MODULE_ORDER` carries no layers and product code
   cannot read `build/` at run time, so it is named here; the R10 test holds it to `build/modules.json`'s layers. */
export const FIRST_LAYER_11 = "wizard-scripts";

/* R2, R100: the order promotion ranks its steps by: the modules' total order (membership R83, R146: `build/modules.json`'s,
   made from the file), with store-door's step (its R5) after every module of layers 1–10 and before every later one
   (K1416: before the first layer-11 module, now `wizard-scripts`, N544), the rank the step has held since it was
   `legacy-store`'s, so every step's checks and projections, and the order of refusals, are today's. Promotion ranks a name
   the order lacks last (its R39). `stepOrderFrom(order)` is the rule for any order a test hands it (R10); `STEP_ORDER` is
   its answer for `MODULE_ORDER`. */
export const stepOrderFrom = (order) => {
  const o = order.filter((m) => m !== STEP);
  const at = o.indexOf(FIRST_LAYER_11);
  return Object.freeze(at === -1 ? [...o, STEP] : [...o.slice(0, at), STEP, ...o.slice(at)]);
};
export const STEP_ORDER = stepOrderFrom(MODULE_ORDER);

/* D-432: the live rows the PROJ mint site's `taken` reads, as `[prefix, table, column]`, seeded at every boot (record-core
   R40). The CASE rows are ratification's and publication's registered seeds (record-core R70). */
const MINT_LEDGER_LIVE = Object.freeze([["PROJ", "bundles", "bundle_id"]]);

/** R4: the logical name of the object the runtime says `ctx` is, asked of the runtime and not remembered: the door
 *  routes every call to the room `storeId(env, "bio")` or `storeId(env, "scratch")` (runtime-limits R28: the generation is
 *  on the room's name only), and a Durable Object's id equals the one it was named by. It answers the LOGICAL name
 *  (`"bio"` inside `bio~g2`), so every `store=`, evidence prefix and published prefix is unchanged. Null for any other
 *  object (a suite's private instance), never a guess: a default here would let a resumed run touch the real record
 *  while the run lived in scratch. Pure. */
export function namespaceOf(ctx, env) {
  const ns = env && env.STORE;
  if (!ns || typeof ns.idFromName !== "function" || !ctx || !ctx.id || typeof ctx.id.equals !== "function") return null;
  for (const name of ["bio", "scratch"]) if (ctx.id.equals(storeId(env, name))) return name;
  return null;
}

/** R5: the injectable clock, in milliseconds: an explicit instant, else `BIO_NOW_MS` (so a suite pins "now"), else the
 *  wall clock. An absent param (null or "") falls through to env, not to Number(null) === 0. */
export function clockOf(env) {
  return (explicit) => {
    if (explicit !== undefined && explicit !== null && explicit !== "") {
      const e = Number(explicit);
      if (Number.isFinite(e) && e >= 0) return e;
    }
    const v = Number(env && env.BIO_NOW_MS);
    if (Number.isFinite(v) && v >= 0) return v;
    return Date.now();
  };
}

/* R1, R5: the clock handed to `capture`, one function for each storage and reading the latest environment given: `captureOf` refuses a
   caller's different `now` for a storage whose capture holds another (its R58), and a second assembly over one storage must build nothing twice. */
const CAPTURE_CLOCKS = new WeakMap();
const captureClockOf = (ctx, env) => {
  let held = CAPTURE_CLOCKS.get(ctx.storage);
  if (!held) { held = { env, now: () => clockOf(held.env)(null) }; CAPTURE_CLOCKS.set(ctx.storage, held); }
  held.env = env;
  return held.now;
};

/** R1: every module of the record store built on `ctx`'s storage, migrated and started; answers the assembled store
 *  `{routes, dispatch, namespace, nowMs, read}`. `deliver`, optional, is `control-plane`'s owed-render delivery
 *  (`deliverOwedRender`), handed to the owed-work ledger: absent, a ledger row that needs it stays owed (R67). `releaseKeys`,
 *  optional and a test's own, is the list of keys instance-setup verifies a release notice against in place of the
 *  product's (`RELEASE_KEYS`): the Durable Object class hands none. The
 *  migration and the starts are work handed to `ctx.blockConcurrencyWhile`, so they run before any request; a module that
 *  fails to build throws here, and the class that called it answers nothing. */
export function assembleStore(ctx, env, { deliver = null, releaseKeys = null } = {}) {
  env = env || {};
  const sql = ctx.storage.sql;
  const namespace = () => namespaceOf(ctx, env) || "bio";
  const nowMs = clockOf(env);
  /* K1832 (ratification R42): a stub over this object's own door, the assembled store's dispatch (the class's `fetch` less
     its headers and its heal), with `acquire`'s trace stamped as the class stamps it */
  const door = async (req) => dispatchRequest(await traceStamped(req));
  let explore = null;

  /* R2. record-core: the evidence bucket and its key prefix, handed over at its first construction. */
  recordOf(ctx, { evidence: env.CAPTURES ?? null, evidencePrefix: () => `${namespace()}/captures/` });
  /* R21 (K1541; credentials R23, R29): credentials holds the Worker secret its seal is derived from, built here before
     any module reaches it (its instance is one per storage, its deps read on the first call only). Unbound, setting a
     member's reference is refused ACCOUNT_SEAL_UNAVAILABLE. */
  credentialsOf(ctx, { sealSecret: env.ACCOUNT_SEAL_SECRET ?? null, now: () => nowMs(null) });   /* K5168: the first construction takes the store's clock */
  /* R22 (T33-12; docprofile R36): the content types registered into docprofile's registry, once, generic last. */
  registerReaders();
  /* R10 (K861): the stats figures, each owner's registered under its own name (record-core R63), and the plane's own
     stats sight (record-core R65). */
  registerOwnersCounts(ctx);
  registerStats(ctx);
  /* promotion, built first with the order its steps rank by (membership, then promotion, as provenance's first call
     built them), so store-door's step ranks after layer 10 and before every layer-11 module (STEP_ORDER). */
  const promotion = promotionOf(ctx, { order: STEP_ORDER });
  /* R16 (N522; K1307): accepted-work's one instance on this host, made here, before inquiry's factory and every reader,
     on this promotion, so its promotion check (its R4) is registered at its rank before the first request. The same
     instance is handed to every module that reads accepted work (strength, basis-versions, reevaluation,
     publication) and to case-import, which fills its one registration (R17), so one registration serves them all. */
  const acceptedWork = acceptedWorkOf(ctx, { record: recordOf(ctx), promotion });
  /* provenance declares its tables and joins every promotion first, so its register write runs before the
     projections that read it. observation-log registers its look on each receipt (its R5, provenance R47), and
     listens to extraction's reading notice once extraction exists (below). */
  const provenance = provenanceOf(ctx);
  const instanceName = env.INSTANCE_NAME || "unnamed";
  /* attestation (N512), next in the modules' order, built here with the instance's receipt-signing key (its R4, K59)
     before any module reaches it, so the one instance every user is handed holds the key: acquisition's receipt
     through capture (`cap.attestation`), case-authoring's and filings' `attestationsOf`, network-notices' signing. */
  const attestation = attestationOf(ctx, { provenance, signingKey: env.RECEIPT_SIGNING_KEY ?? null, instanceName });
  /* provenance-routes (N512), after attestation: at creation it declares its table to purge and registers its audit
     finding `route` and its figure `routeMarks` (its R6, R10, R12); a reconstructed hop names this instance (its R1). */
  provenanceRoutesOf(ctx, { instanceName });
  observationLogOf(ctx, { extraction: null, provenance });
  /* extraction: its projection joins every promotion. content: created on extraction's instance here, so its stale
     mark (REC-82, its R22) is registered before observation-log's rows (its R6–R8), in the modules' total order
     (extraction R24). */
  observationLogOf(ctx).listenTo(contentOf(ctx, { extraction: extractionOf(ctx, { env, promotion, calibration: calibrationOf(ctx) }) }).extraction);
  /* entities (R13): observation-log records each resolution attempt on entities' notice (its R8). */
  observationLogOf(ctx).attachMeaning({ entities: entitiesOf(ctx) });
  /* R21 (T33-90; K1563): layer 5's new modules, in the modules' order, each built here with the instances it reads
     before any other module's factory reaches it (a factory reads its deps on its first call only). events starts at
     creation (its after-read hook and connection owner); lines reads events' `when` (its R6). */
  const events = eventsOf(ctx);
  const lines = linesOf(ctx, { events });
  /* K1563 (10), K1654: the seeded offices' reads (instance-setup R50), for local-facts here and conformance below. */
  const offices = officePorts(() => instanceSetupOf(ctx, env));
  /* local-facts (moved to layer 5, T33-28): its `part_of` walk over lines, and the seeded offices it maps to. */
  const localFacts = localFactsOf(ctx, { lines, officeOf: offices.officeOf });
  /* standards (moved to layer 5, T33-31; K1571): its dated reads over events, and the keyed store its citation lookup
     reads the group's key through (`{credentials, env, governor}`, its R25), the sealed credentials above. */
  const standards = standardsOf(ctx, { events, keyedStore: () => ({ credentials: credentialsOf(ctx), env,
                                                                     governor: governorOf(ctx, { env }) }) });
  /* money (K1573): built before every module that reaches it, with calculations' `bindingOf` as its port
     (calculations comes later in the order, so the port is asked of its instance when read); its projection step
     joins the promotion. */
  const money = moneyOf(ctx, { calculations: { bindingOf: (key) => calculationsOf(ctx).bindingOf(key) } });
  money.joinPromotion(promotion);
  /* money-checks, with the progressions the scheduler builds (its environment), so neither loses its deps. */
  moneyChecksOf(ctx, { money, progressions: progressionsOf(ctx, { env }) });
  /* duties (K1569): the real services by default, the active combined view by default, and the status of a calendar
     entry from local-facts (civil-time R9). Before people, whose duties read would otherwise build it bare. */
  const duties = dutiesOf(ctx, { factOf: dutiesFactOf(() => localFacts) });
  const people = peopleOf(ctx, { money, duties, events, lines });
  /* R23 (K1505 (6); N633, K1730): roster-reader's source registered into people (its R19), reading the held rosters
     of an organisation through the store's read composed here (roster-reader R12). */
  people.registerRosterSource("roster-reader", rosterSource(rosterReads({ sql: () => sql })));
  /* explore (K1566): the one read across the registered owners; it holds nothing, so it is kept for the route map. */
  /* explore R29 (T51 fix round 10; walk C C-M8): an `INFO-` node is named by its document's title. The title is record-core's
     (`bundleInfo`, R34); the sight is membership's (`inSight`), so a viewer who may not see a document is answered no title. */
  const documents = { titlesOf: ({ ids, viewer }) => {
    const titles = {};
    for (const id of ids) {
      if (!membershipOf(ctx).inSight(id, viewer)) continue;
      const info = recordOf(ctx).bundleInfo(id);
      if (info && typeof info.title === "string" && info.title.trim() !== "") titles[id] = info.title;
    }
    return { titles };
  } };
  explore = exploreOf(ctx, { events, money, documents });
  /* retrieval: its projection and text index join every promotion; R21 (K1593): the projected fields' providers,
     each its owner's rule (`standards.standardsFor`, `lines.holderAt`). */
  const retrieval = retrievalOf(ctx, { now: () => nowMs(null),
    terms: retrievalTerms({ standards: () => standards, lines: () => lines, sql: () => sql }) });
  /* calculations (T33-41): over the instances it reads, filling at creation money's change notice, duties'
     occurrence evidence and people's roster source (its R19, R20). Built before reevaluation, which registers on its
     input notice. workbooks (K1570) after it, recomputing through SHEET_WORKER. */
  const calculations = calculationsOf(ctx, { money, duties, people, events, lines, standards, retrieval,
    entities: entitiesOf(ctx), progressions: progressionsOf(ctx) });
  workbooksOf(ctx, { provenance, content: contentOf(ctx), calculations,
                     recompute: sheetRecompute(env, () => namespace()) });
  registerInquiryGrammar(recordOf(ctx));   /* inquiry-grammar R6 (K812): before basis-versions, whose R43 runs at its sub-slot */
  basisVersionsOf(ctx, { retrieval, acceptedWork });   /* basis-versions registers its projection decoration (its R42) */
  /* R30 (K2567): steps, at its place before ai-use and ai-runs (layer 6), one instance per host, built here with the
     plane's promotion and observation-log, so its promotion step, its authority, its look listener and its counts
     (`stepsAcceptedAsProposed`, `stepsAcceptedEdited`, `stepsAcceptedOwnInstead`, record-core R63) are registered
     before ai-runs' factory reaches it (ai-runs registers its run holder with it) and before the first request. */
  stepsOf(ctx, { promotion, observationLog: observationLogOf(ctx) });
  /* R31 (T40; N812; K2488): ai-use, directly before ai-runs, the one instance per host every reader reaches through
     its factory (ai-runs, answers' `useCheck`, question-explorer). Built with no zone handed in, so it reads the
     group's zone from retrieval (its R69) and counts by the group's local day; its first construction migrates and
     declares its tables (its R7). */
  aiUseOf(ctx, { env, now: () => nowMs(null) });   /* R5 (K5200): its first construction takes the store's clock and environment, before any route hands them */
  /* ai-runs registers with retrieval, in the modules' order. R40 (T46): its `partAdmitted` is the one gate of the ask,
     the drafts and the transcriber; a module test's own set (`assistantGateOf`, handed before construction, K61) is
     handed to it here, at its first construction, else it reads Civicsmith's. */
  const testSet = assistantGateOf(ctx).testSet;
  aiRunsOf(ctx, env, testSet ? { testSet } : null);
  /* R36 (T42; N832; K2611, K2656; extraction R72): the one transcriber, registered with extraction once at start, built
     on this object's own instances (ai-runs' R75 records for its test bar, credentials, ai-use, the evidence store, the
     `AGENT_WORKER` binding), so extraction reaches nothing above its layer. */
  extractionOf(ctx).registerTranscriber("plane", transcriberOf(ctx, env));
  /* R21 (T33-44, K1619): leg-earning, before inquiry's factory reaches it, with the standards and duties above. */
  legEarningOf(ctx, { standards, duties });
  /* R21 (K1607): hypotheses at boot, so its leg check joins the promotion (its R5, R6) and the `hunch` owner, which
     registered at load, finds its one instance; explore is the instance above (its R6 rederives through it). */
  hypothesesOf(ctx, { explore: explore });
  /* R21 (K1609; answers R7–R12, R15–R21): the owners its rule services read, the saved query's runner (retrieval,
     whose `relations()` and `zone()` answers reads itself, K1788, K1803) and the account reads. R33 (K2500): no
     `ceilingRefusal`: answers judges a limit through ai-use's `useCheck` on its own host (its R30). */
  answersOf(ctx, { standards, content: contentOf(ctx), events, entities: entitiesOf(ctx), lines, people, duties,
    calculations, retrieval, credentials: credentialsOf(ctx),
    /* R24 (T51; K3807): the one registry, wizard-scripts' `SCREEN_REGISTRY` (the design's), for its explain read; the plane
       carries none of its own. */
    screens: SCREEN_REGISTRY });
  /* reevaluation before actions: actions reaches conformance, which reaches reevaluation, and a factory reads its
     `deps` on the first call only, so created there it would never see `env` (its R25). */
  reevaluationOf(ctx, { env, acceptedWork, calculations });
  /* publication (K365): built here, after reevaluation, so its case reads are registered with reevaluation (its R41,
     R43; reevaluation R26) before anything runs. Built lazily, a sweep an alarm reached before any op found none.
     R18 (T37; K2226): handed the evidence bucket (`CAPTURES`) and the store's namespace, read as record-core's evidence
     prefix reads it (R2), which its factory forwards to the case-carriage it creates, so a photo's obscured copy is held
     (case-carriage R11; without them the mark is recorded with no copy, fail closed). */
  publicationOf(ctx, { acceptedWork, bucket: env.CAPTURES ?? null, store: () => namespace(),
    now: () => new Date(nowMs(null)).toISOString() });   /* R5 (K5200): the store's clock, as an instant: publication forwards it to corpus-export and case-carriage */
  /* R23 (K1505 (3), K1643; publication R61): case-tensions, which publication's factory builds and registers its
     provider with (the seven doors), is the one instance per host the route map reaches. */
  caseTensionsOf(ctx);
  /* R15 (N520; DEC-116): docket, directly after publication in the modules' order, built here with this environment
     (its factory reads its deps on the first call only). At creation it creates and declares its tables to purge
     (whole store only, its R16) and starts, filling reevaluation's docket registration (its R13, reevaluation R30)
     before the first request. public-read and network-notices are handed this instance, the docket they read
     (public-read R20, R21; network-notices R21). */
  const docket = docketOf(ctx, { env });
  publicReadOf(ctx, { docket });
  /* network-notices (DEC-111, K1100), at its place after project-stage: at creation it creates and declares its tables,
     registers its notice ids' mint seed and its three public reads (public-read R18), all before the first request;
     the scheduler reaches it for `working-on-seal` and `working-on-attest` (scheduler R5), with this environment. */
  networkNoticesOf(ctx, { env, attestation, docket });
  /* ratification: its case catalogue and C-2.8's case-member arm, registered at start (its R8, R9). Built here, before
     actions, whose factory reaches it for its hold reader (actions R69), since a factory reads its deps on its first
     call only. K1832 (its R42): handed the Worker's reach, the environment and a stub over this object's own door, so
     a scheduled edition's commit copies its materials (its R39) and assembles its container (its R6) in-process, as
     `op=caseratify` does. */
  ratificationOf(ctx, { worker: ratificationWorker({ env, door: door,
                                                     namespace: () => namespace() }) });
  /* R32 (N823; K2438): publish-schedule, the one instance ratification's factory creates (its R43, registering its
     publisher), over the publication built above; at its place directly after publication in the modules' order, and
     before the scheduler's default owner first reaches it (R30). It is handed to case-authoring (its R58) and to queue
     for queue-producers R37 (below); the scheduler's `scheduled-publish` reaches the same instance (its R22). */
  const publishSchedule = ratificationOf(ctx).publishSchedule;
  /* K1654 (P8, T45): conformance, with the seeded offices' read, before actions: actions' constructor reaches
     conformance (`void a.conformance`) and a factory reads its deps on its first call only, so built after actions it
     never received `officeEntityOf`. Its registrations rank by the modules' total order, never construction order. */
  const conformance = conformanceOf(ctx, { officeEntityOf: offices.officeEntityOf });
  /* R39 (K2849; actions R97): actions, with this environment, registers its own-act reader with consequences (its
     R19) and its own-sending check with standards (its R53), once each, at its creation. */
  actionsOf(ctx, { env });
  /* R39, R14 (T45; K2781 (1), K2815; reconciliation R19): action-holds, directly after actions in the modules' order,
     the one instance per host. At creation it makes and declares its tables (its R13) and registers its
     litigation-hold reader with doorbell (its R4; doorbell R3) and, handed this environment, its reader of holds over
     a project with ratification (its R10; ratification R45), each once; actions no longer makes either. Its
     `purgeHeld` (its R9) is the reader store-door's door is handed (R14). */
  const actionHolds = actionHoldsOf(ctx, { env });
  retrieval.registerLegGrades("inquiry", inquiryLegGrades(ctx));   /* R10 (K861): inquiry's leg grades (its R52, retrieval R55) */
  const connections = connectionsOf(ctx, { env });
  observationLogOf(ctx).attachMeaning({ connections });
  /* R58 (T50; N1186, K3557; membership R150): the two readers of a project's reach `provenance` and `connections` cannot
     register (closed layers), made here once each, over this object's own instances: the home bundles of the captures
     the project's bundles hold, and the records its document cites. A second registration is refused
     `LISTENER_DECLARED`; a reader that throws adds nothing. */
  const reach = projectReachReaders({ record: () => recordOf(ctx), provenance: () => provenance, connections: () => connections,
    sql: () => sql });
  membershipOf(ctx).registerProjectReach("provenance", reach.provenance);
  membershipOf(ctx).registerProjectReach("connections", reach.connections);
  strengthOf(ctx, { retrieval, acceptedWork });   /* strength: registers its pair (R17), its cache projection (R13) and, with retrieval, the cache's fields (R23) */
  /* R17 (N520, N522): case-checker, then case-import, at their places after ratification in the modules' order, built
     here once strength (with its retrieval, above) and reevaluation (with its environment) exist, since a factory reads
     its deps on its first call only. case-checker starts by registering its two public reads with public-read (its
     R15; public-read R18). case-import is built with the deps it reads (case-checker's `checkCaseFile`, strength,
     accepted-work's one instance (R16), reevaluation) and this environment; its case-file bytes are held in its own
     tables, so no object store is handed to it (K1319). At creation it creates its tables, declares them to purge
     (whole store only, its R13) and starts, filling accepted-work's registration (its R16), `moves` among it (R20;
     accepted-work R8), before the first request. */
  registerCaseCheckerPublicReads(ctx, { publicRead: publicReadOf(ctx) });
  caseImportOf(ctx, { env, checkCaseFile, strength: strengthOf(ctx), acceptedWork, reevaluation: reevaluationOf(ctx) });
  /* R18 (N529; K1333): case-disclosures, at its place after case-import and before case-authoring in the modules'
     order, built here with the attestation instance above, so case-authoring's lazy getter finds that one instance per
     host (case-disclosures R23). It holds no table and no op. case-carriage (N532) needs no line here: publication's
     factory (above) creates it eagerly, with the bucket and namespace handed there, its tables made and declared at
     every boot (case-carriage R6, R12; K1024); its ops are routed in R5's map over that one instance. */
  caseDisclosuresOf(ctx, { attestation });
  /* R38 (T42; N839; K2608, K2656; case-account R12): case-account, after case-disclosures and before any module that
     reaches it (`reviewOf` below, which registers its comments through case-authoring's pass-through, and so
     `caseAuthoringOf`), built here with ai-runs' instance on this host as the runs a draft names (its R1), since its
     factory reads its deps on the first call only. One instance per host serves case-authoring, review and the door. */
  caseAccountOf(ctx, { runs: aiRunsOf(ctx, env) });
  biasOf(ctx, { env });
  /* R12 (K1061; inquiry R53, bias R40): inquiry's findings registered with bias as kind `finding`, after bias is built
     with its environment above (its factory reads its deps on the first call only), so a lens change raises a debt on
     a finding concluded under it. */
  biasOf(ctx).registerWorkProducts("finding", inquiryFindings(ctx, biasOf(ctx)));
  /* K2141 (citation R13, retrieval R76): citation made here, explicitly, before run-productions and before the first
     request, so its `recordedBy` read is registered with retrieval at boot and does not wait on run-productions'
     factory reaching it. */
  citationOf(ctx);
  /* run-productions: created after content, connections, strength and citation, so it declares its tables to purge
     (R17) and registers its candidates with basis-versions (R14). ai-runs is handed over as its own module (its
     R28–R29). */
  runProductionsOf(ctx, { aiRuns: aiRunsOf(ctx, env) });
  reviewOf(ctx);
  intentOf(ctx);   /* intent: its check (R1, R2, R26) joins every promotion; its audit check keeps C-2.9 (R22) */
  /* R30, R34 (K2525, K2567; investigation R20, R14): investigation, directly after intent, one instance per host on the
     plane's promotion; ai-runs' run holder registered with it once (ai-runs is earlier in the order and cannot), so a
     running run's principal reaches `planPropose` and `claimFindStep`'s run arm. */
  investigationOf(ctx, { promotion }).registerRunHolder("ai-runs", (by, run) => aiRunsOf(ctx, env).runHolder(by, run));
  caseAuthoringOf(ctx, { publishSchedule });   /* R18: its disclosures, with their attestation, are case-disclosures' (built above) */
  /* R17 (K4221; case-inputs R24): case-inputs' public read `casedetailspublic`, registered once at start with public-read, over the
     instance case-authoring's creation made (with its record, membership and clock: a factory reads its deps on its first call
     only), so case-inputs keeps its place after case-import and case-checker's registration keeps its own. */
  registerCaseInputsPublicReads(ctx, { publicRead: publicReadOf(ctx) });
  /* R39 (T45; K2839): case-check, last in layer 8 (after review), the one instance per host, over case-authoring,
     publication and case-carriage on this host; at creation it makes and declares its table (its R4). */
  const caseCheck = caseCheckOf(ctx);
  /* layer 9, in the modules' order, each registering at start what its factory registers (checks, projections,
     purge, filings' evidence block). standards creates its own tables at construction. R11 (K921): local-facts heads
     the layer, creating its table and declaring it to purge (record-core K23). */
  /* K1654: conformance names an office's entity through the seeded offices (instance-setup R50); built above, before
     actions. */
  const consequences = consequencesModule(ctx, { conformance });
  /* action-clocks (K704): after actions, which it reads and which joins the host first (its R9). R39 (T45): at creation
     it registers its due holder with steps (its R16, steps R29), once. */
  actionClocksOf(ctx, { env, now: () => nowMs(null) });   /* R5 (K5200; diagnosis A3): the store's clock, so `remindersfor` is judged on the world's day */
  /* R39 (T45; K2781 (1)): action-replies, directly after action-clocks, the one instance per host; handed this
     environment, it registers its open-requests source with case-authoring (built above; its R3, case-authoring R70),
     once, and makes and declares its tables (its R4). */
  actionRepliesOf(ctx, { env });
  /* R11 (K921): filing-templates, after action-clocks and before filings: it creates its tables, declares them to purge
     (record-core K23), registers its opaque ids' seed and takes the library `filings` R26 kept (its migration). */
  const filingTemplates = filingTemplatesOf(ctx);
  /* R39 (K2858): filings handed the plane's one action-holds instance, the project roster (migrated in R3's pass,
     so its second-approval read sees the roster), case-check and accepted-work. */
  /* K4051 (filings R64): handed `env`, so its registration of the minutes comparisons with case-inputs runs in production. */
  filingsOf(ctx, { env, now: () => stampInstant("second", nowMs(null)), actions: actionsOf(ctx), conformance, standards: standardsOf(ctx), consequences, attestation,
                   actionHolds, projectRoster: projectRosterOf(ctx), caseCheck, acceptedWork });
  escalationOf(ctx);   /* on this host, it reaches conformance, consequences, actions and filings through their factories */
  /* action-plans (K711): built before any route can run, so ai-runs holds its plan-mode open check (its R30) when the
     first `airunopen` arrives; built lazily, that open is refused AI_RUN_MODE_UNCHECKED. */
  actionPlansOf(ctx, { now: () => stampInstant("second", nowMs(null)) });   /* R5 (K5200; diagnosis A3): its instants, to the second, are the store's */
  /* R39 (T45; K2781 (1)): plan-work, directly after action-plans, the one instance per host, handed the plane's
     action-holds and ai-runs; at creation it makes and declares its tables and registers its closing summary with
     action-plans (its R7, action-plans R44) and its re-examination with actions (`registerResponseListener`, its R10,
     actions R95), once each. following's watch reader is registered with it when following is built (below). */
  planWorkOf(ctx, { actionHolds, aiRuns: aiRunsOf(ctx, env) });
  /* the acquisition act signs its receipt through `cap.attestation`; R5 (K5200): handed the store's clock, so a session and a receipt read it */
  const capture = captureOf(ctx, { env, attestation, now: captureClockOf(ctx, env) });
  /* R75 (T51 fix round 4; C5c; K4429; acquisition R96, control-plane R120): what a request left pending, finished by this object's
     own alarm. `keeps_pending` and `acquire_stages` are the plane's two operational tables, declared to purge as a whole-store
     clear (record-core K23). Acquisition reads `cap.keepLater` as it reads `cap.waitUntil`: a keep that will not end inside the
     door's bound is written down here and put by the alarm, never left to a promise nothing keeps alive. */
  /* R5, R64 (R-CLOCK): the ledger stamps its rows with the assembly's clock, so a pinned clock (`BIO_NOW_MS`) that the scheduler's
     firing is asked at also decides when a row is due; unpinned, it is the wall clock, as before */
  const pending = pendingOf(ctx, { env, store: () => namespace(), deliver, now: () => nowMs(null) });
  recordOf(ctx).declarePurge("store-assembly", ["keeps_pending", "keeps_last", "acquire_stages", "job_unit_attempts", "job_batches"]);   /* R97, R72: the owed-work ledger's tables, this module's own */
  capture.keepLater = (a) => pending.keepLater(a);
  capture.owedLater = (a) => pending.owedLater(a);   /* R77, acquisition R100: the ledger's `subresources` and `unpack` entries, registered the same way */
  /* R98 (fix round 9, G126; K4835 (2); 2c item 1): THE ONE REGISTRAR. Acquisition, capture and doorbell read it as they read `keepLater`: a
     synchronous write of the job row, made inside the caller's filing transaction; the alarm is armed by `armJobs` after the commit. */
  capture.registerJob = (e) => pending.registerJob(e);
  capture.armJobs = () => pending.armJobs();
  /* capture R113 (fix round 9, G127f; K4899): the object key of a digest in the evidence bucket, record-core's own (its R38, the prefix R2 hands
     it), so a file past the request-body ceiling is written in parts under the key its whole is read by */
  capture.evidenceKey = (digest) => `${namespace()}/captures/${digest}`;
  /* R83 (fix round 6, G8, G13; extraction R89), R98 (fix round 9; K4898 (1)): extraction's `owe` IS the registrar: its hook is handed `registerJob`
     (synchronous, so a reader may owe inside its own transaction), the alarm armed beside each row kept; every `readHeld` the ledger makes also
     carries `registerJob` and `armJobs` (pending.mjs). Guarded, as extraction's own merge is later than this line. */
  const extraction = extractionOf(ctx);
  if (typeof extraction.registerOwe === "function")
    extraction.registerOwe((a) => { const r = pending.registerJob(a); if (r && r.ok === true) void pending.armJobs(); return r; });
  /* R37 (T42; N826; K2607 rule 3, K2629, K2630; doorbell R25): doorbell, directly after capture in the modules' order,
     the one instance per host (actions' factory may have reached it first for its hold reader, actions R55); it takes no
     `env` of its own and reads capture's at each use, the instance above. */
  doorbellOf(ctx);
  /* R26 (rev. 2 §4; K2063 (10)): file-safety, directly after doorbell in the modules' order (capture, doorbell,
     file-safety), built here with this
     environment (the `FILE_SCANNER` binding and the `CAPTURES` bucket; the evidence store and its prefix are
     record-core's, R2) and the object's own namespace, since its factory reads its deps on the first call only. Its
     first construction is its start: its `provenance.onReceipt` listener (its R1) is registered before the first
     request. Its tables are made and declared to purge in R3's pass. */
  const fileSafety = fileSafetyOf(ctx, { env, store: namespace(), now: () => nowMs(null) });   /* R5 (K5200): the store's clock */
  /* capture-requests: its table, its `sweep` resolver and its drain; the run sight it reads is ai-runs' (its R28),
     and it registers its wait source with ai-runs (ai-runs R41). Built before link-sweep and handed to it, so
     link-sweep's sweep scope check (its R12) is registered at construction and a sweep-named request drained before
     the first sweep service is judged, never refused for want of a check (K1163). */
  const captureRequests = captureRequestsOf(ctx, { env, storeName: () => namespace(),
    now: () => nowMs(null), runs: aiRunsOf(ctx, env), aiRuns: aiRunsOf(ctx, env) });
  /* R30, R35 (K2567; reading-guides R1, R6): reading-guides, directly after capture-requests, with `groupSlug` read
     from instance-setup's `producingGroup` each time an offer asks (never once at start), so once a group is set up its
     offers are labelled with its slug. Its tables are made in R3's pass. */
  readingGuidesOf(ctx, { groupSlug: () => instanceSetupOf(ctx, env).producingGroup() });
  /* R30 (K2567, K2571; scheduler R26): question-explorer, after ai-runs and the modules it reads, one instance per
     host, migrated here at once (its factory does not migrate) so its tables exist before the scheduler is handed it
     below, and again in R3's pass. */
  const questionExplorer = questionExplorerOf(ctx, { steps: stepsOf(ctx), aiUse: aiUseOf(ctx), aiRuns: aiRunsOf(ctx, env),
                                                   captureRequests, runProductions: runProductionsOf(ctx) });
  questionExplorer.migrate();
  /* R20 (N534; DEC-101 (3)): monitoring is handed the case-import instance built above, whose watches its cadence tick
     reads and whose `recordDocketRead` records each docket read (monitoring R67, R68). */
  const caseImport = caseImportOf(ctx);
  const monitoring = monitoringOf(ctx, { env, caseImport });
  /* link-sweep (N506), after monitoring, whose seam it registers with at creation (`registerSweep`, monitoring R66:
     C-18.5's sweep arm, the fence and the slate share), handed the composed capture-requests (its R12) and capture.
     Built before the scheduler, whose `gathering-sweep` owner (`linkSweepOf(ctx)`, scheduler R5) then reaches this
     instance, the one per storage (K1210). */
  linkSweepOf(ctx, { monitoring, captureRequests, capture });
  /* R21 (T33-79): following, after monitoring whose sweep host it reads, built before the scheduler reaches it
     (scheduler R21's `follow` consumer and its `onFollowed` notice). */
  /* R39 (K2874): handed the plane's own instances it reads (action-plans, plan-work, duties, answers, standards), so
     none is built bare by its lazy getters; at creation it registers its watch reader with plan-work (its R26,
     plan-work R9), once. */
  /* R58 (T50; following R34, retrieval R86): handed the one retrieval instance above, so its start registers its watch
     marks with `retrieval.registerBrowseMarks` before the first request; the plane makes no second registration. */
  followingOf(ctx, { monitoring, events, entities: entitiesOf(ctx), capture, retrieval, actionPlans: actionPlansOf(ctx),
                     planWork: planWorkOf(ctx), duties, answers: answersOf(ctx), standards });
  /* R19 (N528; DEC-120, DEC-121): wizard-scripts, first in layer 11, built here before every layer-11 reader
     (affordances, queue-producers, control-plane). At creation it creates its tables, declares them to purge (K23) and
     registers its ids' seed; it is then registered, once and before the first request, with the bundle's screens and
     library, the member op table, the acts a machine is refused and the labelled machine drafts (its R13). */
  wizardScriptsOf(ctx, { env }).wizardRegister(wizardRegistration({ door: {
    /* K2586 (its R23): the front door's finder over the plane's steps and retrieval, asked at each `startfrom` */
    findExisting: frontDoorFinder({ steps: () => stepsOf(ctx), retrieval: () => retrievalOf(ctx) }),
    /* R51 (T48; N847; K2591; its R37): the pointer, `jurisdictions.combine` over record-core's `jurisdiction_profiles`
       read at each call */
    pointer: frontDoorPointer({ setting: (name) => recordOf(ctx).getSetting(name) }) } }));
  /* K2044, K2054 (admission R21): admission's door window, built at its place in layer 11 so its table is made and
     declared through record-core before the first request; its fingerprint is doorbell's (its R12; K2719). */
  admissionOf(ctx);
  promotion.registerStep(STEP, promotionStep(ctx));   /* R10 (K861, K2037): store-door's step (its R5), the testimony slot and the sight index */
  observationLogOf(ctx).listenToCapture(capture);
  /* R26 (K2153; scheduler R24): file-safety handed to the scheduler as the owner of its four batch consumers
     (`file-scan`, `file-render`, `file-deeper`, `file-forward`) before its start, since its default owners do not
     build it. R30 (K2571; scheduler R26): question-explorer handed the same way, for its `question-explore` consumer;
     the scheduler never builds it. */
  schedulerOf(ctx, env, { fileSafety, questionExplorer });
  schedulerOf(ctx, env).register("plane", pending.consumer());   /* R75: `pending-work`, before the scheduler's start so its alarm is re-derived at a restart (scheduler R11) */
  /* R87 (fix round 6, G54): the case-file sweep, ratification's, a second consumer of the plane's, registered at the same place so a restart re-derives its alarm */
  schedulerOf(ctx, env).register("plane", casefileSweepConsumer(ratificationOf(ctx)));
  /* R3: the migration pass, then scheduler's start. */
  ctx.blockConcurrencyWhile(async () => migrate());
  ctx.blockConcurrencyWhile(async () => schedulerOf(ctx, env).start());
  /* queue, then tasks, each creating its own tables (queue R36, tasks R8). R11: queue is handed the two modules
     `queue-producers` R20 and R21 read, R15 the docket its R30's items read (`Queue.PRODUCER_DEPS`), and R20 the
     case-import its R35's watch items read. */
  /* R21 (T33-82; queue R51; K1683): notice-producers, over the instances it reads, handed to queue beside
     queue-producers' deps. */
  /* K2586 (NOTICE-PRODUCERS #6 J2): handed every instance it reads, the plane's own, so no bare one built first by its
     factory shadows them (a factory keeps the first instance per storage). */
  const noticeProducers = noticeProducersOf(ctx, { membership: membershipOf(ctx), people, moneyChecks: moneyChecksOf(ctx), duties,
    answers: answersOf(ctx), inquiry: inquiryOf(ctx), credentials: credentialsOf(ctx), following: followingOf(ctx), standards,
    fileSafety, provenance, aiUse: aiUseOf(ctx), steps: stepsOf(ctx), questionExplorer, investigation: investigationOf(ctx),
    review: reviewOf(ctx),
    /* R98 (fix round 9): the job table's ended rows, a callback (a lower module reaches a higher one only so, as `updateNotice`, R52) */
    readingsEnded: (q) => pending.readingsEnded(q) });
  /* K1868 (2): queue-producers' one instance per storage, built here with the providers queue would hand it
     (`Queue.PRODUCER_DEPS`), since its factory reads its deps on the first call only; handed to queue as its producers
     and to instance-setup, whose start registers `placeArrivals` through it (instance-setup R62, queue-producers R38),
     so neither builds it bare. */
  /* R32: publish-schedule for queue-producers R37's scheduled items (passed on once queue lists it among its deps). */
  /* K2580 (QUEUE #22 J2): queue reads investigation (its project arm); handed the plane's one instance (R30). */
  /* R39 (T45; action-producers R5, R9, R10, R12): the deps action-producers reads, the plane's own instances:
     action-holds (the hold read moved from actions), following (the watch question) and plan-work (take-ups, review
     days). */
  const queueDeps = { env, filingTemplates, localFacts, docket, caseImport, noticeProducers, publishSchedule,
                      investigation: investigationOf(ctx), actionHolds, following: followingOf(ctx), planWork: planWorkOf(ctx) };
  /* R39 (T45; K2781 (1), K2888): action-producers, the action layer's to-dos moved from queue-producers (its R1–R12),
     the one instance per storage, built here with the plane's own instances it reads, before queue-producers'
     factory reaches it (a factory keeps the first instance per storage), so none is built bare. It registers
     nothing and holds no table. */
  actionProducersOf(ctx, { actions: actionsOf(ctx), actionHolds, actionClocks: actionClocksOf(ctx), escalation: escalationOf(ctx),
    actionPlans: actionPlansOf(ctx), planWork: planWorkOf(ctx), filingTemplates, localFacts, following: followingOf(ctx) });
  /* R52 (T48; N1047; K3189; machinery-producers R12; instance-setup R88, R89): the update notice read, handed to
     machinery-producers as `deps.updateNotice`: a function calling instance-setup's `updateNoticeState()` on the
     object's own instance at each call (K31's pattern: instance-setup is built below, so nothing points later).
     machinery-producers is built here, with it, before queue-producers' factory (which keeps the first instance per
     storage, so a bare one is never made first); every other dep it reads defaults to its module's instance on this
     storage. instance-setup registers its own `update-check` consumer with the scheduler (its R88); this module
     registers none. */
  machineryProducersOf(ctx, { updateNotice: () => instanceSetupOf(ctx, env).updateNoticeState() });
  const queueProducers = queueProducersOf(ctx, Object.fromEntries(
    Queue.PRODUCER_DEPS.filter((k) => queueDeps[k] !== undefined).map((k) => [k, queueDeps[k]])));
  queueOf(ctx, { ...queueDeps, producers: queueProducers }).migrate();
  tasksOf(ctx, { env }).migrate();
  /* K1951, K2042, K2046: the daemon's drain of capture's `archive-unpack` events, registered with the scheduler after
     tasks' `task-drain` (scheduler R8), each event asked of the Worker as `op=unpack` through `SELF`. */
  schedulerOf(ctx, env).register("plane", archiveUnpackConsumer({ capture: () => captureOf(ctx), env }));
  /* R1: instance-setup started once per object (its `start` is idempotent on one storage), built here first, with the
     queue's producers (K1868 (2)). */
  /* R61 (T50; N1084; translations R12): translations, directly before instance-setup in the modules' order, the one
     instance per host; at creation it creates its seven tables and declares them to purge (held once, whichever of it
     and instance-setup is built first). Its nine routes are spread beside instance-setup's (R5), and migrated in R3's
     pass. */
  translationsOf(ctx);
  const instanceSetup = instanceSetupOf(ctx, env, { queueProducers, now: () => nowMs(null), ...(releaseKeys ? { releaseKeys } : {}) });   /* K5171: the instance clock, handed, not read from the env */
  /* R44 (T47; N981; K3030; credentials R64, instance-setup R54): instance-setup's disclosure read registered with
     credentials once, on this object's own instances, on instance-setup's behalf (credentials is earlier in the order
     and cannot reach it), so `disclosureDue` is asked in the assembled plane: `accountreferenceset` and a sign-in's
     `start` are refused DISCLOSURE_DUE while no disclosure is recorded for the member. */
  /* R53 (T48; ai-accounts R23): the registration is ai-accounts', not credentials' delegate */
  aiAccountsOf(ctx).registerDisclosureRead(DISCLOSURE_READER, disclosureReadOf(instanceSetup));   /* instance-setup R54 */
  ctx.blockConcurrencyWhile(async () => {
    const started = await instanceSetup.start();
    /* F16 (K2038; capture R73, capture-sources R65): the group's own hosts, once the store is migrated and started so
       instance-setup's claim reads, handed once to capture (for acquisition R42, adopted from the first caller that
       names them) and to capture-sources' credentials (R55, R56); a claim made later is read at the next
       construction. */
    let identity = null;
    try { identity = instanceSetup.groupIdentity(); } catch { identity = null; }
    /* R28 (N745; installer R47): the copy's own hosts the installer binds, `OWN_HOSTS`, joined with the claim's. */
    const ownHosts = ownHostsOf(identity, env.OWN_HOSTS);
    /* R29 (K2087, K2130; acquisition R44): capture (for acquisition) is handed the `FILE_SCANNER` binding and a reader
       of file-safety's reputation tool, asked at each acquisition, never a value read once here. */
    captureOf(ctx, { ownHosts, fileScanner: env.FILE_SCANNER ?? null, reputation: () => fileSafety.reputationTool() });
    captureCredentialsOf(ctx, { key: env.CAPTURE_CREDENTIALS_KEY ?? null, ownHosts });
    return started;   /* R1: the blocked work answers instance-setup's start */
  });

  /* R3: record-core's `RECORD_SCHEMA` first, then each owner's `migrate()` in this order. */
  function migrate() {
    recordOf(ctx).migrate();
    /* REC-143 — THE ADDITIVE COLUMNS ARE ADDED BEFORE THE OWNERS' TABLES RUN, AND AGAIN AFTER THEM.
       CREATE TABLE IF NOT EXISTS does nothing to a table that already exists, so a column added after a store was first
       written needs adding by hand; these are additive and nullable, so an older row simply has no writer. Every
       release from 0.59.0 to 0.63.0 bricked an existing store because an index on such a column ran before the column
       was added: so the whole list runs first, for every table that already exists, and again after the tables are
       created, for a table created on this boot. Both passes are guarded on PRAGMA and so idempotent on every boot. */
    const ADDITIVE_COLUMNS = [
      /* REC-18 / DATA-MODEL D1(b): the registry ENTITY a question is about, one nullable projection column derived from
         bundle.md's `subject_entity`, written in the same transaction as inquiry_basis (D-21). Not indexed (REC-17). */
      ["bundles", "inquiry_subject_entity", "TEXT"],
    ];
    const addColumns = () => {
      for (const [table, column, decl] of ADDITIVE_COLUMNS) {
        const have = [...sql.exec(`PRAGMA table_info(${table})`)].map((r) => r.name);
        /* An absent table reads as no columns: it is skipped here and its owner creates it. */
        if (have.length && !have.includes(column)) sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
      }
    };
    addColumns();

    calibrationOf(ctx).migrate();
    membershipOf(ctx).migrate();
    /* N783 (K2270, K2294): project-roster, split from membership, directly after it in the modules' order: its three
       tables (`project_join_requests`, `project_owner_votes`, `project_owner_decisions`), so a fresh store holds them as
       a migrated one does, declared to purge (its R18). Its first construction is its start: its invitation and hiding
       listeners (its R15, R16) are registered with membership before the first request. */
    projectRosterOf(ctx).migrate();
    /* R53 (T48; N996): ai-accounts' tables directly before credentials' (its R28; idempotent: credentials' migration
       runs it too), as the modules' order has it */
    aiAccountsOf(ctx).migrate();
    credentialsOf(ctx).migrate();   /* after membership's: its listener and claim fact registered */
    provenanceOf(ctx).migrate();
    attestationOf(ctx).migrate();   /* `receipt_keys`, `signed_receipts` (N512; attestation R10) */
    provenanceRoutesOf(ctx).migrate();   /* `provenance_route_marks` (N512; provenance-routes R12) */
    contentOf(ctx).migrate();
    connectionsOf(ctx).migrate();
    basisVersionsOf(ctx).migrate();
    inquiryOf(ctx).migrate();
    governorOf(ctx, { env: env }).migrate();
    captureOf(ctx).migrate();
    /* R37 (K2629): doorbell's tables directly after capture's, so capture's declaration is first and doorbell's held */
    doorbellOf(ctx).migrate();
    fileSafetyOf(ctx).migrate();   /* R26: its tables, declared to purge (its R25), directly after doorbell's */
    extractionOf(ctx).migrate();
    observationLogOf(ctx).migrate();   /* before the run log folds into its tables below */
    runProductionsOf(ctx).migrate();
    captureRequestsOf(ctx).migrate();
    /* R31: ai-use's tables, directly before ai-runs' (its R7: the pre-T40 counter and ceilings carried over once) */
    aiUseOf(ctx).migrate();
    aiRunsOf(ctx, env).migrate();   /* ai-runs' two late columns and the ai_run_log fold (its R38) */
    readingGuidesOf(ctx).migrate();   /* R30: reading-guides' tables (its factory makes none) */
    questionExplorerOf(ctx).migrate();   /* R30: question-explorer's tables, explicitly (its factory does not migrate) */
    entitiesOf(ctx).migrate();
    /* R21 (T33-90): layer 5's new modules' tables, in the modules' order, after entities and before retrieval, whose
       views read them (each idempotent; money's, people's, events' and lines' factories create none). */
    eventsOf(ctx).migrate();
    linesOf(ctx).migrate();
    standardsOf(ctx).migrate();
    moneyOf(ctx).migrate();
    moneyChecksOf(ctx).migrate();
    dutiesOf(ctx).migrate();
    peopleOf(ctx).migrate();
    legEarningOf(ctx).migrate();   /* `inquiry_basis`, leg-earning's since T33-45 (its R12) */
    hypothesesOf(ctx).migrate();
    stepsOf(ctx).migrate();   /* R30: steps' tables, directly after hypotheses (its factory made them; idempotent) */
    contradictionOf(ctx).migrate();
    progressionsOf(ctx).migrate();
    biasOf(ctx).migrate();
    intentOf(ctx).migrate();
    investigationOf(ctx).migrate();   /* R30: investigation's tables, directly after intent (idempotent) */
    /* R32: `scheduled_editions` (publish-schedule R10), directly after publication, before docket (idempotent) */
    ratificationOf(ctx).publishSchedule.migrate();
    docketOf(ctx).migrate();   /* R15: its tables, in the modules' order (directly after publication) */
    caseImportOf(ctx).migrate();   /* R17: its tables, in the modules' order (after ratification and case-checker) */
    caseCheckOf(ctx).migrate();   /* R39 (T45): `case_checks`, last in layer 8 (idempotent) */
    networkNoticesOf(ctx).migrate();   /* its tables, in the modules' order (after project-stage) */
    /* R11 (K921): layer 9's two new modules, in the modules' order: local-facts' table, then filing-templates' tables
       and its take of the library `filings` R26 kept (a template already taken is passed over). */
    localFactsOf(ctx).migrate();
    filingTemplatesOf(ctx).migrate();
    filingTemplatesOf(ctx).migrateFromFilings();
    /* R39 (T45; K2781 (1)): layer 9's three new modules' tables, in the modules' order (each made at creation too;
       idempotent): action-holds' (after actions), action-replies' (after action-clocks), plan-work's (after
       action-plans). */
    actionHoldsOf(ctx).migrate();
    actionRepliesOf(ctx).migrate();
    planWorkOf(ctx).migrate();
    wizardScriptsOf(ctx).migrate();   /* R19: its tables, in the modules' order (first in layer 11) */
    translationsOf(ctx).migrate();   /* R61: its seven tables, in the modules' order (before instance-setup; idempotent) */
    pendingOf(ctx).migrate();   /* R75: `keeps_pending` and the stage record's table, the plane's own */
    sql.exec(ACQUIRE_STAGES_DDL);

    addColumns();   /* REC-143: the second pass */
    retrievalOf(ctx).migrate();   /* retrieval's projection columns, text index and selections, and its backfill */

    recordOf(ctx).seedMintLedger(MINT_LEDGER_LIVE);
  }

  /* R6: the one route map, every module's own ops map (the `membershipOps` pattern), then instance-setup's, then the owner
     map (R86), then store-door's, in this order; this module holds no route of its own but the owner map. */
  function routes(url, body, grant = null) {
    /* (T47; K3089; answers R35, R30; R33) a read under a grant: the use its read log opens with is the plane's, `draft`
       for a grant this object's draft path minted, else `ask`, stamped on the in-process address (answers' `rule` reads
       it from the query), never a caller's own. Only `op=rule` reads it so (`filing-templates`' `templates` has a `use`
       of its own, left as given). */
    if (url && url.searchParams && url.pathname.replace(/^\/+/, "") === "rule") {
      url.searchParams.delete("use");
      if (typeof grant === "string" && grant !== "") url.searchParams.set("use", draftUse(ctx, grant) || "ask");
    }
    const accountOps = aiAccountsOps(aiAccountsOf(ctx), url, body, env);
    const translationsMap = translationsOps(translationsOf(ctx), url, body);
    return {
      ...membershipOps(membershipOf(ctx), url, body, env),
      /* N783 (K2270): project-roster's ops (`projectowner*`, `projectvisibility`, `projectdirectory`,
         `projectparticipants`, `projectrequest*`), split from membership, directly after its map. */
      ...projectRosterOps(projectRosterOf(ctx), url, body, env),
      /* R53 (T48; N996; ai-accounts R32): ai-accounts' ops directly before credentials', over the one instance
         credentials' factory creates (`aiAccountsOf`) */
      ...accountOps,
      /* credentials' map still spreads ai-accounts' ops over its delegates (its R72, transitional): the names ai-accounts
         serves are dropped from it here, so each op reaches the one handler once and no op is answered twice */
      ...Object.fromEntries(Object.entries(credentialsOps(credentialsOf(ctx), url, body, env))
        .filter(([op]) => !Object.hasOwn(accountOps, op))),
      /* R49 (T47; K3143; signin-door R2, R4, R5): the sign-in door's store-internal routes (`signintokenhold`,
         `signintokenrefused`, `signindisclosuredue`, `signintracekeep`, `signintraceread`), beside credentials' map, over
         the plane's one credentials instance; none has an op spec, so none is served to a caller. */
      ...signinDoorOps(credentialsOf(ctx), url, body, env),
      /* K2042 (acquisition R43; CONTROL-PLANE #24 J3): the group's co-archive setting, acquisition's one instance per
         host, at acquisition's place before capture's map; `by` is the door's stamp. */
      coarchiveset: () => acquisitionOf(ctx).coArchiveSet({ on: body ? body.on : undefined, by: url.searchParams.get("by") }),
      coarchivestate: () => acquisitionOf(ctx).coArchiveState(),
      /* R73 (K4231, K4234): `acquiretimings`, acquisition's stage times of a call still running (its R95), at acquisition's place with the co-archive pair; `acquire` below is handed the timings object it fills, held under the door's `trace`. */
      ...acquireTimingsOps(ctx, url),
      /* R75: the door's deferred reading (control-plane R120), registered for the alarm; store-internal, no caller's own */
      ...pendingOps(pendingOf(ctx), url, { health: () => schedulerOf(ctx, env).health(),
        /* R80, R90: an administrator is the root of trust's credential (`class:admin`), the founder's session (the door stamps the bare `admin`) or a member membership R64 names (an active member of role `admin`) */
        administers: administersOf((id) => membershipOf(ctx).isAdministrator(id)) }),
      ...captureOps(captureOf(ctx), url, body, env, acquireHandlerParts(ctx, url)),
      /* R37 (N826; K2630): doorbell's nine routes, directly after capture's map, each answered by doorbell's instance
         (capture's copy deleted in T43, N849). */
      ...doorbellOps(doorbellOf(ctx), url, body),
      /* R26: file-safety's ops (op-declarations R32), at its place directly after doorbell's map. */
      ...fileSafetyOps(fileSafetyOf(ctx), url, body, env),
      ...calibrationOps(calibrationOf(ctx), url, body),
      ...biasOps(biasOf(ctx), url, body),
      ...extractionOps(extractionOf(ctx), url, body, env),
      ...connectionsOps(connectionsOf(ctx), url, body, env),
      ...inquiryOps(inquiryOf(ctx), url, body),
      /* K1619: `basis`, `restson`, `earnedbasis` are leg-earning's, after inquiry's delegating entries so its own win. */
      ...legEarningOps(legEarningOf(ctx), url),
      ...hypothesesOps(hypothesesOf(ctx), url, body),   /* K1607 */
      ...citationOps(citationOf(ctx), url, body),
      ...observationLogOps(observationLogOf(ctx), url, body),
      ...runProductionsOps(runProductionsOf(ctx), url, body),
      ...entitiesOps(entitiesOf(ctx), url, body),
      /* R21 (T33-90): layer 5's new modules' maps, in the modules' order (control-plane R53 routes them). */
      ...eventsOps(eventsOf(ctx), url, body),
      ...linesOps(linesOf(ctx), url, body),
      ...moneyOps(moneyOf(ctx), url, body),
      ...moneyChecksOps(moneyChecksOf(ctx), url, body),
      ...dutiesOps(dutiesOf(ctx), url, body),
      ...peopleOps(peopleOf(ctx), url, body),
      ...exploreOps(explore, url, body),
      ...calculationsOps(calculationsOf(ctx), url, body),
      ...workbooksOps(workbooksOf(ctx), url, body),
      ...contradictionOps(contradictionOf(ctx), url, body),
      ...progressionOps(progressionsOf(ctx), url, body),
      ...intentOps(intentOf(ctx), url, body),
      ...basisVersionsOps(basisVersionsOf(ctx), url, body),
      ...strengthOps(strengthOf(ctx), url, body),
      ...reevaluationOps(reevaluationOf(ctx), url, body),
      /* R45 (T47; N908; case-inputs R16): case-inputs' ops (`whatchangedpropose`, `whatchangeddrafts`, `statementack`),
         moved from case-authoring's map, directly before it, over the one instance case-authoring's factory creates. */
      ...caseInputsOps(caseInputsOf(ctx), url, body),
      ...caseAuthoringOps(caseAuthoringOf(ctx), url, body),
      /* R39 (T46; N935; case-account R15): case-account's own ops map (`advocacycheck`, `advocacychecks`, its R13), over
         the plane's one instance (R38); the plane names no entry of it (R9). */
      ...caseAccountOps(caseAccountOf(ctx), url, body),
      ...ratificationOps(ratificationOf(ctx), url, body),
      /* R17 (N520, N522): case-import's ten member ops (`importwatch` and `importunwatch` the watch's, R20);
         case-checker's public reads `casechecker` and `casefilespec` are public-read's (its R18). */
      ...caseImportOps(caseImportOf(ctx), url, body),
      /* N483 (K1122): `export` and `exportlog` are corpus-export's (its R6), on the one instance publication created. */
      ...corpusExportOps(corpusExportOf(ctx), (k) => url.searchParams.get(k)),
      /* K1643: `caseflags` and `attribute` are case-tensions', on the one instance publication's factory made. */
      ...caseTensionsOps(caseTensionsOf(ctx), url, body),
      ...publicationOps(publicationOf(ctx), url, body),
      /* R18 (T37; K2226): case-carriage's `obscuremark`, `photomarks` and `obscuremarkwithdraw` (its R9, R10, R14), directly after publication's, over
         the one instance publication's factory made. */
      ...caseCarriageOps(publicationOf(ctx).caseCarriage, url, body),
      /* R32 (N823): publish-schedule's `publishatmove`, `publishatcancel`, `publishschedule`, after publication's map and
         case-carriage's (R18 keeps that one directly after publication's), over the one instance ratification's factory
         made. */
      ...publishScheduleOps(ratificationOf(ctx).publishSchedule, url, body),
      /* R15 (N520): docket's member ops; its public reads `docketpublic` and `docketfeed` are public-read's (its R21). */
      ...docketOps(docketOf(ctx), url, body),
      ...publicReadOps(publicReadOf(ctx), url),
      ...projectStageOps(projectStageOf(ctx), url),
      ...networkNoticesOps(networkNoticesOf(ctx), url, body),   /* noticeprepare, noticepost, notices, directorysubmission */
      ...promotionOps(promotionOf(ctx), url, body),
      /* record-core's audit gated by membership's sight (record-core R73). */
      ...withDeepStats(recordCoreOps(recordOf(ctx), url, body, { sight: viewerPredicate }), url),
      /* `recordcapturedlocator` reports observation-log's receipt listener. */
      ...provenanceOps(provenanceOf(ctx), url, body, { observer: OBSERVATION_LOG_MODULE }),
      /* `provenancechain`, `provenanceroute`, `provenanceroutes`: provenance-routes' (its R9; N512), at the place
         provenance's map held them. */
      ...provenanceRouteOps(provenanceRoutesOf(ctx), url, body),
      ...contentOps(contentOf(ctx), url, body),
      ...captureRequestsOps(captureRequestsOf(ctx), url, body),
      /* R69, R70 (T51; K4213): capture-sources' credential ops (over the instance start builds with the seal key and the own hosts) and investigation's `projectclose`, after capture-requests' map. */
      ...captureSourcesOps(captureCredentialsOf(ctx), url, body),
      ...investigationOps(investigationOf(ctx), url, body),
      /* R35 (K2567): reading-guides' ops, after capture-requests' map, its place in the modules' order. steps',
         investigation's and question-explorer's ops are control-plane R71's own map (K2560), not routed here. */
      ...readingGuidesOps(readingGuidesOf(ctx), url, body),
      ...governorRoutes(governorOf(ctx), url, body),
      /* R31 (K2488): ai-use's `ailimitset`, `ailimits`, `aiusage`, `exploreapprove` (op-declarations R41), before
         ai-runs' map, over the one instance `aiUseOf(ctx)` makes. */
      ...aiUseOps(aiUseOf(ctx), url, body, env),
      ...aiRunsOps(aiRunsOf(ctx, env), url, body),
      ...answersOps(answersOf(ctx), url, body),   /* R21 (K1609) */
      ...retrievalRoutes(retrievalOf(ctx), url, body),
      /* R45 (T47; N961; action-records R15): action-records' acts, moved from actions' map, directly before it, over the
         one instance actions' factory creates. */
      ...actionRecordsOps(actionRecordsOf(ctx), url, body),
      ...actionsOps(actionsOf(ctx), url, body),
      /* R39 (T45): action-holds' ops (`actionpressure`, `actionhold`, `actionholdrelease`, `actionholdpreview`,
         `projectholds`, `holdnoticesent`, `pressurerecord`), directly after actions', over the one instance R39 builds. */
      ...actionHoldsOps(actionHoldsOf(ctx), url, body),
      ...actionClocksOps(actionClocksOf(ctx), url, body),
      /* R39 (T45): action-replies' ops (`actionreplybearing`, `actionbearingpropose`, `arosefrom`), after action-clocks'. */
      ...actionRepliesOps(actionRepliesOf(ctx), url, body),
      /* R11 (K921); R39 (T46; N935; local-facts R15): its own ops map, `grouprules` (its R12) among them; the plane names
         no entry of it (R9). */
      ...localFactsOps(localFactsOf(ctx), url, body),
      ...standardsOps(standardsOf(ctx), url, body),
      ...conformanceOps(conformanceOf(ctx), url, body),
      ...consequencesOps(consequencesModule(ctx), url, body),
      ...filingsOps(filingsOf(ctx), url, body),
      /* R11 (K921): after filings', so `op=templates`, in both maps until filings drops its arm, is filing-templates' (K991). */
      ...filingTemplatesOps(filingTemplatesOf(ctx), url, body),
      ...actionPlansOps(actionPlansOf(ctx), url, body),   /* `optionpropose` answers a promise, which the frame awaits */
      ...planWorkOps(planWorkOf(ctx), url, body),   /* R39 (T45): plan-work's ops, directly after action-plans' */
      ...escalationOps(escalationOf(ctx), url, body),
      ...monitoringOps(monitoringOf(ctx), url, body),
      ...linkSweepOps(linkSweepOf(ctx), url, body),   /* `sweeps` (link-sweep R9), at the place monitoring's map held it (N506) */
      ...followingOps(followingOf(ctx), url, body),   /* R21 (T33-79) */
      ...reviewOps(reviewOf(ctx), url, body),
      /* R39 (T45; K2839): case-check's `publishcheck` (graded as publish) and `casecheck`, after review's map. */
      ...caseCheckOps(caseCheckOf(ctx), url, body),
      ...wizardScriptsOps(wizardScriptsOf(ctx), url, body),   /* R19 (N528): the wizard scripts' ops, layer 11 */
      /* R61 (T50; translations R12): translations' nine routes, over the one instance; instance-setup's own copy of them
         (deleted in its own job, T50-23) is dropped here so each route reaches the one handler once. */
      ...translationsMap,
      ...Object.fromEntries(Object.entries(instanceSetupOps(instanceSetupOf(ctx, env), url, body))
        .filter(([op]) => !Object.hasOwn(translationsMap, op))),
      /* K2044, K2054 (admission R21): the Worker's count of a request to a public op, `doorwindow`, store-internal */
      ...admissionOps(admissionOf(ctx), url, body),
      /* R35 (K2585; control-plane R71, R72): the door's own map for the owners that export a service and no arm, handed
         each owner's one instance on this storage through getters, each asked only when its op is served. */
      /* (T42; N839; K2656) `caseAccount`, the plane's one case-account instance (R38), for control-plane R71's account
         ops; never case-authoring's pass-through. */
      ...ownerOps(ownerGettersOf(ctx, env), url, body),   /* the getters are owners.mjs' (K4435) */
      /* store-door's map (its R1); the grant its door read from the header is handed on (its R11, K2041) */
      ...controlPlaneRoutes(ctx, url, body, grant),
    };
  }

  /* R7, R9: every store request passes store-door's one frame (K2043), handed the object's namespace (R4) and
     `action-holds`' `purgeHeld` (its R9) on the one instance R34 builds, each asked at the purge only. */
  function dispatchRequest(req) {
    return dispatch(req, { routes: (url, body, grant) => routes(url, body, grant), membership: () => membershipOf(ctx),
      namespace, purgeHeld: (q) => actionHoldsOf(ctx).purgeHeld(q),
      /* R49 (B5, K1685; answers R1, R2): a read served under a grant is recorded in this object's read log, scrubbed;
         under a grant this object's draft path minted, with `use: "draft"`, so the rows of projects kept away from drafts are
         removed before the log records them; else the entry's own use. */
      logRead: (entry) => {
        const use = draftUse(ctx, entry && entry.grant);
        return answersOf(ctx).logRead(use ? { ...entry, use } : entry);
      } });
  }

  /* R8: one read the asking member may make, answered by the route map exactly as the door would answer it, her viewer
     stamp in `params.viewer`; a synchronous read's answer, or null for an op the map lacks. It reaches no write. */
  function read(op, params) {
    const u = new URL(`http://do/${op}`);
    for (const [k, v] of Object.entries(params || {})) if (v !== null && v !== undefined) u.searchParams.set(k, String(v));
    const map = routes(u, null);
    return Object.hasOwn(map, op) ? map[op]() : null;
  }

  return Object.freeze({ routes, dispatch: dispatchRequest, namespace, nowMs, read });
}
