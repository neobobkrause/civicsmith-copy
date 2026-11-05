# ux-design — notes: the words inventory

Taken 5 Nov 2026 by a read-only worker for BOB at the tranche tip (after PR 506), from the receipts' not-verified notes in `process/metrics/*.jsonl`, the unmet marks in `build/requirements/*.md` that wait on words, `bio-plane/src/setup-words/words-unreviewed.json` (**U**) and `docs/development/ux-substrate/screens/words.json` (**W**). The lane keeps it current (R1). No key is in both U and W. U holds 8,449 entries drafted by 160 modules; W holds 19,835 words.

Four things first:
- screens-document-beta: every key its requirements name for R60 to R72 is already in W. It waits on words only for R59 (`content.typed.checked`, `content.typed.unchecked`, in U only) and R73 ("words owed", no key named). Its R62 quoted sentence differs from W's English ("This {kind} is kept whole..." in W).
- ai-use R13: six keys drafted in U, none in W, plus `ai.refused.unitunavailable`, which is in W (words.json:1020) with the old wording ("A limit in dollars needs an API key: a subscription doesn't report what a use costs."); R13 asks for "the plan reports no money".
- Settling any U key's wording into W is a wording change: the lane does it only when Bob's approval allows (R3).
- Several blocking items name no key ("words owed"): they need the design stream to name keys first.

## Blocking requirements

| module | mark | keys needed | in U? | in W? | source |
|---|---|---|---|---|---|
| ai-use | R13 | ai.refused.limit.provider | yes (src/ai-use/index.mjs:917) | no | build/requirements/ai-use.md:59; ai-use.md:139; process/metrics/ai-use.jsonl |
| ai-use | R13 | ai.refused.limit.provider.unknown | yes (index.mjs:918) | no | same |
| ai-use | R13 | ai.refused.thresholdinvalid | yes (src/ai-use/checks.mjs:85) | no | same |
| ai-use | R13 | ai.alert.threshold | yes (checks.mjs:87) | no | same |
| ai-use | R13 | ai.use.notmeasurable | yes (checks.mjs:88) | no | same |
| ai-use | R13 (R27's key) | ai.refused.notapayingaccount | yes (checks.mjs:86) | no | ai-use.md:139; ai-use.jsonl |
| ai-use | R13 | ai.refused.unitunavailable (generalised) | no | yes, old wording (words.json:1020) | ai-use.md:59 |
| screens-document-beta | R59 | content.typed.checked, content.typed.unchecked | yes (src/content/index.mjs:823, :824) | no | screens-document-beta.md:9 |
| screens-document-beta | R60 | screen.follow.document.laws | no | yes (words.json:83285) | screens-document-beta.md:11 |
| screens-document-beta | R61 | screen.document.text.partial.one, screen.document.reading.beingread, screen.document.reading.firstn, document.read.more, screen.document.supporting.notwalked.pending/toolarge/unavailable, screen.document.unsupported.ico | no | yes, all | screens-document-beta.md:13 |
| screens-document-beta | R62 | screen.document.held.kind, file.kind.* (48), screen.document.macros, .converted, .encrypted | no | yes (held.kind at words.json:84167; W's English differs from R62's quote) | screens-document-beta.md:15 |
| screens-document-beta | R63 | screen.photo.dropped.* (9) | no | yes, all 9 | screens-document-beta.md:17 |
| screens-document-beta | R64 to R68 | screen.document.interp.label, .offer, .chooser.will, .recorded, .legend.this | no | yes, all | screens-document-beta.md:19-27 |
| screens-document-beta | R72 | screen.document.text.unsure | no | yes (words.json:85441) | screens-document-beta.md:35 |
| screens-document-beta | R73 | none named (words owed) | n/a | no | screens-document-beta.md:37 |
| screens-document | R1 | screen.document.cells_held | yes (src/extraction/screen-words.mjs:7) | no | screens-document.md:15 |
| case-disclosures | R37, R39 | content.typed.frozen.unchecked, content.typed.frozen.checked (basis-versions R59) | no | no | case-disclosures.md:177,179 |
| case-import | R36 | case-import.ungraded.label, case-import.ungraded.not_stated | yes (src/case-import/index.mjs:168, :172) | no | case-import.md:202 |
| notice-producers | R16 | a queue sentence for provider limits (no key named) | no | no | notice-producers.md:37 |
| notice-producers | R33 | ai.alert.threshold, a {use} fill for thresholds, unit words for tokens/calls | yes (ai-use) | no | notice-producers.md:73 |
| notice-producers | R35 | sentences for left-list, left-project-list, signin-ended (no keys named) | no | no | notice-producers.md:75 |
| queue-producers | R57 | queue.signer-self-registered.summary.other, .summary.unnamed.other, .key, .key.undated, .key.comment | no | no | queue-producers.md:155 |
| op-grades | R55 (d) | consequence.rowexpunge | no | no | op-grades.md:128 |
| machinery-producers | F1 | a brought-by sentence for capture-completed-unattended (no key yet) | no | no | machinery-producers.md:137 |
| screens-wizards | R23 | screen.wizards.state.offered.tip, screen.wizards.empty.offered, screen.wizards.state.draft.tip, screen.wizards.empty.draft, screen.wizards.state.submitted.tip, screen.wizards.empty.submitted, screen.wizards.state.withdrawn.tip, screen.wizards.empty.withdrawn, screen.wizards.state.retired.tip, screen.wizards.empty.retired, screen.wizards.state.broken.tip, screen.wizards.empty.broken, screen.wizards.state.proposed.tip, screen.wizards.empty.proposed | no | yes (words.json:123922) | screens-wizards.md:78 |
| journey-check | R17, R26 | rows in words.json and setup-words that still say "group" (keys not named) | n/a | n/a | journey-check.md:71,83 |
| screens-action | R62 | guide.procedure.notreviewed | yes (src/reading-guides/index.mjs:92) | no | screens-action.md:142 |
| screens-action | R62 | text.reviewedby, text.lastchecked | no | no | screens-action.md:142 |
| jurisdictions | R137 | text.lastchecked | no | no | jurisdictions.md:114 |
| agent-worker | R110 | ai.refused.aipathnotready | no | no | agent-worker.md:246 |
| agent-worker | R124 | ai.choice.wait, ai.choice.switch, ai.choice.without_ai | no | no | agent-worker.md:195 |
| agent-worker | R124 | ai.refused.payernotverified | yes (src/ai-accounts/checks.mjs:160) | no | agent-worker.md:195 |
| plane | R119 | content.typed.anonymous_member | yes (content) | no | plane.md:77 |
| screens-inquiry | R142 | screen.project.interp.proposals.heading, screen.interp.proposal.label, screen.interp.proposals.more | no | no | screens-inquiry.md:288 |
| screens-inquiry | R143 | screen.interp.proposals.unavailable | no | no | screens-inquiry.md:289 |
| screens-intake | R72 | screen.capture.limits.heading, .document, .background | no | no | screens-intake.md:128 |
| screens-intake | R73 | screen.capture.refusal.toolarge.nothing_read | no | no | screens-intake.md:129 |
| screens-intake | R74 | screen.capture.refusal.toolarge.part, .register | no | no | screens-intake.md:130 |
| screens-intake | R78 | screen.capture.read.queued | no | no | screens-intake.md:134 |
| network-notices | R32 | listing.contact.note | no | no | network-notices.md:151 |
| agent-runner | R41 | gate.runner.refused.<CODE> | no | no | agent-runner.md:67 |
| screens-action | R74, R80 | screen.request.nooffice.pointer.people, screen.actionnew.refused.deadline, screen.actionnew.refused.addressee | n/a | yes (words.json:123880) | screens-action.md:154,160 |
| screens-daily | R108 | the basis.keys_more line | no | no | screens-daily.md:231 |
| screens-daily | R116 | none named (words owed) | n/a | no | screens-daily.md:242 |
| screens-inquiry | R146, R149, R150 | none named (words owed) | n/a | no | screens-inquiry.md:292,295,296 |
| screens-intake | R92 | none named (words owed) | n/a | no | screens-intake.md:149 |
| screens-investigate | R92 | none named (words owed) | n/a | no | screens-investigate.md:168 |
| screens-plan | R9 | screen.plan.option.goes, screen.plan.option.nooffice, screen.plan.support.hypothetical.means | n/a | yes (words.json:123901) | screens-plan.md:27 |
| screens-public, screens-publish | R102; R105, R106 | none named (words owed) | n/a | no | screens-public.md:44; screens-publish.md:169,172,173 |
| installer | R95 | none named (words are UX-DESIGN's) | n/a | no | installer.md:156 |
| screens-settings | R88, R96, R104 | none named | n/a | no | screens-settings.md:177,185,193 |

Counts: 51 blocking rows, about 50 requirement marks, 26 modules, 79 named keys; 39 named keys missing from W (11 of them drafted in U, 28 in neither).

## Other words items (not blocking a requirement)

| module | keys | note | source |
|---|---|---|---|
| affordances (F2, met) | act.guideoptout.does (neither); stand-in reading-guides.declared.guideoptout (U) | no help word for guideoptout | affordances.jsonl |
| screens-entry | act.aiaccountadd.does, act.aiaccountswitch.does (neither) | buttons carry no explanation | screens-entry.jsonl |
| reading-guides | guide.procedure.notreviewed, refusal.OPT_OUT_NOT_SOLE_MEMBER, refusal.MACHINE_CANNOT_OPT_OUT, refusal.OPT_OUT_NOT_OWN_GUIDE (U) | | reading-guides.jsonl |
| content | content.index.register_row_removed (U) | | content.jsonl |
| lines | lines.row.held/.removed/.unread, lines.why.row_removed, lines.why.row_unread, lines.index.the_record_holds_no_content (U) | | lines.jsonl |
| machinery-producers | three machinery-producers.index.* (U) | | machinery-producers.jsonl |
| run-rules | ai.refused.aipartnotdeployed, ai.refused.partwithdrawn (neither); run-rules.rules.explore_enabler_gone, explore_no_enabler (U) | | run-rules.jsonl |
| standards | refusal.STANDARD_LIMIT_INVALID (U) | | standards.jsonl |
| case-disclosures | case-disclosures.document.ungraded_body (U) | | case-disclosures.jsonl |
| agent-steps | agent-steps.drive.account_change_unrecorded (U) | | agent-steps.jsonl |
| format-registry | format-registry.formats.mhtml_saved_page (U) | | format-registry.jsonl |
| money | money.declared.moneyfiscalyears, label.connectionkinds.money_* (U) | | money.jsonl |
| ai-gate | 74 gate.* keys (U) | reach rows.mjs when setup-words regenerates | ai-gate.jsonl |
| ai-accounts | 35 ai.refused.* keys (U) | | answer-envelope.jsonl |
| screens-inquiry | screen.question.leggrade.act (neither); act.leggrade.label.question used | R139 needs restating | screens-inquiry.jsonl |
| queue-producers | queue.retesting-off.summary (W) holds no {who}/{when} | | queue-producers.jsonl |
| (no job note) | control-plane screen.group.storage.* (10), file-safety screen.open-file.safe.* (5), limit.* (3), question.refused.notowner, about 27 refusal.*, ai.reauth.connect, control-plane.declared.* (4) (U) | | words-unreviewed.json |
