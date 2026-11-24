/* screens-settings (T46-55; N897 (1), (3); K2147): the settings a member and an administrator use day to day, as
   screens of the member interface: `members`, `account`, `connect` and `notes` (registry screens, DEC-139), with the AI
   account panel drawn once for the group's key and the member's own (R9); since T47, `group-identity`, `security` and
   `translations` (R14–R16), and the settings index and the sections the setup page held, `settings`, `group`, `places`
   and `recovery` (R17–R20); since T50, `teamai`, the team's assistant (R47, R48), and `updates` (R27); since T51, `glossary` (R59) and
   `grouprules` (R61), with the members' signing keys on `members` (R55, R56) and the key made on `account` (R57). Pure: every read and act is an op the plane
   serves, called through `interface-shell`'s screen contract (its R21) and kit; nothing here reads a table, writes, or
   keeps anything in the browser.

   `SCREENS`: per screen `{id, reads, render, acts, words, parts}` as interface-shell R21 states them (K2996, K2998);
   every function self-contained. `words` lists the keys a screen draws, all keys (R39: this module holds no English;
   `keys.mjs`). `parts` holds the AI account panel's functions, handed to `members` and `connect` as `view.parts`
   (J2 (1)). `SCREEN_WORDS` is empty (words.mjs). */
import { members } from "./members.mjs";
import { teamai } from "./teamai.mjs";
import { account } from "./account.mjs";
import { connect } from "./connect.mjs";
import { notes } from "./notes.mjs";
import { settings } from "./settings.mjs";
import { group } from "./group.mjs";
import { places } from "./places.mjs";
import { recovery } from "./recovery.mjs";
import { identity } from "./identity.mjs";
import { security } from "./security.mjs";
import { translations } from "./translations.mjs";
import { updates } from "./updates.mjs";
import { glossary } from "./glossary.mjs";
import { grouprules } from "./grouprules.mjs";
import { bias } from "./bias.mjs";
import { aiPanel, aiPanelSend, aiUsageBars, PANEL_KEYS } from "./panel.mjs";
import { SCREEN_WORDS } from "./words.mjs";
import { KEYS } from "./keys.mjs";

export { SCREEN_WORDS, KEYS };

const own = (...prefixes) => KEYS.filter((k) => prefixes.some((p) => k.startsWith(p)));
const PANEL = PANEL_KEYS;
const STATES = ["state.loading", "state.empty", "state.failed"];
const LABELS = (screen, ops) => ops.flatMap((op) => [`act.${op}.label.${screen}`, `act.${op}.does`]);

/** The keys each screen draws (interface-shell R5, R21; R39). */
const WORDS = {
  members: [...STATES, "screen.members.name", ...own("screen.members."), ...["member", "may-do", "expertise"].flatMap((c) => [`column.members.${c}.name`, `column.members.${c}.shows`]), "member.founder.unnamed", "member.founder.unnamed.help", "screen.group.name", "screen.places.name", "screen.recovery.name",
    ...LABELS("members", ["memberadd", "membercaps", "memberset", "adminendorse", "adminremove", "expertiseconfirm", "invitewithdraw",
      "websitekeycreate", "joinlinkenable", "signerset", "signeradd"]), "refusal.BAD_KEY", "refusal.NO_SUCH_MEMBER", "screen.members.signer.held.nodate",
    "act.owed_passwordresetlink.label.members", "act.owed_expertisewithdraw.label.members", "act.owed_expertisewithdraw.does", "refusal.CONSENSUS_REQUIRED", "shell.card.member", "screen.projects.name", "screen.members.tip.owner", "screen.members.tip.workson"],
  teamai: [...STATES, "screen.teamai.name", ...own("screen.teamai.", "screen.members.key.", "screen.members.keepaway."), ...PANEL, "ai.whopays", "act.aikeepaway.does", "screen.connect.whopays.summary", "ai.usage.meter.month_group",
    ...["ask", "draft", "run", "enquire", "read", "transcribe", "account", "suggestions"].map((u) => `ai.use.${u}.inline`),
    ...LABELS("teamai", ["groupkeyset", "groupkeyswitch", "accountusesset", "ailimitset", "groupkeyremove", "aikeepaway"])],
  account: [...STATES, "screen.account.name", ...own("screen.account."), "handle.fixed", "level.prompt.name", "level.pause.name", "signing.ceremony.keepkey",
    "screen.connect.name", "screen.notes.name", "screen.ties.name", "screen.glossary.name", "screen.glossary.purpose", "member.founder.unnamed", "screen.members.signer.held.nodate", "shell.signer.loadfile", "shell.signer.load", "shell.signer.notkey",
    ...LABELS("account", ["expertisedeclare", "setpassword", "signerregisterown", "signerrevokeown", "memberlanguageset", "infolevelset", "signout", "signouteverywhere", "memberpairingset"])],
  connect: [...STATES, "screen.connect.name", ...own("screen.connect."), "member.founder.unnamed", ...PANEL, "ai.whopays", "mark.outward.means", "screen.setup.state.needed", "shell.working",
    ...["ask", "draft", "run", "enquire", "read", "transcribe", "account", "suggestions", "standing"].flatMap((u) => [`ai.use.${u}.name`, `ai.use.${u}.means`]),
    "connect.ifnot", "connect.notnow", "refusal.reference", "session.reauth", "shell.password", "session.reauth.head", "screen.panel.amount", "ai.usage.today",
    "instance.part.signin.absent", "instance.part.unknown",
    ...["NO_SIGNIN_WAITING", "SIGNIN_REFUSED", "SIGNIN_UNAVAILABLE", "SIGNIN_ADDRESS_UNEXPECTED", "AGENT_WORKER_UNBOUND", "DISCLOSURE_DUE"].map((c) => "refusal." + c),
    ...LABELS("connect", ["groupkeynoticeseen", "disclosureshown", "subscriptionsignin", "reauth", "accountreferenceset", "accountusesset", "ailimitset", "accountreferenceremove", "subscriptiondisconnect"])],
  notes: [...STATES, "screen.notes.name", ...own("screen.notes."), "ai.label.untested",
    ...LABELS("notes", ["notewrite", "noteturn", "noterevise", "notedelete", "writinghelp"])],
  settings: [...STATES, ...own("screen.settings."), "screen.settings.everyone", "screen.watching.name", "screen.leads.name", "screen.watching.purpose", "screen.leads.purpose", ...["settings", "account", "connect", "ties", "notes", "recovery", "group", "group-identity", "members", "teamai", "places", "security", "updates", "translations", "wizards", "bias", "grouprules"]
    .flatMap((id) => [`screen.${id}.name`, `screen.${id}.purpose`])],
  group: [...STATES, "screen.group.name", ...own("screen.group."), "screen.settings.storage.head", "settings.set.setup", "settings.set.system", "settings.set.line.setup", "settings.set.line.system", "term.hostingaccount.means", "term.bar.team.means", "member.founder.unnamed",
    ...["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu"].map((z) => `label.timezones.${z}`), "stake.group.title", "stake.group.help", "stake.group.label", "stake.group.save", "stake.set", "stake.none", "stake.history", "stake.unreadable", "ai.label.untested",  "screen.group-identity.draft.label",
    ...own("screen.domainfile."), "shell.copy", "shell.save", "screen.group.hosting.now.date", "screen.group.export.count.tables.one", "screen.group.export.count.tables.other", "screen.group.domain.checked", "queue.export-performed.summary", "queue.export-performed.records.one", "queue.export-performed.records.other", "queue.export-performed.files.one", "queue.export-performed.files.other", "shell.card.member", ...LABELS("group", ["groupnameset", "grouplogoset", "groupdomainset", "grouplanguagesset", "courtnoticeset", "hostingaccessset", "strengthbarset", "declaredstakeset", "writinghelp", "factconfirm", "export", "exportlog"])],
  places: [...STATES, "screen.places.name", ...own("screen.places."), "screen.grouprules.name", "places.elsewhere.head", "places.elsewhere.says", "places.elsewhere.open", "court.add", "court.add.name", "court.add.help", "shell.field.needed", "shell.card.member", "shell.confirm", "screen.request.nameoffice.mark", "screen.request.nameoffice.where", "screen.request.nameoffice.law", ...LABELS("places", ["profilesset", "placewanted", "officesseed", "entitycreate"])],
  recovery: [...STATES, "screen.recovery.name", ...own("screen.recovery."), "screen.members.recovery.one", "screen.members.recovery.many", "screen.members.recovery.add", "member.founder.unnamed",
    ...LABELS("recovery", ["recoverycodesissue"])],
  "group-identity": [...STATES, "screen.group-identity.name", ...own("screen.group-identity."), "ai.label.untested", "shell.field.needed",
    ...LABELS("group-identity", ["groupdescriptionset", "groupdescriptiondraft"])],
  security: [...STATES, "screen.security.name", ...own("screen.security."), "period.days", "member.founder.unnamed", "instance.part.scanner.present", "instance.part.scanner.absent",
    "instance.part.safeview.present", "instance.part.safeview.absent", "instance.part.unknown", "instance.scanner.absent.step",
    ...own("file-scanner.credential."),
    // the scanner's state when it holds no signatures, under file-safety's keys (DEC-396; R77): the date and the reason each fill their own
    "file-safety.index.no_signatures", "file-safety.index.no_signatures_since", "file-safety.index.signatures_refused", "file-safety.index.signatures_failed", "file-safety.index.signatures_not_fetched", "screen.security.nosignatures.next",
    "act.scanmirror.label.security", "screen.security.mirror.started",
    // an unfinished run and a refusal with no status, worded by file-safety R46's keys (C84)
    ...["signatures_refused_unnumbered", "signatures_run_seed", "signatures_run_download", "signatures_run_stage", "signatures_run_verify", "signatures_run_under_way", "signatures_run_stopped"].map((k) => "file-safety.index." + k),
    ...LABELS("security", ["securitymap", "securitytooladd", "securitytooltest", "securitytoolremove"])],
  updates: [...STATES, "screen.updates.name", ...own("screen.updates."), "refusal.UPDATE_SKIP_NO_REASON", "member.founder.unnamed", "settings.set.system",
    "updates.running.release_setup", "updates.earlier.installed_setup", "updates.running.head", "updates.running.release", "updates.running.checked",
    "updates.running.checked_note", "updates.ready.head", "updates.ready.release", "updates.ready.security", "updates.ready.security_says", "updates.ready.signed",
    "updates.notes.members", "updates.notes.admins", "updates.notes.must", "updates.notes.plain", "updates.act.later", "updates.act.update", "updates.act.skip",
    "updates.act.skip_with_reason", "updates.skip.why", "updates.skip.says", "updates.handoff.head", "updates.handoff.says", "updates.handoff.for", "updates.handoff.explain",
    "updates.handoff.copy", "updates.none", "updates.earlier.head", "updates.earlier.installed", "updates.earlier.skipped",
    "updates.running.release_noactor", "updates.earlier.installed_noactor", "updates.running.setup_on", "act.selftest.does", "act.bootstrap.does", "act.runtime.does"],
  translations: [...STATES, "screen.translations.name", ...own("screen.translations."),
    ...LABELS("translations", ["translationdraft", "translationadopt", "translationgrant", "translationconfirm", "translationrevert"])],
  glossary: [...STATES, "screen.glossary.name", ...own("screen.glossary.", "glossary.term.", "state.item.")],
  bias: [...STATES, "screen.bias.name", ...own("screen.bias."), "screen.standard.state.adopted", "shell.reason", "act.writinghelp.does", "shell.field.needed", "shell.card.member",
    ...LABELS("bias", ["biasmanifest", "promote", "biasadopt", "biasinhale", "biasdebt", "biasdebtresolve", "writinghelp"])],
  grouprules: [...STATES, "screen.grouprules.name", ...own("screen.grouprules.", "screen.start-send.kind."), "member.founder.unnamed", "refusal.RULE_NEEDS_QUALIFICATION", "screen.group-identity.draft.label", "ai.label.untested", "shell.field.needed", "shell.card.member",
    // G20 (K4571): the document picker's search, its "nothing matches" and its "the first {n} are shown" (the nearest held rows, the design's own)
    "form.choose.search", "form.choose.search.none", "screen.people.more",
    ...own("screen.action.kind."), ...LABELS("grouprules", ["ruleconfirm", "rulewithdraw", "ruledraft", "writinghelp"])],
};

const PARTS = Object.freeze({ aiPanel, aiPanelSend, aiUsageBars });
const freeze = (s) => Object.freeze({
  ...s,
  acts: Object.freeze(s.acts.map((a) => Object.freeze({ ...a }))),
  words: Object.freeze([...new Set(WORDS[s.id])]),
  parts: PARTS,
});

export const SCREENS = Object.freeze([settings, members, teamai, account, connect, notes, group, identity, places, recovery, security, translations, updates, glossary, grouprules, bias].map(freeze));
