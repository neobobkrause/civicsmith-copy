/* store-assembly R86–R89 (were control-plane R71, R72, R117, R118; T41; N820; K2560, K2569, K2570, K2458; K5046 (a)): THE OWNER
   MAP, for the ops `op-declarations` R43 and R45 declare whose owners export a service and no arm for it, copied from
   `control-plane/owner-ops.mjs` (K624: by copy, then delete). Each arm calls the owner's exported service by name,
   holds no behaviour of its own (a refusal is the owner's, answered as given), and reads its stamps AFTER the body, so a
   body's copy of `by`, `viewer` or `principal` never wins (`control-plane` R29; the door also deletes any the caller sent,
   `store-request` R3).

   The assembly spreads this map into its route map (R6, R89) beside the owners' own, handing it each owner's one instance through
   `of`, a set of getters (`of.aiUse()`, `of.aiRuns()`, `of.caseAccount()`, `of.review()`, `of.legEarning()`,
   `of.capture()`, `of.steps()`, `of.investigation()`, `of.questionExplorer()`, since T47 `of.actionClocks()` and since T51 `of.filings()`, `of.actionPlans()`, `of.extraction()` (R117) and `of.projectRoster()` (R118)), each asked only when its op is served. */

import { localize } from "../setup-words/index.mjs";
import { byteLedger } from "../byte-ledger.mjs";

/* store-assembly R85 (was control-plane R112; K4206, K4210; op-declarations R80, op-grades R49): the ops this map serves and no
   owner declares, declared here beside the map. THE COPY WINDOW (K5052 (4)): while `control-plane` still declares them, they are
   exported under this name and not as `DECLARED_OPS`, so no op is declared twice; `declarations.mjs` registers them under
   `store-assembly`, and Wave B, which deletes control-plane's copy, names this export `DECLARED_OPS`. Each row's classes,
   machineClasses, mutating, stamps and needs are the hand rows' (`op-declarations` and `control-plane`'s stamps); its weight is the grade's ground or rung, its description the grade's
   sentence as a word key; its fields are what the arm reads (accepts) and what a refusal names when absent (requires). */
export const OWNER_MAP_DECLARED_OPS = Object.freeze({
  captureupload: { classes: ["admin", "member"], machineClasses: [], mutating: true, stamps: ["viewer", "by"], needs: "contribute",
    weight: "undetermined", description: localize("control-plane.declared.captureupload", "upload-directed: a member's bytes held as a capture under their digest, in her own name, with its receipt; reached from the upload, never beside a bundle"),
    fields: { accepts: ["statement", "name", "type", "step"], requires: ["statement"] } },
  accountdrafts: { classes: ["admin", "member"], machineClasses: [], mutating: false, stamps: ["viewer"], needs: null,
    weight: "read", description: localize("control-plane.declared.accountdrafts", "read: a case's drafts of its account, each labeled machine work; writes nothing"),
    fields: { accepts: ["case"], requires: ["case"] } },
  accountpropose: { classes: ["admin", "member"], machineClasses: [], mutating: true, stamps: ["viewer", "by"], needs: "contribute",
    weight: "undetermined", description: localize("control-plane.declared.accountpropose", "case-directed: keyed by a case, reached from its account; the system's draft of the account, labeled machine work, never the published account until a member writes it"),
    fields: { accepts: ["case", "kind", "framing", "text", "flags", "run"], requires: ["case", "framing", "text", "run"] } },
  clockpropose: { classes: ["admin", "member", "probe"], mutating: true, stamps: ["viewer", "proposer"], needs: "contribute",
    weight: "reversible", description: localize("control-plane.declared.clockpropose", "action-directed: keyed by (action, rule, proposer); a proposal stored apart, never a clock entry until a member adopts it"),
    fields: { accepts: ["target", "rule"], requires: ["target", "rule"] } },
});

/* The `by` stamp is the actor in the viewer's form (`member:<id>`, the founder's `admin`, a machine `class:<cls>`); the
   owners that compare a bare member id with their roster are handed the bare id, and a machine stamp unchanged, so the
   owner refuses it by name. */
const bare = (by) => (typeof by === "string" && by.startsWith("member:") ? by.slice("member:".length) : by ?? null);
/* steps, investigation and question-explorer ask membership's `positionalMember` of their actor, so the founder's
   session (`admin` in the viewer's form) is handed as its positional identity, `member:admin`. */
const positional = (by) => (by === "admin" ? "member:admin" : by ?? null);
/* the request's length as the door declares it in the address (`declared`, from Content-Length): a whole number or nothing */
const declaredOf = (q) => {
  const d = q("declared");
  return typeof d === "string" && /^[0-9]{1,15}$/.test(d) ? { declared: Number(d) } : {};
};
/* only the fields an act names cross from the body: a machine arm's `run` or a caller's `at` never does */
const pick = (b, keys) => Object.fromEntries(keys.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));

export function ownerOps(of, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  /* a field the caller may send in the address or the body, the body's first */
  const f = (k) => (b[k] !== undefined ? b[k] : q(k));
  return {
    /* ai-use R10, R11 (K2569): an estimate and an actual, answered only to the paying account's owners. */
    aiestimate: () => of.aiUse().estimate({ owner: f("owner"), use: f("use"), mode: f("mode"),
                                            count: b.count !== undefined ? b.count : q("count") === null ? undefined : Number(q("count")),
                                            viewer: q("viewer") }),
    aiactual: () => of.aiUse().actualOf({ run: f("run"), act: f("act"), viewer: q("viewer") }),
    /* ai-runs R74, R73 (K2569): a batch of runs over steps, opened as `airunopen` is (the run's principal, its actor and
       viewer the door's), and the group's test bar's set and read. */
    stepsrunai: () => of.aiRuns().openMany({ ...b, principalPlane: q("principal") ?? q("by"), actor: q("by"), viewer: q("viewer") }),
    grouptestset: () => of.aiRuns().groupTestSet({ ...b, by: q("by") }),
    grouptestresults: () => of.aiRuns().groupTestResults({ part: f("part"), viewer: q("viewer") }),
    /* case-account R1, R3 (R71; T42, N839, K2656): a proposed account of a case, labelled with its proposer as
       `whatchangedpropose`'s are, asked of `case-account` itself, never through `case-authoring`'s pass-through. */
    accountpropose: () => of.caseAccount().accountPropose({ ...b, proposedBy: bare(q("by")), viewer: q("viewer") }),
    accountdrafts: () => of.caseAccount().accountDrafts({ case: f("case"), viewer: q("viewer") }),
    /* review R30, R31, R33 (K2529): the approval rule, an approval, and the comments on a case (`draft` optional). */
    approvalruleset: () => of.review().approvalRuleSet({ approvers: b.approvers, by: bare(q("by")) }),
    caseapprove: () => of.review().caseApprove({ case: f("case"), edition: f("edition"), docSha: f("docSha"),
                                                 reason: f("reason"), by: bare(q("by")) }),
    reviewcomments: () => of.review().reviewCommentsFor({ case: f("case"), edition: f("edition"), viewer: q("viewer"),
                                                          draft: f("draft") ?? null,
                                                          limit: f("limit") === null || f("limit") === undefined ? null : Number(f("limit")) }),
    /* action-clocks R2 (T47; K3145, R79): a clock proposed for an action under a profile's rule. Any credential may
       propose (op-declarations' `proposal` posture), so `proposer` is the door's label stamp and `viewer` its sight;
       `action-clocks` exports the service and no arm, so this one calls it by name. */
    clockpropose: () => of.actionClocks().clockPropose({ target: f("target"), rule: f("rule"), proposer: q("proposer"),
                                                         viewer: q("viewer") }),
    /* R110 (T51; K4073; screens-action R30): the two reads whose owners export a service and no arm. `approvedunsent` is
       filings' `approvedUnsent` (its R53) as the viewer may see; `checkpointsdue` is action-plans' `checkpointsDue` (its R17),
       whose instant is the owner's clock, never the request's, and only `limit` comes from the address or the body. */
    approvedunsent: () => of.filings().approvedUnsent({ viewer: q("viewer") }),
    checkpointsdue: () => of.actionPlans().checkpointsDue(
      f("limit") === undefined || f("limit") === null ? {} : { limit: Number(f("limit")) }),
    /* leg-earning R14 (K2569): the projects a question is shown on, as the viewer may see them. */
    projectsshownon: () => of.legEarning().projectsShownOn({ id: f("id"), viewer: q("viewer") }),

    /* capture R86 (R72; K2458): a member's upload, the request's raw body handed on as `bytes` (a stream, never read
       here), its words from the address, `by` the door's. Capture's own map holds no arm for it, so this one calls its
       service by name, as R71's do. R100 (R085-4): the media type the browser declared, `type`, travels from the address
       as capture R92 takes it, and only when the request names one. No `within` (T42; K2631, K2656): capture R86's `within` is a function an in-process
       caller hands, never a request's field, so one in the address reaches nothing. */
    captureupload: () => of.capture().uploadCapture({ bytes: body, statement: q("statement"), name: q("name"), by: q("by"),
                                                                   ...(q("type") !== null ? { type: q("type") } : {}), ...declaredOf(q), ledger: byteLedger() }),
    /* R72 (capture R113; K4891, K4899): a file past the request-body ceiling sent in parts, the four arms capture declares. Each calls
       capture's method by name, `by` the door's (a body's copy never wins), `captureuploadpart`'s body the part's raw bytes, unread,
       its words in the address, and `declared` the request's length, set by the door from Content-Length (only a whole number). */
    captureuploadbegin: () => of.capture().beginPartedUpload({ sha256: b.sha256, bytes: b.bytes, statement: b.statement, name: b.name, type: b.type,
                                                               by: q("by") ?? undefined }),
    captureuploadpart: () => of.capture().putUploadPart({ upload: q("upload"), index: q("index") === null || q("index") === "" ? null : Number(q("index")),
                                                          sha256: q("sha256"), bytes: body, by: q("by") ?? undefined, ...declaredOf(q), ledger: byteLedger() }),
    captureuploadcomplete: () => of.capture().completePartedUpload({ upload: b.upload, parts: b.parts, by: q("by") ?? undefined }),
    captureuploadabort: () => of.capture().abortPartedUpload({ upload: b.upload ?? q("upload"), by: q("by") ?? undefined }),
    /* R117 (fix round 3, C5, C17; extraction R80): STORE-INTERNAL, no spec, so no caller reaches it (R2): the door asks extraction to
       read a home that has no reading once its bytes are held whole. The act is extraction's in-process `readHeld`, answered as
       it answers (`{ok, read, why?}`); `sha` and `store` are the door's, from the capture's answer and the namespace it landed in.
       The arm exists once the plane hands the getter `of.extraction` (a door without it routes no `readheldfor`). */
    ...(typeof of?.extraction === "function" ? {
      /* named apart from extraction's member op `readheld` (R80 as amended), which is the one the plane serves under that name */
      readheldfor: () => of.extraction().readHeld({ sha: q("sha"), storeName: q("store") || "bio" }) } : {}),
    /* R118 (fix round 3, C14, P2.2; project-roster R42, review R43): `projectlist` is project-roster's read, handed the reader of
       the drafts shared for review, review's `sharedDraftsByProject({projectIds, viewer})`, as its `sharedDraftsOf`; project-roster
       calls it once for the page's projects. It replaces the roster's own arm (the one that reads `env.sharedDraftsOf`, which the
       door never holds), with the same request fields. Present once the plane hands the getter `of.projectRoster`. */
    ...(typeof of?.projectRoster === "function" ? {
      projectlist: () => of.projectRoster().projectList({ viewer: q("viewer"), limit: q("limit"), after: q("after"),
        sharedDraftsOf: (asked) => of.review().sharedDraftsByProject(asked) }) } : {}),
    /* R71 (steps R9): STORE-INTERNAL, no spec, so no caller reaches it (R2): the door ties a member's landed capture to
       the step she named, `recordProduct` asked only for a step she may see; one she may not is answered as steps
       answers an unseen step. */
    capturestepproduct: () => {
      const s = of.steps(), seen = s.step({ step: b.step, viewer: q("viewer") });
      if (!seen || seen.ok !== true) return seen;
      return s.recordProduct({ step: b.step, record: { kind: "capture", id: b.capture }, by: positional(q("by")) });
    },

    /* steps R1–R24 (K2560, K2570): a step's acts, `by` the door's; its reads, `viewer` the door's. */
    ...acts(() => of.steps(), {
      stepcreate: ["stepCreate", ["place", "work", "byWhen", "project"]],
      stepstart: ["stepStart", ["step"]],
      stepend: ["stepEnd", ["step", "end", "outcomes", "learned", "reason"]],
      stepdelete: ["stepDelete", ["step", "question"]],
      steprefer: ["stepRefer", ["step", "question"]],
      stepproduct: ["stepProduct", ["step", "record"]],
      stepwait: ["stepWait", ["step", "on"]],
      stepwaitremove: ["stepWaitRemove", ["wait"]],
      stepreminder: ["stepReminder", ["step", "at"]],
      stepcostadd: ["stepCostAdd", ["step", "kind", "amount", "currency", "what"]],
      stepcostremove: ["stepCostRemove", ["cost"]],
      costmessage: ["costMessage", ["step", "text"]],
      questionfollow: ["questionFollow", ["question", "on"]],
      stepaccept: ["stepAccept", ["proposal", "form", "work", "project", "reason"]],
      stepoutcome: ["stepOutcome", ["step", "question", "outcome"]],
      steplearn: ["stepLearn", ["step", "text"]],
      stepbywhen: ["stepByWhen", ["step", "byWhen"]],
    }, b, q),
    ...reads(() => of.steps(), {
      stepslike: ["stepsLike", ["work", "questions", "limit"]],
      stepproposals: ["stepProposals", ["after", "limit"]],
      costmessages: ["costMessages", []],
      questionfollowstate: ["following", ["question"]],
      stepproducts: ["productsOf", ["step"]],
      recordsteps: ["stepsOf", ["record"]],   /* the instance's method, not the factory */
    }, f, q),
    /* `steps`: one step by its id, else the steps on a question, in a project, or the group's */
    steps: () => {
      const s = of.steps(), viewer = q("viewer"), page = { state: f("state"), after: f("after"), limit: f("limit") };
      if (f("step")) return s.step({ step: f("step"), viewer });
      if (f("question")) return s.stepsOn({ question: f("question"), viewer, ...page });
      if (f("project")) return s.stepsIn({ project: f("project"), viewer, ...page });
      return s.stepsOfGroup({ viewer, ...page });
    },

    /* investigation R1–R20 (K2560): its acts and reads; `milestonereminder`'s `at` is the body's calendar day,
       untouched; `milestonerevise` hands on only the fields the body names. */
    ...acts(() => of.investigation(), {
      milestoneset: ["milestoneSet", ["project", "name", "date", "waitsOn"]],
      milestonerevise: ["milestoneRevise", ["milestone", "name", "date", "waitsOn"]],
      milestoneremove: ["milestoneRemove", ["milestone", "reason"]],
      milestoneitemremove: ["milestoneItemRemove", ["milestone", "item", "reason"]],
      milestonereminder: ["milestoneReminder", ["milestone", "at"]],
      reportkeep: ["reportKeep", ["project", "question", "text", "since", "corrects"]],
      interviewkeep: ["interviewKeep", ["project", "answers", "from_draft"]],
      narrativeclaim: ["narrativeClaim", ["project", "source", "text", "about"]],
      claimfindstep: ["claimFindStep", ["claim", "question"]],
      claimfound: ["claimFound", ["claim", "record", "step"]],
      planaccept: ["planAccept", ["proposal", "form", "text", "reason"]],
      projectwatch: ["projectWatch", ["project"]],
      projectclosewithgaps: ["projectCloseWithGaps", ["project", "reason", "note"]],
    }, b, q),
    ...reads(() => of.investigation(), {
      milestones: ["milestonesOf", ["project"]],
      reportdraft: ["reportDraft", ["project", "question"]],
      reports: ["reportsOf", ["project"]],
      interview: ["interviewOf", ["project"]],
      interviewform: ["interviewForm", ["project"]],
      claims: ["claimsOf", ["project"]],
      investigationproposals: ["planProposals", ["project"]],
      quietstate: ["quietState", ["project"]],
      projectstanding: ["projectStanding", ["project"]],
    }, f, q),

    /* question-explorer R6 (K2570): a find taken up or muted by the member it was offered to; its doors read by her
       sight, a find not offered to her answered as absent, in the owner's own words (EXPLORE_NO_SUCH_FIND). */
    ...acts(() => of.questionExplorer(), {
      findaccept: ["findAccept", ["find", "question", "form", "edit"]],
      findmute: ["findMute", ["find", "question"]],
    }, b, q),
    finddoors: () => {
      const e = of.questionExplorer(), find = f("find"), question = f("question");
      const doors = e.findDoors({ find, question, viewer: q("viewer") });
      return doors ?? e.findMute({ find, question, by: null });
    },
  };
}

/* An act: the named fields from the body, then `by`, the door's, as the owner's positional identity. */
function acts(owner, table, b, q) {
  return Object.fromEntries(Object.entries(table).map(([op, [method, keys]]) =>
    [op, () => owner()[method]({ ...pick(b, keys), by: positional(q("by")) })]));
}
/* A read: the named fields from the address or the body, then `viewer`, the door's. */
function reads(owner, table, f, q) {
  return Object.fromEntries(Object.entries(table).map(([op, [method, keys]]) =>
    [op, () => owner()[method]({ ...Object.fromEntries(keys.map((k) => [k, f(k)]).filter(([, v]) => v !== undefined && v !== null)),
                                 viewer: q("viewer") })]));
}
