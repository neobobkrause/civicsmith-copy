/* screens-intake: bringing material in and deciding what enters the record (N897 (1); draft-T46-interface.md §2.4).
 * Five registry screens, `capture`, `held`, `archive` (since T47), `open-file` and `inbox`, each met to interface-shell's screen contract (its
 * R21): `{id, reads, render, acts, words}`. Pure: it reads no table and writes nothing; every read and act is an op the
 * plane serves, called through the kit.
 *
 * The contract is interface-shell R21's (K2996, K2998): every function is self-contained (its parameters, the kit `cs`
 * and the language's own globals), so the shell composes the page's one script from their text and the same functions
 * run in node for the tests. `reads(view)` answers `{name: {op, query, empty?}}`; `render(cs, view)` the screen's HTML;
 * each act `{op, label, send(view, el, cs, extra), done?(view, answer, cs), rereads?, refusals?, dialog?}`. It also
 * reads the parts K2999 and K3002 added to R21: `cs.download(op, {query, body})`, a byte answer handed to the browser
 * as a file (R6); `cs.digest(text)`, the SHA-256 of a text (the bundle an acquire promotes, R1); `cs.now()`; a `send`
 * answering a promise; `extra.picked`, the picked rows' keys; and `{refuse: key, fills}`, a word of the list beside the act.
 *
 * Words by key (R26; K3366, K3368; DEC-257, DEC-258): this module holds no member-facing English. `words` is the keys of
 * `setup-words`' `WORD_ROWS` each screen draws, and the shell reads every sentence through them. */

import { CAPTURE_SCREEN } from "./capture.mjs";

/* R42 (C55): the one drawing of what a check found, for `screens-inquiry`'s document page to import (K4164) */
export { checkOutcome, supportingReasons } from "./capture.mjs";
import { HELD_SCREEN } from "./held.mjs";
import { OPEN_FILE_SCREEN } from "./open-file.mjs";
import { INBOX_SCREEN } from "./inbox.mjs";
import { ARCHIVE_SCREEN } from "./archive.mjs";
import { ABOUT_KNOCKER_SCREEN } from "./about-knocker.mjs";
import { LEADS_SCREEN } from "./leads.mjs";
import { WATCHING_SCREEN } from "./watching.mjs";

/* R36 (fix round 10, G7): the sentences reading-pipeline holds for a file kind it does not read (`UNSUPPORTED_FORMAT {kind}`), and its general one with the kind filled */
const UNSUPPORTED = ["rtf", "email", "legacy_word", "legacy_excel", "legacy_powerpoint", "legacy_office", "tiff", "gif", "webp", "heic", "avif", "bmp", "jp2", "ico", "kind"]
  .map((k) => "reading-pipeline.index.unsupported_" + k);

/* The keys each screen reads (R26). */
export const SCREEN_KEYS = Object.freeze({
  capture: Object.freeze([
    ...UNSUPPORTED,
    "act.acquire.label.capture", "act.capturerequest.label.capture", "act.captureupload.label.capture",
    "capture.cite", "capture.cite.tip", "capture.filed.project", "capture.filed.question", "act.monitor.label.capture", "act.monitorset.label.capture",
    "act.testify.label.capture", "act.writinghelp.label.capture", "ai.label.untested", "capture.fieldneeded",
    "photo.reminder", "refusal.BAD_LOCATOR", "refusal.EMPTY", "refusal.FETCH_FAILED", "refusal.SOURCE_REFUSED",
    "refusal.TOO_LARGE", "screen.capture.address.archive", "screen.capture.address.checked.modified", "screen.capture.address.checked.removed", "screen.capture.address.checked.unchanged", "screen.capture.address.checked.unknown",
    "screen.capture.address.done", "screen.capture.address.existed", "screen.capture.address.freq",
    "screen.capture.address.freq.daily", "screen.capture.address.freq.hourly", "screen.capture.address.freq.monthly",
    "screen.capture.address.freq.per_meeting", "screen.capture.address.freq.weekly", "screen.capture.address.help",
    "screen.capture.address.label", "screen.capture.address.note", "screen.capture.address.notpromoted",
    "screen.capture.address.requested", "screen.capture.address.requested.waits", "screen.capture.address.watchabout",
    "screen.capture.address.watchafter", "screen.capture.address.watching", "screen.capture.file.choose",
    "screen.capture.file.choosehelp", "screen.capture.file.done", "screen.capture.file.downloaded",
    "screen.capture.file.existed", "screen.capture.file.how", "screen.capture.file.how.downloaded",
    "screen.capture.file.how.handed", "screen.capture.file.how.made", "screen.capture.file.how.sent",
    "screen.capture.file.missing", "screen.capture.file.nofile", "screen.capture.file.note",
    "screen.capture.file.toaddress", "screen.capture.file.toolong", "screen.capture.file.what",
    "screen.capture.file.where", "screen.capture.file.wherehelp", "screen.capture.help.empty",
    "screen.capture.help.only", "screen.capture.refusal.MEMBER_SESSION_REQUIRED",
    "screen.capture.refusal.UPLOAD_NO_STATEMENT", "screen.capture.refusal.upload.EMPTY",
    "screen.capture.refusal.upload.TOO_LARGE", "screen.capture.saw.after", "screen.capture.saw.badwhen",
    "screen.capture.saw.done", "screen.capture.saw.draft", "screen.capture.saw.missing", "screen.capture.saw.note",
    "screen.capture.saw.when", "screen.capture.saw.whenhelp", "screen.capture.saw.where",
    "screen.capture.saw.wherein", "screen.capture.saw.words", "screen.capture.sub", "screen.capture.tab.address",
    "screen.capture.tab.file", "screen.capture.tab.saw", "screen.capture.tabs", "shell.unread",
    "capture.finish", "capture.forquestion", "capture.forquestion.help", "capture.forquestion.refused.summary",
    "capture.unfinished", "document.untitled.web", "refusal.BAD_FOR", "screen.capture.forq",
    "refusal.uncatalogued", "screen.held.untitled", "screen.capture.openit", "screen.capture.openit.help", "screen.capture.leaveit",
    "screen.capture.leaveit.help", "screen.capture.a64.already_in_the_record_as", "screen.capture.a64.the_site_still_gives_the_same_document",
    "screen.capture.a64.the_site_has_changed_since", "screen.capture.a64.your_team_holds_a_capture_from_14_septem",
    "screen.capture.a64.capturing_it_again_keeps_the_new_copy_be", "screen.capture.a64.whoever_cited_the_old_one_stays_on_it_un",
    "screen.capture.a64.capture_the_new_copy", "state.loading", "screen.capture.a64.captured_by", "screen.capture.a64.nothing_added",
    "screen.capture.a64.undetermined",
    /* R45, R50 (T51 fix round; DEC-375, DEC-384) */
    "screen.capture.address.working", "screen.capture.address.working.head", "screen.capture.address.existed.open",
    "screen.capture.render.keep.site", "screen.capture.render.keep.visitor", "screen.capture.render.keep.explain1", "screen.capture.render.keep.explain2",
    "screen.capture.archive.summary", "screen.capture.archive.explain1", "screen.capture.archive.explain2", "screen.watching.sweepdef.match",
    "screen.capture.cred.head", "screen.capture.cred.turned", "screen.capture.cred.why1", "screen.capture.cred.why2", "screen.capture.cred.user",
    "screen.capture.cred.secret", "screen.capture.cred.sealed1", "screen.capture.cred.sealed2", "screen.capture.cred.retry", "screen.capture.cred.only1",
    "screen.capture.cred.only2", "screen.capture.cred.ref.machine1", "screen.capture.cred.ref.machine2", "screen.capture.cred.ref.own1",
    "screen.capture.cred.ref.own2", "screen.capture.cred.ref.notretry", "screen.capture.cred.stored", "screen.capture.cred.notshown",
    "screen.capture.cred.list", "screen.capture.cred.listnote1", "screen.capture.cred.listnote2", "screen.capture.cred.tip1", "screen.capture.cred.tip2",
    "act.owed_capturecredentialsupply.label.capture", "act.owed_capturecredentiallist.label.capture", "act.owed_capturecredentialwithdraw.label.capture",
    "act.capturerequestretry.label.capture",
    "act.capturerequests.label.capture", "screen.watching.name", "screen.leads.name", "shell.card.question", "shell.card.document", "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE", "refusal.ACQUIRE_TIMED_OUT",
    "screen.capture.later.head", "screen.capture.later.about", "screen.capture.later.waiting", "screen.capture.later.captured", "screen.capture.later.turned",
    /* R2 (T51 fix round 3, C17): whether a project-less upload was read */
    "screen.document.text.label", "screen.document.text.full", "screen.document.text.none", "screen.document.text.read", "screen.document.text.unread", "capture.picture.unread",
    /* R49, R2, N4 (T51 fix round 4; DEC-412): the rows the design wrote for the filing of a found document, the none of "requests for later" and the next step of an unread upload */
    "screen.capture.address.filedhere", "screen.capture.later.none", "screen.document.text.unread.next",
    /* R38, R31 (fix round 5, E7, E8; K4530): a held copy's reading asked for by the press, and what "Finish it" was answered; the nearest held rows stand in (K4269) */
    "transcribe.why.evidenceabsent", "refusal.CAPTURE_NOT_HELD", "acquisition.index.render_pending_note", "acquisition.note.continuation_files_new",
    /* G72, G74 (fix round 7; K4269): the nearest held rows stand in: a closed capture, and a project the member is not in; the closed capture has its own row now, `refusal.NO_SUCH_SESSION` (DEC-425) */
    "refusal.NO_SUCH_SESSION", "project.notmember", "refusal.PROMOTE_NOT_A_PARTICIPANT",
    /* G110 (fix round 8): a skipped supporting file is told by its reason's code: the count line and one sentence for each kind of reason */
    "screen.capture.supporting.kept", "screen.capture.supporting.cap", "screen.capture.supporting.toolarge", "screen.capture.supporting.unavailable",
  ]),
  held: Object.freeze([
    "act.heldcaptures.label.held", "act.heldrestore.label.held", "act.heldsetaside.label.held",
    "act.release.label.held", "mark.gap.refused.means", "mark.gap.refused.name", "mark.gap.undetermined.means",
    "mark.gap.undetermined.name", "mark.gap.withheld.means", "mark.gap.withheld.name", "refusal.CRUCIAL_IN_BATCH",
    "refusal.ENTRY_REQUIREMENTS", "screen.held.ack", "screen.held.ackhelp", "screen.held.age", "screen.held.age.one",
    "screen.held.age.today", "screen.held.archive", "screen.held.archive.filed", "screen.held.archive.notfiled",
    "screen.held.archivefiles", "screen.held.archivemore", "screen.held.asideby", "screen.held.asideempty",
    "screen.held.col", "screen.held.eligibility.undetermined", "screen.held.empty", "screen.held.for",
    "screen.held.forundetermined", "screen.held.from", "screen.held.grade.nocapture", "screen.held.grade.received",
    "screen.held.grade.stated", "screen.held.grade.testimony", "screen.held.grade.ungraded",
    "screen.held.grade.unread", "screen.held.ineligible", "screen.held.ineligible.alone",
    "screen.held.ineligible.contested", "screen.held.ineligible.crucial", "screen.held.mitigation",
    "screen.held.mitigationhelp", "screen.held.more", "screen.held.none", "screen.held.noproject",
    "screen.held.project", "screen.held.released", "screen.held.restored", "screen.held.selectfailed",
    "screen.held.setaside", "screen.held.setasidecount", "screen.held.sub", "screen.held.thumb",
    "screen.held.untitled", "screen.held.vouchbad", "screen.held.vouchmissing", "screen.held.waiting",
    "screen.held.withheld", "state.undetermined", "document.uploaded.by", "size.kb", "size.mb", "size.small",
    "screen.capture.openit", "screen.capture.openit.help", "state.item.review.name", "screen.held.name",
    "screen.capture.address.filedhere", "shell.unread", "document.untitled.web",
    /* fix round 10 (cause 33): the held rows that stand in for the filter and the doors until the design's own are in the list (K4269) */
    "ai.whose.own", "ai.whose.group", "document.read.next", "document.read.prev",
  ]),
  archive: Object.freeze([
    "act.archivelist.label.archive", "act.gradenote.label.archive", "act.heldsetaside.label.archive",
    "act.release.label.archive", "mark.gap.refused.means", "mark.gap.refused.name", "refusal.CRUCIAL_IN_BATCH",
    "refusal.ENTRY_REQUIREMENTS", "screen.archive.alreadyheld", "screen.archive.col", "screen.archive.empty",
    "screen.archive.facts", "screen.archive.facts.entries", "screen.archive.filed", "screen.archive.filedunseen",
    "screen.archive.files", "screen.archive.folder", "screen.archive.gradeabout", "screen.archive.link",
    "screen.archive.lists", "screen.archive.more", "screen.archive.names", "screen.archive.nonote",
    "screen.archive.notopened", "screen.archive.onlynotfiled", "screen.archive.onlynotfiledact",
    "screen.archive.refused.none", "screen.archive.see", "screen.archive.setaside", "screen.archive.sum.filed",
    "screen.archive.sum.folders", "screen.archive.sum.held", "screen.archive.sum.notfiled",
    "screen.archive.ungraded", "screen.archive.waiting", "screen.held.ack", "screen.held.ackhelp",
    "screen.held.mitigation", "screen.held.mitigationhelp", "screen.held.none", "screen.held.released",
    "shell.unavailable.home", "shell.unavailable.nothing.says", "shell.unavailable.nothing.title",
    "state.undetermined",
  ]),
  "open-file": Object.freeze([
    "act.deepercheck.label.open-file", "act.openoriginal.label.open-file", "act.openwithwarning.label.open-file",
    "act.releasescanhold.label.open-file", "act.safeview.label.open-file", "mark.origin.machine.means",
    "mark.origin.machine.name", "screen.open-file.checks", "screen.open-file.checks.none", "screen.open-file.closed",
    "screen.open-file.deeper", "screen.open-file.deeper.about", "screen.open-file.deeper.done",
    "screen.open-file.deeper.queued", "screen.open-file.deeper.running", "screen.open-file.deeper.state",
    "screen.open-file.findings", "screen.open-file.held.about", "screen.open-file.note.at",
    "screen.open-file.note.line", "screen.open-file.opened", "screen.open-file.release.done",
    "screen.open-file.release.pending", "screen.open-file.result.clean", "screen.open-file.result.failed",
    "screen.open-file.result.found", "screen.open-file.result.not_scanned", "screen.open-file.risk.held",
    "screen.open-file.risk.held.means",
    "screen.open-file.risk.high", "screen.open-file.risk.high.means", "screen.open-file.risk.low",
    "screen.open-file.risk.low.means", "screen.open-file.safe", "screen.open-file.safe.about",
    "screen.open-file.safe.cell", "screen.open-file.safe.cite", "screen.open-file.safe.cut", "screen.open-file.safe.cut.more",
    "screen.open-file.safe.notdrawn", "screen.open-file.safe.sheet.unreadable", "screen.open-file.safe.sheetscut", "screen.open-file.safe.origin",
    "screen.open-file.safe.pages", "screen.open-file.safe.ready", "screen.open-file.safe.sheet",
    "screen.open-file.safe.truncated", "screen.open-file.safe.value", "screen.open-file.status",
    "screen.open-file.status.held", "screen.open-file.status.line", "screen.open-file.status.overdue",
    "screen.open-file.status.queued", "screen.open-file.tool.clamav", "screen.open-file.warn", "screen.open-file.warn.both",
    "screen.open-file.warn.confirm", "screen.open-file.warn.device", "screen.open-file.warn.ends",
    "screen.open-file.warn.macros", "screen.open-file.warn.notoffered", "screen.open-file.warn.title",
    "screen.open-file.weekly", "screen.open-file.why", "shell.unavailable.home", "shell.unavailable.nothing.says",
    "shell.unavailable.nothing.title", "refusal.NO_SAFE_VIEW", "screen.open-file.check.notyet", "screen.open-file.high.yours",
    "screen.open-file.next.head", "screen.open-file.next.yours", "screen.open-file.safetext", "screen.open-file.safetext.cut",
    "shell.unread", "screen.open-file.digest.checked", "refusal.DIGEST_MISMATCH", "refusal.DIGEST_MISMATCH.unheld",
    /* fix round 10 (R35b, R33): the held rows that stand in until the design's own are in the list (K4269): the owner's sentence for an unread picture type */
    "reading-pipeline.index.unsupported_tiff", "reading-pipeline.index.unsupported_heic", "reading-pipeline.index.unsupported_bmp", "reading-pipeline.index.unsupported_kind",
  ]),
  "about-knocker": Object.freeze([
    "act.sourcedisclose.label.about-knocker", "act.sourceconsent.label.about-knocker", "act.sourceconsentwithdraw.label.about-knocker",
    "act.sourcepersonlink.label.about-knocker", "act.writinghelp.label.about-knocker", "capture.fieldneeded", "screen.capture.help.empty",
    "screen.inbox.ladder", "screen.inbox.ladder.unknown", "screen.inbox.ladder.same", "screen.inbox.ladder.partly", "screen.inbox.ladder.group",
    "screen.inbox.ladder.public", "screen.inbox.ladder.basis", "shell.unavailable.home", "shell.unavailable.nothing.says", "shell.unavailable.nothing.title",
    "screen.about-knocker.intro1", "screen.about-knocker.intro2", "screen.about-knocker.known.head", "screen.about-knocker.known.help1",
    "screen.about-knocker.known.help2", "screen.about-knocker.how.self", "screen.about-knocker.how.third", "screen.about-knocker.how.hostile",
    "screen.about-knocker.how.opt.self", "screen.about-knocker.how.opt.filing", "screen.about-knocker.how.opt.third", "screen.about-knocker.how.opt.hostile",
    "screen.about-knocker.how.label", "screen.about-knocker.knownto.group", "screen.about-knocker.audience.member", "screen.about-knocker.audience.group",
    "screen.about-knocker.audience.public", "screen.about-knocker.knownto.label", "screen.about-knocker.consent.members", "screen.about-knocker.hostile.claim",
    "screen.about-knocker.kind.attribute", "screen.about-knocker.kind.name", "screen.about-knocker.kind.link", "screen.about-knocker.attribute.label",
    "screen.about-knocker.attribute.occupation", "screen.about-knocker.attribute.employer", "screen.about-knocker.attribute.role",
    "screen.about-knocker.value.label", "screen.about-knocker.value.help", "screen.about-knocker.claimedby.label", "screen.about-knocker.claimedby.help1",
    "screen.about-knocker.claimedby.help2", "screen.about-knocker.claimedat.label", "screen.about-knocker.claimedat.help1", "screen.about-knocker.claimedat.help2",
    "screen.about-knocker.store.legend", "screen.about-knocker.store.yes", "screen.about-knocker.store.no", "screen.about-knocker.sight.legend",
    "screen.about-knocker.evidence.label", "screen.about-knocker.evidence.help", "screen.about-knocker.confirms.label", "screen.about-knocker.confirms.none",
    "screen.about-knocker.confirms.help", "screen.about-knocker.read.logged1", "screen.about-knocker.read.logged2", "screen.about-knocker.notrecorded",
    "screen.about-knocker.publish.heading", "screen.about-knocker.publish.intro1", "screen.about-knocker.publish.intro2", "screen.about-knocker.consent.detail",
    "screen.about-knocker.audience.label", "screen.about-knocker.consent.evidence", "screen.about-knocker.person.heading", "screen.about-knocker.person.intro1",
    "screen.about-knocker.person.intro2", "screen.about-knocker.person.which", "screen.about-knocker.person.replace", "screen.about-knocker.person.refused.org",
    "screen.about-knocker.person.refused.org.next",
  ]),
  leads: Object.freeze([
    "act.lead.label.leads", "act.leadread.label.leads", "act.leadlook.label.leads", "act.leadshare.label.leads", "act.writinghelp.label.leads",
    "screen.capture.help.empty", "screen.capture.saw.draft", "screen.leads.intro1", "screen.leads.intro2", "screen.leads.write.heading", "screen.leads.write.words",
    "screen.leads.write.where", "screen.leads.write.note1", "screen.leads.write.note2", "screen.leads.mine.head", "screen.leads.list.help", "screen.leads.state.never",
    "screen.leads.state.absent", "screen.leads.state.unclear", "screen.leads.state.part", "screen.leads.state.found", "screen.leads.one.head",
    "screen.leads.written", "screen.leads.look.line", "screen.leads.shared.line", "screen.leads.look.head", "screen.leads.look.state",
    "screen.leads.look.opt.absent", "screen.leads.look.opt.unclear", "screen.leads.look.opt.part", "screen.leads.look.opt.found", "screen.leads.look.kind",
    "screen.leads.look.kind.help", "screen.leads.look.kind.none", "screen.leads.look.kind.doc", "screen.leads.look.kind.passage", "screen.leads.look.which",
    "screen.leads.look.detail", "screen.leads.share.head", "screen.leads.share.project", "screen.leads.share.project.help", "screen.leads.share.reason",
    "screen.leads.share.reason.help", "screen.leads.share.note1", "screen.leads.share.note2", "shell.unread",
  ]),
  watching: Object.freeze([
    "act.monitoring.label.watching", "act.monitorpause.label.watching", "act.monitorslate.label.watching", "act.sweeps.label.watching",
    "screen.watching.intro", "screen.watching.running.head", "screen.watching.running", "screen.watching.running.meta", "screen.watching.paused",
    "screen.watching.paused.line", "screen.watching.paused.effect", "screen.watching.pause", "screen.watching.resume", "screen.watching.list.head",
    "screen.watching.list.help", "screen.watching.counts", "screen.watching.unscheduled", "screen.watching.unscheduled.note1", "screen.watching.unscheduled.note2",
    "screen.watching.ended", "screen.watching.nr.last", "screen.watching.nr.due", "screen.watching.nr.next", "monitor.freq.hourly", "monitor.freq.daily",
    "monitor.freq.weekly", "monitor.freq.monthly", "monitor.freq.per_meeting", "screen.watching.slate.head", "screen.watching.slate.intro1",
    "screen.watching.slate.intro2", "screen.watching.sweeps.head", "screen.watching.sweep.help", "screen.watching.sweep.ratified", "screen.watching.sweep.next",
    "screen.watching.sweep.unratified", "screen.watching.sweep.note1", "screen.watching.sweep.note2", "state.empty",
    "capture.fieldneeded", "act.writinghelp.label.watching", "screen.capture.help.empty", "screen.watching.project", "screen.watching.sweep.pages", "screen.watching.nr.head", "screen.watching.nr.tip", "screen.watching.nr.where",
    "screen.watching.nr.authority", "screen.watching.nr.open", "screen.watching.nr.retired", "screen.watching.nr.never", "screen.watching.nr.list",
    "screen.watching.nr.listnote", "screen.watching.nr.ask", "screen.watching.nr.asktip", "screen.watching.nr.f.target", "screen.watching.nr.f.desc",
    "screen.watching.nr.f.loc", "screen.watching.nr.f.lochelp", "screen.watching.nr.f.auth", "screen.watching.nr.f.authhelp", "screen.watching.nr.f.matters",
    "screen.watching.nr.f.crucial", "screen.watching.nr.f.supporting", "screen.watching.nr.f.often", "screen.watching.nr.f.c.hour", "screen.watching.nr.f.c.day",
    "screen.watching.nr.f.c.week", "screen.watching.nr.f.c.month", "screen.watching.nr.f.c.none", "screen.watching.nr.retire", "screen.watching.nr.n1",
    "screen.watching.nr.n2", "screen.watching.nr.n3", "screen.watching.nr.ref.machine1", "screen.watching.nr.ref.machine2", "screen.watching.nr.ref.https",
    "screen.watching.nr.ref.nothing", "screen.watching.nr.ref.target", "screen.watching.sweepdef.head", "screen.watching.sweepdef.tip", "screen.watching.sweepdef.title",
    "screen.watching.sweepdef.sources", "screen.watching.sweepdef.sourceshelp", "screen.watching.sweepdef.seeds", "screen.watching.sweepdef.match",
    "screen.watching.sweepdef.matchhelp", "screen.watching.sweepdef.often", "screen.watching.sweepdef.budget", "screen.watching.sweepdef.n1", "screen.watching.sweepdef.n2",
    "screen.watching.sweepdef.ratify", "screen.watching.sweepdef.stop", "screen.watching.sweepdef.rathead", "screen.watching.sweepdef.rattip", "screen.watching.sweepdef.rat1",
    "screen.watching.sweepdef.rat2", "screen.watching.sweepdef.ratnote1", "screen.watching.sweepdef.ratnote2", "screen.watching.sweepdef.ref.owner1",
    "screen.watching.sweepdef.ref.owner2", "screen.watching.sweepdef.ref.machine1", "screen.watching.sweepdef.ref.machine2", "screen.watching.sweepdef.scope",
  ]),
  inbox: Object.freeze([
    "act.inboxpull.label.inbox", "act.inboxresolve.label.inbox", "act.sourcelink.label.inbox",
    "screen.inbox.discarded", "screen.inbox.empty", "screen.inbox.existed", "screen.inbox.knock",
    "screen.inbox.ladder", "screen.inbox.ladder.basis", "screen.inbox.ladder.group", "screen.inbox.ladder.partly",
    "screen.inbox.ladder.public", "screen.inbox.ladder.same", "screen.inbox.ladder.unknown",
    "screen.inbox.link.done", "screen.inbox.link.evidence", "screen.inbox.link.missing",
    "screen.inbox.link.none", "screen.inbox.link.nosource", "screen.inbox.link.to",
    "screen.inbox.nonote", "screen.inbox.note", "screen.inbox.pulled", "refusal.RESOLVE_NO_REASON",
    "screen.inbox.resolved", "screen.inbox.same", "screen.inbox.status.discarded",
    "screen.inbox.status.new", "screen.inbox.status.pulled", "screen.inbox.sub", "state.loading",
    "inbox.discard.why", "reference.label", "screen.inbox.alreadyheld", "screen.inbox.alreadyheld.other",
    "screen.inbox.same.date", "shell.card.document", "screen.document.fingerprint", "act.inboxresolve.label.inbox.putback", "shell.reason", "screen.inbox.putback.done", "act.knocksof.label.inbox", "screen.inbox.knocker.heading", "screen.inbox.knocker.same1", "screen.inbox.knocker.same2",
    "screen.inbox.knocker.help1", "screen.inbox.knocker.help2", "screen.inbox.source.line", "screen.about-knocker.name", "size.kb", "size.mb", "size.small",
  ]),
});

export const SCREENS = Object.freeze([CAPTURE_SCREEN, HELD_SCREEN, ARCHIVE_SCREEN, OPEN_FILE_SCREEN, INBOX_SCREEN, ABOUT_KNOCKER_SCREEN, LEADS_SCREEN, WATCHING_SCREEN]
  .map((s) => Object.freeze({ ...s, words: SCREEN_KEYS[s.id] })));
