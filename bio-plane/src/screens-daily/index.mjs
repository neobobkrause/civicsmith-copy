/* screens-daily (T46-57, T47-60, T48-72, T49-24; N897 (1), N972, N847, N1036, N1047; DEC-110, DEC-131, DEC-139, DEC-164,
   DEC-198, DEC-201, DEC-212, DEC-218, DEC-219, DEC-226, DEC-227, DEC-228, DEC-257, DEC-258; N698's screen part): where a member
   starts and works each day. The registry screens `home`, `elsewhere`, `projects`, `queue`, `finder`, `find-in` and `answers`,
   built to interface-shell R21's screen contract: each `{id, reads, render, acts, words}`, every function self-contained,
   every read and act an op through the shell. Pure: this module reads no table and writes nothing. It holds no member-facing
   English (R34, K3366): each screen's `words` are the keys of the word list it draws, and the shell reads each through
   `setup-words`. */
import { home } from "./home.mjs";
import { elsewhere } from "./elsewhere.mjs";
import { projects } from "./projects.mjs";
import { queue } from "./queue.mjs";
import { finder } from "./finder.mjs";
import { findIn } from "./find-in.mjs";
import { answers } from "./answers.mjs";
import { WORD_ROWS } from "../setup-words/index.mjs";

// The keys each screen draws, by family. The first three states are every screen's.
const SHARED = ["state.loading", "state.empty", "state.failed", "state.undetermined"];
const DOORS = ["problem", "person", "money", "read", "tip", "elsewhere"];
// The queue's keyed kinds (`queue.<kind>.summary` and `.detail`), the same for Home and the queue (`item-words.mjs`).
const QUEUE_KINDS = ["question-find", "step-later-found", "step-date-due", "step-reminder", "step-cost-shared", "step-cost-message",
  "milestone-overdue", "milestone-reminder", "project-quiet", "review-comment-left-out", "action-clock-overdue.ours",
  "action-clock-overdue.theirs", "member-left-items", "watch-keep-or-stop", "plan-review-due", "plan-look-again",
  "litigation-hold.docket", "project-invitation", "project-request"];
// DEC-227's order of the kinds of places `elsewhere` lists (R15).
const ELSEWHERE_KINDS = ["legalaid", "selfhelp", "service", "agency", "representative", "tipline"];
// R55: the item states the table draws a chip for (the design's sixteen).
const ITEM_STATES = ["review", "reviewed", "retired", "open", "concluded", "published", "waiting", "flagged", "watched", "deferred", "dismissed", "divided", "planned", "active", "resolved", "abandoned"];
const MARKS = (kinds) => kinds.flatMap((k) => [`mark.${k}.name`, `mark.${k}.means`]);
const ACTS = (screen, ops) => ops.flatMap((op) => [`act.${op}.label.${screen}`, `act.${op}.does`]);
const KEYED_QUEUE = [...QUEUE_KINDS.flatMap((k) => [`queue.${k}.summary`, `queue.${k}.detail`]), "queue.project-invitation.summary.unnamed"];
// R50: a kind's plain name on the muted list (DEC-309 (1)), every `queue.kind.*` the list of words holds.
const KIND_NAMES = WORD_ROWS.map((r) => r[0]).filter((k) => k.startsWith("queue.kind."));
// R60: the feeds the word list names (`queue.feed.<id>`), the ones `queue-states.mjs` can name when one did not answer.
const KIND_FEEDS = WORD_ROWS.map((r) => r[0]).filter((k) => k.startsWith("queue.feed."));
// G16, G20 (fix round 6): a list or a search that stops says so, in the nearest held words until the design gives its own.
const CUT_EXTRA = { home: ["screen.held.more"], queue: ["screen.held.more"],
  finder: ["screen.held.archivemore", "observation-log.partial.looked_got_part", "find.browse.more", "find.browse.showmore"],
  "find-in": ["screen.held.archivemore", "screen.people.more", "find.browse.more", "find.browse.showmore"] };
// R42: the ways into a project, and who to ask; R50: the team's own passed date.
const JOIN = ["screen.home.join.heading", "screen.home.join.says", "screen.home.join.lead", "screen.home.join.nocreate", "screen.home.join.none",
  "queue.project-invitation.summary.unnamed", "queue.project-invitation.detail", "projects.findable.meta", "projects.request.asked", "act.projectrequest.label.home",
  "act.projectrequestwithdraw.label.home", "member.founder.unnamed"];
const OURS = ["due.ours.passed", "due.ours.passed_says"];
// R22: the source notices, one item of each kind with its count; R28: a subject with no title; R31: a reply not recorded.
const SOURCES = ["queue.source-modified.one", "queue.source-modified.many", "queue.source-removed.one", "queue.source-removed.many",
  "queue.source.detail", "queue.source.untitled", "document.untitled.web"];
const PROJECT_ROWS = (w) => [`${w}.questions.one`, `${w}.questions.many`, `${w}.owner`, `${w}.owner.none`, `${w}.lastchange`, `${w}.lastchange.none`,
  `${w}.truncated`, `${w}.stage.means`, `${w}.stage.none`, ...["forming", "investigating", "matured", "closed"].map((s) => `${w}.stage.${s}`),
  "member.founder.unnamed", "screen.matter.unknown", "shell.glance.busy", "shell.glance.steady", "shell.glance.quiet", "project.rescue.title.nodate"];
// R25, R30: "Start a project".
const START = ["project.start.title", "project.start.title.help", "project.start.go", "project.visibility.title", "project.visibility.start.hidden",
  "project.visibility.start.discoverable", "project.visibility.start.later", "project.visibility.start.required"];

// R47, R48: the lists the recording forms are chosen from (`find-in-forms.mjs`), each worded by key.
const SEVEN_ZONES = ["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu"];
const DATE_KINDS = ["meeting", "adopted", "effective", "signed", "entered", "issued", "published", "received", "hearing", "period_covered", "edited"];
const STANDARD_KINDS = ["statute", "regulation", "ordinance", "court", "policy", "commitment", "standard"];
const MONEY_KINDS = ["allocation", "balance", "behested", "contribution", "debt", "expenditure", "fee_charged", "gift", "income", "other", "payment", "revenue", "settlement", "transfer"];

// R75: the decisions the record routes to a member, on Home and the queue: the form's words, and the items' own rows for an endorsement,
// an owner vote and an expertise (B422). R79 (b): an item with no sentence of its own, drawn by the unkeyed pair on both.
const ROUTED = ["screen.queue.forward.to", "refusal.ALREADY_THEIRS", "screen.queue.fieldfirst", "queue.unkeyed.summary", "queue.unkeyed.detail", "queue.source.untitled", "queue.owed.nobody",
  ...["item", "open", "question", "know", "cannot", "issuer.label", "issuer.help1", "issuer.help2", "how.label", "how.help1", "how.help2", "tried.label", "tried.help1", "tried.help",
    "fine1", "fine2", "leaves", "record", "refused.basis", "refused.issuer1", "refused.issuer2", "refused.yours1", "refused.yours2"].map((k) => `screen.queue.routed.auth.${k}`),
  "queue.endorsement-owed.summary", "queue.endorsement-owed.detail", "queue.endorsement-owed.owner.summary.add", "queue.endorsement-owed.owner.summary.remove",
  "queue.endorsement-owed.owner.detail", "queue.expertise-confirmation-owed.summary", "queue.expertise-confirmation-owed.detail"];
// R82: the invitation `adminendorse` answers, kept and shown once with the sentence that no email is sent (as Members does).
const INVITE = ["screen.members.invite.shown", "screen.members.invite.noemail"];
const ROUTED_ACTS = (screen) => [...ACTS(screen, ["adminendorse", "projectowneradd", "expertiseconfirm", "taskforward"]), `act.owed_taskdecide.label.${screen}`, "act.owed_taskdecide.does"];

// R65: the doors to Held captures and the Inbox, on Home and the queue; on Home, the line that says how many wait for a member to look.
const DOORS_TO = (screen) => [`act.release.label.${screen}`, "screen.held.name", "screen.inbox.name", "screen.home.waiting.counts", ...(screen === "queue" ? ["shell.queue.waiting"] : [])];

// R17 (B21): the to-dos to vouch for the photos she captured (the dashboard's sentence for one photo at a place, Home's having none) and the
// statements the vouching asks; approving a letter reads only its act's words.
const TODOS = ["screen.home.todo.vouch", "screen.home.todo.vouch.noplace", "screen.home.todo.vouch.noplace.one", "screen.dash-project.next.vouch.one",
  "screen.held.ack", "screen.held.ackhelp", "screen.held.mitigation", "screen.held.mitigationhelp", "screen.held.none", "screen.held.vouchmissing",
  "screen.held.vouchbad", "screen.held.selectfailed"];

const WORDS_OF = {
  home: [...SHARED, ...DOORS_TO("home"), "screen.home.name", "screen.home.purpose", "shell.group.unnamed", ...ACTS("home", ["promote", "startfrom", "taskresolve", "adoptversion", "keepversion", "release", "filingapprove"]), ...TODOS,
    "act.projectjoin.label.home", "act.projectjoin.does",
    "door.front.head", "door.front.intro", "door.front.blank", ...DOORS.flatMap((k) => [`door.front.${k}.name`, `door.front.${k}.hint`]),
    ...MARKS(["kind.todo", "kind.noticed", "kind.status"]), "mark.due.means", "home.update.ready", "home.update.security", "queue.update.see",
    ...SOURCES, "home.first.name", ...KEYED_QUEUE, "action.noreply.title", "queue.step-cost-shared.detail",
    ...START, "file.trigger.home", "screen.home.title.needed",
    "screen.home.script", "home.ready.title", "screen.home.invite", "screen.home.saywho", "screen.home.first.invite", "screen.home.first.identity", "screen.home.first.project",
    "act.promote.here.home", ...JOIN, ...OURS, "home.strip.ours_passed.one", "home.strip.ours_passed.other", "home.strip.ours_passed.opens", "screen.home.request.grant", "screen.home.request.decline", "screen.plan.judge.note",
    "act.projectrequestanswer.label.home", ...ROUTED, ...ROUTED_ACTS("home"), ...INVITE,
    "screen.home.strip.you", "screen.home.strip.group", "screen.home.needsyou", "screen.home.needsyou.holds", "screen.home.needsgroup", "screen.home.needsgroup.holds",
    "screen.home.open", "screen.home.why", "screen.home.fieldfirst", "screen.home.move.admin", "screen.home.move.member", "screen.home.move.anyone",
    "screen.home.areas", "screen.home.areas.holds", ...["investigation", "action", "members", "administration"].map((a) => `screen.home.area.${a}`),
    "screen.home.area.need.one", "screen.home.area.need.many",
    ...["project", "projects", "question", "questions", "ours", "group", "member", "members", "admin", "admins", "invited", "release"].map((r) => `screen.home.rd.${r}`),
    // R64: Home's remaining readings: documents, cases, people followed, clocks running, the edition line, expertise, the security level.
    ...["document", "documents", "case", "cases", "followed.one", "followed.other", "clock", "clocks", "security", "level.ordinary", "level.raised", "level.high"].map((r) => `screen.home.rd.${r}`),
    "screen.home.area.ourmove", "screen.home.area.theirmove", "screen.home.area.edition", "screen.home.area.expertise",
    ...["person", "confirmed", "declared"].map((k) => `screen.home.area.expertise.${k}`),
    ...["published", "comments", "comments.one", "draftonly", "draftonly.comments", "draftonly.comments.one"].map((k) => `screen.home.area.edition.${k}`),
    "screen.home.line.lastchange", "screen.home.line.places", "screen.home.line.languages", "screen.home.line.aiused", "screen.home.line.ailimit",
    "screen.home.projects", "screen.home.since", "screen.home.since.holds", "screen.home.since.changed", ...PROJECT_ROWS("screen.home")],
  elsewhere: [...SHARED, "screen.elsewhere.name", "screen.elsewhere.purpose", "elsewhere.title", "elsewhere.says", "elsewhere.records_nothing",
    ...ELSEWHERE_KINDS.flatMap((k) => [`elsewhere.kind.${k}`, `elsewhere.kind.${k}_says`]), ...["phone", "web", "email", "address", "mail"].map((h) => `elsewhere.reach.${h}`),
    "elsewhere.source", "elsewhere.none.head", "elsewhere.none.says", "elsewhere.none.noplace", "elsewhere.danger", "elsewhere.back"],
  queue: [...SHARED, ...DOORS_TO("queue"), "screen.queue.name", "screen.queue.purpose", ...MARKS(["kind.todo", "kind.noticed", "kind.status", "origin.accepted"]),
    "mark.due.means", "mark.hint.label", "mark.hint.means",
    ...ACTS("queue", ["taskresolve", "taskforward", "proposedispose", "queuesnooze", "queuemute", "adoptversion", "keepversion", "reminderanswer", "promote",
      "projectkeyset", "exploreapprove", "actionmove", "release", "filingapprove"]), ...TODOS,
    ...KEYED_QUEUE, "action.noreply.title", ...SOURCES, "file.trigger.queue", "conformance.rests", "conformance.falsify",
    "queue.update.section", "queue.update.section_says", "queue.update.ready", "queue.update.see", "updates.ready.security", "updates.ready.security_says",
    "act.owed_updatelater.label.queue", "act.owed_updatelater.does",
    "queue.done", "queue.muted.title", "queue.muted.help", "queue.muted.kind", "queue.muted.by", "queue.muted.by.undated", "queue.muted.unmute", "queue.muted.item",
    "act.queuemute.here.queue_kind", "queue.muted.unmute.item.help", "act.actionmove.here.queue", ...KIND_NAMES, ...OURS, "act.projectjoin.label.queue", "act.projectjoin.does",
    "act.projectrequestanswer.label.queue", "act.projectrequestanswer.does", "screen.home.request.grant", "screen.home.request.decline", "screen.plan.judge.note", "queue.project-request.summary", "queue.project-request.detail",
    "screen.queue.count.one", "screen.queue.count.many", "screen.queue.grouped", "screen.queue.sort", ...["added", "due", "case", "kind"].map((s) => `screen.queue.sort.${s}`),
    "screen.queue.note", "screen.queue.note.once", "screen.queue.nocase", "screen.queue.empty", "screen.queue.more", "screen.queue.more.one", "screen.queue.open",
    "screen.queue.hint.how", "screen.queue.hint.matched", "screen.queue.hint.method", "screen.queue.hint.trust", "screen.queue.hint.rate", "screen.queue.hint.rate.none",
    "screen.queue.hint.not", "screen.queue.hint.not.text", "screen.queue.forward.to", "screen.queue.snooze.until", "screen.queue.reminder.on", "screen.queue.fieldfirst",
    "screen.queue.why", "screen.queue.question", "screen.queue.projectkey", "screen.queue.unsent.pickup", "screen.queue.unsent.keep", "screen.queue.unsent.drop",
    // R68, R69, R75, R79: Defer beside Dismiss, a snoozed case and "Bring back", the routed decisions, the helps, the day picker, the answered rows.
    "screen.queue.defer", "screen.queue.bringback", "screen.queue.snoozed.head", "screen.queue.snoozed.holds", "screen.queue.snoozed.until", ...ROUTED, ...ROUTED_ACTS("queue"), ...INVITE, "queue.act.dothis.help", "queue.act.open.help", "screen.queue.snooze.pick", "queue.signer-self-registered.members", "queue.signer-self-registered.known",
    "queue.answered.done", "queue.answered.dismissed", "queue.answered.dismissed.noreason", "queue.answered.muted", "queue.answered.generic",
    // R58 to R61: choosing several items, what was answered, the feeds' honesty and the set-aside findings.
    "queue.multi.entry", "queue.multi.choose", "queue.multi.head", "queue.multi.head2", "queue.multi.chosen", "queue.multi.chosen.one", "queue.multi.done",
    "queue.multi.forward", "queue.multi.snooze", "queue.multi.snooze.help", "queue.multi.dismiss", "queue.multi.refused", "queue.multi.result", "queue.multi.result.one",
    "queue.multi.why.letter", "queue.multi.why.check", "queue.multi.done.help2", "queue.answered.forwarded.unnamed", "queue.multi.back", "screen.finder.pick", "screen.finder.pickfirst", "shell.unread",
    "queue.answered.title", "queue.answered.head", "queue.answered.heading", "queue.answered.help", "queue.answered.byyou", "queue.answered.bymember", "queue.answered.byother",
    "queue.answered.forwarded", "queue.answered.snoozed", "queue.answered.snoozed.meta", "time.at", "time.clock", "time.am", "time.pm",
    "queue.aside.help", "queue.aside.help2", "queue.aside.dismissed", "queue.aside.dismissed.bymember", "queue.aside.deferred", "queue.aside.deferred.bymember", "queue.aside.v2",
    "progression.finding.state.dismissed", "queue.allclear.withheld", "queue.allclear.failed", "queue.allclear.failed2", "queue.allclear.failed.feed", "queue.tryagain",
    ...KIND_FEEDS, ...["todo", "noticed", "status"].flatMap((k) => [`queue.none.${k}`, `queue.none.${k}2`]), "screen.queue.uptodate", "screen.queue.gohome"],
  projects: [...SHARED, "screen.projects.name", "screen.projects.purpose", "screen.projects.sub", "screen.imported.name", ...ACTS("projects", ["promote", "projectjoin"]),
    "projects.empty.sub", "projects.empty.note", "projects.invited.head", "projects.invited.says", "projects.findable.head", "projects.findable.says", "projects.findable.meta",
    "projects.request.asked", "act.projectrequest.label.projects", "act.projectrequestwithdraw.label.projects", "screen.projects.nocreate", "member.founder.unnamed",
    "theme.section", "theme.across", "theme.never.evidence", "theme.every", ...START, "file.trigger.projects", "screen.projects.title.needed",
    "screen.projects.search.label", "screen.projects.search.help", "screen.projects.filter.label", "screen.projects.filter.help",
    "screen.projects.filter.all", "screen.projects.filter.in", "screen.projects.filter.own",
    ...PROJECT_ROWS("screen.projects")],
  finder: [...SHARED, "screen.finder.name", "screen.finder.purpose", "mark.origin.search.name", "mark.origin.search.means", "mark.gap.nobody.name", "mark.gap.nobody.means",
    ...ACTS("finder", ["search", "select", "findin", "selectionrelease", "frontier", "calculationcreate"]),
    "screen.finder.sub", "screen.finder.words", "screen.finder.wordsfirst", "screen.finder.total.one", "screen.finder.total.many", "screen.finder.noresult",
    "screen.finder.covers", "screen.finder.captureit", "screen.finder.widen", "screen.finder.widen.passages", "act.search.label.finder.widen", "screen.finder.pick", "screen.finder.held.one", "screen.finder.held.many",
    "screen.finder.until", "screen.finder.nobody", "screen.finder.nobody.one", "screen.finder.nobody.none", "screen.finder.count.question", "screen.finder.count.from", "screen.finder.count.to",
    "screen.finder.counted", "screen.finder.pickfirst", ...["legend", "support", "against", "cited", "newly_against", "set_changed", "added_since", "gone_since", "back", "back.help"].map((k) => `screen.finder.cite.${k}`), "screen.finder.holdfirst",
    // R44, R45: the browse, its marks, and Watch, Flag and Clear.
    "find.query.placeholder", "find.browse.says", "find.browse.new.means", "find.browse.nosince", "find.browse.nosince.summary", "find.browse.more", "find.browse.showmore",
    "find.kind.label", "find.kind.all", "find.kind.document", "find.kind.question", "find.kind.action", "find.kind.entity", "find.kind.plan",
    "find.state.label", "find.state.any", "find.state.new", "find.state.watched", "find.state.secondlook",
    ...["document", "passage", "person", "organization", "question", "action", "plan"].map((k) => `find.row.kind.${k}`),
    "find.row.new", "find.row.watched", "find.row.secondlook", "find.row.unwatch", "find.secondlook.note", "find.secondlook.note.help",
    "act.owed_watchitem.label.finder", "act.owed_watchitem.does", "act.owed_secondlook.label.finder", "act.owed_secondlook.does",
    "act.secondlookclear.label.finder", "act.secondlookclear.does", "act.watchitem.off.does",
    "refusal.MARK_NO_ITEM", "refusal.MARK_NO_SUCH_ITEM", "refusal.MACHINE_CANNOT_MARK", "refusal.SECOND_LOOK_NO_NOTE", "refusal.SECOND_LOOK_NOT_OPEN",
    // R54 to R57: the words field and choices, the table, the scope and the three routes, what was covered, and citing the held set.
    "find.query.help", "list.fresh", "screen.finder.showas", "screen.finder.showas.list", "screen.finder.showas.table", "screen.finder.table.view.help",
    "screen.finder.table.intro", "screen.finder.table.count.one", "screen.finder.table.count.other", "screen.finder.table.sorting", "shell.sort",
    ...["item", "kind", "state", "updated"].flatMap((c) => [`column.finder.${c}.name`, `column.finder.${c}.shows`]),
    ...ITEM_STATES.flatMap((k) => [`state.item.${k}.name`, `state.item.${k}.means`, `state.item.${k}.can`]), ...ITEM_STATES.filter((k) => !["waiting", "flagged", "watched", "planned", "active"].includes(k)).map((k) => `state.item.${k}.cannot`),
    ...["open", "paused", "closed"].flatMap((k) => [`screen.plan.state.${k}`, `state.plan.${k}.means`, `state.plan.${k}.can`]),
    "screen.find-in.lookin", "screen.finder.scope.help", "screen.finder.scope.everything", "screen.finder.scope.cases",
    "screen.finder.route.fields", "screen.finder.route.fields.holds.one", "screen.finder.route.fields.holds.other", "screen.finder.route.passages",
    "screen.finder.route.passages.holds.one", "screen.finder.route.passages.holds.other", "screen.finder.route.subjects.holds.one", "screen.finder.route.subjects.holds.other",
    "screen.finder.subjects.heading", "screen.finder.subjects.help", "screen.finder.named.nodoc", "screen.finder.named.nodoc.one", "screen.finder.route.apart",
    "screen.finder.route.cross", "screen.finder.route.cross.heading", ...["source", "office", "ordinance", "parcel", "contract", "fund", "program", "place", "proceeding"].map((k) => `find.row.kind.${k}`),
    "screen.finder.covered.heading", "screen.finder.covered.levels", "screen.finder.covered.rests", "screen.finder.covered.read", "screen.finder.covered.read.says.one",
    "screen.finder.covered.read.says.other", "screen.finder.covered.docs", "screen.finder.covered.docs.says.one", "screen.finder.covered.docs.says.other", "screen.finder.covered.looked",
    // R67, R77, R78: the frontier at four levels, the partial match, a hit with no title.
    "screen.answers.look", "screen.answers.state.other", ...["document", "content", "meaning", "internet"].map((l) => `screen.answers.level.${l}`), ...["LOOKED_FOUND", "LOOKED_ABSENT", "NOT_LOOKED"].map((s) => `screen.answers.state.${s}`),
    "screen.finder.noresult.partial", "screen.finder.partial.head", "queue.source.untitled", "shell.card.document", "shell.card.passage", "shell.card.member", "shell.card.person",
    "screen.find-in.passage", "act.cite.label.find-in", "screen.document.cite.question", "screen.document.cite.role", "screen.document.cite.noquestion", "screen.findin.cite.supports",
    "screen.findin.cite.against", "screen.findin.cite.norole", "queue.answered.col.did", ...["newly_cited_supporting_the_question", "left_as_it_was", "the_question_already_cited_it",
      "cite_every_document_you_hold_together_in", "each_document_is_cited_whole_as_its_own_", "a_document_the_question_already_cites_is", "if_the_set_changed_after_you_held_it_wha",
      "cites_every_document_you_hold_together_i", "you_choose_the_question_and_how_they_bea", "cites_every_document_you_hold_together_i.2", "one_already_cited_is_left_as_it_was_and_"].map((k) => `screen.finder.a17.${k}`),
    // R43: the Theme filter.
    "theme.filter", "theme.filter.any", "theme.filter.help", "act.themeread.label.finder", "act.themeread.does", "theme.placed", "theme.hunches", "theme.hunch.note"],
  "find-in": [...SHARED, "screen.find-in.name", "screen.find-in.purpose", "mark.origin.search.name", "mark.origin.search.means", "mark.origin.accepted.name", "mark.origin.accepted.means",
    ...ACTS("find-in", ["findin", "standingquestionset", "recordpersonfact", "recorddatedfact", "standarddeclare", "recordfact", "tabledeclare", "cite", "search"]),
    "shell.unavailable.nothing.title", "shell.unavailable.home", "screen.findin.cite.supports", "screen.findin.cite.against", "screen.findin.cite.norole",
    "screen.find-in.sub", "screen.find-in.lookin", "screen.find-in.lookin.help", "screen.find-in.scope.document", "screen.find-in.scope.this", "screen.find-in.scope.held", "screen.find-in.scope.project",
    "screen.find-in.scope.none", "screen.find-in.what", ...["people", "money", "dates", "requirements", "events", "term"].map((k) => `screen.find-in.kind.${k}`),
    "screen.find-in.term", "screen.find-in.term.help", "screen.find-in.question.help", "findin.question.choose", "screen.document.cite.noquestion",
    "screen.find-in.kindsfirst", "screen.find-in.section", "screen.find-in.termsection", "screen.find-in.nothing", "screen.find-in.notread", "screen.find-in.notread.one",
    ...["footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box", "speaker_note", "master_text", "cell_note"].map((k) => `content.part_kind.${k}`),
    "screen.find-in.quote", "screen.find-in.passage", "screen.find-in.recorded", "screen.find-in.note", "screen.find-in.questionfirst", "screen.find-in.keeping",
    ...["kind", "value", "date", "cite", "issuer", "reason", "amount", "currency", "phase", "from", "to", "header", "standardkind", "payee.short"].map((f) => `screen.find-in.field.${f}`),
    // R47, R48: the recording forms, their lists by key, the acknowledgement, a passage's count and a match's place.
    "screen.find-in.fact.office", "findin.prefilled", "screen.find-in.valid", "screen.find-in.valid.help", "screen.find-in.valid.from", "screen.find-in.valid.to",
    "screen.find-in.valid.precision", "screen.find-in.valid.zone", ...["day", "minute", "second", "edtf"].map((p) => `label.timeprecisions.${p}`),
    ...SEVEN_ZONES.map((z) => `label.timezones.${z}`), "refusal.BAD_VALIDITY",
    ...["name", "birth", "death", "locality", "address", "contact"].map((k) => `screen.person.kind.${k}`),
    "screen.timeline.datekind", ...DATE_KINDS.map((k) => `screen.timeline.datekind.${k}`), ...STANDARD_KINDS.map((k) => `screen.standard.kind.${k}`),
    ...MONEY_KINDS.map((k) => `label.moneykinds.${k}`), ...["proposed", "adopted", "adjusted", "actual"].map((k) => `label.moneyphases.${k}`),
    ...["assessed", "collected", "encumbered", "incurred", "paid"].map((k) => `label.moneystages.${k}`),
    "screen.money.f.stage", "money.flow.step", "screen.find-in.flow.help", "screen.money.f.payer", "screen.money.f.payee", "findin.fieldneeded",
    "findin.recorded", "screen.find-in.recorded.fact", "screen.person.name", "screen.timeline.name", "screen.standard.name", "screen.money.name",
    "passage.facts.count", "passage.facts.count.one", "findin.match.sheet", "findin.match.sheet.norow", "findin.cell.uncalculated", "findin.match.nameinpassage"],
  answers: [...SHARED, "screen.answers.name", "screen.answers.purpose", "screen.finder.words", "screen.finder.none", "screen.finder.wordsfirst", "mark.origin.search.name", "mark.origin.search.means",
    ...ACTS("answers", ["ask", "ruleanswer", "search", "standingquestionset", "standingquestionend"]), "act.search.label.finder",
    "ai.refused.limit", "ai.refused.limit.unjudged", "ai.refused.off", "ai.refused.projectkeptaway", "ai.refused.signinnotconnected", "refusal.ANSWER_MALFORMED",
    "ai.label.untested", "screen.answers.sub", "screen.answers.question", "screen.answers.questionfirst", "screen.answers.machine", "screen.answers.asread",
    "screen.answers.holdings", "screen.answers.looks", "screen.answers.look", ...["document", "content", "meaning", "internet"].map((l) => `screen.answers.level.${l}`),
    ...["LOOKED_FOUND", "LOOKED_ABSENT", "NOT_LOOKED", "other"].map((s) => `screen.answers.state.${s}`), "screen.answers.withheld", "screen.answers.withheld.one", "screen.answers.notestablished",
    "screen.answers.legal", "screen.answers.offtitle", "screen.answers.offsub", "screen.answers.rule.value", "screen.answers.rule.basis", "screen.answers.rule.notheld",
    ...["legal_information", "procedural_fact", "computed_fact"].map((l) => `screen.answers.label.${l}`), "screen.answers.refused.off", "screen.answers.refused.notdeployed",
    "screen.answers.keeping", "screen.answers.kept", "screen.answers.cadence.weekly",
    // R52, R53: the ask's progress, its check, and the states.
    "ai.progress.reading.ask", "ai.progress.composing.answer", "ai.progress.checking", "ai.progress.hold.answer", "ai.progress.means", "ai.progress.checked.all",
    "ai.progress.checked.all.means", "ai.progress.check.failed", "screen.answers.failed.next", "refusal.ASSISTANT_REMOTE_NOT_READY", "screen.connect.name"],
};

/** The seven screens, in the registry's order of the rail (Home and its Where else to go, Projects, Queue, Find, Find in
    this, Ask). */
export const SCREENS = Object.freeze([home, elsewhere, projects, queue, finder, findIn, answers]
  .map((s) => Object.freeze({ ...s, words: Object.freeze([...new Set([...WORDS_OF[s.id], ...(CUT_EXTRA[s.id] || [])])]) })));
