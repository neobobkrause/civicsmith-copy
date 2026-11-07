<!-- Snapshot of the claude.ai document https://claude.ai/artifact/UgRF58WWCfuDu88ztaKNbL, exported 2026-11-07T05:45Z for the account switch. The live document stays the working copy until Bob says otherwise. -->

# Investigation: requirements for BD-14

Nov 7, 2026 · @Bob Krause

Draft requirements for Bob's answers to Q9 (BD-14, 7 Nov). Q9.2–Q9.6 are ready to place. Q9.1 is drafted and held until Bob's UX check names a fallback. Q9.7 needs no requirement here: it keeps the ruling and sends a gloss to the ux lane. Each draft has a lane id (IV-n). BOB gives it a module R number when it is placed.

## Placement

Eleven drafts across eleven modules, plus three held. IV-5 and IV-7 are proposals to the publication lane.

| Draft | What it requires | Home module (layer) | Waits on |
| --- | --- | --- | --- |
| IV-1 | A conclusion may carry key assumptions | inquiry (6) | — |
| IV-2 | An assumption may become a "find the record" step | steps (6) | IV-1 |
| IV-3 | CHECK runs when a conclusion is adopted and before signing | run-rules (6) for when it runs; ratification (8) reads it before signing | the ai-design lane's design of CHECK |
| IV-4 | Each look keeps its parameters | observation-log (5) | Q7, for the INV:85 canon line only |
| IV-5 | A case states what was searched, with those parameters | publication lane, under BD-13 | IV-4 |
| IV-6 | A second reading of a conclusion, on by default | investigation (7) | — |
| IV-7 | Signing refuses when the second reading is missing; a missing reading is stated | ratification (8), case-grammar (8) | IV-6 |
| IV-8 | Contrary recall measured on the test investigations | ai-gate (6), ai-runs (6) | — |
| IV-9 | A bar a reading part must meet before release | ai-gate (6) | IV-8, and Bob's number for the bar |
| IV-10 | A counter-proposal pass at reading time | contradiction (6) | IV-8 |
| IV-11 | An optional reason on a leg | inquiry-grammar (6) | — |
| IV-H1 to IV-H4 | Rival hypotheses: B's full marks (IV-H2) or the rules-out fallback (IV-H4) | hypotheses (6), inquiry (6) | **HELD**: Bob's UX check and fallback |

Funding disclosure (Q9.6) is the publication lane's under BD-13 and is not drafted here. Q9.7 needs no requirement in this area.

## Q9.2 Key assumptions and CHECK

**IV-1 (inquiry). A conclusion may carry key assumptions.** A concluded inquiry may hold `assumptions: [{text, by, at, step?}]`, at most 12.

- `text` is the member's own words, at most 500 characters.
- `by` is a member; a machine stamp is refused, because the machine never concludes (INV:46).
- An assumption is never a leg and never moves a grade or the strength.
- Each assumption shows its state:
  - `unconfirmed`, or
  - `confirmed by <leg>` once a member names a leg that bears it out, or
  - `contradicted by <leg>` once a member names a leg against it.
- An unconfirmed or contradicted assumption is shown beside the strength wherever the conclusion is shown.
- Adding, editing or removing an assumption is kept in the inquiry's history. Removal keeps who removed it and when.
- **Refusals, in order:** `MACHINE_CANNOT_ASSUME`; `NOT_CONCLUDED`; `ASSUMPTION_EMPTY`; `ASSUMPTION_TOO_LONG` (naming 500); `TOO_MANY_ASSUMPTIONS` (naming 12); `NO_SUCH_LEG` for a `confirmed by` or `contradicted by` leg not in the inquiry.

**IV-2 (steps). An assumption may become a "find the record" step.** A member may open a step from an assumption, as recalled claims already do (INV:140). The step names the assumption it serves. When it ends with a leg, the member is offered `confirmed by` or `contradicted by` that leg. The member chooses, and the choice is never made for them.

**IV-3 (run-rules; ratification reads it). CHECK runs at two points.**

- **When it runs.** The CHECK role (AIR §7.4) runs once when a member adopts a conclusion, and once before a case edition is signed, over the conclusions the edition carries.
- **What it can raise.** It raises labelled signals only, each naming its leg or assumption and the reason in one line:
  - a leg that no longer resolves;
  - a falsifier with evidence;
  - legs of an OR-branch that share an origin;
  - an assumption the record contradicts.
- **What it may never do.** It never changes a grade, a strength or a conclusion. Its signals carry the measured false-alarm rate (INV:108).
- **Before signing.** Signing shows the open signals and asks the signer to acknowledge each one. It does not block, and the acknowledgement is kept with the edition.
- **While CHECK is unmeasured.** CHECK runs only once its part passes the test-investigation gate (`ai-runs` R75). Until then, the conclusion and the signing view say "no adversarial check has run". Nothing waits on it.

## Q9.3 Look parameters

**IV-4 (observation-log). Each look keeps its parameters.** An entry at the `internet` or `document` level may carry `params: {where, query?, filter?, guide?, range?}`.

- `where` is the portal, site or held collection searched, named as the record names it.
- `query` is the search words as sent.
- `filter` is the portal's filters, as key and value.
- `guide` is the reading guide's id, when one drove the look.
- `range` is the dates or items covered.
- A `LOOKED_ABSENT` or `LOOKED_INDETERMINATE` entry made by a member's or a step's search carries `params` with at least `where`.
- An entry without `params` from before this requirement reads as `params: unrecorded`, never as a refusal.
- The step's own path (which links were followed, in what order) is still not kept (INV:85). Only the look's parameters are.
- A query is stored as given and shown only to those who may see the entry. No secret is ever stored: a parameter whose key names a credential, a token or a key is refused (`PARAM_LOOKS_SECRET`) and nothing is written.
- **Refusals, in order:** `PARAMS_NO_WHERE`, for an absent or indeterminate look with no `where`; `PARAMS_TOO_LONG`, with any field over 2,000 characters, naming the field; `PARAM_LOOKS_SECRET`.

**IV-5 (publication lane, BD-13). Showing it in a case.** A case's "what was searched" (INV:92) states each look's `where`, `query` and `range` beside its outcome, so an outside checker can repeat it. How it is worded is the publication lane's.

**Canon.** INV:85 gains: "A look keeps where and how it searched; the path a step took is still not kept." This waits on Q7, so the module's job places IV-4 against BD-14 meanwhile.

## Q9.4 Independent reading of conclusions

**IV-6 (investigation). A second reading, on by default.**

- **The default and the switch.** A project of a group with two or more joined members has `second_reading: on` by default. The project's owner may switch it off with a reason, which is kept.
- **Recording a reading.** A reading is `readConclusion({inquiry, by, verdict, note?})`:
  - `verdict` is `read`, `read_with_concerns` or `cannot_support`;
  - `note` is required for the last two, and is the member's own words.
- **Who may read.** The reader must be a joined member who neither adopted the conclusion nor accepted more than half of its legs, so the reading is independent. A machine is refused.
- **What a reading never does.** It never moves the conclusion or its strength. `cannot_support` is shown beside the conclusion until the conclusion changes or the reader withdraws it.
- **When a conclusion changes.** A changed conclusion, meaning a new basis version adopted, asks for a new reading. Earlier readings stay in its history, marked as readings of the earlier version.
- **Refusals, in order:** `MACHINE_CANNOT_READ`; `NOT_CONCLUDED`; `READER_NOT_INDEPENDENT` (naming why: adopted it, or accepted most legs); `READING_NOTE_REQUIRED`; `READING_SWITCH_NEEDS_REASON` (on the switch).

**IV-7 (ratification, case-grammar). Signing and stating it.**

- **Switch on.** Signing a case edition whose conclusions lack a current reading is refused `SECOND_READING_MISSING`, naming the conclusions.
- **Switch off, or a group of one.** Signing goes ahead, and the case states it plainly: "No second member read these conclusions", with the reason. This is the pattern for a missing falsifier (CM:694–710).
- **A `cannot_support` reading.** It does not block signing. The case carries the reading's note, as a reviewer's comment would (INV:171), and the publisher may not leave it out.
- **The wording** is the publication lane's, under BD-13.

## Q9.5 Contrary recall

**IV-8 (ai-gate builds; ai-runs writes). Contrary recall on the test investigations.** Every test investigation's human-written answer marks which passages cut against each conclusion it holds, including exculpatory passages. For every reading part that proposes passages (INV:127), the Gate 1 record (`ai-runs` R75) reports two figures separately:

- **contrary recall:** the share of marked cutting-against passages the part proposed;
- **supporting recall:** the same share for supporting passages.

Each comes with the counts behind it. A test investigation without contrary marks contributes to neither figure, and the record says how many did.

**IV-9 (ai-gate). A release bar on contrary recall.** A reading part passes Gate 1 only if its contrary recall meets the bar. It must also not trail its supporting recall by more than the gap the bar names. The bar and the gap are Civicsmith's published numbers, with their dates, shown wherever the gate's verdict is shown. **The numbers are Bob's.** The lane recommends 0.8 contrary recall and a gap of at most 0.1, to be confirmed once the first measurement exists. Until Bob sets them, the measure is recorded and the bar is not enforced, and the verdict says so.

**IV-10 (contradiction). A counter-proposal pass at reading time.**

- **What it does.** When a reading part proposes passages from a document for a question, a second pass over the same document asks what in it cuts against the question's current answer.
- **How its finds appear.** They are proposed in the same accepting act (INV:106), labelled "cuts against", and never mixed into the supporting list.
- **When it finds nothing.** It says "looked for passages against: none found" and records that as a look at the `meaning` level (`observation-log`).
- **What it never does.** It never measures, scores or names a member, so DEC-68 stands. It runs only once its part passes Gate 1, and until then the reading says "no search for contrary passages has run".
- **Cost.** It is a second AI act on each reading, priced through `ai-use` like any other, and a group may switch it off with a reason, which is kept. Its absence is stated wherever the reading is shown.

## Q9.6 A reason on a leg

**IV-11 (inquiry-grammar). An optional reason on a leg.** A leg may carry `reason: {text, by, at}`, giving why this passage bears on this claim, in the member's own words.

- **Shape.** `text` is at most 300 characters, in one or two sentences.
- **Who writes it.** `by` is a member. A machine stamp is refused (AIR rule 1), and the machine never drafts or suggests it.
- **What it never does.** It never moves a grade or the strength.
- **Who reads it.**
  - CHECK (IV-3) reads it, and may raise "the reason does not follow from the passage" as a labelled signal.
  - The case's sentence check (INV:165) may test a case sentence against it, under publication's rules (BD-13).
- **Editing.** A reason is kept in the leg's history when it is edited. It travels with the leg into the case, pinned as the leg is.
- **Refusals, in order:** `MACHINE_CANNOT_REASON`, `REASON_EMPTY`, `REASON_TOO_LONG` (naming 300).

Funding disclosure is the publication lane's (BD-13).

## Q9.1 Rival hypotheses (HELD)

**HELD.** Bob settled the fallback on 7 Nov, BD-14: rules-out marks only. The ux lane builds a clickable walkthrough of B with the fallback beside it. No job builds either until Bob has seen it and confirmed one. IV-H1 and IV-H3 hold for both. IV-H2 is option B, and IV-H4 is the fallback.

**The model, for the ux lane**

- **Question.** An inquiry: what the members want answered.
- **Leg.** One piece of evidence held on the question. It is a cited passage or record, graded, and either supporting or cutting against the current answer. Legs already exist.
- **Rival.** One candidate answer to the question, held as a hypothesis (`hypotheses` R1). Example: "budget shortfall". The rivals are listed side by side on the question.
- **Mark.** A member's judgment of how one leg bears on one rival. It is never a machine's, and it never moves a grade, a strength or a conclusion.
- **Still standing.** The rivals no member has set aside. Nothing is computed away: setting a rival aside is always a member's act with a reason.

**IV-H1 (hypotheses). The rival set.**

- An inquiry may hold one rival set of 2 to 6 hypotheses already held in it.
- Only a member creates the set or adds or removes a rival, and each change is kept in its history.
- **Setting a rival aside.** A member may set a rival aside with a reason that names at least one leg marked against it. A member may also bring a set-aside rival back. Both acts are kept.
- **Refusals, in order:** `MACHINE_CANNOT_HYPOTHESISE`; `RIVALS_TOO_FEW` / `RIVALS_TOO_MANY` (naming 2 and 6); `NOT_IN_INQUIRY`; `SET_ASIDE_NEEDS_LEG`.

**IV-H2 (hypotheses). Option B: full marks.** For each leg and each rival, a member may mark `consistent`, `inconsistent` or `not_bearing`. A pair no one has marked shows "not yet marked".

- **Whose mark.** Each member holds at most one mark per leg and rival. A later mark by the same member replaces their earlier one, and both are kept in history with who and when.
- **Agreement and dispute.** When members' current marks agree, the pair shows that mark. When they differ, it shows "disputed" and opens to who marked what. Disagreement is structure, not a note.
- **Does not tell them apart.** A leg shows "does not tell the rivals apart" only when every rival's mark for it is `consistent` and none is disputed. An unmarked pair never counts. This is a labelled signal (INV:108).

**IV-H3 (inquiry). What the question shows.**

- **Rivals still standing.** Each standing rival comes with its case against: the legs marked against it, with their grades and any dispute.
- **Set-aside rivals.** These come with the member, the date and the reason.
- **Rejected rivals in a case.** How a case lists them is the publication lane's (BD-13).

**IV-H4 (hypotheses). The fallback: rules-out marks only.**

- **One action per leg.** A member marks a leg "rules out", naming one or more rivals it cuts against. There is no grid, and no consistent or not-bearing mark.
- **How it is recorded.** A rules-out is the same record as IV-H2's `inconsistent`, so the data needs no migration if B is adopted later.
- **Whose mark and dispute.** The same as IV-H2. A member may withdraw their own rules-out. When one member rules out a rival and another marks that they do not agree, the leg shows "disputed" for that rival.
- **Does not tell them apart.** This signal does not exist in the fallback: it needs consistent marks, which the fallback does not have.

## Screens owed to the ux lane, and Bob's caveat

Bob chose these "without the opportunity for first see whether the resulting UX is rich enough and friendly enough". So every draft above that a member sees owes a screen to the ux lane, and the ux lane's check may send a draft back to this lane through BOB. The lane will then revise the draft. It never drops a draft without Bob.

| Draft | What the member must be able to see and do |
| --- | --- |
| IV-1, IV-2 | Add an assumption to a conclusion. See which are unconfirmed. Open a step from one. |
| IV-3 | See CHECK's signals on a conclusion. Acknowledge each one at signing. |
| IV-4 | See where and how a look searched, beside "looked, found nothing". |
| IV-6 | Ask for a second reading. Give a reading. See a "cannot support". |
| IV-10 | See "cuts against" proposals kept apart from supporting ones. |
| IV-11 | Add a reason to a leg and read it. |
| IV-H1 to IV-H4 | **The UX check Bob asked for**: a walkthrough of B beside the rules-out fallback. Name rivals, mark legs, see which still stand. |
| Q9.7 | A word gloss beside each grade letter, for example "D: a member's own account; no captured document". |

IV-5 and IV-7 are proposals to the publication lane, which owns case text and signing under BD-13. It may reword them or decline them through BOB.
