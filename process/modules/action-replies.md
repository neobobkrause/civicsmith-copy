Length: 64 lines. Last section: "Suggestions".

# action-replies: requirements

Next number: 12

**Size (P6).** About 650 lines: the claim-by-claim layout and its proposals, the `arose_from` link and its two reads, the open-requests source for the signing view.

## Public

### Purpose

(T45; N880; Actions D13, D20; v0.2 rules 8, 16) What a reply to the group's action did, and what it set off: a member lays out a reply to a request for comment claim by claim (new evidence, disputed without evidence, not addressed), with the assistant's layout stored apart as a proposal; a member links a matter or project to the response it arose from; and, at signing, each open request for comment on a case is answered once as a line of fact, never a gate. A member does every act; nothing here rates a reply or counts a chain.

### Provides

Terms. An **action**, its entries, positions and legs are `actions`' (its Terms). A **response** is a `received` entry of an action (`actions` R15, R83).

**actionReplyBearing({target, ord, claims, author, viewer}), actionBearingPropose({target, ord, claims, proposer, viewer})** (`op=actionreplybearing`, `op=actionbearingpropose`)
- **R1** [met] (T45; N880; S1 §C 7; Actions D13; v0.2 rule 16 "laid out claim by claim") For a `received` entry of a `request_for_comment`, a member lays out the reply claim by claim: `claims` as `action-grammar.bearingFindings` (its R24) shapes them, each `claim` the target of one of the action's `advances` or `rests_on` legs, each `bearing` of `BEARINGS`. Refusals in order, each writing nothing: `MACHINE_CANNOT_RECORD_BEARING` (an empty or machine author); `NO_TARGET`; `NO_SUCH_ACTION` (absent, invisible or not an action alike, through `actions.actionRead`, its R106; K3750); `BEARING_NOT_RFC` (another kind, or an entry not `received`); `BEARING_REFUSED` (R24's findings), naming the item. A later layout appends; the read `bearingsOf({target, ord?, viewer})` answers the latest per entry with the earlier ones. `actionBearingPropose` stores a proposal apart, labelled (`record-grammar`'s `proposalLabel`), with `BEARING_REFUSED`'s shape check and never changing a layout; any credential may propose, a proposer's restatement replacing its own. Control: one claim per leg with a listed bearing lands; a claim not among the legs is refused.

**aroseFromLink({target, ord, arising, author, viewer}), aroseFrom({target, ord, viewer}), arisenFrom({project} | {plan, matter}, viewer)** (`op=arosefrom`)
- **R2** [met] (T45; Actions D20; v0.2 rule 16, §6 `arose_from`; State Rules §5.1) A member records that a matter or project arose from the response at `ord`: `arising` is `{project}` (a project the author sees at `FULL`) or `{plan, matter}` (stored as given and never read here; `action-plans` sets it). Refusals in order, each writing nothing: `MACHINE_CANNOT_LINK`; `NO_TARGET`; `NO_SUCH_ACTION` (absent, invisible or not an action alike, through `actions.actionRead`, its R106; K3750); `AROSE_FROM_NOT_A_RESPONSE` (the entry is not `received`); `NO_SUCH_PROJECT` (`membership.noSuchProject`); `AROSE_FROM_LINKED` (the same link stands). Appended, never edited. `aroseFrom` answers what arose from a response, `arisenFrom` the response a project or matter arose from, each withholding whole what the viewer may not see. It is the read `plan-work` R10 uses for its reach (projects linked both ways). It never counts a chain. Control: a link from a `received` entry lands; from a `sent` entry is refused.

**The open requests at signing** (T45; N880; Actions D13; v0.2 rule 8; reconciliation R2)
- **R3** [met] (T45; N880; Actions D13; v0.2 rule 8 "each request for comment still open on the case is shown once as one line of fact") At start this module registers once with `case-inputs.registerOpenRequests` (its R8; `case-authoring` R70 before T47, N908) the source `openRequestsOn({case, members, viewer})`, in that requirement's names and shape: each `request_for_comment` the viewer may see, not `resolved` or `abandoned`, whose `advances` or `rests_on` legs name a bundle among `members` (the case's findings and inquiries, derived here from `members` itself), as `{whom, asked_at, window_closes, answers}`: `whom` R9's office by role and body as the action names it; `asked_at` its first `sent` entry's date; `window_closes` its clock entry's date as `action-clocks` answers it (null when the action states none); `answers` `{answered, claims}`, `claims` the claims of the latest R1 layout and `answered` those whose bearing is not `not_addressed`, or null with no reply recorded or no layout. It asks no reason, refuses nothing and writes nothing; it throws when it cannot read, so `case-inputs` answers `undetermined` (its R8) and `case-authoring`'s sign step says so, never `[]`. Control: a resolved request on the case is not answered.

**The proposal's label, the link's refusals, its words** (T46)
- **R5** [met] (T46; N912; amends R1; `record-grammar` R60) A proposed layout (`actionBearingPropose`) is labelled through `record-grammar`'s `proposalLabel(proposer, "bearing")`, its state and sentence that subject's, in place of this module's own sentences over `lawProposalState`; the label's three states are unchanged. Control: a machine's proposal reads `machine_proposed` with `record-grammar`'s bearing sentence.
- **R6** [met] (T46; N932; amends R2) `aroseFromLink`'s refusals, in order: `MACHINE_CANNOT_LINK`; `NO_TARGET`; `NO_SUCH_ACTION` (absent, invisible or not an action alike, through `actions.actionRead`, its R106; K3750); `AROSE_FROM_NOT_A_RESPONSE`; `AROSE_FROM_REFUSED` (C-150.7: `arising` is neither `{project}`, a project id, nor `{plan, matter}`, a `PLN-` id and a matter named in one line); `NO_SUCH_PROJECT`; `AROSE_FROM_LINKED`. A `{project}` is judged by the author's sight: one the author does not see at `FULL` is answered `NO_SUCH_PROJECT` through `membership.noSuchProject`, absent and unseen alike. `arisenFrom` refuses a malformed `arising` `AROSE_FROM_REFUSED`, a project the viewer does not see at `FULL` `NO_SUCH_PROJECT`, and a plan not in the viewer's sight `NO_SUCH_BUNDLE`. Control: a well-formed link to a project the author sees at `FULL` lands; the same project unseen is refused.
- **R7** [met] (T46; DEC-194; N913; amends R1, R2) The rows C-150.1 `MACHINE_CANNOT_RECORD_BEARING`, C-150.2 `BEARING_NOT_RFC`, C-150.3 `BEARING_REFUSED`, C-150.4 `MACHINE_CANNOT_LINK`, C-150.5 `AROSE_FROM_NOT_A_RESPONSE` and C-150.6 `AROSE_FROM_LINKED` take their translations from `words.json`'s `refusal.<CODE>`, read by key (as `membership`'s `HANDLE_WORDS` and `extraction`'s `TRANSCRIBE_WORDS` are), never a copy of the sentence; codes, numbers, `where`s and behaviour are unmoved. `BEARING_REFUSED`'s one row is this module's, minted at its site (`#bearingShape`) over `action-grammar`'s findings (its R24), so it is re-worded here and nowhere else (K231, K2845). C-150.7 `AROSE_FROM_REFUSED` reads `refusal.AROSE_FROM_REFUSED` by key likewise, since `words.json` holds it (DEC-260; T50, K3738). The six changed rows wait for T47's promotion stamp (T46 rule 5 (2)).
- **R8** [met] (T46; K2964; amends R3; `case-authoring` R70, R73, now `case-inputs` R8, R10, T47) Each open-request row R3 registers also answers `replied`: `true` when a reply (a `received` entry) is recorded for the request, else `false`, beside `answers` as today, so `case-inputs` (its R10, R17) never reads a recorded reply as none. Control: a request with a reply recorded and no claims laid out answers `answers: null, replied: true`; one with none, `replied: false`.
- **R9** [met] (T47; N992; DEC-199; amends R7; `action-grammar` R24) C-150.3 `BEARING_REFUSED` takes DEC-199's sentence from `words.json`'s `refusal.BEARING_REFUSED`, read by key, never a copy, with `{item}` filled with the item `action-grammar.bearingFindings` (its R24) names first (its position in `claims`, and the claim when it names one; the list itself when the count is outside 1 to 50): a sentence true of every arm R24 refuses (a count outside 1 to 50, a claim not among the action's legs, a claim listed twice, a bearing not of `BEARINGS`, a note over 500 characters). R1's refusal and R5's proposal answer it alike. Its code, number, `where` and behaviour are unmoved; the changed row waits for T48's promotion stamp (plan rule 5 (2)). Controls: each arm answers the key's sentence with its item filled; no answer carries an unfilled `{item}`.

**A reply that asks not to be quoted** (T48; N880; Actions D13, H17; v0.2 rule 8, "unless the reply itself says otherwise")
- **R10** [met] (T48; N880; Actions D13, H17; v0.2 rule 8) `actionReplyQuoting({target, ord, quotable, words?, author, viewer})` (`op=actionreplyquoting`). For a `received` entry of a `request_for_comment`, a member records one of two things: that the reply says it may not be quoted (`quotable: false`), with the reply's own `words` that say so (1 to 500 characters, one line, no quote, backslash or line break); or that such a record is withdrawn (`quotable: true`). - Refusals, in order, each writing nothing: `MACHINE_CANNOT_RECORD_QUOTING` (C-150.8; an empty or machine author); `NO_TARGET`; `NO_SUCH_ACTION` (absent, invisible or not an action alike, through `actions.actionRead`, its R106; K3750); `QUOTING_NOT_RFC` (C-150.9; another kind, or an entry that is not `received`); `QUOTING_REFUSED` (C-150.10; a `quotable` that is not a boolean, `words` missing with `false`, or malformed `words`). - Records are appended, never edited, and the latest per entry stands. `bearingsOf` (R1) also answers, per entry, `quotable` (`true` with nothing recorded) with its `words`, who recorded it and when. - It refuses no act of any module and enters nothing published: a declaration (DEC-13). - The rows' translations are `words.json`'s `refusal.<CODE>` for C-150.8 to C-150.10, read by key, never a copy (DEC-232; T50, K3738). They wait for T51's promotion stamp (plan rule 5 (2)). - Controls: `quotable: false` with words on a received reply lands and `bearingsOf` answers it; the same on a `sent` entry is refused `QUOTING_NOT_RFC`; a later `quotable: true` makes the entry read `true` again.
- **R11** [met] (T48; N880; amends R3, R8; `case-inputs` R18) Each open-request row R3 registers also answers `quotable`: `false` when R10's latest record on any received reply of the request says so, else `true`. Control: a request whose reply asks not to be quoted answers `false`; one with no record, or whose record was withdrawn, answers `true`.

## Private

### Uses

- `actions` (L9, earlier): `actionRead`, `actionsFor` (the action, its kind, legs, entries, state; R1–R3).
- `action-clocks` (L9, earlier): the clock entry's date read (its R3; R3's `window_closes`; reconciliation R15: this module sits after it).
- `action-grammar`: `bearingFindings`, `BEARINGS` (its R24, R2; R1); the rows (its R9).
- (T47; N908; K2982) `case-inputs` (L8): `caseInputsOf`, `registerOpenRequests` (its R8; R3), in place of `case-authoring` (its R70 until T47), which leaves `uses`; `open.test.mjs` still builds `case-authoring` for the sign step it drives, a test edge as before.
- `membership`: `sight`, `noSuchProject` (R2).
- `record-core`: `transact`, `stampInstant`, `declarePurge` (R4). `record-grammar`: `isMachineIdentity`, `proposalLabel` (R1).

Every edge points earlier (this module 122). `plan-work` reads R2; `affordances` and the plane compose the ops.

### Invariants

- **R4** [met] (T45; v0.2 rule 1) A machine never records a bearing layout, an `arose_from` link or (T48) a quoting record (R10); it may propose a layout (R1). Layouts, proposals and links are this module's tables, append-only, keyed by `bundle_id`, declared to purge (K23). Every read answers an invisible action as an absent one. No place is named in this module's behaviour or outward text.

### Satisfies

- `BIO_Action_v0_2.md` §4 rules 1, 8, 16, §6 (`arose_from`) (K2780; T45, N893): replies laid out claim by claim (R1), what arose from a response (R2), open requests shown once at signing (R3), a reply that asks not to be quoted (R10, R11; T48, N880, K2744); Actions D13, D20, H17; State Rules §5.1 (`arose_from`); S1 §C 7.

### Suggestions

- Rows: R1's, R2's codes (`MACHINE_CANNOT_RECORD_BEARING`, `BEARING_NOT_RFC`, `BEARING_REFUSED`, `MACHINE_CANNOT_LINK`, `AROSE_FROM_NOT_A_RESPONSE`, `AROSE_FROM_LINKED`) take C-117's next numbers in `action-grammar` until this module's own family is BOB's at its START (reconciliation R21).
- The assistant's claim bearings (a proposal through R1) wait for an AI task; none is in T45.
- Tests: each refusal with a control; R3 against `case-inputs` R8's shape (a second registration refused there; `case-authoring` R70's before T47), with a reply laid out and without.
