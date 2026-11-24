/* screens-entry R21 (K3366, K3368; DEC-257, DEC-258): the keys this module reads, and no English. Every sentence its
   screens draw is the interface's word list (`setup-words` `WORD_ROWS`, generated from the design stream's
   `words.json`), drawn by key through the shell's `w` and read in node through `setup-words` `word(key, vars)`. The
   lists are `words-reads.json`'s `reads` for this module with every key a requirement here names (R16–R20); a sentence
   no key holds is a REPORT to BOB, never English here. DEC-256 retired `screen.forgot.handle.help` and
   `screen.setup.taken`, and DEC-230 withdrew `signin.founderhint`: none is read. R24: the lists below are this module's
   own declared keys, every one held by `hasWord`, and every key a screen draws is one of them. */

export const STATES = Object.freeze(["state.loading", "state.empty", "state.failed"]);

/* shared by the screens */
export const PASSWORDS = Object.freeze(["screen.entry.password", "screen.entry.newpassword", "screen.entry.again",
  "screen.entry.twelve", "screen.entry.differ", "screen.entry.short"]);
export const CODES = Object.freeze(["screen.entry.codes.heading", "screen.entry.codes.what", "screen.entry.codes.none",
  "screen.entry.codes.list", "screen.entry.codes.save", "screen.entry.codes.copy"]);
/* R17, R18: the handle a founder chooses, and the four refusals of it */
export const HANDLE_REFUSALS = Object.freeze(["refusal.NO_HANDLE", "refusal.BAD_HANDLE", "refusal.HANDLE_TAKEN", "refusal.HANDLE_FIXED"]);

/* R4, R6: instance-setup's `HOSTING_CONTROL` (setup's) and `FORGOT_HELP` (forgot's), keyed by the design stream */
export const HOSTING_KEYS = Object.freeze(["screen.hosting.heading", "screen.hosting.s1", "screen.hosting.s2", "screen.hosting.s3",
  "screen.hosting.s4", "screen.hosting.s5", "screen.hosting.guide"]);
export const HELP_KEYS = Object.freeze(["screen.forgot.help.heading", "screen.forgot.help.s1", "screen.forgot.help.s2"]);

/* R26: the team's website file (DEC-374, C11), as the design's `domainFile` draws it; `shell.copy` is the copy act's label */
export const DOMAINFILE = Object.freeze(["summary", "what", "download", "steps", "step1", "step2", "step3", "step4", "step5", "daily",
  "refused.summary", "refused.malformed", "refused.absent", "refused.mismatched", "refused.undetermined", "refused.notadmin"]
  .map((k) => "screen.domainfile." + k));

const labels = (screen, ops) => ops.flatMap((op) => [`act.${op}.label.${screen}`, `act.${op}.does`]);

/** Per screen, every key it reads (interface-shell R5, R21). */
export const READS = Object.freeze({
  front: Object.freeze([...STATES, "screen.front.name", "screen.front.purpose",
    ...["published", "edition", "edition.nosigner", "untitled", "doorbell", "doorbell.what", "doorbell.go", "how", "how.what", "how.go",
      "members", "handle", "device", "incomplete", "forgot", "notmember", "welcomeback", "notyou", "other", "nopassword"].map((k) => "screen.front." + k),
    "screen.entry.uses", "screen.entry.group", "screen.entry.logo", "screen.entry.password", "signin.handle.help",
    "session.keep", "session.shared", "session.signedout", "session.ended", "session.locked",
    "refusal.SIGN_IN_REFUSED", "refusal.SIGN_IN_PAUSED", ...labels("front", ["login", "unlock"])]),
  tour: Object.freeze(["screen.tour.name", "screen.tour.purpose", "screen.tour.step", "screen.tour.back", "screen.tour.next",
    "screen.tour.stop", "screen.tour.end", "screen.tour.nothing", "screen.tour.doorbell",
    ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`screen.tour.step${n}.title`, `screen.tour.step${n}.body`])]),
  forgot: Object.freeze([...STATES, "screen.forgot.name", "screen.forgot.purpose",
    ...["lede", "codes", "code", "code.help", "incomplete", "done", "done.last", "admin", "admin.what"].map((k) => "screen.forgot." + k),
    ...HELP_KEYS, ...PASSWORDS, "screen.front.handle", "forgot.handle.help", "screen.entry.signin",
    "refusal.RECOVERY_REFUSED", "refusal.PASSWORD_TOO_SHORT", "refusal.SIGN_IN_PAUSED", ...labels("forgot", ["recover"])]),
  reset: Object.freeze([...STATES, "screen.reset.name", "screen.reset.purpose",
    ...["for", "forhandle", "keeps", "done", "dead", "dead.what"].map((k) => "screen.reset." + k),
    ...PASSWORDS, "screen.entry.signin", "screen.entry.backtofront", "refusal.PASSWORD_TOO_SHORT", ...labels("reset", ["passwordreset"])]),
  setup: Object.freeze([...STATES, "screen.setup.name", "screen.setup.purpose", "shell.mark",
    /* R22: the parts as the design draws them, each its name, what it is for and its state */
    ...["lede", "coming", "after", "state.needed", "state.done", "state.optional", "state.off", "state.skipped", "state.skipped.help",
      "claim", "part.claim.why", "claim.intro", "claim.button", "otp", "otp.help", "otp.tip", "handle", "handle.help", "handle.tip", "own",
      "own.help", "again.help", "nootp", "claimed", "claimed.nosignin", "unarmed", "codes.intro",
      "part.group", "part.group.why", "name.field", "name.help", "name.tip", "name.now", "name.empty", "site.q", "site.no", "site.yes",
      "site.tip", "domain", "domain.help", "domain.empty", "domain.verified",
      "places", "part.places.why", "places.intro", "places.chosen", "places.choose", "place.other", "places.help", "places.none",
      "place.wanted", "place.wanted.help", "place.wanted.now", "place.empty",
      "offices", "part.offices.why", "offices.what", "offices.none", "office.field", "office.note", "office.empty", "office.added",
      "assistant", "part.assistant.why", "assistant.what", "ai.q", "ai.yes", "ai.yes.help", "leaves.what", "keepaway", "ai.no.help",
      "keepaway.on", "ai.off", "keepaway.why", "keepaway.help", "keepaway.noreason", "pay.q", "pay.own", "pay.group", "assistant.own",
      "assistant.paid", "key", "key.help", "key.tip", "key.nokey", "key.held", "key.on", "key.off", "key.switchon", "key.switchoff",
      "key.told", "limit", "limit.help", "limit.bad", "limit.set",
      "court", "part.court.why", "people.what", "court.what", "court.matters", "court.legend", "court.tell", "court.dont", "court.pick",
      "court.now.tell", "court.now.dont",
      "security", "part.security.why", "security.scanner", "security.what", "security.field", "security.keep", "security.missing",
      "security.nopick", "security.passed", "security.failed", "security.held", "security.add",
      "admins", "part.admins.why", "admins.what", "admins.id", "admins.id.help", "admins.cover", "admins.incomplete", "admins.shown",
      "hosting.field", "hosting.help", "hosting.note", "hosting.empty", "hosting.now",
      "finished", "finished.title", "finished.what", "finished.go"].map((k) => "screen.setup." + k),
    ...HOSTING_KEYS, "screen.entry.again", "screen.entry.differ", "screen.entry.short", "screen.entry.codes.list", "screen.entry.codes.none",
    "screen.entry.signin", "screen.entry.group", "refusal.PASSWORD_TOO_SHORT",
    /* R17, R18: the founder's handle; R19: a reader who is not the founder; R20: the codes, and state c; R23: Skip for now,
       and the second administrator */
    ...HANDLE_REFUSALS, "founder.handle.title", "founder.handle.says", "founder.handle.choose", "founder.handle.later",
    "founder.handle.later.help", "founder.handle.done",
    "setup.member.heading", "setup.member.sub", "setup.member.home",
    "setup.codes.once", "setup.codes.copy", "setup.codes.save", "setup.claimed.heading", "setup.claimed.sub", "refusal.ALREADY_CLAIMED", "refusal.ENTITY_NO_NOTE",
    "setup.skip", "setup.skip_does", "setup.admin.invite", "setup.admin.invite_does",
    /* R34: the team's time zone, in the words Settings draws it by (screens-settings R45) */
    "screen.setup.zone", "screen.setup.zone.help", "screen.group.timezone", "screen.group.timezone.how",
    "screen.group.timezone.source", "screen.group.timezone.source.help", "screen.group.timezone.governs.local", "act.factconfirm.label.group",
    "act.factconfirm.does",
    ...["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu"]
      .map((z) => "label.timezones." + z),
    /* R26: the website file; R30: who recorded the hosting account, when it was the setup or the system */
    ...DOMAINFILE, "shell.copy", "screen.group.hosting.now.setup", "screen.group.hosting.now.system",
    /* R33: the scanner holding no signatures, in the words file-safety's `scanstatus` carries by key (its R46) */
    "file-safety.index.no_signatures", "file-safety.index.no_signatures_since", "file-safety.index.signatures_refused",
    "file-safety.index.signatures_failed", "file-safety.index.signatures_not_fetched",
    ...labels("setup", ["recoverycodesissue", "groupnameset", "groupdomainset", "profilesset", "placewanted", "officesseed", "entitycreate",
      "aikeepaway", "groupkeyset", "ailimitset", "courtnoticeset", "hostingaccessset"]),
    ...["claim", "groupkeyswitch", "memberadd", "securitytooladd"].map((op) => `act.${op}.does`)]),
  join: Object.freeze([...STATES, "screen.join.name", "screen.join.purpose",
    ...["invited", "invited.as", "link", "link.what", "cover", "cover.help", "cover.empty", "dead", "dead.what", "language",
      "language.help", "handle", "handle.help", "handle.taken", "handle.empty", "codes.after", "joined", "joined.nosignin", "home",
      "member", "member.go", "invite.reread"].map((k) => "screen.join." + k),
    ...PASSWORDS, ...CODES, "screen.entry.group", "screen.entry.signin",
    "handle.free", "handle.taken", "handle.characters", "handle.fixed", "handle.refused.paused", "refusal.JOIN_LINK_DAILY_CAP", "join.cap.says",
    "refusal.PASSWORD_TOO_SHORT", ...labels("join", ["invitelook", "memberlanguageset", "handlecheck", "enroll", "joinlinkinvite"])]),
});
