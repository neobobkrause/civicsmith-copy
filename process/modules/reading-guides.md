Length: 59 lines. Last section: "Suggestions".

# reading-guides: requirements

Next number: 17

**Size (P6).** About 900 lines.

## Public

### Purpose

Reading guides say what to look for in one kind of document (D8): by hand a checklist, for the AI what to read for, so the two are the same thing (D65). Civicsmith's library ships to every group; each group keeps its own; guides are offered across groups and reviewed before adoption. A guide says what to look for, never how the AI may behave (D24).

### Provides

Terms. A **guide** is `GUD-` (`record-grammar` R53): `{id, kind, origin, items, state, author, reviewed_by, based_on}`; `kind` a document kind (`doctypes`); `origin` `civicsmith`, `group` or `adopted`; each **item** `{label, look_for, where?}`, short plain strings. A **state** is `draft`, `usable_by_author`, `group`, `retired`.

- **R1** [met] `CIVICSMITH_GUIDES` is frozen data carried with the release, each guide approved by Bob or someone he names, each carrying the record of measured use that showed it works; read-only to every group.
- **R2** [met] `guideDraft({kind, items, based_on?, by})` by a member: usable by its author at once (`usable_by_author`). A machine may draft (`guidePropose`, labeled, R12), never approve.
- **R3** [met] `guideReview({guide, verdict, reason, by})` by another member (never the author): `approve` makes it the group's; `refuse` keeps it its author's with the reason. History kept.
- **R4** [met] `checkGuide(items)` (pure) refuses `GUIDE_CARRIES_CONDUCT`, naming the item, any item whose text names an act, op, tool, rule, the assistant, a permission or a control-flow pattern (the check registered by `registerConductCheck(fn)`, once at start, K31's pattern: `skills` fills it with its R16 `controlFlowAuthority`; a second registration is refused `PROVIDER_DECLARED`; with none registered R4 checks only its own lists, and `skills` R40 re-runs R16 at every render), or is not a look-for statement (the closed lists in this file's Suggestions, BOB's; K2472); every draft, review, adoption and render runs it. No guide can loosen a rule (D24).
- **R5** [met] `guideFor({kind, viewer})` answers the guide in force for a kind: the viewer's own usable guide when she asks, else the group's, else Civicsmith's, else none, with its origin. Never throws.
- **R6** [met] (D8 cross-group) `guideOffer({guide, by})` by a group member answers the guide's canonical bytes and digest, labeled with the offering group's slug, for another group; `guideAdopt({bytes, by})` imports one as `adopted`, `based_on` the offer's digest, usable only after R3's review in the adopting group. A guide many groups use may be exported marked as a proposal for Civicsmith's library (`guideProposeToCivicsmith`); Civicsmith's adoption is a release's, not this module's. The channel between groups is registered later (`registerGuideChannel`, K31's pattern; `network-notices`), BOB's.
- **R7** [met] `guideRetire({guide, reason, by})` by an approver of its scope; retired guides stay readable; nothing is deleted.
- **R8** [met] `guidesOf({kind?, state?, viewer})` lists guides the viewer may see, at most 200, `truncated`.
- **R12** [met] `guidePropose({kind, items, run, by})` stores a machine draft apart, labeled (`record-grammar` R42); only a member's R2 act with `based_on` makes it a guide.
- **R13** [met] (T45; N858; Actions D8; v0.2 rule 11) A guide may have `purpose` `procedure` (a reading guide's is `reading`, the default): `kind` an `action_kinds` kind of the active profiles' view (`GUIDE_KIND_UNKNOWN` otherwise), each item `{route, expect?, citation}`, `route` and `expect` short plain strings, `citation` required (`GUIDE_ITEM_UNSOURCED`). R2, R3, R6–R8 and R12 hold for it. R4's check for a procedure guide applies only its op form, its party-to-conduct list and `skills` R16's control-flow check (a procedure names acts and duties, "send", "must", by nature); its look-for opening and its act and rule words do not apply. `procedureGuidesFor({kind, viewer})` answers the profile's guide for `kind` (from `combine`, `jurisdictions` R80) first, then the group's approved procedure guides in the order approved, each with its origin, answered as `{kind, guides: [{guide, origin, items}], label}` (`guide` the guide's id; K2820), served to members by `op=procedureguides` (`{kind}`, declared by `op-declarations`); no rank, score or preferred route; every answer carries `label` keyed `guide.procedure.legalinfo` (canon's words, v0.2 rule 11: "legal information, not legal advice"). Never throws.
- **R14** [met] (T46; DEC-194; N913; amends R11, R13) The rows C-144.4 `GUIDE_KIND_UNKNOWN` and C-144.19 `GUIDE_ITEM_UNSOURCED` take their translations from `words.json`'s `refusal.<CODE>`, read by key (as `membership`'s `HANDLE_WORDS` and `extraction`'s `TRANSCRIBE_WORDS` are), never a copy of the sentence; codes, numbers, `where`s and behaviour are unmoved, and each still says nothing was written. R13's `label` (`PROCEDURE_GUIDE_LABEL`) carries the words of `guide.procedure.legalinfo` read by that key ("Legal information, not legal advice", protected), never its own copy; the key is unchanged. This module's other rows, which `words.json` does not hold, keep theirs. The two changed rows wait for T47's promotion stamp (T46 rule 5 (2)).
- **R15** [met] (T51; N858 D8; DEC-340, U366; K3935; amends R13; `screens-action` R31) **A procedure guide says who approved it and where it came from.** `procedureGuidesFor({kind, viewer})` (R13) answers each guide of the profile as `{origin: "profile", items, status, basis}` and each approved group guide as `{origin: "group", guide, items, approved_by, approved_at}` (an adopted guide, R6, approved by this group's review keeps `origin: "adopted"` and answers `approved_by` and `approved_at` the same way; K4009) (`approved_by` the reviewing member as the viewer may see her, `approved_at` the day), after the profile's, in the order approved. Each item keeps `{route, expect?, citation}`; a route without `citation` is never answered (R13), and `after` (`jurisdictions` R87 (d)) is answered when the item has it. With no guide for the kind, `guides: []` and the `label`. No rank, score or preferred route. Test: a group guide answers its approver and day; a profile guide answers `status` and `basis`; control: an unapproved group guide is not answered.

## Private

### Uses

- `record-grammar`: `ID_TABLE`'s `GUD` and `isGuideId` (its R53), the proposal labels (its R42).
- `civil-time`: dates of reviews and adoptions.
- `record-core`: `declareTable` (R9).
- `membership`: members, the group's sight (R2, R3, R7).
- (T45) `jurisdictions` (L1): `combine`'s view, its `action_kinds` and `procedure_guides` (its R25, R80), for R13; the active profiles through `record-core` `getSetting` (an existing edge).

### Invariants

- **R9** [met] Tables declared through `record-core.declareTable`, purged with the store; a group guide's sight is the group's.
- **R10** [met] A guide never grades, concludes, or names a body's conduct; its items say what to look for and where.
- **R11** [met] Each refusal carries its row in this module's own `checks.mjs`, a new family. No place is named in behaviour or outward text.

### Satisfies

- The investigation design of record (K2417): D8, D24, D65; D1's "reading-guide library".
- `BIO_Action_v0_2.md` rule 11 (K2780; T45, N893): procedure guides per kind, legal information, unranked, a group's own beside the profile's (R13).
- DEC-194 (R14; N913).

### Suggestions

- **R4's closed lists (BOB's, K2472).** An item is a look-for statement when it opens with one of: "Look for", "Note whether", "Note where", "Check whether", "Check that", "Watch for", "Compare". It names conduct when, as a whole word and case-insensitive, it carries an op form (`op=`), a tool or act word (`run`, `call`, `fetch`, `search`, `capture`, `post`, `send`, `sign`, `publish`, `approve`, `delete`, `tool`, `grant`), a party to conduct (`assistant`, `Civicsmith`, `model`, `AI`), or a rule or permission word (`permission`, `permitted`, `allowed`, `must` (not `may`, which a month's name would trip; READING-GUIDES #1 J1, K2482), `rule`, `instruction`). The lists are frozen in code and tested whole; a later change is a requirement change.
- Paths: `bio-plane/src/reading-guides/`; tests `bio-plane/test/m/reading-guides/`.

- **R16** [met] (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `procedureguides`. Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`).
