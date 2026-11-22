Length: 80 lines. Last section: "Suggestions".

# contradiction-words: requirements

Next number: 63

## Public

### Purpose

The words contradiction holds as data: the judgement and recommendation prompts a run is given, with their pinned digests and the labels an answer may carry (`contradiction.mjs`), and the rows of every refusal of the pairing read and the candidate door, C-60 and C-93, with their translations (`contradiction/checks.mjs`). Pure: it reads and decides nothing; `contradiction` answers through it and `skills` packages its prompts.

### Provides

**The judgement's words: CONTRADICTION_LABELS, JUDGEMENT_PROMPT, JUDGEMENT_PROMPT_SHA256, judgementSide(side), renderJudgementInput(pairs)** Pure; never throw.
- **R1** [met] `CONTRADICTION_LABELS` is exactly `world`, `record`, `precision`, `unrelated`, `undetermined`, in that order.
- **R2** [met] `sha256(JUDGEMENT_PROMPT)` equals `JUDGEMENT_PROMPT_SHA256`, the digest measured on the over-strictness gate (M-162). The prompt changes only with a new measurement that moves the digest in the same change.
- **R3** [met] `judgementSide` keeps only `text`, `doctype`, `date` and `role`, and omits a field that is null or absent; it never fills one.
- **R4** [met] `renderJudgementInput` is the prompt, then `PAIRS:`, then each pair numbered from 1 with its key, its context when it has one, and sides A and B through R3. A non-array renders no pairs.

#### The measures

- **R41** [not yet met] (K447 (6)). `sha256(RECOMMEND_PROMPT)` equals `RECOMMEND_PROMPT_SHA256`: the digest under which the blind fixture of dissolved pairs was measured and recorded in `MEASUREMENTS.md`. The prompt changes only with a new measurement that moves the digest in the same change.

## Private

### Uses

- `setup-words`: `word`, `localize` (each row's translation by key).

### Invariants

- **R20** [met] Each check moves here as an invariant with its test (K6): C-60.1, C-93.1–C-93.7; and C-60.2, C-60.3 and C-93.8–C-93.42 (N345; translations below).

Rows C-60.2, C-60.3 (`CONTRADICTION_PAIR_CHECKS`) and C-93.8–C-93.39 (`CONTRADICTION_CANDIDATE_CHECKS`) (R20; N345), with their translations; promotion stamps them:

| row | code | translation |
|---|---|---|
| C-60.2 | `CANDIDATES_NO_SUBJECT` | "Candidates are read for one thing at a time: a question, a document part, a subject, a record, a project or one candidate. Name exactly one. Nothing was read." |
| C-60.3 | `TENSIONS_TOO_MANY` | "At most 200 items can be asked about in one request. Ask about fewer at a time. Nothing was read." |
| C-93.8 | `NO_CANDIDATE` | "This act is about one contradiction candidate, named by its id, and it names none. Nothing was written." |
| C-93.9 | `NO_SUCH_CANDIDATE` | "No contradiction you can see answers to that id. One whose side you may not see is answered here exactly as one that does not exist. If it touches your project, it reaches you as a notice about your own side. Nothing was written." |
| C-93.10 | `MACHINE_CANNOT_ACT_ON_CANDIDATE` | "Saying what a contradiction turned out to be is a member's act, and a machine credential cannot take it. A machine may recommend in which respects the two sides may differ. Nothing was written." |
| C-93.11 | `CANDIDATE_CLOSED` | "That contradiction has already been dismissed or resolved, by the member named, and it stays as they left it. If something new bears on it, take it up as a question. Nothing was written." |
| C-93.12 | `CANDIDATE_TAKEN_UP` | "That contradiction has been taken up as a question, which is named, and it is resolved there by the question's conclusion. Nothing was written." |
| C-93.13 | `RECORD_CANNOT_BE_DISMISSED` | "This conflict is between two things the record itself holds, so it cannot be dismissed. It closes only when a member says how the two differ, which one is wrong, or that they really conflict. Nothing was written." |
| C-93.14 | `DISMISSAL_REASON_UNKNOWN` | "Dismissing a lead gives one of three reasons: the same fact at different precision, not about the same matter, or a real conflict not pursued now. Choose one. Nothing was written." |
| C-93.15 | `CLARIFY_NOT_A_TENSION` | "This is a lead the record noticed about the world, not a conflict in the record, so there is nothing to clarify. Take it up as a question, or dismiss it with a reason. Nothing was written." |
| C-93.16 | `CLARIFY_CHOICE_UNKNOWN` | "That is not one of the answers to 'how do these differ?' for this conflict. The answers are listed with it. Nothing was written." |
| C-93.17 | `CLARIFY_COORDINATE_UNKNOWN` | "Saying the two differ names at least one respect in which they differ, from the ones listed for this conflict. Nothing was written." |
| C-93.18 | `CLARIFY_NO_EXPLANATION` | "Saying how the two differ is explained in your own words, unless you are accepting the recommendation shown. Add a sentence. Nothing was written." |
| C-93.19 | `EVIDENCE_NOT_SEEN` | "Something named as evidence is not one you can see, or is a fact the record does not state. Name only what is shown to you. Nothing was written." |
| C-93.20 | `WRONG_SIDE_UNNAMED` | "Saying one of them is wrong names which one. Nothing was written." |
| C-93.21 | `WRONG_SIDE_NO_REASON` | "Saying one side is wrong is a kept decision, and a kept decision says why. Give the reason. Nothing was written." |
| C-93.22 | `PLURALITY_HAS_NO_WRONG_SIDE` | "These are two projects' own conclusions, and neither is made to adopt the other's answer. Say how they differ, that they really conflict, or take the question up. Nothing was written." |
| C-93.23 | `TAKE_UP_NO_QUESTION` | "Taking a contradiction up starts a question, and the question is yours to word. Accept the suggested wording or write your own. Nothing was written." |
| C-93.24 | `TAKE_UP_NO_FRAME` | "The question is asked around one of the two sides. Choose which one. Nothing was written." |
| C-93.25 | `ACCEPTANCE_NOT_STANDING` | "The recommendation you accepted is no longer standing for this contradiction, or was never made for it. Read it again, and choose. Nothing was written." |
| C-93.26 | `ACCEPTANCE_VALUE_DIFFERS` | "You accepted a recommendation for something this act does not record. Accept only what you are recording, or record it unaided. Nothing was written." |
| C-93.27 | `NOT_A_CONTRADICTION_INQUIRY` | "No question you can see answers to that id as one taken up from a contradiction. Nothing was written." |
| C-93.28 | `RECOMMEND_NO_COORDINATES` | "A recommendation names at least one respect in which the two sides may differ. None was named, so nothing was written." |
| C-93.29 | `RECOMMEND_COORDINATE_UNKNOWN` | "A recommendation may name only the respects listed for this conflict, never which side is wrong or what kind of conflict it is. Nothing was written." |
| C-93.30 | `RECOMMEND_NO_REASON` | "Each recommendation says in one sentence why, so the member can see what the machine saw. One had no reason, so nothing was written." |
| C-93.31 | `RECOMMEND_CANDIDATE_NOT_STANDING` | "That contradiction is not open to recommendation: it has been resolved, dismissed or taken up, or it is not shown. Nothing was written." |
| C-93.32 | `CANDIDATE_NOT_HELD` | "This question names a contradiction the record does not hold, or one you cannot see both sides of. Take a contradiction up from where it is shown. Nothing was written." |
| C-93.33 | `WORDS_MALFORMED` | "A piece of text in this act is longer than it may be. The field and its limit are named. Nothing was written." |
| C-93.34 | `NOT_A_PARTY` | "The project named does not rest on the side of this conflict that you can see, so it cannot ask to resolve it or respond to it. Name the project the notice came to. Nothing was written." |
| C-93.35 | `NOT_A_PROJECT_CONFLICT` | "This is a lead the record noticed about the world, not a conflict the record holds between projects, so there is nothing to resolve between projects. Take it up as a question, or dismiss it with a reason. Nothing was written." |
| C-93.36 | `RESPONSE_BEFORE_OPT_IN` | "A project responds to a conflict after it has asked to resolve it. Ask first, on the notice; your response reaches the other projects only once every project holding a side has asked. Nothing was written." |
| C-93.37 | `RESPONSE_NO_TEXT` | "A response says something in your own words. Write it, and choose separately whether to share your cover or an email address. Nothing was written." |
| C-93.38 | `DISCLOSURE_MALFORMED` | "What a response shares about you is your cover, an email address, or neither, and nothing else. The address must be one address. The part that is not one of these is named. Nothing was written." |
| C-93.39 | `DISCLOSURE_NOT_YOURS` | "A response may share only your own cover or your own email address. What was given is someone else's, so it was not shared. Share your own, or nothing. Nothing was written." |

### Satisfies

- What the judgement sees (K102): no change. The input stays as measured (R3, R4: each side's text, doctype, date and role, and K3's passage; 0/17 false conflicts, 9/9 recall, M-162), and the canon's text changes: CONTRADICTION-IDENTIFY-DESIGN §5 is amended to say so. The inquiry's question is added only with a new measurement on a corpus of real documents, the binding gap §7 names.

### Suggestions

- **The recommender's prompt** is packaged into the skill pack by `skills`, as the judgement's prompt is.
