/* queue's catalogue (R1–R5): `queuestate.mjs`, pure, driven at its interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classOfKind, catalogueIdOf, itemClassOf, suppressedBy, mutedAsItem, serializeMutedKinds, parseMutedKinds,
  QUEUE_CONDITION_KINDS, QUEUE_OBLIGATION_KINDS, QUEUE_FINDING_KINDS,
} from "../../../src/queuestate.mjs";
import { CONDITION_KINDS } from "../../../src/observation-log/vocabulary.mjs";
import { NOTICE_KINDS } from "../../../src/notice-producers/index.mjs";
import { QueueProducers } from "../../../src/queue-producers/index.mjs";

/* R1's seventeen, N345's two duties among them (DEC-85's unseen one included), N375's self-registered key, the Action
   layer's three (K608, K614), the litigation hold (K899 (7)), K921's review request and local fact, the unchosen
   credit level (queue-producers R23, DEC-102 item 3) and the docket's core item (queue-producers R30, DEC-116 item 2). */
const OBLIGATION = ["authority-undetermined", "bias-debt", "endorsement-owed", "expertise-confirmation-owed",
  "membership-request", "project-owners-inactive", "contradiction-duty", "contradiction-duty-unseen",
  "signer-self-registered", "plan-checkpoint-due", "escalation-stage-proposed", "action-reminder", "litigation-hold",
  "template-review-requested", "local-fact-due", "attribution-unchosen", "docket-core-due",
  /* T31 (queue-producers R33, DEC-121 (1)) */
  "wizard-approval-requested",
  /* T33-83 (notice-producers R6; K1505 (15), K1594 (3)) */
  "inquiry-recheck-due",
  /* T34-53 (tasks R14; DEC-135 (2)) */
  "check-requested",
  /* T41 (notice-producers R17; N820, K2418, K2484) */
  "step-date-due", "step-reminder", "milestone-reminder",
  /* T45 (action-producers R10, R12; N855, N890) */
  "watch-keep-or-stop", "plan-review-due", "plan-look-again",
  /* T48 (R54; N1047, DEC-226 (1)) */
  "update-ready",
  /* T50 (R57; N1091, N1204; queue-producers R41, R42) */
  "project-invitation", "project-request", "project-leave",
  /* T53 (R1; K5480, K5478): re-testing turned off, and an AI account stopped for an unpaid gateway call */
  "retesting-off", "ai-credits-stop"];
/* R1's twenty-nine, `cardinality_exceeded` (N107, K209), `newer-capture-affects-reference` (N172), N345's five, the two
   docket kinds (queue-producers R31, DEC-116 items 3, 7) and the released hold (queue-producers R29, DEC-113) among
   them. */
const FINDING = ["missing_predecessor", "overdue_successor", "temporal-expectation-due", "source-modified",
  "source-removed", "duplicate-document", "link-verdict-changed", "reused-asset-changed", "assistant-surfaced-focus",
  "grade-improvable", "objective-gap", "measure-decay", "export-performed", "audit-finding", "register-unbacked",
  "out-of-inquiry-lead", "stance-changed-here-not-elsewhere", "new-version-arrived-from-another-team",
  "shared-inquiry-concluded-by-another-project", "cardinality_exceeded", "newer-capture-affects-reference",
  "contradiction-plurality-unseen", "contradiction-lead", "contradiction-plurality", "side-corrected",
  "tension-after-publication", "edition-withdrawn", "edition-contested", "litigation-hold-released",
  /* T31 (queue-producers R32, R34, R35; DEC-121 (5), DEC-101 (3), DEC-116 item 8) */
  "wizard-withdrawn", "wizard-restored", "cited-newer-edition", "cited-edition-withdrawn", "followed-case-entry",
  "cited-docket-entry-refused",
  /* T33-83 (notice-producers R2, R3, R4; K1491, K1481) */
  "interest-check-noticed", "money-detector-noticed", "standing-answer",
  /* T36-46 (notice-producers R12–R15; DEC-165 (7), DEC-145 (5), DEC-169 (4), K1929) */
  "security-level-high", "policy-changed-noticed", "scan-found", "security-tool-off",
  /* T40 (notice-producers R16; N812, K2376 (2)) */
  "explore-ask", "ai-limit-reached", "project-account-suspended",
  /* T41 (notice-producers R17; N820, K2418, K2484) */
  "question-find", "step-later-found", "milestone-overdue", "project-quiet", "step-cost-shared", "step-cost-message",
  "review-comment-left-out",
  /* T45 (action-producers R9; N881) */
  "member-left-items",
  /* T50 (R57; N1204; notice-producers R24) */
  "watched-changed",
  /* T51 fix round 7 (G61; notice-producers R27, R28; K4562): a finished background fetch and a finished or stopped ingest;
     queue-producers R37 (the scheduled edition's findings) and R39 (`wizard-base-updated`) */
  "fetch-done", "ingest-done", "ingest-stopped", "edition-published-as-scheduled", "scheduled-edition-stopped",
  "wizard-base-updated",
  /* T51 fix round 9 (G135f; K4933; notice-producers R29): a reading of a supplied document ended */
  "reading-ended",
  /* T53 (R98; N1259; notice-producers R30, R31): a register watch's change, and an import's end */
  "register-changed-noticed", "register-import-done", "register-import-stopped", "register-import-failed",
  // layer 11 reopen (notice-producers R33-R36): the AI accounts' and the mail door's notices
  "ai-threshold-reached", "ai-terms-notice", "ai-account-left-list", "ai-account-left-project-list", "ai-signin-ended",
  "mail-cleared"];
/* observation-log's twenty (R5): its twelve, the five sweep kinds (link-sweep R11, queue-producers R26) and the three
   notice kinds (network-notices R12, R13, queue-producers R27) its R33 added in T23 (K1099); and the overdue action
   clock (K611). */
const SWEEP_CONDITION = ["sweep-held-backlog", "sweep-yield-anomaly", "sweep-seed-unreachable",
  "sweep-redirect-out-of-scope", "sweep-silent"];
const NOTICE_CONDITION = ["notice-attestation-missed", "notice-lapse-near", "notice-project-closed"];
const LOOK_CONDITION = ["monitoring-recheck-due", "archive-fallback-eligible", "capture-session-ttl-expiring",
  "source-unreachable-governed", "capture-completed-unattended", "partial-capture-outstanding", "text-undetermined",
  "client-rendered-shell", "invitation-spent-or-expired", "governor-holding-host", "runtime-ceiling-reached",
  "render-deferred", ...SWEEP_CONDITION, ...NOTICE_CONDITION];
/* Beside them, the conditions no look carries: the overdue action clock (K611) and the unreadable followed docket
   (queue-producers R35, T31; the reading J1 asks BOB to fold into R5). */
const QUEUE_ONLY_CONDITION = ["action-clock-overdue", "cited-docket-unreadable",
  /* T51 fix round 7 (G61): queue-producers R37 (a waiting scheduled edition), R38 (an arrived place profile) and
     action-producers R25 (a request approved and left unsent) */
  "edition-scheduled", "place-profile-arrived", "request-unsent"];
const CONDITION = [...LOOK_CONDITION, ...QUEUE_ONLY_CONDITION];
/* What each of the eight says, as R1 states it: the sentence is observation-log's, and it says this. */
const NEW_CONDITION_SAYS = {
  "sweep-held-backlog": /sweep is held: its backlog .* is at or over its ceiling, so it does not run/,
  "sweep-yield-anomaly": /sweep's last run .* filed far more than, or nothing against, the median of its recent runs/,
  "sweep-seed-unreachable": /seed of a monitoring sweep failed on the sweep's last run/,
  "sweep-redirect-out-of-scope": /sweep's last run met a redirect to an address outside the sweep's scope/,
  "sweep-silent": /sweep is silent: its last four runs each filed nothing/,
  "notice-attestation-missed": /monthly attestation of a project's working-on notice was missed for want of an instance key/,
  "notice-lapse-near": /working-on notice will lapse within 7 days/,
  "notice-project-closed": /project closed while its working-on notice was open/,
};
const sorted = (a) => [...a].sort();

test("R1: every catalogued kind answers its class, anything else null, and every kind has its sentence", () => {
  for (const k of OBLIGATION) assert.equal(classOfKind(k), "OBLIGATION", k);
  for (const k of FINDING) assert.equal(classOfKind(k), "FINDING", k);
  for (const k of CONDITION) assert.equal(classOfKind(k), "CONDITION", k);
  // the catalogue is exactly these: nothing else is classed
  assert.deepEqual(sorted(Object.keys(QUEUE_OBLIGATION_KINDS)), sorted(OBLIGATION));
  assert.deepEqual(sorted(Object.keys(QUEUE_FINDING_KINDS)), sorted(FINDING));
  assert.deepEqual(sorted(Object.keys(QUEUE_CONDITION_KINDS)), sorted(CONDITION));
  for (const v of [undefined, null, "", 7, {}, [], true, "no-such-kind", "N-1", "FINDING", "toString", "__proto__",
                   "hasOwnProperty", " bias-debt", "BIAS-DEBT"])
    assert.equal(classOfKind(v), null, String(v));
  for (const vocab of [QUEUE_OBLIGATION_KINDS, QUEUE_FINDING_KINDS, QUEUE_CONDITION_KINDS])
    for (const [k, s] of Object.entries(vocab)) assert.ok(typeof s === "string" && s.trim().length > 0, k);
  // N375: the self-registered key is an OBLIGATION whose sentence says what happened and what may be done
  assert.match(QUEUE_OBLIGATION_KINDS["signer-self-registered"], /registered their own signing key; you may revoke it/);
  // the Action layer's kinds (K608, K611, K614): each sentence says what came and what a member does about it
  assert.match(QUEUE_OBLIGATION_KINDS["plan-checkpoint-due"], /checkpoint your team set in an action plan has come; a member judges whether its condition was met/);
  assert.match(QUEUE_OBLIGATION_KINDS["escalation-stage-proposed"], /next stage is proposed because its trigger was met; a member advances it or declines with a reason/);
  assert.match(QUEUE_OBLIGATION_KINDS["action-reminder"], /reminder you asked for on one of the team's action deadlines; answer it with another reminder or none/);
  // K899 (7), DEC-61: the litigation hold says what was marked and what a member records; DEC-113: the release is its own act
  assert.match(QUEUE_OBLIGATION_KINDS["litigation-hold"], /a reply the team marked as legal pressure: consider whether to place a litigation hold, and record it in place or released with a reason/);
  assert.match(QUEUE_OBLIGATION_KINDS["litigation-hold"], /op=actionhold to place it, op=actionholdrelease to release it/);
  // T27 (N518, N520): the released hold, the docket's core item and the two edition kinds, each with R1's sentence
  assert.match(QUEUE_FINDING_KINDS["litigation-hold-released"], /a member released a litigation hold: the projects it alone covered may be purged again and their assistant transcripts deleted on schedule/);
  assert.match(QUEUE_OBLIGATION_KINDS["docket-core-due"], /a case you manage has an item its docket must list: a response or statement from its subject or a holder of standing, a newer edition, or a conflict on a load-bearing finding not disclosed; place it, or decline it/);
  assert.match(QUEUE_FINDING_KINDS["edition-withdrawn"], /something a finding rests on is in a case edition its team has withdrawn/);
  assert.match(QUEUE_FINDING_KINDS["edition-contested"], /a response the team filed contests a case edition this finding is part of/);
  // negative control: near-misses of the T27 kinds are outside the vocabulary
  for (const v of ["litigation-hold-release", "hold-released", "docket-core", "docket-core-due ", "edition-withdrawal",
                   "edition-contest", "EDITION-WITHDRAWN", "FINDING::edition-withdrawn"])
    assert.equal(classOfKind(v), null, v);
  // K921: the review request and the local fact say what is owed, each with its own door
  assert.match(QUEUE_OBLIGATION_KINDS["template-review-requested"], /a member asked you to review a filing template's version/);
  assert.match(QUEUE_OBLIGATION_KINDS["local-fact-due"], /a holiday calendar or office hours one of the team's deadlines reads is unconfirmed or due for confirmation/);
  // DEC-135 (2): the check request says who asked, by what, on what, and the member's two answers
  assert.match(QUEUE_OBLIGATION_KINDS["check-requested"], /a project owner asked for a check, by an expertise you declared or by name, on something you can see; take it \(op=checktake\), or leave it/);
  for (const v of ["check-request", "check-requested ", "CHECK-REQUESTED", "check_requested", "OBLIGATION::check-requested"])
    assert.equal(classOfKind(v), null, v);
  // DEC-102 item 3: the unchosen credit level says what the edition reaches and what the member does
  assert.match(QUEUE_OBLIGATION_KINDS["attribution-unchosen"], /a case edition being prepared reaches an observation you authored and you have chosen no credit level for it; choose one/);
  assert.match(QUEUE_CONDITION_KINDS["action-clock-overdue"], /deadline on one of the team's actions passed while its entry is still pending/);
  // T23 (K1099): the five sweep kinds and the three notice kinds are CONDITIONs, each with observation-log's sentence
  for (const [k, says] of Object.entries(NEW_CONDITION_SAYS)) {
    assert.equal(classOfKind(k), "CONDITION", k);
    assert.equal(QUEUE_CONDITION_KINDS[k], CONDITION_KINDS[k], k);
    assert.match(QUEUE_CONDITION_KINDS[k], says, k);
  }
  // negative control: near-misses of the new kinds are outside the vocabulary and classed null
  for (const v of ["sweep-", "sweep-held", "sweep-backlog", "sweep-unknown", "notice-", "notice-posted",
                   "notice-lapsed", " sweep-silent", "sweep-silent ", "SWEEP-SILENT", "notice_lapse_near",
                   "CONDITION::sweep-silent"])
    assert.equal(classOfKind(v), null, v);
  // T36 (notice-producers R12–R15): the four security and policy kinds are FINDINGs, each with R1's sentence, naming no one
  const T36_SAYS = {
    "security-level-high": /the team's security level became High: an unusual run of refused attempts, or something got through; counts only, naming no one/,
    "policy-changed-noticed": /a policy the team follows changed at its address without an announced amendment; review it/,
    "scan-found": /a file you can see was held after a scanner found something in it; its safe view stays open/,
    "security-tool-off": /one of the team's security tools was switched off because it did not confirm its private mode/,
  };
  for (const [k, says] of Object.entries(T36_SAYS)) {
    assert.equal(classOfKind(k), "FINDING", k);
    assert.match(QUEUE_FINDING_KINDS[k], says, k);
    assert.equal(catalogueIdOf(k), null, k);
  }
  // negative control: near-misses of the T36 kinds are outside the vocabulary
  for (const v of ["security-level", "security-level-raised", "policy-changed", "scan-finding", "scan-found ",
                   "SCAN-FOUND", "security_tool_off", "security-tool-on", "FINDING::scan-found"])
    assert.equal(classOfKind(v), null, v);
  // the cardinality finding is worded as what it is: never "required and absent"
  assert.doesNotMatch(QUEUE_FINDING_KINDS.cardinality_exceeded, /absent/);
});

test("R2: catalogueIdOf answers N-1 for export-performed and null for every other kind", () => {
  assert.equal(catalogueIdOf("export-performed"), "N-1");
  for (const k of [...OBLIGATION, ...FINDING, ...CONDITION].filter((x) => x !== "export-performed"))
    assert.equal(catalogueIdOf(k), null, k);
  for (const v of [undefined, null, "", "toString", "__proto__", "N-1"]) assert.equal(catalogueIdOf(v), null);
});

test("R3: itemClassOf reads FINDING:: and CONDITION:: ids with a non-blank rest, trimmed; else null", () => {
  assert.equal(itemClassOf("FINDING::proc::award"), "FINDING");
  assert.equal(itemClassOf("  CONDITION::governor-holding-host::example.org  "), "CONDITION");
  assert.equal(itemClassOf("FINDING::x"), "FINDING");
  for (const v of ["FINDING::", "FINDING::   ", "CONDITION::", "OBLIGATION::bias-debt::r1", "finding::x", "FINDING:x",
                   "x::FINDING::y", "", "   ", null, undefined, 3, {}, "TASK-2026-0001"])
    assert.equal(itemClassOf(v), null, String(v));
});

test("R4: suppressedBy names the first muted ancestor holding the kind, with no wildcard; the item form and the codec", () => {
  const item = (kind, ids, cls = "CONDITION") => ({ id: `${cls}::${kind}::1`, class: cls, kind,
    case: { ancestors: ids.map((id) => ({ id })) } });
  const mutes = new Map([["INQ-1", new Set(["governor-holding-host"])], ["PRJ-1", new Set(["governor-holding-host", "render-deferred"])]]);
  assert.equal(suppressedBy(item("governor-holding-host", ["INQ-1", "PRJ-1"]), mutes), "INQ-1");
  assert.equal(suppressedBy(item("governor-holding-host", ["PRJ-1", "INQ-1"]), mutes), "PRJ-1");
  assert.equal(suppressedBy(item("render-deferred", ["INQ-1", "PRJ-1"]), mutes), "PRJ-1");
  // a kind not named when the mute was made is not suppressed: no wildcard
  assert.equal(suppressedBy(item("partial-capture-outstanding", ["INQ-1", "PRJ-1"]), mutes), null);
  assert.equal(suppressedBy(item("governor-holding-host", ["PRJ-9"]), mutes), null);
  assert.equal(suppressedBy(item("governor-holding-host", []), mutes), null);
  assert.equal(suppressedBy({ kind: "governor-holding-host" }, mutes), null);
  assert.equal(suppressedBy(item("governor-holding-host", ["INQ-1"]), new Map()), null);
  assert.equal(suppressedBy(null, mutes), null);
  assert.equal(suppressedBy(item("", ["INQ-1"]), new Map([["INQ-1", new Set([""])]])), null);
  // the item form: only a CONDITION or FINDING whose id is in the set
  const set = new Set(["CONDITION::a::1", "FINDING::p::s", "OBLIGATION::bias-debt::r1", "TASK-1"]);
  assert.equal(mutedAsItem({ id: "CONDITION::a::1", class: "CONDITION" }, set), true);
  assert.equal(mutedAsItem({ id: "FINDING::p::s", class: "FINDING" }, set), true);
  assert.equal(mutedAsItem({ id: "OBLIGATION::bias-debt::r1", class: "OBLIGATION" }, set), false);
  assert.equal(mutedAsItem({ id: "TASK-1", class: "OBLIGATION" }, set), false);
  assert.equal(mutedAsItem({ id: "FINDING::q::s", class: "FINDING" }, set), false);
  assert.equal(mutedAsItem({ id: "FINDING::p::s", class: "FINDING" }, new Set()), false);
  assert.equal(mutedAsItem(null, set), false);
  // the codec: sorted, de-duplicated, comma-joined; parse inverts it
  assert.equal(serializeMutedKinds(["b", "a", "b", "", null, 3, "c"]), "a,b,c");
  assert.equal(serializeMutedKinds([]), "");
  assert.equal(serializeMutedKinds(undefined), "");
  assert.deepEqual(parseMutedKinds("c, a,b,a,,"), ["a", "b", "c"]);
  assert.deepEqual(parseMutedKinds(""), []);
  assert.deepEqual(parseMutedKinds(null), []);
  for (const kinds of [["render-deferred"], CONDITION, ["x", "y"]])
    assert.deepEqual(parseMutedKinds(serializeMutedKinds(kinds)), sorted(new Set(kinds)));
});

test("R5: the condition kinds are observation-log's vocabulary with action-clock-overdue and cited-docket-unreadable, re-exported as QUEUE_CONDITION_KINDS", () => {
  assert.deepEqual(sorted(Object.keys(CONDITION_KINDS)), sorted(LOOK_CONDITION));
  // every one of observation-log's, with its own sentence, and action-clock-overdue beside them; nothing else
  for (const [k, s] of Object.entries(CONDITION_KINDS)) assert.equal(QUEUE_CONDITION_KINDS[k], s, k);
  assert.deepEqual(sorted(Object.keys(QUEUE_CONDITION_KINDS)), sorted([...Object.keys(CONDITION_KINDS), ...QUEUE_ONLY_CONDITION]));
  assert.equal(Object.keys(QUEUE_CONDITION_KINDS).length, 25);
  // T23 (K1099): the eight new kinds are among them, each with observation-log's own sentence
  for (const k of [...SWEEP_CONDITION, ...NOTICE_CONDITION]) {
    assert.ok(k in CONDITION_KINDS, k);
    assert.equal(QUEUE_CONDITION_KINDS[k], CONDITION_KINDS[k], k);
  }
  // negative control: a kind outside observation-log's vocabulary, other than action-clock-overdue, is not carried
  for (const k of Object.keys(QUEUE_CONDITION_KINDS))
    assert.ok(k in CONDITION_KINDS || QUEUE_ONLY_CONDITION.includes(k), k);
  for (const v of ["sweep-unknown", "notice-posted", "bias-debt", "export-performed"]) {
    assert.ok(!(v in QUEUE_CONDITION_KINDS), v);
    assert.notEqual(classOfKind(v), "CONDITION", v);
  }
  for (const k of QUEUE_ONLY_CONDITION) assert.ok(!(k in CONDITION_KINDS), `observation-log's list is not changed: no look carries ${k}`);
  assert.ok(Object.isFrozen(QUEUE_CONDITION_KINDS));
  for (const k of Object.keys(QUEUE_CONDITION_KINDS)) assert.equal(classOfKind(k), "CONDITION", k);
});

/* G61 (T51 fix round 7; B.md:22): the catalogue names every kind a producer mints. The producers' own tables agreed with
   themselves and the catalogue's lists with themselves; nothing held one against the other, so a member who ran an ingest
   had her whole Queue refused `NO_SUCH_KIND` (R11) on a kind the catalogue did not know. */
test("R1 (G61): every kind notice-producers and queue-producers mint is named by the catalogue, in the class the producer mints it", () => {
  const minted = { ...NOTICE_KINDS };
  for (const [cls, kind] of Object.values(QueueProducers.SCHEDULED_KINDS)) minted[kind] = cls;
  // the three the walker's ingest and fetch minted (B.md:22), and the others found beside them
  for (const k of ["ingest-done", "ingest-stopped", "fetch-done"]) assert.ok(k in minted, `${k} is minted`);
  for (const [kind, cls] of Object.entries(minted)) assert.equal(classOfKind(kind), cls, kind);
  const missing = Object.keys(minted).filter((k) => classOfKind(k) === null);
  assert.deepEqual(missing, []);
  // the two ingest notices and the fetch notice are FINDINGs a recipient disposes of (never muted as an OBLIGATION)
  for (const k of ["ingest-done", "ingest-stopped", "fetch-done"]) {
    assert.equal(classOfKind(k), "FINDING", k);
    assert.ok(QUEUE_FINDING_KINDS[k].trim().length > 0, k);
  }
  // kinds queue-producers (R38, R39) and action-producers (R25) mint without a table of their own
  assert.equal(classOfKind("place-profile-arrived"), "CONDITION");
  assert.equal(classOfKind("wizard-base-updated"), "FINDING");
  assert.equal(classOfKind("request-unsent"), "CONDITION");
  // R1 (G135f; K4933): the reading notice notice-producers R29 mints is a FINDING a recipient disposes of
  assert.equal(classOfKind("reading-ended"), "FINDING");
  assert.ok(QUEUE_FINDING_KINDS["reading-ended"].trim().length > 0);
  // control: a near-miss is still outside the vocabulary
  for (const v of ["ingest-finished", "ingest_done", "fetch-complete", "INGEST-DONE", "FINDING::ingest-done"])
    assert.equal(classOfKind(v), null, v);
});
