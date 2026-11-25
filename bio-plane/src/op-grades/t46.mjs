/* op-grades — R33 (T46; R32's pattern; N897 (2), N919, N920, N654, N917; DEC-162, DEC-175; K2952, K2960, K2987): EVERY OP
 * T46 ADDS, graded by R5 and R3 with `affordances` R12's totality holding over them, each grade read from its owner's
 * requirements and merged code as R13, R17 and R22–R32 do: `instance-setup`'s information level, `plan-work`'s assistant
 * items for a status report, `escalation`'s stop and reopening, `ai-runs`' member-run door, `membership`'s doors read,
 * `action-clocks`' standing proposals and `agent-worker`'s text check. Data only: no op's behaviour is decided here (P6).
 *
 * `./index.mjs` spreads the three tables into `RUNGS`, `RUNG_ABSENT` and `NON_ACTS`. This file imports nothing, so the
 * spread closes no cycle. (`affordances` R52, amending R51) `escalationstoppursuing` and `escalationreopen` are `ACTS` rows
 * on an action target, so they have no NON_ACTS row here and are in `MACHINE_REFUSALS` (`./index.mjs`) with escalation's
 * code, `MACHINE_CANNOT_STOP`; every other op here is a non-act, none in `MACHINE_REFUSALS` (`ai-runs` refuses any caller
 * but the run's principal, `AI_RUN_NOT_PRINCIPAL`). By R18 `phone` follows the rung or ground. No vocabulary, prompt,
 * consequence statement or Irreversible weight is added: `words.json` (@ `3f40899950`) holds no consequence sentence for
 * stopping pursuit, which the design stream owes (K2960). */

const R = (s) => `read: ${s}; writes nothing`;

/* ---- the rungs (`affordances` R19's backing beside each) ---- */
export const T46_RUNGS = {
  /* escalation R31, R33: each refuses an absent reason ESCALATION_NO_REASON (R24, already in the family); a stop is taken
     back only by a reasoned reopening, and both are append-only (R18) */
  escalationstoppursuing: "reasoned", // ESCALATION_NO_REASON (escalation R31: stopped with its reason, never ended)
  escalationreopen:       "reasoned", // ESCALATION_NO_REASON (escalation R31: reopened at the stage where it stopped)
};

/* ---- the stated absences ---- */
export const T46_RUNG_ABSENT = {
  /* instance-setup R79, as memberlanguageset (R17): a member's own setting, asking no reason */
  infolevelset: { ground: "caller-owned", is: "a member sets how quickly explanations open for her, promptly or after a longer pause, nothing ever hidden; no one sets it for another, and each set is appended with when (instance-setup R79)" },
  /* ai-runs R18 (N919; K2952), on R3's rule: it asks no authored reason and no published act takes it back */
  airundispatch: { ground: "undetermined", is: "a member starts the next segment of a check or plan run she opened on her own sign-in, for her only, at her own act; any other caller is refused and nothing is sent (ai-runs R18)" },
};

/* ---- every non-act's NON_ACTS reason (R5; R32: a read "read: …", a draft "draft: …") ---- */
export const T46_NON_ACTS = {
  /* instance-setup R79 */
  infolevelset: "personal state, keyed by member: how quickly explanations open, promptly or after a longer pause; "
    + "nothing is hidden",
  infolevel: R("the viewer's own information level, when she set it and when she answered whether to keep it, and "
    + "nobody else's"),
  /* plan-work R14, as statusreportdraft (R32) */
  statusreportassist: "draft: answers the items, each with its source, that the assistant drafts a plan's status report "
    + "from, through the plane's draft door; writes nothing of the record; the report kept is the member's",
  /* ai-runs R18 (N919): the member-run door's op, `control-plane`'s route (T46-59) */
  airundispatch: "run-directed: keyed by a run the caller opened on her own sign-in; starts its next segment for her "
    + "only; moves no bundle",
  /* membership R130 (N654) */
  joindoors: R("the settings and history of the group's two doors, to an administrator, never a door's secret"),
  /* action-clocks R20 (K2987) */
  clockproposals: R("the standing clock proposals on an action the viewer may see, which clockadopt adopts"),
  /* agent-worker R76 (N917; control-plane R57's door) */
  textcheck: "draft: answers the sentences of a prepared outward text that read as an assertion, a position, an "
    + "own-benefit ask or a staff member named, as a labeled proposal for the member; never rewrites the text; writes "
    + "nothing of the record",
};
