/* store-request: THE REQUEST THE STORE IS ASKED, MADE FROM THE PAGE'S (R1–R15, R23, R24; K5046 (b), K5052 (1), K5054). Split by
   copy from `control-plane`'s door (`index.mjs:1384-3881`, its construction of the store's request, less the door arms), so the
   Worker's door and a test world's door make the same request by one function (P5, K4990). `innerRequest` takes the admitted
   caller and the page's request and answers the store's: every stamp set from the caller and none taken from the request,
   every credential in a header, the actor written into the body where the owner reads it there. It holds no gate, door arm
   or answer, reads no clock, writes nothing and never throws. The expressions are named by letter in the requirements'
   terms: M a session's member, else C (`class:<cls>`); T a session's member, else `token:<cls>`; I a session's identity,
   else C; A a session's member, an `ai` caller's `class:ai/<tokenId>`, else C; AI a session's identity, an `ai` caller's
   `class:ai/<tokenId>`, else C; P a session's identity, an `ai` caller's `<principal>/<tokenId>`, else C; N a session's
   identity, an `ai` caller's principal, else C; V a session's viewer, an `ai` caller's the viewer admission answers, else C.
   The rules run in the order the door ran them (R3, R4, R6, R7, R8, R11, R12, R23): a key a later rule sets replaces an
   earlier one's. */
import { parseFrontmatter, createSha256, normalizeType, MACHINE_AUTHOR_PREFIX, MACHINE_CLASS_PREFIX } from "../record-grammar/index.mjs";
import { projectCreationGate, callerViewer } from "../admission/index.mjs";
import { normalizeAddress } from "../subresources.mjs";
import { EDGE_ACTIONS, STATE_ACTIONS, ACTION_ACTIONS, DECLARATION_ACTIONS, STRUCTURE_ACTIONS, VERSION_ACTIONS,
         PROJECT_ACTIONS, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS, CUSTODIAL_ACTIONS, ROSTER_SELF_ACTIONS,
         OWN_KEY_ACTIONS, CAPTURE_MEMBER_ACTIONS, CAPTURE_VIEWER_ACTIONS, CAPTURE_READS, SOURCE_ACTIONS, SOURCE_READS,
         QUEUE_ACTIONS, RUN_VERB_ACTIONS, RUN_PRODUCTION_ACTIONS, POSITIONAL_ACTS, INTENT_ACTIONS, INTENT_READS,
         REEVALUATION_ACTIONS, STANDARDS_ACTIONS, CONTRADICTION_ACTIONS, CONTRADICTION_READS, QUERY_AUTHOR_ACTIONS, OPS, NEEDS,
         ACTION_LAYER_ACTIONS, ACTION_LAYER_READS, PLAN_PROPOSAL_ACTIONS, TEMPLATE_PROPOSAL_ACTIONS, LOCAL_FACTS_ACTIONS,
         WHAT_CHANGED_PROPOSAL_ACTIONS, WHAT_CHANGED_READS, NETWORK_NOTICES_ACTIONS, NETWORK_NOTICES_READS,
         NETWORK_NOTICES_BY, DOCKET_ACTIONS, DOCKET_READS, DOCKET_AUTHOR, DOCKET_BY, OP_STAMPS } from "../op-declarations/index.mjs";

/* ---- R24: the lists this function reads, moved with it ---- */

/** R3: the stamps a caller may never supply in the address (and, for `LOCAL_FACTS_ACTIONS`, in the body, R12). */
export const QUERY_STAMPS = Object.freeze(["viewer", "identity", "author", "by", "actor", "who", "origin", "administer", "aiCred",
                                           "source", "country"]);
/** R9: the body keys only the door sets. */
export const BODY_STAMPS = Object.freeze(["actorIdentity", "actorViewer", "actorMemberId", "ownerMemberId", "assistantPrincipal",
                                          "migrationReplay"]);
/** R3: what an op takes from its body alone leaves the address. */
export const BODY_ONLY = Object.freeze({ securitytooladd: Object.freeze(["credentials", "config"]),
                                         projectkeyset: Object.freeze(["key"]),
                                         setpassword: Object.freeze(["current", "password", "role"]) });
/** R9: the body keys an op drops. */
export const BODY_DROPPED = Object.freeze({ setpassword: Object.freeze(["role"]) });
/** R9: the ops whose body `member` is the session's own, so the body's is deleted. */
export const SESSION_MEMBER_BODY_OPS = Object.freeze(["stepsource", "stepsourcewithdraw"]);
/** R3: the acts whose owner reads `at` as the time the act is recorded: the caller's `at` leaves the address and the body. */
export const ACT_CLOCK_OPS = Object.freeze(["aicredentialmint", "transcribe", "transcriptionattest", "contentmint", "attesttext",
  "airunopen", "airuntick", "airunclose", "airunverify", "stepsrunai", "grouptestset", "ailimitset", "exploreapprove",
  "biasdebtresolve", "captureaccount", "queuemute", "queuesnooze", "contradictionpropose", "contradictionrecommend",
  "extractpropose", "scanbatch"]);
/** R7: membership's administrator acts, stamped `by`=M. */
export const MEMBERSHIP_ADMIN_ACTS = Object.freeze(["invitewithdraw", "websitekeycreate", "websitekeyset", "websitekeyrevoke",
  "joinlinkenable", "joinlinkset", "joinlinkreplace", "joinlinkoff", "courtnoticeset", "groupdescriptionset", "joindoors"]);
/** R7: wizard-scripts' authoring acts, stamped `author`=I. */
export const WIZARD_AUTHOR_ACTIONS = Object.freeze(["wizarddraft", "wizardrevise", "wizardsubmit", "wizardapprove", "wizardretire",
                                                    "wizardeditorgrant", "wizardeditorrevoke"]);
/** R7: wizard-scripts' proposal, stamped `author`=A. */
export const WIZARD_PROPOSAL_ACTIONS = Object.freeze(["wizardpropose"]);
/** R6: wizard-scripts' ops stamped with the caller's sight. */
export const WIZARD_VIEWER_OPS = Object.freeze(["wizarddraft", "wizardrevise", "wizardsubmit", "wizardapprove", "wizardretire",
  "wizardpropose", "wizards", "wizardread", "wizardsat", "wizarduse", "wizardcandidates", "wizardcheck", "startfrom", "baseupdates"]);
/** R7: case-import's acts, stamped `by`=I. */
export const CASE_IMPORT_ACTIONS = Object.freeze(["caseimport", "caseimportdocument", "importaccept", "importacceptwithdraw",
  "importflag", "importflagclear", "importwatch", "importunwatch", "rerunstart", "rerunpair"]);
/** R6: case-import's reads, stamped with the caller's sight. */
export const CASE_IMPORT_READS = Object.freeze(["importedcases", "importedcase", "importregrade", "rerunread"]);
/** R12: the ops whose owner reads its actor from the body under a key that is not `by`, op → key. */
export const BODY_ACTOR = Object.freeze({
  lawrelate: "author", lawwithdraw: "author", courtlink: "author", courttreat: "author", standardforce: "author",
  standardforcewithdraw: "author", standardrelease: "author", standardadoption: "author", standardimpose: "author",
  standardbenchmark: "author", standardinforcethrough: "author", standardinforcethroughwithdraw: "author",
  lawpropose: "proposer", standardforcepropose: "proposer" });
const BODY_ACTOR_KEYS = Object.freeze([...new Set(Object.values(BODY_ACTOR))]);

/** R2: the ops whose store route has another name. */
/** R25: an op graded as `publish`, read from the declarations: `publish`'s spec and capability, `author` declared. */
const gradedAsPublish = (op) => op !== undefined && NEEDS[op] === "publish" && (OP_STAMPS[op] || []).includes("author")
  && sameSpec(OPS[op], OPS.publish);
const sameSpec = (a, b) => !!a && !!b && a.mutating === b.mutating && a.classes.join() === b.classes.join()
  && JSON.stringify(a.machineClasses) === JSON.stringify(b.machineClasses);
/** R7: the translation family's acts, whose `by` is the bare member id. */
export const TRANSLATION_ACTS = Object.freeze(["translationdraft", "translationgrant", "translationadopt", "translationconfirm",
  "translationrevert", "translationmark"]);
/** R7: the member-roster acts that ask `membership` whether `by` is an administrator, which reads the bare member id. */
export const ADMIN_ASKING_OPS = Object.freeze(["adminremovalsopen", "expertisewithdraw"]);
export const DO_PATH = Object.freeze({ inbox: "inboxlist", publish: "publishcase", inboxpull: "inboxpullfile" });
/** R5: the internal headers a stamped session and an ask's grant travel in (`store-door` R9). */
export const SESSION_HEADER = "x-bio-session";
export const GRANT_HEADER = "x-bio-grant";
/** R23: the ops that present a grant's secret, and those that issue one. */
export const SECRET_PRESENTING_OPS = Object.freeze(["reviewcopy", "reviewcomment", "statementack", "templateread",
                                                    "templatecomments", "templatereview", "templatecomment"]);
const TEMPLATE_DOOR_OPS = Object.freeze(["templateread", "templatecomments", "templatereview", "templatecomment"]);
export const GRANT_ISSUING_OPS = Object.freeze(["reviewgrant", "templatereviewgrant"]);

/* R6: the reads stamped with their caller's sight beside the families; R7: the positional reads (identity N). */
const IDENTITY_READS = Object.freeze(["leadlook", "leadread", "leadshare", "leadlist", "frontier", "projectbarset"]);
const VIEWER_OPS = new Set(["search", "meaningrows", "select", "selection", "selectionlist", "list", "index", "projection", "image",
  "file", "backlinks", "excludedby", "reevaluations", "inquirystrength", "earnedbasis", "content", "contentcrop", "contentaxis",
  "provenancechain", "provenanceroute", "provenanceroutes", "airun", "airunlog", "airunspawn", "airuns", "frontier",
  "versionchain", "versionnotice", "basisversions", "versionstrength", "partitionindependence", "biasmanifest", "biasdebt",
  "biasdebtresolve", "biasadopt", "casedraft", "casedrafts", "suggest", "capturerequest", "capturerequests",
  "capturerequestretry", "reevaluationnotices", "reevaluationchanges", "proposedispose", "contentmint", "extractpropose",
  "extractproposals", "contradictionpropose", "contradictionrecommend", "contradictionpairs", "narrow", "narrowcandidates",
  "connectionchoose", "connectionassert", "connectionsasserted", "filemembershipstore", "filemembership",
  "filemembershipjudge", "actionquotes", "transcribe", "transcriptionattest", "transcription", "attesttext", "leadlook",
  "leadread", "leadshare", "leadlist", "themeplace", "themepropose", "themeread", "themewithdraw", "idmatch",
  "actionlawspropose", "actionriskpropose", "stats", "driveshells", "memberpairings", "monitoring", "monitorslate", "entity",
  "entitybyalias", "publishtensions", "publishpreflight", "inboxpull", "inboxresolve", "dangling", "tasks", "reading",
  "readingref", "readingname", "textprovenance", "textattest", "calibrationdrift", "resolutions", "concerns", "connections",
  "instance", "exceptions", "thread", "discharge", "audit", "searchindexcheck", "projectownerarith", "strengthbarof",
  "projectvisibility", "projectdirectory", "projectparticipants", "projectrequests", "projectstage", "captureaccounts",
  "memberlist", "projectbarset",
  ...EDGE_ACTIONS, ...STATE_ACTIONS, ...ACTION_ACTIONS, ...STRUCTURE_ACTIONS, ...VERSION_ACTIONS, ...QUEUE_ACTIONS,
  ...INTENT_ACTIONS, ...INTENT_READS, ...REEVALUATION_ACTIONS, ...PROJECT_ACTIONS, ...ACTION_LAYER_ACTIONS, ...ACTION_LAYER_READS,
  ...CONTRADICTION_ACTIONS, ...CONTRADICTION_READS, ...SOURCE_READS, ...CAPTURE_VIEWER_ACTIONS, ...CAPTURE_READS,
  ...WHAT_CHANGED_PROPOSAL_ACTIONS, ...WHAT_CHANGED_READS, ...NETWORK_NOTICES_ACTIONS, ...NETWORK_NOTICES_READS,
  ...DOCKET_ACTIONS, ...DOCKET_READS, ...CASE_IMPORT_ACTIONS, ...CASE_IMPORT_READS, ...RUN_VERB_ACTIONS, ...WIZARD_VIEWER_OPS]);
/** R6: every op stamped with its caller's sight, as one list (for tests and for `control-plane`'s census). */
export const VIEWER_STAMPED_OPS = Object.freeze([...VIEWER_OPS]);

/* R11 (D-526): what a promotion is, derived once from the bytes the caller sent: the document's own `object_type` through
   record-grammar's `normalizeType`, the envelope's only where the document states none, as `promote` derives it. */
export function promotedTypeOf(b) {
  const md = Array.isArray(b.files) ? b.files.find((f) => f && f.path === "bundle.md") : null;
  const fm = md && typeof md.text === "string" ? parseFrontmatter(md.text).data : null;
  const said = fm && typeof fm === "object" ? fm.object_type : undefined;
  if (typeof said === "string" && said.trim() !== "") return normalizeType(said);
  return b.meta && typeof b.meta === "object" ? normalizeType(b.meta.object_type) : undefined;
}

const isObject = (b) => !!b && typeof b === "object" && !Array.isArray(b);
const parsed = (text) => { try { return JSON.parse(text); } catch { return undefined; } };

/** R1: the store's request `{url, body, headers}` made from a page's, or `{refusal}` for a project creation the capability
 *  gate refuses (R11). Synchronous; never throws; the same answer for the same arguments. */
export function innerRequest(args = {}) {
  try { return make(args); }
  catch (e) { return { refusal: { status: 500, body: { ok: false, reason: "STORE_REQUEST_FAILED", op: args && args.op } } }; }
}

function make({ op, url, method = "GET", body, caller, source = null, country = null, userAgent = null, origin = null,
                length = null, resolving = false, replay = null, deferred = false, secretSha = null, bySecret = false,
                mint = null }) {
  const page = url instanceof URL ? url : new URL(String(url));
  const c = caller || {};
  const cls = c.cls ?? null;
  const viaSession = c.viaSession === true;
  const aiCred = c.aiCred ?? null;
  const sessMember = viaSession ? c.member : null, sessViewer = viaSession ? c.viewer : null, sessIdentity = viaSession ? c.identity : null;
  const sessRights = viaSession ? (c.rights || {}) : {};
  const sessCaps = viaSession ? c.caps : null;
  const storeName = c.storeName ?? "bio";
  const isAi = cls === "ai" && !!aiCred;
  const C = cls ? `${MACHINE_CLASS_PREFIX}${cls}` : null;
  const aiViewer = isAi ? callerViewer(c, { carry: false }) : null;
  /* the expressions, by letter (the requirements' terms) */
  const M = viaSession ? sessMember : C;
  const T = viaSession ? sessMember : cls ? `${MACHINE_AUTHOR_PREFIX}${cls}` : null;
  const I = viaSession ? sessIdentity : C;
  const A = viaSession ? sessMember : isAi ? `${MACHINE_CLASS_PREFIX}${cls}/${aiCred.tokenId}` : C;
  const AI = viaSession ? sessIdentity : isAi ? `${MACHINE_CLASS_PREFIX}${cls}/${aiCred.tokenId}` : C;
  const P = viaSession ? sessIdentity : isAi ? `${aiCred.principal}/${aiCred.tokenId}` : C;
  const N = viaSession ? sessIdentity : isAi ? aiCred.principal : C;
  const V = viaSession ? sessViewer : isAi ? aiViewer : C;
  const actor = viaSession ? sessViewer : isAi ? `${MACHINE_CLASS_PREFIX}ai/${aiCred.tokenId}` : C;

  /* R2: the route, and every parameter of the page's address but `token` and `op` */
  const inner = new URL("http://x/" + (DO_PATH[op] || op));
  for (const [k, v] of page.searchParams) if (k !== "token" && k !== "op") inner.searchParams.set(k, v);
  const q = inner.searchParams;
  /* a value that is none is not set (R4): a caller that is not admitted (a public op's) carries no expression */
  const put = (k, v) => { if (v !== null && v !== undefined) q.set(k, v); };
  /* R3: nothing the caller names survives in the address: `identity` first, then the rest */
  q.delete("identity");
  for (const k of QUERY_STAMPS) q.delete(k);
  for (const k of ["secretSha", "bySecret"]) q.delete(k);
  const presentsSecret = SECRET_PRESENTING_OPS.includes(op), issuesGrant = GRANT_ISSUING_OPS.includes(op);
  if (presentsSecret || issuesGrant) q.delete("secret");
  if (Object.hasOwn(BODY_ONLY, op)) for (const k of BODY_ONLY[op]) q.delete(k);
  if (ACT_CLOCK_OPS.includes(op)) q.delete("at");
  if (op === "opencaptures") for (const k of ["at", "now"]) q.delete(k);

  /* R4: the declared stamps, from the admitted caller */
  const declared = OP_STAMPS[op] || [];
  const stampOf = { viewer: V, by: actor, author: AI, proposer: A, member: viaSession ? sessViewer : null,
                    session: viaSession ? (c.token ?? null) : null, principal: P, owner: I,
                    source: source ?? null, country: country ?? null };
  /* R5: a stamped session travels in a header, never the address */
  q.delete("session");
  let sessionCarried = null;
  for (const k of declared) if (Object.hasOwn(stampOf, k)) {
    q.delete(k);
    if (k === "session") { sessionCarried = stampOf[k]; continue; }
    if (stampOf[k] !== null && stampOf[k] !== undefined) put(k, stampOf[k]);
  }
  q.delete("grant");

  /* R8, R7: the per-op facts set before the sight stamp */
  if (op === "unpack") {
    put("cls", viaSession ? "member" : cls);
    put("member", viaSession ? "1" : "0");
  }
  if (op === "pagetranscribe" || op === "pdfstructure") {
    put("cls", cls);
    put("session", viaSession ? "1" : "0");
    put("caps", [...(sessCaps || [])].join(","));
    put("viewer", stampOf.viewer);
    put("author", viaSession ? sessMember : actor);
    put("store", storeName);
  }
  if (op === "lease") put("actor", T);
  if (op === "monitorpause") put("actor", M);

  /* R6: a read is stamped with its caller's sight; R7: the positional reads with N */
  if (VIEWER_OPS.has(op) || IDENTITY_READS.includes(op)) {
    put("viewer", V);
    if (IDENTITY_READS.includes(op)) put("identity", N);
  }
  /* R8 */
  if (op === "versionchain") put("address", normalizeAddress(page.searchParams.get("address") || ""));
  /* R7 */
  if (op === "biasadopt") put("author", T);
  /* R8 */
  const administers = (viaSession ? !!sessRights.administer : cls === "admin") ? "1" : "0";
  if (op === "stats") put("capacity", cls === "admin" || (viaSession && sessRights.administer) ? "1" : "0");
  if (op === "memberlist" || op === "memberpairings" || op === "themedeclare" || op === "themeplace" || op === "themepropose"
      || op === "themeread" || op === "themewithdraw") put("administer", administers);
  /* R7 */
  if (QUEUE_ACTIONS.includes(op)) put("member", viaSession ? sessMember : "");
  if (op === "attesttext") put("attestor", M);
  if (op === "transcribe") put("transcriber", M);
  if (op === "transcriptionattest") put("attestor", M);
  if (op === "testify") put("author", M);
  if (op === "lead") put("author", M);
  if (op === "leadlook") put("looker", M);
  if (op === "leadshare") put("sharer", M);
  if (op === "attribute") put("by", M);
  if (op === "themedeclare") put("declarer", M);
  if (op === "themeplace") put("placer", M);
  if (op === "themewithdraw") put("actor", M);
  if (op === "themepropose" || op === "actionlawspropose" || op === "actionriskpropose") put("proposer", A);
  if (PLAN_PROPOSAL_ACTIONS.includes(op)) { put("proposer", A); put("principal", P); }
  if (TEMPLATE_PROPOSAL_ACTIONS.includes(op)) { put("proposer", A); put("author", A); }
  if (QUERY_AUTHOR_ACTIONS.includes(op)) put("author", AI);
  if (CONTRADICTION_ACTIONS.includes(op)) put("author", AI);
  if (op === "contentmint") put("mintedBy", A);
  if (op === "extractpropose" || op === "contradictionpropose" || op === "contradictionrecommend") put("proposedBy", A);
  if (op === "select" || op === "selection" || op === "selectionlist" || op === "selectionrelease"
      || EDGE_ACTIONS.includes(op) || STATE_ACTIONS.includes(op)) put("owner", I);
  if (EDGE_ACTIONS.includes(op) || STATE_ACTIONS.includes(op) || ACTION_ACTIONS.includes(op) || DECLARATION_ACTIONS.includes(op)
      || STRUCTURE_ACTIONS.includes(op) || op === "connectionchoose" || VERSION_ACTIONS.includes(op) || op === "suggest"
      || op === "provenancechain" || op === "provenanceroute" || op === "narrow") put("author", T);
  if (op === "connectionassert" || op === "filemembershipjudge") put("author", T);
  if (op === "projectbarset") put("author", T);
  /* R8 */
  if ((op === "publishpreflight" || gradedAsPublish(op)) && isAi) put("aiCred", JSON.stringify({ tokenId: aiCred.tokenId, principal: aiCred.principal }));
  /* R7, R25 */
  if (op === "publishtensions" || op === "publishpreflight" || gradedAsPublish(op)) put("author", T);
  if (REEVALUATION_ACTIONS.includes(op)) put("author", T);
  if (POSITIONAL_ACTS.includes(op)) put("identity", N);
  if (op === "calibrate") put("identity", N);
  if (PROJECT_ACTIONS.includes(op) || GOVERNANCE_ACTIONS.includes(op) || op === "projectparticipants"
      || op === "projectownerarith" || CUSTODIAL_ACTIONS.includes(op)) put("by", M);
  if (op === "projectrequests") put("by", M);
  if (op === "profilesset") put("by", M);
  if (MEMBERSHIP_ADMIN_ACTS.includes(op)) put("by", M);
  if (op === "handlechange") put("by", M);
  /* R7 (J5): the translations module asks `membership` of the bare member id */
  if (TRANSLATION_ACTS.includes(op)) put("by", M);
  if (op === "translations") put("viewer", M);
  if (ADMIN_ASKING_OPS.includes(op)) put("by", M);
  if (op === "captureupload") put("by", M);
  if (ROSTER_SELF_ACTIONS.includes(op)) put("by", M);
  if (OWN_KEY_ACTIONS.includes(op) || CAPTURE_MEMBER_ACTIONS.includes(op) || SOURCE_ACTIONS.includes(op)) put("by", M);
  if (op === "inboxpull") {
    put("identity", I);
    /* R8: the resolve is the door's re-route, never the caller's */
    q.delete("resolve");
    if (resolving === true) put("resolve", "pulled");
  }
  if (IDENTITY_ACTIONS.includes(op)) {
    put("by", M);
    if (origin !== null && origin !== undefined) put("origin", origin);
  }
  if (RUN_VERB_ACTIONS.includes(op) || RUN_PRODUCTION_ACTIONS.includes(op)) put("principal", P);
  if (op === "capturerequestretry") put("principal", P);
  if (WHAT_CHANGED_PROPOSAL_ACTIONS.includes(op)) { put("proposedBy", A); put("author", A); }
  if (NETWORK_NOTICES_BY.includes(op)) put("by", I);
  if (DOCKET_AUTHOR.includes(op)) put("author", I);
  if (DOCKET_BY.includes(op)) put("by", I);
  if (CASE_IMPORT_ACTIONS.includes(op)) put("by", I);
  if (WIZARD_AUTHOR_ACTIONS.includes(op)) put("author", I);
  if (WIZARD_PROPOSAL_ACTIONS.includes(op)) put("author", A);
  if (RUN_VERB_ACTIONS.includes(op)) { q.delete("actor"); put("actor", viaSession ? sessMember : ""); }
  /* R23: a member's session at a secret-presenting op is stamped as the door stamps it: `viewer` V, and for the template
     doors `author` AI (the form filing-templates asks membership of); a recipient (`bySecret`) and a caller who is no session carry none */
  if (presentsSecret && viaSession && !(bySecret === true && typeof secretSha === "string")) {
    put("viewer", V);
    if (TEMPLATE_DOOR_OPS.includes(op)) put("author", AI);
  }
  /* R8: the door's verdict on a held reading's bound, and the declared length of an upload */
  if (op === "readheld") { q.delete("defer"); if (deferred === true) put("defer", "1"); }
  q.delete("declared");
  if ((op === "captureupload" || op === "captureuploadpart") && Number.isSafeInteger(length) && length >= 0) put("declared", String(length));

  /* R9–R12: the body. Text is read as JSON where a rule needs it; bytes and streams pass as they came. */
  const post = String(method).toUpperCase() === "POST";
  let passBody = body === null ? undefined : body;
  const textual = typeof passBody === "string";
  if (textual && passBody) {
    const b0 = parsed(passBody);
    const strip = [...BODY_STAMPS, "token", "secretSha", "bySecret", ...(presentsSecret || issuesGrant ? ["secret"] : []),
                   ...(presentsSecret ? QUERY_STAMPS : []), ...(BODY_DROPPED[op] ?? []),
                   ...(ACT_CLOCK_OPS.includes(op) ? ["at"] : []),
                   ...(op === "inboxpull" || op === "inboxresolve" ? ["viewer"] : []),
                   ...declared.filter((k) => k === "by" || k === "viewer" || k === "session"
                                             || (k === "member" && SESSION_MEMBER_BODY_OPS.includes(op)))];
    if (isObject(b0) && strip.some((k) => k in b0)) {
      for (const k of strip) delete b0[k];
      passBody = JSON.stringify(b0);
    }
  }
  /* R10 */
  if (declared.includes("bodyBy") && post && (passBody === undefined || textual)) {
    const b = passBody ? parsed(passBody) : {};
    if (isObject(b)) { b.by = actor; passBody = JSON.stringify(b); }
  }
  /* R11: a promotion's body */
  if (op === "promote" && textual && passBody) {
    const b = parsed(passBody);
    if (isObject(b)) {
      const promotedType = promotedTypeOf(b);
      delete b.ownerMemberId;
      delete b.actorMemberId;
      delete b.author;
      if (viaSession) { b.author = sessMember; b.actorMemberId = sessMember; }
      else b.author = T;
      delete b.actorIdentity;
      b.actorIdentity = N;
      delete b.actorViewer;
      b.actorViewer = V;
      delete b.replay;
      delete b.migrationReplay;
      const creatingInquiry = b.base === null && !!b.meta && promotedType === "inquiry";
      const proven = replay && replay.proven ? replay.proven : null;
      if (proven) b.replay = true;
      const replayed = creatingInquiry ? proven : null;
      if (replayed) b.migrationReplay = replayed;
      delete b.memberUserAgent;
      if (viaSession && b.base === null) {
        const agent = (typeof userAgent === "string" ? userAgent : "").trim().slice(0, 512).trimEnd();
        if (agent) b.memberUserAgent = agent;
      }
      delete b.assistantPrincipal;
      if (!viaSession) b.assistantPrincipal = isAi ? `${aiCred.principal}/${aiCred.tokenId}` : C;
      if (replayed) delete b.assistantPrincipal;
      const saidWarningSeen = b.personWarningSeen === true;
      delete b.setIn;
      delete b.personWarningSeen;
      const context = String(page.searchParams.get("project") ?? (typeof b.project === "string" ? b.project : "")).trim().slice(0, 200);
      if (context) b.setIn = context;
      if (viaSession && saidWarningSeen) b.personWarningSeen = true;
      if (b.base === null && b.meta && promotedType === "project" && viaSession) {
        const creation = projectCreationGate(sessCaps);
        if (creation) return { refusal: creation };
        b.ownerMemberId = sessMember;
      }
      if (b.base === null && b.meta && !replayed && promotedType === "inquiry" && Array.isArray(b.files)) {
        const bm = b.files.find((f) => f && f.path === "bundle.md" && typeof f.text === "string");
        if (bm) {
          const want = viaSession ? "human" : "agent";
          const lines = bm.text.split("\n");
          const end = lines.indexOf("---", 1);
          let changed = false;
          for (let i = 1; i < (end === -1 ? lines.length : end); i++) {
            if (lines[i].startsWith("surfaced_by:")) { lines[i] = "surfaced_by: " + want; changed = true; break; }
          }
          const sentSha = createSha256().update(new TextEncoder().encode(bm.text)).hex();
          const sentOk = bm.sha256 === undefined || bm.sha256 === null
            || (typeof bm.sha256 === "string" && bm.sha256.toLowerCase() === sentSha);
          if (changed && sentOk) {
            bm.text = lines.join("\n");
            const bytes = new TextEncoder().encode(bm.text);
            bm.bytes = bytes.length;
            bm.sha256 = createSha256().update(bytes).hex();
          }
        }
      }
      passBody = JSON.stringify(b);
    }
  }
  /* R12: the actor in the body, per op */
  const stampBody = (when, set) => {
    if (!when) return;
    const emptyAllowed = post && (passBody === undefined || passBody === "");
    if (!(textual && passBody) && !emptyAllowed) return;
    const b = passBody ? parsed(passBody) : {};
    if (isObject(b)) { set(b); passBody = JSON.stringify(b); }
  };
  const stampPresent = (when, set) => {
    if (!when || !(textual && passBody)) return;
    const b = parsed(passBody);
    if (isObject(b)) { set(b); passBody = JSON.stringify(b); }
  };
  stampPresent(op === "expertisedeclare", (b) => { b.memberId = M; });
  stampPresent(op === "expertiseconfirm", (b) => { b.by = M; });
  stampPresent(op === "entitycreate" || op === "entityalias" || op === "relationdeclare", (b) => { b.declaredBy = M; });
  stampPresent(op === "aliaswithdraw" || op === "relationwithdraw", (b) => { b.withdrawnBy = M; });
  stampBody(op === "resolutiondefect" && post, (b) => { b.by = M; });
  stampPresent(op === "resolve" || op === "resolvetestify", (b) => { b.resolvedBy = M; });
  stampPresent(op === "progressiondefine", (b) => { b.declaredBy = M; });
  stampPresent(op === "connect", (b) => { b.assertedBy = "system"; });
  stampPresent(op === "thread", (b) => { b.threadedBy = M; });
  stampPresent(op === "discharge", (b) => { b.declaredBy = M; });
  stampPresent(op === "proposedispose", (b) => { b.decidedBy = M; });
  stampBody(INTENT_ACTIONS.includes(op) && post, (b) => {
    b.author = AI;
    if (op === "triage") {
      delete b.assistantPrincipal;
      if (!viaSession) b.assistantPrincipal = isAi ? `${aiCred.principal}/${aiCred.tokenId}` : C;
    }
  });
  stampBody((STANDARDS_ACTIONS.includes(op) || Object.hasOwn(BODY_ACTOR, op)) && post, (b) => {
    for (const k of ["author", "proposer", ...BODY_ACTOR_KEYS]) delete b[k];
    b[Object.hasOwn(BODY_ACTOR, op) ? BODY_ACTOR[op] : op === "standardpropose" ? "proposer" : "author"] = AI;
  });
  stampBody(LOCAL_FACTS_ACTIONS.includes(op) && post, (b) => {
    /* `source` is the correction's own argument (local-facts' `factconfirm` reads it from the body), never a stamp there */
    for (const k of QUERY_STAMPS) if (k !== "source") delete b[k];
    b.by = AI;
  });
  stampPresent(op === "inboxresolve", (b) => { b.by = T; });
  /* R13: `taskdecide` takes the others' body stamp of `actor` */
  stampPresent(op === "taskforward" || op === "taskresolve" || op === "taskdrain" || op === "taskdecide" || op === "biasdebtresolve",
               (b) => { b.actor = T; });
  /* R7: who acted, set after the body (as the door set them) */
  if (op === "aicredentialrevoke") put("who", T);
  if (op === "instancegroupseed") put("author", T);
  if (op === "casedraft" || op === "reviewgrant" || op === "reviewrevoke") { put("author", T); q.delete("secretSha"); }

  /* R23: a grant's digest crosses in the body */
  if (op === "aicredentialmint") {
    put("who", T);
    const asked = textual && passBody ? parsed(passBody) : {};
    const m = isObject(mint) ? mint : {};
    passBody = JSON.stringify({ ...(isObject(asked) ? asked : {}), writes: m.writes, confinedTo: m.confinedTo, secretSha: m.secretSha });
  }
  if (GRANT_ISSUING_OPS.includes(op) && typeof secretSha === "string") {
    if (passBody === undefined || passBody === "") passBody = JSON.stringify({ secretSha });
    else if (textual) { const b = parsed(passBody); if (isObject(b)) passBody = JSON.stringify({ ...b, secretSha }); }
  }
  if (SECRET_PRESENTING_OPS.includes(op) && bySecret === true && typeof secretSha === "string") {
    put("bySecret", "1");
    const b = textual && passBody ? parsed(passBody) : undefined;
    passBody = JSON.stringify({ ...(isObject(b) ? b : {}), secretSha });
  }

  /* R5: the credentials, in headers */
  const headers = {};
  if (sessionCarried) headers[SESSION_HEADER] = sessionCarried;
  if (aiCred && aiCred.grant) headers[GRANT_HEADER] = aiCred.grant;
  const answer = { url: inner.toString(), headers };
  if (passBody !== undefined) answer.body = passBody;
  return answer;
}
