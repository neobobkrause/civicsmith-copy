/* screens-action's words for ARCH's flaws of 22 Nov 2026 (code differences against the Screens page "Deciding and acting"; the keys
   this group draws, each one setup-words holds; R19). WORDS: keys added to SCREEN_WORDS. EXTRA: keys a screen draws that do not
   start with its `screen.<id>.` prefix, by screen id. */
const PLAN = ["purpose", "tip.hypothetical", "tip.enddate", "tip.enddate_why", "tip.hostile", "tip.hostile_example", "tip.checkpoint", "tip.scenario",
  "tip.scenario_phase",
  // U17: the reworded tips, each saying only what the plan holds
  "tip.hypothetical_why", "tip.hostile_why", "tip.scenario_why", "tip.alternative", "tip.alternative_start", "tip.alternative_why", "decide.the.options.you.picked", "each.decision.is.recorded.with.who", "nothing.here.starts.an.action",
  "when.an.option.is.not.added", "when.a.decision.is.not.recorded", "when.a.scenario.is.not.laid",
  "press.empty.role", "press.empty.organisation", "press.empty.both"].map(function (k) { return "screen.plan." + k; });
const ACTION = ["when.a.reply.is.not.recorded", "the.day.is.not.a.real", "write.it.as.a.day.that", "choose.one.and.record.again", "a.silence.has.no.document.or", "record.it.with.its.date.alone", "this.action.says.no.reply.is",
  "change.that.on.the.action.first", "that.kind.of.reply.does.not", "a.sending.is.a.request.a", "a.decision.needs.what.it.decided",
  "choose.what.the.office.decided.or", "a.fee.quote.needs.an.amount", "fix.the.quote.and.record.again", "the.date.the.office.gave.needs",
  "add.the.law.first.or.leave", "a.line.has.a.quotation.mark", "take.them.out.and.record.again", "another.member.is.recording.on.this",
  "wait.a.moment.and.try.again", "ended.complied", "ended.denied", "ended.escalated", "ended.withdrawn", "ended.completed", "ended.help",
  "ended.own", "ended.own.help", "ended.head"].map(function (k) { return "screen.action." + k; });
const MATTER = ["when_the_determination_is_compliant_or_unclear", "an_escalation_pursues_a_breach_so_it", "if_the_act_was_found_compliant_there",
  "if_it_is_unclear_answer_the_question", "when_it_cannot_be_recorded", "it_needs_at_least_one_published_finding", "add_what_is_missing_then_record_it",
  "when_a_rule_does_not_bind_the", "noncompliant_is_recorded_only_against_a_rule", "if_this_rule_does_not_bind_it", "when_a_rule_was_not_in_force",
  "the_rule_was_not_in_force_when", "choose_the_rule_that_was_in_force", "when_you_choose_unclear", "unclear_needs_at_least_one_question_that",
  "write_the_question_then_record_it_again", "when_the_cause_has_no_evidence", "a_cause_is_recorded_only_when_evidence", "add_the_evidence_or_leave_the_cause",
  "when_it_says_how_serious_it_is", "a_determination_says_what_was_required_what", "it_does_not_say_how_serious_the", "propose_an_action_for_that",
  "when_the_reason_is_missing", "a_new_determination_that_replaces_an_earlier", "write_the_reason_then_record_it_again",
  "when_the_earlier_one_is_already_replaced", "an_earlier_determination_is_replaced_only_once", "replace_the_newest_one_instead",
  "when_a_part_cannot_be_recorded", "a_consequence_is_what_a_breach_did", "choose_such_a_rule_or_record_the", "when_the_figure_cannot_be_worked_out",
  "a_figure_is_worked_out_only_from", "name_the_figures_or_assess_it_yourself", "when_a_named_person_is_not_in", "a_named_person_must_appear_in_a",
  "choose_the_passage_that_names_them_or", "when_the_cause_is_only_your_own", "evidence_that_your_team_s_own_letter", "add_evidence_from_elsewhere_or_leave_the",
  "when_it_cannot_be_attached", "only_an_action_that_states_a_breach", "choose_such_an_action_or_move_the", "when_it_is_already_attached",
  "that_action_is_already_attached_to_an", "when_the_office_is_the_wrong_kind", "an_official_request_goes_to_an_elected", "choose_a_purpose_that_fits_the_office",
  "when_no_stage_is_proposed", "there_is_nothing_to_hold_at", "when_it_is_already_suspended", "resume_it_before_suspending_it_again",
  "when_it_is_not_suspended", "this_escalation_is_open_not_suspended_so", "when_there_is_nothing_to_read", "a_reading_other_than_no_response_names",
  "choose_the_reply_or_choose_no_response", "when_it_is_not_at_stage_4", "a_response_is_read_at_stage_4", "when_it_cannot_be_ended_compliance_is",
  "an_escalation_ends_only_after_your_team", "record_it_then_end_the_escalation", "when_it_cannot_be_ended_the_consequences",
  "if_your_team_judges_the_breach_had", "when_it_cannot_be_ended_the_consequences_2", "say_with_evidence_that_each_part_was",
  // U17: where it stands and since when it is paused, and the end and hold folds' sentences without {why} or {missing}
  "escalation.stands_at", "escalation.paused_since", "compliance_is_not_restored_why", "whether_the_consequences_are_addressed_is_undetermined",
  "the_consequences_are_not_addressed_why", "stage_3_is_not_proposed_yet_missing"].map(function (k) { return "screen.matter." + k; });

export const WORDS = Object.freeze([...PLAN, ...ACTION, ...MATTER]);
export const EXTRA = Object.freeze({
  // the action's move is kept with the member's reason, in the shell's words, unless it resolves (then her own words, `screen.action.ended.own`)
  action: ["shell.reason", "shell.reason.help"],
  // U17 (DEC-260): each end or hold fold ends with the refusal's own words by its code
  matter: ["refusal.COMPLIANCE_NOT_RESTORED", "refusal.CONSEQUENCES_UNDETERMINED", "refusal.CONSEQUENCES_NOT_ADDRESSED", "refusal.EDGE_NOT_PROPOSED"],
});
