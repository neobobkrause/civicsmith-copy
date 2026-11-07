/* control-plane's record fixture (K856): one Durable Object's storage at the plane's shape — node:sqlite behind `sql.exec`
   answering a cursor, `transactionSync` a savepoint that rolls back on a throw, as workerd's does — with the modules the
   record store's door routes to here, and the modules a promotion's registered steps reach, composed from earlier modules
   only (all in this module's `uses`), each built and migrated in the order the composition root uses, with
   instance-setup started, and an in-memory evidence bucket. The door is this module's `dispatch` over a route map of capture's own routes, the doorbell's
   (T42) and `controlPlaneRoutes`, so no suite here constructs plane's class (P4). `record({step: true})` also registers this
   module's promotion step (R42) at the rank the composition root gives it, with `probes` (`{module: {check, project}}`)
   registered beside it, and routes provenance's ops (`op=testify`) with provenance-routes' beside them (`op=provenancechain`,
   `provenanceroute`, `provenanceroutes`; N512). attestation and provenance-routes are built directly after provenance,
   as the composition root builds them (provenance, attestation, provenance-routes). */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import "./harness.mjs";
import { dispatch, controlPlaneRoutes } from "../../../src/store-door/dispatch.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { membershipOf, MODULE_ORDER } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { catalogueFor } from "../ai-accounts/catalogue.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { provenanceOps } from "../../../src/provenance/ops.mjs";
import { attestationOf } from "../../../src/attestation/index.mjs";
import { provenanceRoutesOf, provenanceRouteOps } from "../../../src/provenance-routes/index.mjs";
import { OBSERVATION_LOG_MODULE } from "../../../src/observation-log/index.mjs";
import { promotionStep } from "../../../src/store-door/step.mjs";
import { calibrationOf } from "../../../src/calibration/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { progressionsOf } from "../../../src/progressions/index.mjs";
import { biasOf } from "../../../src/bias/index.mjs";
import { observationLogOf } from "../../../src/observation-log/index.mjs";
import { retrievalOf } from "../../../src/retrieval/index.mjs";
import { registerInquiryGrammar } from "../../../src/inquiry-grammar/index.mjs";
import { inquiryOf } from "../../../src/inquiry/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { contradictionOf } from "../../../src/contradiction/index.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { answersOf } from "../../../src/answers/index.mjs";
import { runProductionsOf } from "../../../src/run-productions/index.mjs";
import { captureRequestsOf } from "../../../src/capture-requests/index.mjs";
import { intentOf } from "../../../src/intent/index.mjs";
import { captureOf, captureOps } from "../../../src/capture/index.mjs";
import { doorbellOf, doorbellOps } from "../../../src/doorbell/index.mjs";
import { instanceSetupOf } from "../../../src/setup.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() { const rest = c.toArray(); if (rest.length !== 1) throw new Error(`expected one row, got ${rest.length}`); return rest[0]; },
  };
  return c;
}

/* R42: the order promotion ranks its steps by, as the composition root gives it: the modules' total order with this
   module's step at the rank `legacy-store`'s step had, after every module of layers 1-10 and before the first module of
   layer 11 in `build/modules.json` (`wizard-scripts` since N544; N548). */
const LAYERS = JSON.parse(readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8"));
export const FIRST_LATER = (LAYERS.modules || LAYERS).find((m) => m.layer > 10 && m.id !== "control-plane").id;
export const STEP_ORDER = Object.freeze((() => {
  const o = MODULE_ORDER.filter((m) => m !== "control-plane");
  const at = o.indexOf(FIRST_LATER);
  return [...o.slice(0, at), "control-plane", ...o.slice(at)];
})());

/** A record and its door. `go(path, method, body)` asks the door; `ctx` and `db` are the object's. */
export async function record({ step = false, probes = {}, sealSecret = null } = {}) {
  const db = new DatabaseSync(":memory:");
  const sql = { exec(q, ...a) { const st = db.prepare(q); return cursor(st.columns().length ? st.all(...a.map(bind)).map((r) => ({ ...r })) : (st.run(...a.map(bind)), [])); },
                get databaseSize() { return size; } };
  let size = 0;   /* G42: settable, so a test sets the object's measured size (`setSize(n)`; null states none) */
  let n = 0;
  const transactionSync = (fn) => {
    const sp = `sp${n++}`;
    db.exec(`SAVEPOINT ${sp}`);
    try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
    catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
  };
  const objects = new Map();
  const bucket = {
    async head(k) { return objects.has(k) ? { size: objects.get(k).length } : null; },
    async get(k) { const b = objects.get(k); return b ? { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) } : null; },
    async put(k, b) { objects.set(k, new Uint8Array(b)); return {}; },
  };
  const ctx = { storage: { sql, transactionSync, getAlarm: async () => null, setAlarm: async () => {}, deleteAlarm: async () => {} },
                id: { equals: () => false, toString: () => "do" }, blockConcurrencyWhile: (fn) => fn(), waitUntil() {} };
  const env = { STORE: { idFromName: (x) => x }, CAPTURES: bucket, INSTANCE_NAME: "test" };
  /* built in the composition root's order, each module the promotion's steps reach registering at start */
  const record = recordOf(ctx, { evidence: bucket, evidencePrefix: () => "bio/captures/" });
  const promotion = step ? promotionOf(ctx, { order: STEP_ORDER }) : promotionOf(ctx);
  /* T34 (R57): credentials built first with a seal secret when a suite asks for one, so accounts can be held */
  /* (T53; ai-accounts R32, R59; op-grades R57) and with ai-catalogue's real service, seeded as ai-accounts' tests seed it, since
     an account is now held on a catalogue plan; the seed awaited before any act (store-door's record does the same) */
  if (sealSecret) {
    const catalogue = catalogueFor(ctx, { record });
    credentialsOf(ctx, { record, sealSecret, catalogue });
    await catalogue.seeded;
  }
  observationLogOf(ctx, { extraction: null, provenance: provenanceOf(ctx, { signingKey: null, instanceName: "test" }) });
  /* N512: provenance's split, each built after provenance in the module order */
  attestationOf(ctx, { record, provenance: provenanceOf(ctx), signingKey: null });
  provenanceRoutesOf(ctx, { record, promotion, instanceName: "test" });
  observationLogOf(ctx).listenTo(contentOf(ctx, { extraction: extractionOf(ctx, { env, promotion, calibration: calibrationOf(ctx) }) }).extraction);
  observationLogOf(ctx).attachMeaning({ entities: entitiesOf(ctx) });
  const retrieval = retrievalOf(ctx, { now: () => Date.now() });
  registerInquiryGrammar(record);
  basisVersionsOf(ctx, { retrieval });
  /* ai-use (T41-22; plane R31): the one instance every reader of AI use shares, built before ai-runs reads it */
  aiUseOf(ctx);
  /* answers (its R30 `askAccount`, which store-door R10 asks before a draft) reads the account through credentials, handed
     as plane hands it */
  answersOf(ctx, { credentials: credentialsOf(ctx) });
  aiRunsOf(ctx, env);
  observationLogOf(ctx).attachMeaning({ connections: connectionsOf(ctx, { env }) });
  biasOf(ctx, { env });
  runProductionsOf(ctx, { aiRuns: aiRunsOf(ctx, env) });
  intentOf(ctx);
  /* R42: where the composition root registers the step, after layer 10's modules are built and before capture */
  if (step) {
    for (const [module, p] of Object.entries(probes)) promotion.registerStep(module, p);
    promotion.registerStep("control-plane", typeof step === "object" ? step : promotionStep(ctx));
  }
  const capture = captureOf(ctx, { env });
  /* T42 (N826): the doorbell, built on capture's instance for the storage as the composition root builds it; its routes
     (the knock, the inbox, the doorbell's own pull) answer for the doorbell's, not capture's copy */
  doorbellOf(ctx, { capture });
  captureRequestsOf(ctx, { env, storeName: () => "bio", now: () => Date.now(), runs: aiRunsOf(ctx, env), aiRuns: aiRunsOf(ctx, env) });
  observationLogOf(ctx).listenToCapture(capture);
  /* the migration pass, in the composition root's order, for every owner this module uses (host-governor's tables are
     made by capture's own governor) */
  record.migrate();
  for (const m of [calibrationOf(ctx), membershipOf(ctx), credentialsOf(ctx), provenanceOf(ctx), provenanceRoutesOf(ctx), contentOf(ctx), connectionsOf(ctx),
                   basisVersionsOf(ctx), inquiryOf(ctx), captureOf(ctx), extractionOf(ctx), observationLogOf(ctx), runProductionsOf(ctx),
                   captureRequestsOf(ctx), aiRunsOf(ctx, env), entitiesOf(ctx), contradictionOf(ctx), progressionsOf(ctx), biasOf(ctx),
                   intentOf(ctx), retrievalOf(ctx)]) m.migrate();
  /* instance-setup started, as the composition root starts it: it provides the producing group a promotion reads */
  await instanceSetupOf(ctx, env).start();
  const store = { routes: (url, body) => ({ ...captureOps(captureOf(ctx), url, body, env),
                                            ...doorbellOps(doorbellOf(ctx), url, body),
                                            ...(step ? provenanceOps(provenanceOf(ctx), url, body, { observer: OBSERVATION_LOG_MODULE }) : {}),
                                            ...(step ? provenanceRouteOps(provenanceRoutesOf(ctx), url, body) : {}),
                                            ...controlPlaneRoutes(ctx, url, body) }),
                  membership: () => membershipOf(ctx) };
  const go = async (path, method = "GET", body) => {
    const r = await dispatch(new Request(`http://do/${path}`, body === undefined ? { method } : { method, body: JSON.stringify(body) }), store);
    return { status: r.status, json: await r.json() };
  };
  return { ctx, db, env, go, objects, promotion, setSize: (n) => { size = n; } };
}
