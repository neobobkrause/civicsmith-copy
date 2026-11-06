# ux-design — notes: the words inventory

Taken 5 Nov 2026 by a read-only worker for BOB at the tranche tip (after PR 506), from the receipts' not-verified notes in `process/metrics/*.jsonl`, the unmet marks in `build/requirements/*.md` that wait on words, `bio-plane/src/setup-words/words-unreviewed.json` (**U**) and `docs/development/ux-substrate/screens/words.json` (**W**). The lane keeps it current (R1). No key is in both U and W. U holds 8,449 entries drafted by 160 modules; W holds 19,835 words.

Settled 5 Nov 2026 (R3), on job/ux-design: the wording of lane PRs 535, 536, 537, 540, 525, 527, 530, 532, 534 and 539, carried into `build_words.mjs` and `words-drawn-4.src.py`; every blocking row with named keys now has them in W. Left: installer R95 names no key; journey-check R17/R26 (rows that say "group" for a team) are setup-words rows in bio-plane/src, settled on branch `lane/ux-team-words` and left for their owner; agent-runner R41's NO_BINARY rewording ("a part it needs is missing. Tell an administrator.") waits on agent-runner regenerating its says-words.mjs and bundle, so the row keeps the English that file carries. The not-blocking items below stay open.

Four things first (as taken, before the 5 Nov settlement):
- screens-document-beta: every key its requirements name for R60 to R72 is already in W. It waits on words only for R59 (`content.typed.checked`, `content.typed.unchecked`, in U only) and R73 ("words owed", no key named). Its R62 quoted sentence differs from W's English ("This {kind} is kept whole..." in W).
- ai-use R13: six keys drafted in U, none in W, plus `ai.refused.unitunavailable`, which is in W (words.json:1020) with the old wording ("A limit in dollars needs an API key: a subscription doesn't report what a use costs."); R13 asks for "the plan reports no money".
- Settling any U key's wording into W is a wording change: the lane does it only when Bob's approval allows (R3).
- Several blocking items name no key ("words owed"): they need the design stream to name keys first.

## Blocking requirements

| module | mark | keys needed | in U? | in W? | source |
|---|---|---|---|---|---|
| ai-use | R13 | ai.refused.limit.provider | no (moved to W) | yes (settled 5 Nov, R3) | build/requirements/ai-use.md:59; ai-use.md:139; process/metrics/ai-use.jsonl |
| ai-use | R13 | ai.refused.limit.provider.unknown | no (moved to W) | yes (settled 5 Nov, R3) | same |
| ai-use | R13 | ai.refused.thresholdinvalid | no (moved to W) | yes (settled 5 Nov, R3) | same |
| ai-use | R13 | ai.alert.threshold | no (moved to W) | yes (settled 5 Nov, R3) | same |
| ai-use | R13 | ai.use.notmeasurable | no (moved to W) | yes (settled 5 Nov, R3) | same |
| ai-use | R13 (R27's key) | ai.refused.notapayingaccount | no (moved to W) | yes (settled 5 Nov, R3) | ai-use.md:139; ai-use.jsonl |
| ai-use | R13 | ai.refused.unitunavailable (generalised) | no | yes (generalised 5 Nov, R3: the plan reports no money) | ai-use.md:59 |
| screens-document-beta | R59 | content.typed.checked, content.typed.unchecked | no (moved to W) | yes (settled 5 Nov, R3) | screens-document-beta.md:9 |
| screens-document-beta | R60 | screen.follow.document.laws | no | yes (words.json:83285) | screens-document-beta.md:11 |
| screens-document-beta | R61 | screen.document.text.partial.one, screen.document.reading.beingread, screen.document.reading.firstn, document.read.more, screen.document.supporting.notwalked.pending/toolarge/unavailable, screen.document.unsupported.ico | no | yes, all | screens-document-beta.md:13 |
| screens-document-beta | R62 | screen.document.held.kind, file.kind.* (48), screen.document.macros, .converted, .encrypted | no | yes (held.kind at words.json:84167; W's English differs from R62's quote) | screens-document-beta.md:15 |
| screens-document-beta | R63 | screen.photo.dropped.* (9) | no | yes, all 9 | screens-document-beta.md:17 |
| screens-document-beta | R64 to R68 | screen.document.interp.label, .offer, .chooser.will, .recorded, .legend.this | no | yes, all | screens-document-beta.md:19-27 |
| screens-document-beta | R72 | screen.document.text.unsure | no | yes (words.json:85441) | screens-document-beta.md:35 |
| screens-document-beta | R73 | screen.document.basis.doorbell, screen.document.basis.testimony, screen.document.reading.unparsed, screen.document.readway.stored, screen.document.readway.pictures, screen.document.readway.mixed | no | yes (named and settled 5 Nov, R3) | screens-document-beta.md:37 |
| screens-document | R1 | screen.document.cells_held | no (moved to W) | yes (settled 5 Nov, R3) | screens-document.md:15 |
| case-disclosures | R37, R39 | content.typed.frozen.unchecked, content.typed.frozen.checked (basis-versions R59) | no | yes (words.json:123895) | case-disclosures.md:177,179 |
| case-import | R36 | case-import.ungraded.label, case-import.ungraded.not_stated | no (moved to W) | yes (words.json:123881) | case-import.md:202 |
| notice-producers | R16 | ai.queue.limitreached.provider, ai.queue.limitreached.provider.unknown | no | yes (named and settled 5 Nov, R3) | notice-producers.md:37 |
| notice-producers | R33 | ai.alert.threshold, ai.alert.scope.overall, ai.alert.scope.per_member, ai.alert.level.percent, ai.alert.level.usd, ai.alert.level.tokens, ai.alert.level.calls, ai.alert.basis.reported, ai.alert.basis.estimated | no (moved to W) | yes (settled 5 Nov, R3) | notice-producers.md:73 |
| notice-producers | R35 | ai.queue.leftlist.own, ai.queue.leftlist.project, ai.queue.leftprojectlist, ai.queue.signinended | no | yes (named and settled 5 Nov, R3) | notice-producers.md:75 |
| queue-producers | R57 | queue.signer-self-registered.summary.other, .summary.unnamed.other, .key, .key.undated, .key.comment | no | yes (settled 5 Nov, R3) | queue-producers.md:155 |
| op-grades | R55 (d) | consequence.rowexpunge | no | yes (words.json:123909) | op-grades.md:128 |
| machinery-producers | F1 | queue.capture-completed-unattended.request.summary.brought, queue.capture-completed-unattended.request.summary.unnamed.brought, queue.capture-completed-unattended.request.detail.brought, queue.capture-completed-unattended.request.detail.unnamed.brought | no | yes (named and settled 5 Nov, R3) | machinery-producers.md:137 |
| screens-wizards | R23 | screen.wizards.state.offered.tip, screen.wizards.empty.offered, screen.wizards.state.draft.tip, screen.wizards.empty.draft, screen.wizards.state.submitted.tip, screen.wizards.empty.submitted, screen.wizards.state.withdrawn.tip, screen.wizards.empty.withdrawn, screen.wizards.state.retired.tip, screen.wizards.empty.retired, screen.wizards.state.broken.tip, screen.wizards.empty.broken, screen.wizards.state.proposed.tip, screen.wizards.empty.proposed | no | yes (words.json:123922) | screens-wizards.md:78 |
| journey-check | R17, R26 | rows in words.json and setup-words that still say "group" (keys not named) | n/a | n/a | journey-check.md:71,83 |
| screens-action | R62 | guide.procedure.notreviewed | no (moved to W) | yes (words.json:123894) | screens-action.md:142 |
| screens-action | R62 | text.reviewedby, text.lastchecked | no | yes (words.json:123880) | screens-action.md:142 |
| jurisdictions | R137 | text.lastchecked | no | yes (words.json:123887) | jurisdictions.md:114 |
| agent-worker | R110 | ai.refused.aipathnotready | no | yes (settled 5 Nov, R3) | agent-worker.md:246 |
| agent-worker | R124 | ai.choice.wait, ai.choice.switch, ai.choice.without_ai | no | yes (settled 5 Nov, R3) | agent-worker.md:195 |
| agent-worker | R124 | ai.refused.payernotverified | no (moved to W) | yes (settled 5 Nov, R3) | agent-worker.md:195 |
| plane | R119 | content.typed.anonymous_member | no (moved to W) | yes (settled 5 Nov, R3) | plane.md:77 |
| screens-inquiry | R142 | screen.project.interp.proposals.heading, screen.interp.proposal.label, screen.interp.proposals.more | no | yes (words.json:123908) | screens-inquiry.md:288 |
| screens-inquiry | R143 | screen.interp.proposals.unavailable | no | yes (words.json:123929) | screens-inquiry.md:289 |
| screens-intake | R72 | screen.capture.limits.heading, screen.capture.limits.document, screen.capture.limits.sheet, screen.capture.limits.image, screen.capture.limits.archive, screen.capture.limits.background | no | yes (words.json:123936) | screens-intake.md:128 |
| screens-intake | R73 | screen.capture.refusal.toolarge.nothing_read | no | yes (words.json:123977) | screens-intake.md:129 |
| screens-intake | R74 | screen.capture.refusal.toolarge.part, screen.capture.refusal.toolarge.register | no | yes (words.json:123991) | screens-intake.md:130 |
| screens-intake | R78 | screen.capture.read.queued | no | yes (words.json:123997) | screens-intake.md:134 |
| network-notices | R32 | listing.contact.note | no | yes (words.json:123916) | network-notices.md:151 |
| agent-runner | R41 | agent-runner.signin.your_teams_civicsmith_could_not_2, agent-runner.signin.your_teams_civicsmith_cannot_start, agent-runner.signin.claudes_sign_in_gave_no, agent-runner.signin.claudes_sign_in_stopped_before, agent-runner.signin.this_claude_sign_in_was, agent-runner.signin.your_teams_civicsmith_could_not_3, agent-runner.signin.claude_gave_no_answer_within, agent-runner.signin.claude_answered_the_code_but, agent-runner.signin.claude_did_not_accept_the, agent-runner.worker.your_teams_civicsmith_could_not | no | yes (named and settled 5 Nov, R3 (the sign-in image's rows; NO_BINARY keeps the English its says-words.mjs carries: the reworded form waits on agent-runner)) | agent-runner.md:67 |
| screens-action | R74, R80 | screen.request.nooffice.pointer.people, screen.actionnew.refused.deadline, screen.actionnew.refused.addressee | n/a | yes (words.json:123880) | screens-action.md:154,160 |
| screens-daily | R108 | screen.queue.signer.keys_more, screen.queue.signer.keys_more.one | no | yes (words.json:123887) | screens-daily.md:231 |
| screens-daily | R116 | screen.help.way.home, screen.help.way.next | n/a | yes (words.json:123936) | screens-daily.md:242 |
| screens-inquiry | R146, R149, R150 | screen.dash-project.next.add, screen.dash-project.next.ask, screen.dash-project.next.project, screen.dash-project.story.none, screen.question.conclude.own.empty, screen.question.conclude.own.toolong, screen.project.stage.read.one, screen.project.question.notrated | n/a | yes (words.json:123880) | screens-inquiry.md:292,295,296 |
| screens-intake | R92 | screen.inbox.row.named, screen.inbox.row.noted, screen.inbox.row.unnamed, screen.inbox.row.became, screen.inbox.ladder.unknown.means, screen.inbox.ladder.same.means, screen.inbox.ladder.partly.means, screen.inbox.ladder.group.means, screen.inbox.ladder.public.means | n/a | yes (words.json:123894) | screens-intake.md:149 |
| screens-investigate | R92 | screen.ties.preview.employer.name, screen.ties.preview.employer.group, screen.ties.preview.relative.name, screen.ties.preview.relative.group, screen.ties.preview.business.name, screen.ties.preview.business.group, screen.ties.preview.other.name, screen.ties.preview.other.group | n/a | yes (words.json:123957) | screens-investigate.md:168 |
| screens-plan | R9 | screen.plan.option.goes, screen.plan.option.nooffice, screen.plan.support.hypothetical.means | n/a | yes (words.json:123901) | screens-plan.md:27 |
| screens-public, screens-publish | R102; R105, R106 | screen.published.ungraded.line, screen.published.ungraded.more, screen.ceremony.when.help.named, screen.case-editor.needed.targets, screen.case-editor.passages.heading | n/a | yes (words.json:123880) | screens-public.md:44; screens-publish.md:169,172,173 |
| installer | R95 | none named (words are UX-DESIGN's) | n/a | no | installer.md:156 |
| screens-settings | R88, R96, R104 | screen.settings.placement.heading, screen.settings.placement.hint, screen.settings.placement.jurisdiction, screen.settings.placement.neither, screen.settings.placement.fixed, shell.choice.chosen, shell.toggle.state, shell.toggle.on, shell.toggle.off, screen.setup.places.offered.none | n/a | yes (words.json:123915) | screens-settings.md:177,185,193 |

Counts: 51 blocking rows, about 50 requirement marks, 26 modules, 79 named keys; 39 named keys missing from W (11 of them drafted in U, 28 in neither).

## Module entries (R2)

Added 5 Nov 2026 by the lane (R2). For each row below the module's keys are all in W; the lane added the module's entry in `docs/development/ux-substrate/screens/words-reads-requirements.mjs`, which `words-reads.src.mjs` lists among the module's reads in `words-reads.json` (screens-document-beta has no source of its own yet, so its reads are these). No wording changed. Each requirement below **no longer waits on words**; what remains is the module's own code. Test: `bio-plane/test/m/ux-design/module-entries.test.mjs`, one test per mark.

| module | mark | keys in its entry | waits on words? |
|---|---|---|---|
| screens-document-beta | R60 | screen.follow.document.laws | no longer |
| screens-document-beta | R61 | screen.document.text.partial.one, .reading.beingread, .reading.firstn, document.read.more, screen.document.supporting.notwalked.pending, .toolarge, .unavailable, screen.document.unsupported.ico | no longer |
| screens-document-beta | R62 (held.kind) | screen.document.held.kind | no longer for held.kind (W's English differs from R62's quote: the table wins, K3930); file.kind.* and the other R62 forms not in this entry |
| screens-document-beta | R63 | screen.photo.dropped.thumbnail, .maker_note, .profile, .extra_picture, .after_end, .xmp, .credentials, .other_metadata, .unreadable | no longer |
| screens-document-beta | R64 | screen.document.interp.label | no longer |
| screens-document-beta | R65 | screen.document.interp.offer | no longer |
| screens-document-beta | R66 | screen.document.interp.chooser.will | no longer |
| screens-document-beta | R67 | screen.document.interp.recorded | no longer |
| screens-document-beta | R68 | screen.document.interp.legend.this | no longer |
| screens-document-beta | R72 | screen.document.text.unsure | no longer |

Still waiting on words in screens-document-beta: R59 (two keys in U only, R3) and R73 (no key named).

## Other words items (not blocking a requirement)

| module | keys | note | source |
|---|---|---|---|
| affordances (F2, met) | act.guideoptout.does (W, settled 6 Nov by the lane, words-drawn-1.src.py:863); stand-in reading-guides.declared.guideoptout (U) | act-help.mjs reads the W row in place of the stand-in; the words-reads finding that refused layer close 6 is cleared | affordances.jsonl |
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
