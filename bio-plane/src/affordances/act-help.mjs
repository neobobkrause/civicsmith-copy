/* affordances — ACT_HELP (R48, R53, R54, R56, R57, R61, R62, R69, R70; N726, DEC-174 (3) as amended (U117), DEC-99, K3366): the one table of
 * what each act does, one explanation per op, keyed by op.
 *
 * WORDS BY KEY (R62; K3366, K3368; DEC-257, DEC-258). This module holds no member-facing English: each op is bound to the key of
 * its sentence in the interface's word list (`act.<op>.does`; the exceptions below, where the design keys the text by an alias or
 * by an `owed_` tag it has not yet cleared), and `ACT_HELP` is each key read through `setup-words`' `word`. The text is the
 * design stream's `docs/development/ux-substrate/screens/mock-acts.js` as it stands on `main` at PR #37's merge (`f498560a37`;
 * DEC-229 to DEC-241, DEC-245, DEC-246), 338 entries, held verbatim by the word list (R61), and re-read at the design commit `8c5e692e19` (R70);
 * a later design text is a re-generation
 * of the list below, not a re-wording here. A key the list lacks fails the load (`UNKNOWN_WORD`), as `attestFence` does, so the
 * plane never answers an explanation it cannot make true.
 *
 * Its keys are read as R48 reads them, the ops held in the design's order:
 *   - a declared op is that op; an alias (`op-grades`' OP_ALIASES, `op-declarations` R21's table) is held under its op, never as
 *     a second entry (the design gives `readtranslate` both bare and as `owed_readtranslate`, the one text, held once);
 *   - `owed_<op>` is held under `<op>` once `<op>` is declared or spelled `op=` (R61): the six DEC-248 cleared
 *     (`readtranslate`, `projectfork`, `versionconsider`, `versionreject`, `versionrevert`, `versioncurrent`), `updatestart`,
 *     `updatelater`, `updateskip`, `passwordresetlink`, and `founderhandleset`, which `op-declarations` R71 declares in T49
 *     (K2999's rule: R34's partition holds at both merges). T50 (R65): `projectstakeset`, `actionstake`, `watchitem`, `secondlook`
 *     and `actioninquiry` are held under their ops, read from `act.owed_<op>.does` as the word list holds them (their ops
 *     are declared, `op-declarations` R73), so no held key starts `owed_`; `secondlookclear` is held under its own
 *     `act.secondlookclear.does`;
 *   - T50 (R64, R66; DEC-264, DEC-309 (5)): `reauth` (`act.reauth.does`) and `aliaswithdraw` (`act.owed_aliaswithdraw.does`),
 *     `factconfirm`, `projectrequest`, `projectrequestwithdraw` and `projectrequestanswer` (each `act.<op>.does`) are held
 *     under their ops, and so leave `op-declarations`' `ACT_HELP_ABSENT` (its R75);
 *   - `handlechange`: the design's text still describes a change of handle, which `membership` R129 refuses whatever is asked
 *     (DEC-197), so it is not read; the help states the refusal, `membership`'s own `HANDLE_FIXED` row read by reference (R53);
 *   - T51 (R70; DEC-340, U366): `holdnoticeprepare` and `counselpacket` are held (`actionhold`'s and `holdnoticesent`'s texts are the
 *     design's new ones, read by key), as are `noticeprepare`, `noticepost`, `signeradd` and `versionnotice`, whose `does` words the
 *     design's reads list for this module gives (R62); `op-declarations`' `ACT_HELP_ABSENT` keeps none of them;
 *   - T51 (K4093; DEC-359): `actionholdrelease`, which the design @ `2a64c5ae77` explains, is held (R70 re-taken at that design);
 *   - T51 (K4248, B12): `strengthbarset` is held under its own text, `act.strengthbarset.does`, in `T51_DESIGN_OPS`; `strengthbar`, an op
 *     whose text the design does not give and which no screen sends (the screens send `strengthbarset` and `projectbarset`), is held none;
 *   - T51 (G49, K4680): `capturerequests`, `casedrafts` and `readheld`, whose `act.<op>.does` words the design's reads list now gives, are
 *     held in `T51_DESIGN_OPS` (`readheld` was a stand-in until its design row landed);
 *   - T51 (K4900; `capture` R113): `captureuploadbegin`, `captureuploadpart`, `captureuploadcomplete` and `captureuploadabort`, the steps the
 *     page takes to send a large file in parts, are held in `T51_DESIGN_OPS` (stand-ins until DEC-431 gave their rows, K4968);
 *   - T51 (R71; DEC-438 to DEC-441, K5303): the five acts Standard draws, `standardinforcethrough`, `standardinforcethroughwithdraw`,
 *     `standardadoption`, `standardimpose` and `standardbenchmark`, are held in `T51_STANDARD_OPS`, each `act.<op>.does`. `leggrade` and
 *     `signerknown` (`credentials` R83) are held in `T51_STANDIN_HELP` under their own keys until the design's rows land;
 *   - T51 (R69): the seven browser acts, `BROWSER_ACTS`, are held under their own names from `act.owed_<name>.does`;
 *   - `projectownervotes` has no text in the design and is held none (`op-declarations` names it in `ACT_HELP_ABSENT`, R61);
 *   - `selftest` (FR-40, K4190): the word list holds `act.selftest.does` for the updates screen (DEC-376), but this module's reads
 *     list (R62) does not give it and no act this module draws is `selftest` (instance-setup's probe), so it is held none.
 * A retired op is not held. */
import { word, localize } from "../setup-words/index.mjs";
import { MEMBERSHIP_CHECKS } from "../membership/index.mjs";

/** T51 (K4248; U421, DEC-387): the declared ops whose `act.<op>.does` words the design's reads list for this module gives (R62), held
 *  under their own names in the reads list's order; `handlechange` is not (R53). Exported so the tests can name them. */
export const T51_DESIGN_OPS = Object.freeze([
  "accountdrafts",
  "accountpropose",
  "addressedrecord",
  "aspirationdeadend",
  "aspirationdeclare",
  "aspirationdepart",
  "aspirationretire",
  "biasadopt",
  "biasdebt",
  "biasdebtresolve",
  "biasinhale",
  "biasmanifest",
  "captureaccount",
  "capturerequestretry",
  "capturerequests",
  "captureseenin",
  "casedrafts",
  "consequencerecord",
  "consequencerevise",
  "contradictionclarify",
  "contradictiondismiss",
  "contradictionflag",
  "contradictionoptin",
  "contradictionresolve",
  "contradictionrespond",
  "contradictiontakeup",
  "determine",
  "escalationattach",
  "escalationdecline",
  "escalationevaluate",
  "escalationresume",
  "escalationsuspend",
  "export",
  "exportlog",
  "goalclose",
  "goaldeclare",
  "goallink",
  "hypothesisrevise",
  "hypothesiswithdraw",
  "importacceptwithdraw",
  "inboxlist",
  "inquirydivide",
  "knockerconsent",
  "knocksof",
  "lead",
  "leadlook",
  "leadread",
  "leadshare",
  "linewithdraw",
  "memberpairingset",
  "moneysets",
  "monitoring",
  "monitorpause",
  "monitorslate",
  "objectivecondition",
  "officeconfirm",
  "origins",
  "pdfstructure",
  "progressions",
  "provenanceroute",
  "readheld",
  "reattest",
  "reevaluationrecord",
  "reevaluations",
  "remindersfor",
  "reopen",
  "resolutiondefect",
  "runtime",
  "scanmirror",
  "selftest",
  "sourceconsent",
  "sourceconsentwithdraw",
  "sourcedisclose",
  "sourcepersonlink",
  "standardinforce",
  "strengthbarset",
  "sweeps",
  "templatesave",
  "transcriptionattest",
  "transcriptions",
  "triage",
  "captureuploadabort",
  "captureuploadbegin",
  "captureuploadcomplete",
  "captureuploadpart",
]);

/** T51 (R71; DEC-438, K5303): the declared ops Standard's four acts and Matter's benchmark send, whose `act.<op>.does` words the word list holds
 *  (the design's ACT_HELP, `mock-acts.js`); not yet in the design's reads list, which is a generation behind. Exported so the tests can name them. */
export const T51_STANDARD_OPS = Object.freeze(["standardinforcethrough", "standardinforcethroughwithdraw", "standardadoption", "standardimpose",
  "standardbenchmark"]);

/** T51 (B14, K4376; `op-declarations` J22): the declared ops whose `act.owed_<op>.does` words the design's reads list gives, held under
 *  their ops (R61; KEY_EXCEPTIONS below). Exported so the tests can name them. */
export const T51_OWED_OPS = Object.freeze(["expertisewithdraw", "declareorigin", "capturecredentiallist", "capturecredentialsupply", "capturecredentialwithdraw",
  "citeimported", "withdrawimported", "projectclose", "importregrade", "rerunstart", "rerunpair", "rerunread", "casedetailsset",
  "casedetails", "namedrequestset", "namedrequests", "sweepset", "sweepratify", "taskdecide"]);

/** T51 (B14; B17, DEC-412 K4458; G49): the declared ops whose `act.<op>.does` rows the word list held but the reads list did not give. The
 *  reads list now gives all ten (`contradictionflag`, origins, inboxlist, transcriptions, progressions, remindersfor, moneysets,
 *  captureseenin, scanmirror, officeconfirm), so they are held in `T51_DESIGN_OPS`; kept as an empty frozen value for the tests that import it. */
export const T51_LIST_ONLY_OPS = Object.freeze([]);

/** T51 (K4900, fix round 9; `capture` R113; K4968, DEC-431; K5164): the declared ops held under a `localize` default while the word list
 *  held no sentence for them. `captureupload*` had their design rows land (DEC-431), so they are held in `T51_DESIGN_OPS` and read by key.
 *  K5164: `authority` (provenance's read, R80) and `ruleservicesstate` (answers' read) are held here; T51 (R71, K5303): `leggrade` (citation R24) and `signerknown` (credentials R83) likewise, each under its own `act.<op>.does` key
 *  with a plain English default until the design stream's row lands, so `op-declarations` R34 finds an explanation for each. */
export const T51_STANDIN_HELP = Object.freeze({
  authority: localize("act.authority.does", "Lists, for each captured file of this document, who issued it as the record now stands, with the dated basis, and whether a member reviewed it and could not tell. Changes nothing."),
  leggrade: localize("act.leggrade.does", "Records how well your team's copy of a cited document shows the passage cited for this question, as a grade from A to D with your reason. The grade can be no higher than the record's own ceiling for that copy, and nothing else changes."),
  signerknown: localize("act.signerknown.does", "An administrator says they know about a signing key a member registered for themselves. It records who said so and when, and nothing else changes."),
  ruleservicesstate: localize("act.ruleservicesstate.does", "Says whether the rule services are switched on, so a screen draws their control only while they are. Changes nothing."),
});
export const T51_STANDIN_OPS = Object.freeze(Object.keys(T51_STANDIN_HELP));

/** The ops held, in the design's order (R48, R61). */
export const ACT_HELP_OPS = Object.freeze([
  "bootstrap", "login", "unlock", "recover", "grouplanguagesset", "grouplogoset", "passwordreset", "signout",
  "signouteverywhere", "joinlinkinvite", "passwordresetlink", "peopledirectory", "claim", "groupnameset",
  "groupdomainset", "profilesset", "officesseed", "entitycreate", "placewanted", "aikeepaway", "groupkeyset",
  "groupkeyswitch", "courtnoticeset", "hostingaccessset", "updatestart", "updatelater", "updateskip",
  "securitytooladd", "memberadd", "groupdescriptionset", "groupdescriptiondraft", "invitelook", "memberlanguageset",
  "enroll", "startfrom", "membercaps", "memberset", "adminendorse", "adminremove", "expertiseconfirm",
  "invitewithdraw", "websitekeycreate", "joinlinkenable", "groupkeyremove", "securitymap", "securitytooltest",
  "securitytoolremove", "expertisedeclare", "setpassword", "signrequest", "signerset", "signerregister",
  "signerrevoke", "infolevelset", "groupkeynoticeseen", "disclosureshown", "subscriptionsignin",
  "subscriptiondisconnect", "accountreferenceset", "accountreferenceremove", "membertie", "membertiewithdraw",
  "notewrite", "noteturn", "noterevise", "notedelete", "writinghelp", "translationdraft", "translationadopt",
  "translationgrant", "translationconfirm", "translationrevert", "wizards", "wizarddraft", "wizardrevise",
  "wizardsubmit", "wizardapprove", "wizardretire", "taskresolve", "taskforward", "proposedispose", "queuesnooze",
  "queuemute", "versionadopt", "versionkeep", "reminderanswer", "promote", "search", "select", "findin",
  "selectionrelease", "frontier", "acquire", "captureupload", "testify", "capturerequest", "monitor",
  "recoverycodesissue", "monitorset", "heldcaptures", "release", "heldsetaside", "heldrestore", "gradenote",
  "archivelist", "openoriginal", "openwithwarning", "safeview", "deepercheck", "releasescanhold", "cite",
  "entityalias", "relationdeclare", "resolve", "resolvetestify", "connect", "planask", "stepsource",
  "stepsourcewithdraw", "actionreplyquoting", "readtranslate", "proceedingdates", "updatenotice", "aiuseovertime",
  "exploregraph", "standardproposals", "filingread", "pressurefor", "lookedsince", "projectstakeset",
  "actionstake", "founderhandleset", "projectvisibilityset", "projectowneradd", "projectownerremove",
  "projectremove", "projectleave", "projectfork", "projectownerrescue", "watchitem", "secondlook",
  "actionrisktier", "actionlawspropose", "actioninquiry", "inquiryground", "versionaccept", "versionhide",
  "versionconsider", "versionreject", "versionrevert", "versioncurrent", "connectionchoose", "retire", "attest",
  "identityclaim", "standingset", "personfact", "datedfact", "clockpropose", "accountusesset", "ailimitset",
  "projectkeyset", "projectsigninset", "projectaccountswitch", "projectaccountremove", "projectkeynoticeseen",
  "projectaikeepaway", "projectscopeset", "projectapprovalset", "ruledraft", "ruleconfirm", "rulewithdraw",
  "ruleoffer", "dutyfromresponse", "dutiesarising", "procedureguides", "standingendset", "declaredstakeset",
  "clockproposals", "joindoors", "textcheck", "infractiondraft", "bearingdraft", "publishcheck", "casecheck",
  "advocacycheck", "curelink", "successrecord", "outcomecarry", "actionreceipt", "actionscope", "actionpromise",
  "openitemswith", "actionreplybearing", "actionbearingpropose", "arosefrom", "pressurerecord", "holdnoticesent",
  "jointsignatory", "filingsecondapprove", "escalationstoppursuing", "statusreportassist", "airundispatch",
  "escalationreopen", "scenariosetaside", "scenariorestore", "planpause", "planresume", "matteroutcomeset",
  "itemtakeup", "watchlink", "watchanswer", "followend", "pagetranscribe", "transcribe", "exploreapprove",
  "handlechange", "handlecheck", "obscuremarkwithdraw", "obscuremark", "standarddeclare", "moneyrecord",
  "tabledeclare", "projectbarset", "drawquestion", "spotcheckvisit", "projectquestions", "projectlist",
  "projectinvite", "projectjoin", "planopen", "sever", "reinstate", "narrow", "conclude", "withdrawconclusion",
  "hypothesishold", "instance", "progression", "progressiondefine", "thread", "discharge", "captureprogressions",
  "themeread", "themedeclare", "themeplace", "themepropose", "themewithdraw", "checkrequest", "ask", "rule",
  "standingend", "airunopen", "suggest", "airunclose", "person", "identitywithdraw", "followregister",
  "personexpunge", "eventcreate", "participantadd", "eventrelate", "moneysetcreate", "moneysetinclude",
  "moneysetexclude", "moneyreconcile", "committedagainstpaid", "authoritychain", "calculationcreate",
  "calculationdraw", "workbookadd", "workbookbind", "workbooksecondcheck", "calculationaccept", "explore",
  "explorepreset", "exploreverify", "connectionassert", "linerecord", "dutydeclare", "courtlink", "clockadopt",
  "reminderset", "standardadopt", "lawrelate", "plansubjectadd", "optionadd", "optionpropose", "optionadopt",
  "optiondispose", "scenarioset", "checkpointrecord", "optionstartpreview", "planclose", "optionstart",
  "communicationprepare", "filingprepare", "filingapprove", "filingsent", "addresseesuggest", "actioncreate",
  "actionlaws", "actionmove", "actioncorrespond", "actionpressure", "actionhold", "escalationopen",
  "escalationadvance", "declinetoescalate", "escalationend", "casedraft", "whatchangedpropose", "statementack",
  "attribute", "reviewgrant", "reviewrevoke", "reviewcomment", "publishpreflight", "publishtensions", "caseratify",
  "publish", "publishatmove", "publishatcancel", "publishat", "verify", "publishedcase", "caseimport", "importaccept",
  "importflag", "importwatch", "docketfile", "docketpost", "inboxpull", "inboxresolve", "sourcelink", "knock",
  "secondlookclear", "reauth", "aliaswithdraw", "factconfirm", "projectrequest", "projectrequestwithdraw", "projectrequestanswer",
  "holdnoticeprepare", "counselpacket", "noticeprepare", "noticepost", "signeradd", "versionnotice", "actionholdrelease",
  ...T51_DESIGN_OPS,
  ...T51_OWED_OPS,
  ...T51_STANDARD_OPS,
  ...T51_LIST_ONLY_OPS,
  ...T51_STANDIN_OPS,
]);

/** R69 (T51; DEC-330 owed, U348, K3810; `op-declarations` R76): the seven browser acts, each explained under its own name though none
 *  is an op, read from the design's `act.owed_<name>.does` (the design keeps the `owed_` in the key of these seven). None is in
 *  `ACTS`, `CAPTURE_ACTS`, `PER_ITEM_ACTS`, `NON_ACTS`, `RUNGS` or `RUNG_ABSENT` (so R12's totality neither lists nor misses one) or
 *  in `ACT_HELP_ABSENT` (R34's partition runs over ops only). R48's rule that a key naming neither a declared op nor an owed act
 *  is not held is read with these among the names it admits. */
export const BROWSER_ACTS = Object.freeze(["revisioncompare", "hashcopy", "linkopen", "pubfloorset", "pubfloorclear", "pubprint",
  "reviewexport"]);

/* Where the design keys a text by something other than `act.<op>.does`: an alias's own name, or an `owed_` tag not yet cleared. */
const KEY_EXCEPTIONS = Object.freeze({
  passwordresetlink: "act.owed_passwordresetlink.does",
  updatestart: "act.owed_updatestart.does",
  updatelater: "act.owed_updatelater.does",
  updateskip: "act.owed_updateskip.does",
  signerregister: "act.signerregisterown.does",
  signerrevoke: "act.signerrevokeown.does",
  membertie: "act.declaretie.does",
  membertiewithdraw: "act.withdrawtie.does",
  versionadopt: "act.adoptversion.does",
  versionkeep: "act.keepversion.does",
  founderhandleset: "act.owed_founderhandleset.does",
  standingset: "act.standingquestionset.does",
  personfact: "act.recordpersonfact.does",
  datedfact: "act.recorddatedfact.does",
  moneyrecord: "act.recordfact.does",
  rule: "act.ruleanswer.does",
  standingend: "act.standingquestionend.does",
  identitywithdraw: "act.withdrawidentityclaim.does",
  eventcreate: "act.createevent.does",
  participantadd: "act.addparticipant.does",
  eventrelate: "act.relate.does",
  moneysetcreate: "act.createset.does",
  moneysetinclude: "act.include.does",
  moneysetexclude: "act.exclude.does",
  moneyreconcile: "act.reconcile.does",
  workbookadd: "act.addworkbook.does",
  workbookbind: "act.bind.does",
  workbooksecondcheck: "act.recordcheck.does",
  linerecord: "act.recordline.does",
  dutydeclare: "act.declare.does",
  filingsent: "act.filingrecordsent.does",
  projectstakeset: "act.owed_projectstakeset.does",
  actionstake: "act.owed_actionstake.does",
  watchitem: "act.owed_watchitem.does",
  secondlook: "act.owed_secondlook.does",
  actioninquiry: "act.owed_actioninquiry.does",
  aliaswithdraw: "act.owed_aliaswithdraw.does",
  ...Object.fromEntries(T51_OWED_OPS.map((op) => [op, `act.owed_${op}.does`])),
});

/** Every name held: the ops in the design's order, then R69's browser acts. */
const HELD = Object.freeze([...ACT_HELP_OPS, ...BROWSER_ACTS]);

/** R62, R69: each held name's word key, `act.<op>.does` unless the design keys it otherwise (a browser act is `act.owed_<name>.does`);
 *  `handlechange` has none (R53). */
export const ACT_HELP_KEYS = Object.freeze(Object.fromEntries(HELD.filter((op) => op !== "handlechange")
  .map((op) => [op, KEY_EXCEPTIONS[op] ?? (BROWSER_ACTS.includes(op) ? `act.owed_${op}.does` : `act.${op}.does`)])));

/** R48, R61, R62, R69, R70: what each act does, each sentence read through `word`; the very object `op=affordances` answers (R49). */
export const ACT_HELP = Object.freeze(Object.fromEntries(HELD.map((op) =>
  [op, op === "handlechange" ? MEMBERSHIP_CHECKS.HANDLE_FIXED.translation
    : Object.hasOwn(T51_STANDIN_HELP, op) ? T51_STANDIN_HELP[op] : word(ACT_HELP_KEYS[op])])));
