/* screens-wizards' words (R13; interface-shell R5, R70; setup-words R11-R13): this module holds no member-facing English,
   only the keys it reads through `word(key, vars)`. They are the `reads` list for it in
   `docs/development/ux-substrate/screens/words-reads.json` (DEC-258, DEC-260), with the keys R15-R17 name. `SCREEN_WORDS`
   is empty: every sentence is `WORD_ROWS`'. A Civicsmith script's own words (`wizard.<id>.*`) and each act's label and
   explanation (`act.<op>.label.wizards`, `act.<op>.does`) are listed by `index.mjs` from `WORD_ROWS`. */

export const SCREEN_WORDS = Object.freeze([]);

/* the library screen's keys (R1, R8, R15, R16) */
export const LIBRARY_KEYS = Object.freeze([
  "refusal.uncatalogued",
  "screen.wizards.act.adopt", "screen.wizards.act.adoptbase", "screen.wizards.act.copy",
  "screen.wizards.act.fromproposal", "screen.wizards.act.newdraft", "screen.wizards.act.retire",
  "screen.wizards.act.save", "screen.wizards.act.seeall", "screen.wizards.act.steps", "screen.wizards.act.widen",
  "screen.wizards.act.withdraw", "screen.wizards.basechanged", "screen.wizards.basedon", "screen.wizards.basehidden",
  "screen.wizards.broken", "screen.wizards.changes.base", "screen.wizards.changes.copy",
  "screen.wizards.changes.head", "screen.wizards.changes.newdraft", "screen.wizards.civicsmith.only",
  "screen.wizards.col.approver", "screen.wizards.col.base", "screen.wizards.col.finished", "screen.wizards.col.name",
  "screen.wizards.col.whose", "screen.wizards.copy.note", "screen.wizards.draftfor.field",
  "screen.wizards.draftfor.none", "screen.wizards.edit.add", "screen.wizards.edit.addact",
  "screen.wizards.edit.addscreen", "screen.wizards.edit.addwhat", "screen.wizards.edit.addwhy",
  "screen.wizards.edit.head", "screen.wizards.edit.nosteps", "screen.wizards.edit.place",
  "screen.wizards.edit.remove", "screen.wizards.edit.what", "screen.wizards.edit.why", "screen.wizards.empty",
  "screen.wizards.finished", "screen.wizards.name", "screen.wizards.name.field", "screen.wizards.nobase",
  "screen.wizards.notapproved", "screen.wizards.project.field", "screen.wizards.project.none",
  "screen.wizards.proposal.by", "screen.wizards.purpose", "screen.wizards.reason.field",
  "screen.wizards.reason.needed", "screen.wizards.record.head", "screen.wizards.record.intro",
  "screen.wizards.refusal.step", "screen.wizards.required", "screen.wizards.retired", "screen.wizards.showing",
  "screen.wizards.state.broken", "screen.wizards.state.draft", "screen.wizards.state.field",
  "screen.wizards.state.offered", "screen.wizards.state.proposed", "screen.wizards.state.retired",
  "screen.wizards.state.submitted", "screen.wizards.state.withdrawn", "screen.wizards.steps.draft.machine",
  "screen.wizards.steps.draft.template", "screen.wizards.steps.draft.text", "screen.wizards.steps.head",
  "screen.wizards.steps.noact", "screen.wizards.steps.recorded", "screen.wizards.steps.via",
  "screen.wizards.steps.where", "screen.wizards.steps.why", "screen.wizards.version",
  "screen.wizards.vstate.approved", "screen.wizards.vstate.draft", "screen.wizards.vstate.submitted",
  "screen.wizards.vstate.updated", "screen.wizards.vstate.withdrawn", "screen.wizards.whose.civicsmith",
  "screen.wizards.whose.group", "screen.wizards.whose.widened", "screen.wizards.own.fold", "screen.wizards.own.says",
  // R23: each filter's own explanation and its own empty line
  ...["offered", "draft", "submitted", "withdrawn", "retired", "broken", "proposed"].flatMap((k) => [
    "screen.wizards.state." + k + ".tip", "screen.wizards.empty." + k]),
]);

/* the dock's guide, its marks and its subject choice (R2-R7, R10-R12, R16, R17) */
export const GUIDE_KEYS = Object.freeze([
  "act.wizarddraft.does", "ai.label.untested", "screen.guide.absent", "screen.guide.back", "screen.guide.close",
  "screen.guide.draft.asking", "screen.guide.draft.machine", "screen.guide.draft.nofield",
  "screen.guide.draft.placed", "screen.guide.draft.refused", "screen.guide.draft.template",
  "screen.guide.draft.template.held", "screen.guide.draft.text", "screen.guide.draftit", "screen.guide.draftit.does",
  "screen.guide.failed", "screen.guide.finish", "screen.guide.finished", "screen.guide.key", "screen.guide.loading",
  "screen.guide.mark.draft", "screen.guide.mark.finished", "screen.guide.mark.start", "screen.guide.marks.means",
  "screen.guide.next", "screen.guide.notnow", "screen.guide.offer.first", "screen.guide.recording",
  "screen.guide.recording.empty", "screen.guide.recording.intro", "screen.guide.recording.name",
  "screen.guide.recording.noname", "screen.guide.recording.none", "screen.guide.recording.pair",
  "screen.guide.recording.remove", "screen.guide.recording.save", "screen.guide.recording.saved",
  "screen.guide.recording.stop", "screen.guide.stop", "screen.guide.stop.does", "screen.guide.title",
  "screen.guide.welcome", "screen.guide.welcome.continue", "wizard.subject.project", "wizard.subject.question",
  "wizard.subject.document", "wizard.subject.none.project", "wizard.subject.none.summary",
]);

/* read by both parts, and the keys of the guide that are not `screen.guide.*` */
export const COMMON_KEYS = Object.freeze([
  "guide.draft", "guide.press", "guide.showwhere", "guide.sidetrip", "guide.step", "guide.stopping",
  "screen.elsewhere.name", "screen.elsewhere.purpose", "state.empty", "state.failed", "state.loading",
  "wizard.guide.elsewhere", "wizard.guide.elsewhere_link", "wizard.mark.recommended", "wizard.marks.chip",
  "wizard.marks.chip.one",
]);
