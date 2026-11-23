/* plane R6: the hooks `control-plane`'s `makeFetch` takes, composed from the arms' owners' handlers. Moved from
   `src/index.mjs` (legacy-index map §1a, "composition root"; K846) once each arm's owner had taken its handler: what is
   left is which handler answers which op, and the stamps and helpers each is handed. Every stamp is control-plane's,
   set from the authenticated caller; every answer is the handler's (R9). */
import { bootstrapOp, INSTANCE_SETUP_OPS, instanceSetupOp } from "../setup.mjs";
import { caseRatifyStatement, NS_RATIFY } from "../sshsig.mjs";
import { MACHINE_AUTHOR_PREFIX, MACHINE_CLASS_PREFIX } from "../record-grammar/actors.mjs";
import { publicReadDoorOp } from "../public-read/door.mjs";
import { publicationDoorOp } from "../publication/door.mjs";
import { affordancesOp } from "../affordances.mjs";
import { QUEUE_DOOR_OPS, queueOp } from "../queue/door.mjs";
import { registerAuditOp } from "../provenance/ops.mjs";
import { attestOp } from "../attestation/index.mjs";
import { withBiasChecks } from "../bias/index.mjs";
import { GOVERNOR_OPS, governorOpResponse } from "../host-governor/index.mjs";
/* R37 (N826; K2630): the knock is doorbell's, never capture's copy (deleted in T43, N849). */
import { doorbellPublicOp } from "../doorbell/door.mjs";
import { captureOp } from "../capture/ops.mjs";
import { monitorOp } from "../monitoring/index.mjs";
import { EXTRACTION_OPS, extractionOp, acquireReadingOp, pageTranscribeOp } from "../extraction/ops.mjs";
import { CONNECTIONS_OPS, connectionsOp } from "../connections/ops.mjs";
import { ratificationOp } from "../ratification/ops.mjs";
import { ACT_GATE } from "../op-declarations/index.mjs";
import { askOp, actionDraftOp, ACTION_DRAFT_OPS } from "../store-assembly/index.mjs";
/* K1907, K2041: the answer's envelope is answer-envelope's (its R1–R5); the reads of a case, a capture's key and the
   store's absence stay control-plane's, with the namespace names it re-exports from admission. */
import { json, doAnswer, storeSilent, storeRefusal, STORE_SILENT_REASON, STORE_SILENT_DETAIL,
         requiredArgument } from "../answer-envelope/index.mjs";
import { SCRATCH, sha256Hex, caseReader, captureKey, storageAbsent } from "../control-plane/index.mjs";
import { storeStub } from "../store-place.mjs";

/* R96 (fix round 8, G106, G120; control-plane R128): the door's `stateTiming(name, ms)`, handed in the context the door gives these hooks, reaches
   every handler's context as `stateTiming`; absent when the door gave none (a module's call is then a no-op). Nothing is made up here. */
const timingHook = (stateTiming) => (typeof stateTiming === "function" ? { stateTiming } : {});

/* The public ops: each owner's handler asked in turn; the bootstrap report answers any other. */
/* K2062 (control-plane's door, admission R20, R21): the hook is handed the caller's presented `credential` (read from the
   header or body, never the query), the keyed `source` and Cloudflare's `country`. `credential` reaches the readers of a
   case (`caseReader`, admission's `readerOf`); `country` reaches doorbell's knock (doorbell R20). A JSON body's `token` is
   the caller's credential and no arm passes it on. */
export async function publicOp({ req, url, env, op, stub, fp, presentedAi, credential = null, country = null, stateTiming = null }) {
  const hook = timingHook(stateTiming);
  { const pr = await publicReadDoorOp(op, url, env, stub, { json, requiredArgument, storeSilent, storeRefusal, doAnswer, ...hook }); if (pr) return pr; }
  { const pd = await publicationDoorOp(op, url, stub, { json, storeSilent, storeRefusal, doAnswer, sha256Hex, NS_RATIFY, ...hook,
      caseRatifyStatement, readerOf: () => caseReader(url, env, "bio", presentedAi.cred, credential),
      /* publication R73 (F1; K2011): the request's body, read on a copy and only when its door asks for it, so the
         review copy's secret arrives in the body and the request stays readable by the arms after it. */
      body: () => req.clone().json() }); if (pd) return pd; }
  /* Anyone, no token, no session: the doorbell (R37), confined to the inbox namespace. */
  { const knocked = await doorbellPublicOp(op, req, env, stub, { json, requiredArgument, storeSilent, storeRefusal, doAnswer, country, ...hook }); if (knocked) return knocked; }
  /* R95 (T51; instance-setup, K4076): the bootstrap report states its seven facts only to a credentialed caller, handed as
     the control plane resolves who is asking (`caseReader`, the admission gate's `readerOf`): `{cls: "admin"}` for an
     admin-class token or an administrator's signed-in session; none for a caller that presented nothing, a stranger or a
     store silence, who is answered R132's key set only. */
  let caller = null;
  try {
    const reader = await caseReader(url, env, "bio", presentedAi.cred, credential);
    if (!reader.silent && "cls" in reader) {
      /* instance-setup R103 (fix round 8, G114): a signed-in member's viewer, in the session's form the door stamps elsewhere (never a machine identity),
         so the report carries her `language` and `words_version`; absent without a session. */
      const viewer = (reader.cls === "member" || reader.cls === "admin") && typeof reader.viewer === "string" && reader.viewer !== ""
                     && !reader.viewer.startsWith(MACHINE_CLASS_PREFIX) ? reader.viewer : null;
      if (reader.cls === "admin" || viewer) caller = { ...(reader.cls === "admin" ? { cls: "admin" } : {}), ...(viewer ? { viewer } : {}) };
    }
  } catch { caller = null; }
  return bootstrapOp(url, env, fp, { stub, json, storeSilent, storeRefusal, doAnswer, caller, ...hook });
}

/* The admitted ops whose handler is a module's door; undefined for control-plane's generic forward. */
export async function gatedOp({ req, url, env, op, cls, viaSession, sessMember, sessViewer, sessIdentity, sessRights,
                                sessCaps, aiCred, storeName, stub, grantMember, trace = null, memberRef = null, timings = null, deferReading = null, stateTiming = null }) {
  const hook = timingHook(stateTiming);
  const store = () => storeStub(env, storeName);
  /* The stamps, from the authenticated caller: a session's member, viewer and identity; an `ai` credential's principal
     as its viewer and identity, and `class:ai/<tokenId>` as its author (control-plane R17, as its generic forward stamps
     it; REC-134; N866): no arm below that takes `author` records the `token:` form for an `ai` caller; (T44; N874)
     `class:ai/<tokenId>` as its `by` too, never `class:ai` alone; a binding class as `class:<cls>`, or `token:<cls>` as
     an author (D-311). */
  const viewer = viaSession ? sessViewer : cls === "ai" ? aiCred.principal : `${MACHINE_CLASS_PREFIX}${cls}`;
  const identity = viaSession ? sessIdentity : cls === "ai" ? aiCred.principal : `${MACHINE_CLASS_PREFIX}${cls}`;
  const author = viaSession ? sessMember
    : cls === "ai" ? `${MACHINE_CLASS_PREFIX}ai/${aiCred.tokenId}` : `${MACHINE_AUTHOR_PREFIX}${cls}`;
  const by = viaSession ? sessMember : cls === "ai" ? `${MACHINE_CLASS_PREFIX}ai/${aiCred.tokenId}` : `${MACHINE_CLASS_PREFIX}${cls}`;

  /* B2 (K1674): the ask, a member's own act, carried to agent-worker with the grant and the member's account. */
  /* R55 (T48; N1015; K3103; control-plane R93): the door's `trace` and member ref, minted per request by the door and handed
     here in process, reach the ask's call to agent-worker as headers (`ask.mjs`' `doorHeaders`); none is taken from the
     caller, and none is read here. */
  if (op === "ask") return askOp({ req, url, env, viaSession, sessMember, grantMember, trace, memberRef, ...hook });
  /* R41 (T45; K2824, K2881): the assistant's infraction and reply-bearing drafts, a member's own act on the `bio` object */
  if (ACTION_DRAFT_OPS.includes(op)) return actionDraftOp({ req, url, env, op, viaSession, sessMember, sessViewer, trace, memberRef, ...hook });
  if (op === "affordances")
    return affordancesOp(url, store(), { json, doAnswer, storeSilent, storeRefusal, gate: ACT_GATE, viewer, identity, author,
      by, storeName, cls, ...hook });
  if (QUEUE_DOOR_OPS.includes(op)) return queueOp(op, url, store, { json, doAnswer, storeRefusal, storeSilent, gate: ACT_GATE,
    storeName, cls, viewer, member: viaSession ? sessMember : "", ...hook });
  if (op === "registeraudit") return registerAuditOp(env, store(), { json, doAnswer, storeSilent, storeRefusal, captureKey,
    storeName, cls, ...hook });
  if (INSTANCE_SETUP_OPS.includes(op)) return instanceSetupOp(op, url, env, storeName, { cls, scratch: SCRATCH, json, doAnswer,
    storeSilent, storeRefusal, viewer, ...hook });
  if (CONNECTIONS_OPS.includes(op)) return connectionsOp(op, url, store, { json, doAnswer, storeRefusal, storeSilent,
    viewer, identity, ...hook });
  if (GOVERNOR_OPS.includes(op)) return governorOpResponse(op, url, store, { json, doAnswer, storeRefusal, storeSilent, ...hook });
  {
    const c = await captureOp(op, req, url, env, store, { json, storeSilent, storeRefusal, doAnswer, storageAbsent,
      requiredArgument, cls, member: viaSession, sessMember, storeName, key: (s) => captureKey(storeName, s), viewer,
      timings, trace, ...hook,   /* control-plane R115: `acquire`'s stage timings; capture R99: the door's `trace`, sent to the object as a header so it holds them under it (plane R73) */
      readAcquired: async (answer, st) => {
        /* R75 (K4440; control-plane R120): the door asks of the document just filed whether its reading will not fit the bound; if so the read
           step is skipped and the document answered with `reading_pending: true`, the reading following by `readHeld` and the object's alarm.
           A hook that throws defers nothing: the kept capture is read as it always was. (R76 amended, K4916) Its answer is awaited: a promise of
           `true` defers; one that rejects, like a throw, defers nothing. */
        let deferred = false;
        try { deferred = typeof deferReading === "function" && (await deferReading(answer && answer.document)) === true; } catch { deferred = false; }
        return deferred ? { body: { ...answer, reading_pending: true } }
                        : acquireReadingOp(answer, st, { json, storeSilent, storeRefusal, doAnswer, storeName });
      } });
    if (c) return c;
  }
  if (EXTRACTION_OPS.includes(op)) return extractionOp(op, url, env, store, { json, storeSilent, storeRefusal, doAnswer,
    storageAbsent, requiredArgument, cls, session: viaSession, caps: sessCaps, viewer, author, storeName, ...hook });
  /* R36 (K2635, K2656; control-plane R74): a member's transcription of a stored scan's unread pages, extraction's exported
     handler, beside `pdfstructure`'s arm, with the same stamps. */
  if (op === "pagetranscribe") return pageTranscribeOp(url, env, store(), { json, storeSilent, storeRefusal, doAnswer,
    storageAbsent, requiredArgument, cls, session: viaSession, caps: sessCaps, viewer, author, storeName, trace, memberRef, ...hook });
  if (op === "attest") return attestOp(req, env, store(), { json, doAnswer, storageAbsent, captureKey, storeName, cls, ...hook });
  if (op === "monitor") return monitorOp(req, store(), { json, storeSilent, storeRefusal, requiredArgument, doAnswer,
    viaSession, sessViewer, storeName, cls, ...hook });
  return ratificationOp(op, req, stub, { env, json, doAnswer, storeSilent, storeRefusal, storeName, cls, aiCred, viaSession,
    sessViewer, sessRights, withBiasChecks, STORE_SILENT_REASON, STORE_SILENT_DETAIL, ...hook });
}
