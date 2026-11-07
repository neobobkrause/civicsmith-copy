# contradiction — requirements

**Status** · In force: approved by Bob 2026-09-26 (K102); N345 folded (K455, K456, K459). Last changed T41 (T41-20: R50 and R55 amended, a non-hidden party named, as `draft-T41-investigation.md` §3.6; D64, K2405, K2418), not yet met; every other requirement met (K1611) except the K5 arms of five requirements (no measured recommender run, K488) and two marked N345.

**Size (P6).** About 975 lines move (about 640 without comment-only lines): `store.mjs` 780, `contradiction.mjs` 83, `bio-checks.mjs` 81, `schema.mjs` 31. Well under 4,000; one session reads it with the public parts of its uses.

## Public

### Purpose

Contradiction's IDENTIFY: the plane pairs assertions worth comparing, deterministically, for a viewer, and says at which level a key found nothing; a run's machine judgement over a formed pair enters the record only as a labelled, append-only proposal. It never judges, grades, edits or closes either side.

PRESENT and RESOLVE are held here too. A candidate is shown to a member who may see both of its sides, at the weight its label and key give it. A member's attributed act says what the conflict turned out to be: inline, or by taking it up as a contradiction inquiry whose conclusion records its kind. The machine may recommend only in which respects the sides may differ. Nothing here edits a side. What an act implies (a qualifier, a stale mark, a tension) is read, never written onto the side.

A conflict between projects whose other side a member may not see is told to that member's project on its own side only, never naming the other side or who holds it. Each project may ask to resolve it. When every project holding a side has asked, the projects are named to each other's members, and each project's members may respond; a response reaches the other projects carrying only what its responder chose to share (DEC-85, K456).

### Provides

Terms. A **key** is one of `K1` (one inquiry, opposite roles: a `supports` and a `cuts_against` leg of one inquiry, each naming a content row), `K2` (one subject, two held claims: two inquiries with the same subject entity, each with an accepted, unhidden basis version carrying a non-empty claim), `K3` (one referent, two held claims: accepted, unhidden, claimed versions of two different inquiries whose version legs rest on the same content row, or, where neither names one, on the same `information` target), `K4` (one entity, two sources: two cited content rows whose captures both resolve, established, to one entity, told apart by doctype or else by date as their readers state them), `K5` (one question, two projects' conclusions: two projects whose stances on one inquiry are both `concluded` (`basis-versions` R22's `conclusionOf`), adopting claims whose text differs; each side is `{kind: "stance", inquiry, project, version, claim}`; N345, DEC-84 item 3), `K6` (two amounts for one transfer: two money facts naming the same payer and payee entities, the same kind and phase or stage, and periods that overlap, whose amounts `money.reconcile` does not answer `consistent`; each side is `{kind: "money", fact, capture_sha, ref, amount, period, stage}`; ladders §5C.4, T33-48). A **side** is a claim `{kind: "claim", inquiry, version, claim, …}`, a leg `{kind: "leg", inquiry, ord, role, target, content_id, note, capture_sha, ref, extent_kind, stale}` or an extent `{kind: "extent", content_id, capture_sha, ref, extent_kind, doctype, date, read}`. A **label** is one of R1. Every refusal names `reason` and `code`, and carries its catalogue `check` and `translation`. `viewer`, `proposedBy` and `caller` are the control plane's stamps. A **weight** is `lead`, `duty`, `plurality` or `not_shown` (R24). A candidate's **state** is `open`, `dismissed`, `explained_not_shown`, `taken_up` or `resolved` (R26). A **mark** is one of R27's. **Coordinates**, **kinds** and **canons** are `inquiry`'s vocabularies (its R46). An **acceptance basis** is R30's. A candidate's **parties**, a **conflict between projects**, and a viewer who **sees it half** are R49's. A **notice** is R50's, an **opt-in** R51's, the **reveal** R52's, and a **response** and its **relay** R53's and R54's.

**The judgement's words: CONTRADICTION_LABELS, JUDGEMENT_PROMPT, JUDGEMENT_PROMPT_SHA256, judgementSide(side), renderJudgementInput(pairs)** Pure; never throw.
- **R1** `CONTRADICTION_LABELS` is exactly `world`, `record`, `precision`, `unrelated`, `undetermined`, in that order.
- **R2** `sha256(JUDGEMENT_PROMPT)` equals `JUDGEMENT_PROMPT_SHA256`, the digest measured on the over-strictness gate (M-162). The prompt changes only with a new measurement that moves the digest in the same change.
- **R3** `judgementSide` keeps only `text`, `doctype`, `date` and `role`, and omits a field that is null or absent; it never fills one.
- **R4** `renderJudgementInput` is the prompt, then `PAIRS:`, then each pair numbered from 1 with its key, its context when it has one, and sides A and B through R3. A non-array renders no pairs.

**pairs({key, limit, viewer}) → answer or refusal** (`op=contradictionpairs`) A read; writes nothing.
- **R5** `key` is trimmed and upper-cased; absent or blank runs every key (five, and `K6` since T33). Any other key is `CONTRADICTION_KEY_UNKNOWN` (C-60.1) naming the keys held.
- **R6** `limit` is clamped to [1, 50] (a non-number or less than 1 is 50) and never refused; the answer carries `limit`, `bound: 50`, `bounded: true`.
- **R7** Each key is run once. Per key: `ran`, `formed`, `limit`, `truncated` (observed by reading one past the bound, never inferred), `levels` (its ladder), `notes`, `absence`, and for K3 `arms: {passage, document}` each with its own `formed` and `truncated`. A key a request did not name answers `ran: false` with absence level `not_run`.
- **R8** The joins are the key definitions above, each pair carrying its key, counted once (never once from each side). K1 and K4 sides resolve their content row's `capture_sha`, `ref`, `extent_kind` and `stale` (null when the row is not held). K5's sides are read through `basis-versions`' `conclusionOf` for each project that draws on the inquiry (its R37). `K6`'s sides are the two money facts as `money` holds them, each with its source extent's capture and reference; a pair is formed only when both facts and their sources are visible to the viewer (R10), and `money.reconcile`'s differing dimensions are carried as context facts (R28), so a member can see whether a basis, period or rounding difference explains it.
- **R9** K4 reads a document's doctype as its reader states it (the reading's `content_type`) and its date as the document's own date that `events` holds for its capture (its dated facts; the one the reading states when exactly one is held), never from capture or registration time. Two dates are compared through `civil-time.compare` at their precision, never as raw strings: a band, a coarser precision or equal values that do not settle the order leave the dates undetermined as discriminators. A pair that needs an unstated or unsettled value is not formed: it is counted in `undetermined`, split in `undetermined_detail` as `never_read`, `no_doctype`, `no_date` and `order_undetermined`, and stated in a note; a pair whose stated doctype and date both agree is counted in `indistinct`. `candidatesFor`'s `{entity}` order (R25) reads the same own dates the same way, an undetermined order listed apart with the undated ones, never placed by guess.
- **R10** Every side's bundle is one the viewer may see; for K5, both projects are ones the viewer may see (`membership` R44 at `FULL`). An absent or unrecognised viewer compares nothing: `viewer_scope: "DENY"`, every run key's absence level `viewer`, and `says` states an outage, not a statement about the record. A reveal (R52) never widens this rule: a side a viewer may not see stays unseen by them after it.
- **R11** A key that formed nothing names the first empty rung of its ladder (K1: viewer, inquiry, leg, role, referent; K2: viewer, inquiry, subject, reading, claim; K3: viewer, inquiry, reading, claim, referent; K4: viewer, content, cited, resolution, shared entity; K5: viewer, inquiry, drawing projects, concluded stances, differing claim; K6: viewer, money fact, same parties, same stage and period, differing amount), each rung an existence probe under the same viewer gate; with every rung present, its own last level (`shared_side`, `shared_subject`, `shared_referent`, `discriminator`, `shared_question`, `shared_transfer`). Each level's sentence comes from one table. No key answers a bare zero.
- **R12** The answer states `wrote: false`, `pairs_formed`, the flat `pairs`, `judgement: {state: "HELD_APART", read: "candidatesFor"}` and a `says` sentence: the pairing answers pairs, and a run's judgements over them are read through R25. It publishes no label vocabulary.

**propose({run, proposals, proposedBy, viewer, caller, at}) → answer or refusal** (`op=contradictionpropose`) A run's judgement enters as candidates.
- **R13** Refusals in order, each asked of the whole batch before anything is written: `CANDIDATE_NO_PROPOSER` (C-93.1, an empty stamp); `CANDIDATE_NO_RUN` (C-93.2: no run named, or one absent or not visible, the same answer); a caller who is not the run's principal, relayed as `AI_RUN_NOT_PRINCIPAL` (C-22.12); `CANDIDATE_RUN_NOT_RUNNING` (C-93.3); `CANDIDATE_NO_PROPOSALS` (C-93.4); a label outside R1, `CANDIDATE_LABEL_UNKNOWN` (C-93.5, with `index` and `labels`); a blank reason, `CANDIDATE_NO_REASON` (C-93.6); a proposal naming a pair that R5–R11 do not form for this viewer now, by key and both sides at their versions, `CANDIDATE_PAIR_NOT_FORMED` (C-93.7, with `index` and `cut_keys`, the keys cut at their bound).
- **R14** A side's referent at a version: a claim is `inquiry|version`, versioned by the SHA-256 of the claim text compared; a leg or extent is its content id (or its capture where none is named), versioned by the capture; a stance is `inquiry|project|version`, versioned by the SHA-256 of the adopted claim. A claim changed since pairing is a different referent, so its proposal is refused by R13.
- **R15** A candidate's id is the SHA-256 of `{v: 1, key, sides}` with the sides ordered; the row carries the key, both sides with their bundles, the run, `proposed_by`, the label, the reason (trimmed, at most 2,000 characters), `state: "proposed"`, `origin: "machine"` and `at`. A proposal over a candidate already held writes nothing and leaves the row as it was. (K4323) `origin` is `member` for a flag (R61), whose `run` is empty.
- **R16** The answer is `{ok, run, proposed, written, unchanged, candidates}`, each candidate with `new` and its stored row, and `says` that each is proposed machine work and no finding.

#### What is shown, and at what weight (N345)

- **R24** A candidate's **weight** comes from its label (R1) and its key, and is never stored:
  - `precision` and `unrelated` are `not_shown`: never shown as a tension, and counted where R25 answers.
  - `world` and `undetermined` are `lead` (DEC-84 item 1: the machine's uncertainty never creates an obligation).
  - `record` on K1–K4 is `duty`.
  - Any shown label on K5 is `plurality` until a `no_difference` act (R34), then `duty`.

  A **duty** is held for the joined participants of every project that draws on either side:
  - For a claim, leg or stance side, the projects drawing on its inquiry (`basis-versions` R37).
  - For an extent side, the projects drawing on each inquiry with a leg on its content row (`inquiry` R40).
  - For K5, the two projects.

  At most 32 projects per inquiry and 32 inquiries per content row, with `truncated` stated. A duty is never muted, dismissed or set aside, and it leaves only by resolution (DEC-84 item 2). *(its K5 arm not yet met: no measured recommender run, K488)*

**candidatesFor({on, label?, weight?, state?, after?, limit?, viewer})** (`op=contradictioncandidates`)
- **R25** (T51 K4264) Once it is `taken_up` or `resolved` by an inquiry's take-up, it also carries `taken_up: {member, at, words}` (the member who took it up, the instant, the question as worded) from its `take_up` act; absent otherwise. (K4323) A candidate a member flagged (R61) carries `flagged_by: {member, at, reason}` and `machine: null`.
  - **`on`.** Exactly one of `{inquiry}`, `{content}`, `{entity}`, `{bundle}`, `{project}` or `{candidate}`. None, or more than one, is `CANDIDATES_NO_SUBJECT` (C-60.2). `{project}` answers the candidates whose duty or lead reaches that project (R24's rule).
  - **Which candidates.** The candidates of weight other than `not_shown` whose both sides the viewer may see (R10), newest first. `{entity}` answers instead in the stated date of the earlier-dated side (R9), with undated candidates last and counted as `undated`, never placed by guess.
  - **Each candidate.** Its key and the sentence saying why its sides were paired (R11's table), both sides verbatim with their source, stated date, doctype and capture, the label and reason labelled machine work, the weight, the state (R26), its resolution and the member who made it, the standing recommendations (R37) labelled machine work, the reach of a duty (R24) and `default_question` (the stated default R35 may take).
  - **Filters and page.** `label`, `weight` and `state` filter. The page is at most 50 (a non-number is 50), with `truncated` observed by reading one past, and `cursor` the last id.
  - **Empty answers.** An empty answer names its level, never a bare empty list: `none_judged` (no visible candidate names it) or `none_shown` (visible candidates held, each `not_shown`, counted per label as `not_shown: {precision, unrelated}`). Whether the pairing forms pairs there is `pairs`' answer (R11). A candidate the viewer may not see is neither a level nor counted.
  - **Between projects** (DEC-85). A conflict between projects (R49) also carries, for each party of which the viewer is a joined participant, that project's `opted_in`, `asked_by_another`, `revealed`, the revealed `parties` and the relayed `responses`, as R50 words them for a notice. A candidate the viewer sees half is never answered here; R50 answers it.

  It writes nothing and never throws.
- **R26** A candidate's **state** is derived at every read and never stored in place (R17):
  - `open` until a member acts.
  - `dismissed` after R31.
  - `explained_not_shown` after a `differs` act without evidence (R32).
  - `resolved`, with its kind, after an evidenced `differs`, a `one_wrong` (kind `corrected`) or an inquiry's conclusion.
  - `taken_up` while its contradiction inquiry (`inquiry` R48) is at any state but `concluded`.

  The kind, when concluded, is the inquiry's `resolution` (`inquiry` R47). A reopened inquiry makes its candidate `taken_up` again. A later act on an `explained_not_shown` candidate moves it on.

**tensionsOn({referents, viewer})** (`op=contradictiontensions`)
- **R27** For each referent at its version (R14), this answers its marks from every candidate the viewer may see on it:
  - `in_tension`: a duty that is `open` or `taken_up`.
  - `softened`: `explained_not_shown`, with the explanation, the member and the coordinates, each qualifier marked hypothesis.
  - `stale`: this side named wrong by a CORRECTED resolution, with the reason, the member and the instant (for a resolution concluded by a contradiction inquiry, R36's concluding member and the conclusion's instant), and the act or inquiry.
  - `qualified`: resolved `dissolved`, with the coordinates, the qualifier and the explanation, marked evidenced.
  - `held_irreconcilable`: resolved `irreconcilable`, with the inquiry.
  - `lead`: an open lead.
  - `plurality`: an open K5 candidate before `no_difference`.
  - `unseen_conflict` (DEC-85): a conflict between projects that the viewer sees half, on the side they may see, when they are a joined participant of a party reached through that side (R49). It carries the candidate, the weight and that project, and nothing of the other side.

  Each mark carries its candidate. A stale side still resolves, and says it was corrected. Every surface that shows a side reads this, so no surface holds a copy of the rule. More than 200 referents is `TENSIONS_TOO_MANY` (C-60.3). Each referent's marks are read from at most 200 candidates (`TENSIONS_CANDIDATES_MAX`); past it the referent carries `truncated: true` (K544). It writes nothing and never throws. *(its K5 arm not yet met: no measured recommender run, K488)*

**contextFacts({candidate, viewer})** (`op=contradictionfacts`)
- **R28** This answers the facts the record holds that bear on each coordinate, each `{coordinate, a, b, source}`, computed from what the sides already carry: the stated date and doctype (R9), each capture, each side's resolved entities (`entities` R14) and, for K5, each project. Each fact is labelled the record's, never machine work. A fact not stated is `undetermined`, with why, never guessed. An absent or invisible candidate is `NO_SUCH_CANDIDATE` (C-93.9). It writes nothing. Each side's resolved entities are at most 500 (`FACTS_ENTITIES_MAX`); past it that fact carries `truncated: true` (K544).

**unresolvedRecordOn({finding, sha})** (in-process; read as the plane)
- **R29** This answers the candidates that a case pinning `finding` at `sha` must disclose:
  - **Which candidates.** Each candidate of weight `duty` whose state is `open`, `explained_not_shown` or `taken_up`, or which is resolved `irreconcilable` (DEC-84 item 11), with a side whose referent is held one level deep (DEC-84 item 12):
    - an accepted, unhidden, claimed version of the finding at those bytes;
    - the content row of each document leg of its basis there;
    - for each inquiry leg, an accepted, unhidden, claimed version of that inquiry.
  - **Each candidate.** Both sides, its state, its explanation if any, its inquiry if any, and `depth: 1`. The answer states that deeper findings disclose their own when published.
  - **Sides the caller cannot see** (DEC-85). Every candidate is answered, because a publisher must see every tension on what they publish. A candidate with a side in a bundle the stated `viewer` may not see (when one is passed; R10, which a reveal never widens) answers `unseen_other_side: true` with its seen side only. Nothing of the other side is answered: no id, text, kind, bundle, source, project or members. Its explanation and its inquiry are withheld too, since either may quote that side. `case-authoring` highlights it (`case-disclosures` R1, R17; `case-authoring` R33).
  - **Bound and failure.** At most 200 candidates per finding, with `truncated`. A read that fails answers `undetermined: true`. It writes nothing and never throws.

#### The member's acts

- **R30**
  - **Refusals common to R31–R36**, first and in order:
    - an empty or machine `author` is `MACHINE_CANNOT_ACT_ON_CANDIDATE` (C-93.10);
    - no candidate named is `NO_CANDIDATE` (C-93.8);
    - one absent, one whose side the viewer may not see, or one `not_shown` is `NO_SUCH_CANDIDATE` (C-93.9), all three the same answer;
    - any free text over its cap is `WORDS_MALFORMED` (C-93.33), naming the field. The caps are: explanation 1,000; reason 500; words 500; each qualifier 200; question 500.
  - **Who may act.** Any member who may see both sides may act. No project position is asked, because a RECORD tension is in the group's shared holding (DEC-84 item 4).
  - **The acceptance basis.** Every act that records a coordinate or a kind (R32, R36) records its **acceptance basis**, per coordinate recorded:
    - `accepted`, naming the recommendation (R37) it accepts, when the act names one;
    - else `unaided`.

    The act also records the recommendations standing at its instant. An acceptance naming a recommendation that is not standing for this candidate is `ACCEPTANCE_NOT_STANDING` (C-93.25). One whose coordinate is not among those the act records is `ACCEPTANCE_VALUE_DIFFERS` (C-93.26).
  - **The machine's reason.** The machine's reason stays labelled the machine's, and is never written as the member's (DEC-84 item 14).
  - **The row.** Each act appends one row: the candidate, the act, the author, the instant, the coordinates, the explanation, the evidence named, the wrong side and its reason, the qualifiers and the acceptance basis. The row never changes a side.

**dismiss({candidate, reason, words?, viewer, author})** (`op=contradictiondismiss`)
- **R31** After R30:
  - a candidate already `dismissed` or `resolved` is `CANDIDATE_CLOSED` (C-93.11), and one `taken_up` is `CANDIDATE_TAKEN_UP` (C-93.12), naming its inquiry;
  - a `duty` or a `plurality` is `RECORD_CANNOT_BE_DISMISSED` (C-93.13), whose answer says it closes only by a resolution;
  - a `reason` that is not one of `same_fact_different_precision`, `not_same_matter` or `real_conflict_not_pursued` (DEC-84 item 17) is `DISMISSAL_REASON_UNKNOWN` (C-93.14).

  Otherwise the lead is `dismissed`, with the reason and any words.

**clarify({candidate, choice, coordinates?, explanation?, evidence?, qualifiers?, wrongSide?, reason?, accepted?, viewer, author})** (`op=contradictionclarify`)
- **R32** After R30 and R31's closed-state refusals:
  - **Refusals.**
    - A `lead` is `CLARIFY_NOT_A_TENSION` (C-93.15); a lead is dismissed or taken up.
    - A `choice` other than `differs`, `one_wrong` or `no_difference` is `CLARIFY_CHOICE_UNKNOWN` (C-93.16).
    - For `differs`, no coordinate, or one outside the key's vocabulary, is `CLARIFY_COORDINATE_UNKNOWN` (C-93.17). The vocabulary is `CONTRADICTION_COORDINATES` for K1–K4 and `PLURALITY_DIFFERENCES` for K5 (`inquiry` R46).
    - No explanation is `CLARIFY_NO_EXPLANATION` (C-93.18), unless every coordinate recorded is `accepted` (DEC-84 item 14). The record then states that no words of the member's own were given.
    - An evidence item (`{content}`, `{inquiry, ord}` or `{fact: coordinate}`) that the viewer may not see, or a fact R28 answers `undetermined`, is `EVIDENCE_NOT_SEEN` (C-93.19).
  - **What `differs` does.**
    - With at least one evidence item, the candidate is `resolved`, kind `dissolved`, and each side's qualifier is marked evidenced.
    - With none, it is `explained_not_shown`: each qualifier is marked hypothesis, the mark softens and does not clear, and a duty stays (DEC-76 item 1).
    - On K4, `subject` also reports a defect on each resolution that paired the two sides, through `entities.reportResolutionDefect` (its R38), with the explanation as its reason and the candidate as its source.
    - On K5, an evidenced `differs` is recorded on both projects' stances as the named difference (DEC-84 item 3). *(its K5 arm not yet met: no measured recommender run, K488)*
- **R33** `one_wrong`:
  - `wrongSide` must be `a` or `b`, else `WRONG_SIDE_UNNAMED` (C-93.20).
  - `reason` must not be blank, else `WRONG_SIDE_NO_REASON` (C-93.21).
  - On K5 it is `PLURALITY_HAS_NO_WRONG_SIDE` (C-93.22): neither project is made to adopt the other's answer.

  Otherwise the candidate is `resolved`, kind `corrected` (no category is asked; DEC-84 item 16), and the named side is marked stale with the reason, the member and the instant. The side is never deleted, and nothing resting on it moves (DEC-84 item 7). *(its K5 arm not yet met: no measured recommender run, K488)*
- **R34** `no_difference` applies to K5 only; on any other key it is `CLARIFY_CHOICE_UNKNOWN`. It records that the member found no named difference, and the candidate's weight becomes `duty` for both projects (R24; DEC-84 item 3). *(not yet met: N345)*

**takeUp({candidate, question, frame, viewer, author})** (`op=contradictiontakeup`)
- **R35** After R30 and R31's closed-state refusals:
  - a candidate already `taken_up` answers its inquiry with `existed: true` and writes nothing;
  - no question is `TAKE_UP_NO_QUESTION` (C-93.23). The plane fills in none: R25's `default_question` is shown, and the surface sends what the member accepts;
  - a `frame` other than `a` or `b` (the side the question is framed around) is `TAKE_UP_NO_FRAME` (C-93.24).

  **What it writes.** Otherwise, in one act, through `promotion.promote`: a new inquiry, `open`, `surfaced_by: human`, titled from the question (`record-grammar` R30), carrying `contradiction: {candidate}` (`inquiry` R47) and both sides as legs, with no grade:
  - the framed side as `supports` and the other as `cuts_against` (K447 (8));
  - a claim or stance side as an inquiry leg on its inquiry;
  - a leg or extent side as a leg on its information bundle, naming its content row;
  - each leg's note naming its side of the candidate.

  A promotion refusal is relayed whole, and nothing is written. The candidate reads `taken_up` (R26).

**resolve({inquiry, resolution, conclusion, version, falsifier | noFalsifier, accepted?, viewer, author})** (`op=contradictionresolve`)
- **R36** After R30's first refusal: (T51 K4264) With no `version`, the conclusion is the member's own reading, passed to `conclude` as `reading` (`basis-versions` R51), so a freshly taken-up question is concluded in one act; `conclude`'s `BAD_READING` (12 to 500 characters) reaches the member. With a `version`, the named accepted version's claim is adopted as before.
  - an inquiry that is absent, invisible or not a contradiction inquiry is `NOT_A_CONTRADICTION_INQUIRY` (C-93.27), the same answer for each;
  - on K5, a CORRECTED kind or `double_speak_or_reversal` is `PLURALITY_HAS_NO_WRONG_SIDE` (C-93.22);
  - R30's acceptance checks follow.

  **What it writes.** Otherwise it writes `resolution` into the inquiry's document (`inquiry` R46's `resolutionLines`, judged by its R47) and concludes the question through `basis-versions`' `conclude` without a project (its R16–R19). This is the question's own conclusion, never a project's stance (DEC-84 item 4). Both land together or neither does. Every refusal of either is relayed whole.

  **What follows from each kind.**
  - A CORRECTED kind marks its `wrong_side` stale, as R33 does.
  - `dissolved` qualifies both sides, as an evidenced `differs` does.
  - `double_speak_or_reversal` is the inquiry concluded as a finding: nothing further.
  - `obligation_against_act` records no outcome. `conformance` reads it (its R21).
  - `irreconcilable` keeps both sides, and no choice is made.

  A conclusion reached by `basis-versions`' own door carries its resolution the same way, since the state is read from the document (R26), and records no acceptance basis.

**candidateSidesSeen({inquiry, viewer}) → boolean** (in-process; read as the viewer, for `affordances` R14; N365)
- **R56** It answers `true` exactly when R36's `NOT_A_CONTRADICTION_INQUIRY` check (C-93.27) passes for this viewer: the inquiry is one the viewer may see, it is a contradiction inquiry (`inquiry` R48's `contradictionLink` names a candidate), this module holds that candidate, and the viewer may see both of its sides (R10: every bundle each side lives in). It answers `false` otherwise, an absent viewer included. It is the one predicate R36 applies, so the offer and the act cannot disagree. It writes nothing and never throws.
- **R57** (the over-strictness gate; CONTRADICTION-IDENTIFY-DESIGN §7, M-118, M-162; N394, K595) The judgement recorded under `JUDGEMENT_PROMPT_SHA256` passes the gate over the gate's labelled corpus (synthetic pairs over K1–K4, each shape §7 requires at least once, at least 6 per key, each key with a negative and a conflict): every corpus pair is formed by its own key through R5–R11, nothing the corpus does not label is formed, and no key is cut at its bound; R4's input carries every formed pair and no label or fixture id; every formed pair is answered with an R1 label; no `precision` or `unrelated` pair is labelled `world` or `record` (a false-conflict rate of 0, M-118's threshold, per key and over all); recall is stated beside the rate, never as the gate, and each recorded run's beats the lexical baseline's. The gate fails by name an empty record (each key's R11 level carried instead), an always-`world` judgement and a silent one, and passes a judgement that gives every pair its gold label. A recording answers only the prompt it was made under: a moved digest (R2) leaves pairs unanswered and the gate fails. *(its K5 arm, a live run, not yet met: K488)*

#### The recommendation (the machine's one act)

**recommend({run, candidate, coordinates: [{coordinate, reason}], proposedBy, viewer, caller})** (`op=contradictionrecommend`)
- **R37** (DEC-77 item 3(b), DEC-84 item 5).
  - **Refusals.** R13's first four, in its order and with its codes (C-93.1, C-93.2, C-22.12, C-93.3, through R21's gate). Then:
    - no coordinates is `RECOMMEND_NO_COORDINATES` (C-93.28);
    - a coordinate outside the key's clarifier vocabulary (R32) is `RECOMMEND_COORDINATE_UNKNOWN` (C-93.29);
    - a blank reason is `RECOMMEND_NO_REASON` (C-93.30);
    - a candidate not shown to this viewer, or not `open` or `explained_not_shown`, is `RECOMMEND_CANDIDATE_NOT_STANDING` (C-93.31).
  - **What it writes.** Otherwise one recommendation per coordinate, each with an id, the run, `proposed_by`, the reason (at most 2,000 characters) and `origin: "machine"`, through one append site. The same run, candidate and coordinate again writes nothing.
  - **What a recommendation is.** It names only a respect in which the sides may differ, never which side is wrong and never a GENUINE kind. It is **standing** while its candidate is `open` or `explained_not_shown`.
  - **The answer** says each recommendation is machine work and not a member's choice.

**The promotion check** (registered with `promotion`, its R39)
- **R38** (enforces `inquiry` R47's link at the record's one door). A non-replay promotion of a document whose `contradiction.candidate` names a candidate this module does not hold, or one whose side the author may not see, is refused `CANDIDATE_NOT_HELD` (C-93.32).

#### The measures

- **R39** (DEC-77 item 3; K447 (15)). `acceptanceRates({coordinate?, since?})` answers, per coordinate:
  - `offered`: acts at whose instant a recommendation of it was standing;
  - `accepted`: acts that named it;
  - `chosen_unaided`: acts that recorded it without naming it;
  - `chose_otherwise`: acts that did not record it.

  All are counts, never a bare percentage. `review_due` is true when `accepted / offered` ≥ 0.95 over at least 30 offered. The threshold is stated `PROVISIONAL`, as IDENTIFY's was. It carries no id, and never throws.
- **R40** (DEC-76 item 3, DEC-84 item 17). `dismissalMeasure({since?})` answers dismissed leads counted by reason, by key and by label, and `false_conflicts`: the count of `same_fact_different_precision` and `not_same_matter`. `real_conflict_not_pursued` is never counted as one. It carries no id, and never throws.
- **R41** (K447 (6)). `sha256(RECOMMEND_PROMPT)` equals `RECOMMEND_PROMPT_SHA256`: the digest under which the blind fixture of dissolved pairs was measured and recorded in `MEASUREMENTS.md`. The prompt changes only with a new measurement that moves the digest in the same change. *(not yet met: N345)*

#### A conflict with a side the member cannot see (DEC-85, as Bob clarified it in K456)

- **R49** **Parties and the half-seen conflict.**
  - A candidate's **parties** are the projects R24's reach names through each of its sides: the projects drawing on that side, at most 32 per side, with `parties_truncated` stated. A project reached through both sides is a party through both.
  - A **conflict between projects** is a candidate of weight `duty` or `plurality` whose state is `open`, `explained_not_shown` or `taken_up`. A lead is not one: the machine's uncertainty creates no obligation (DEC-84 item 1), and telling of it would say that an unseen record exists on a machine's guess.
  - A viewer **sees it half** when they may see exactly one of its sides (R10).

  It is derived at every read, never stored.

**conflictNotices({project, after?, limit?, viewer})** (`op=contradictionnotices`)
- **R50** The notice to a project's members, on their own side.
  - **The viewer's member** (T51; K4233): R50 and R25 read the viewer's member through `member-roster` R73 (`viewerMember`), so the founder's bare `admin` is the member `admin`: joined to a project she is answered its notices and marks; invited only she is refused `NOT_A_PARTICIPANT`; an ordinary member and a machine credential are answered as before. Test: `projects.test.mjs` (R50, R25, K4233), with the controls.
  - **Refusals, in order:** `membership`'s existence answer (its R77); `NO_SUCH_PROJECT` through its R78; a viewer who is not a joined participant (joined or leaving, its R54), through its `notAParticipant` (R87, C-56.3).
  - **Which conflicts.** Each conflict between projects of which `project` is a party, that the viewer sees half, where the side they may see is one through which `project` is a party.
  - **Each notice** carries:
    - the candidate's id, `project`, the weight and the state (without the explanation or the inquiry);
    - that one side verbatim, with its source, stated date, doctype and capture;
    - one fixed sentence: "Something this project rests on is in conflict with a record you cannot see. Neither that record nor who holds it is shown. Your project can ask to resolve it. If every project holding a side asks, the projects are named to each other's members, and you can respond.";
    - `opted_in`: this project's opt-in (R51: the member, the instant, the words), or null;
    - `asked_by_another`: true when another party has opted in. It never says which, or how many;
    - `revealed` (R52), and once revealed `parties`: the opted-in projects' ids and names;
    - `responses`, the relay (R54).
  - **Withheld, always:** the other side, its kind, bundle, source, project and members; the key and its pairing sentence; the label's reason (the machine's words describe both sides); and the number of parties. Before R52, no other party is named.
  - **Page.** At most 50 in candidate id order after `after` (a non-number is 50), with `truncated` observed by reading one past, and `cursor` the last id. A conflict the viewer sees whole is not a notice: R25 answers it.
  - **A non-hidden party named** (T41, D64; amended). When another party of a conflict between projects is a non-hidden project the viewer may see by name (`membership` R44), the notice names it (`{id, name}`) from the start, with the fixed sentence "Your project's conclusion conflicts with that project's"; its side, members and contents stay withheld (sight is unchanged). A hidden party is never named or counted, and with one the notice says only that something the project rests on conflicts, as today. Read (CONTRADICTION #9 J2, K2479): "another party" is a party reached through the side the viewer does not see (R49), other than `project`; it is named when `membership.visibilityOf` answers `discoverable` (R85) and the viewer's `sight` of it is not `NONE` (R44); the notice carries `named: [{id, name}]` (id order) and, when non-empty, `NOTICE_NAMED_SENTENCE` ("Your project's conclusion conflicts with that project's.") in place of the fixed sentence; with none named it is today's notice, byte for byte, with `named: []`, whether or not a hidden party also exists.

  It writes nothing and never throws.

**optIn({candidate, project, words?, viewer, author})** (`op=contradictionoptin`)
- **R51** A project says it would like to resolve the conflict.
  - **Refusals, in order:**
    - an empty or machine `author` is `MACHINE_CANNOT_ACT_ON_CANDIDATE` (C-93.10);
    - no candidate is `NO_CANDIDATE` (C-93.8);
    - `project`: R50's three refusals, in its order;
    - a candidate that is absent, or of which the viewer may see neither side, is `NO_SUCH_CANDIDATE` (C-93.9), the same answer;
    - a `project` that is not a party through a side the viewer may see is `NOT_A_PARTY` (C-93.34);
    - a candidate that is not a conflict between projects (a lead, or `not_shown`) is `NOT_A_PROJECT_CONFLICT` (C-93.35);
    - one `dismissed` or `resolved` is `CANDIDATE_CLOSED` (C-93.11);
    - `words` over 500 characters is `WORDS_MALFORMED` (C-93.33).
  - **What it writes.** Otherwise one row: the candidate, the project, the author, the instant and the words. It is the project's act, taken by any of its joined participants. A project already opted in answers `already: true` with the first opt-in, and writes nothing.
  - **Never withdrawn.** Once the other parties have been told, they cannot be untold.
  - **What the other parties learn** before R52 is only `asked_by_another` (R50). This project is never named to them.
- **R52** **The reveal.**
  - **When.** The opt-in that leaves every party of the candidate opted in, with neither side's parties truncated, appends in the same act one `revealed` row naming the parties at that instant.
  - **What it reveals.** From then on the opted-in projects are revealed to each other. Each joined participant of one sees the others' ids and names on this conflict's notice (R50) and in R25, and receives their responses (R54). Nothing else of them is revealed: not their members, their sides, or anything inside them. `membership` R44 is not widened.
  - **Later parties.** A party that arrives after the reveal gets a notice. It joins the revealed set when it opts in.
  - **Truncated parties.** With either side's parties truncated, the reveal is undetermined, and the notice says so. No reveal is recorded until the parties are read whole.
  - **What it never widens:** what a candidate shows (R10), who may act on it (R30), and what a published case names (`case-authoring` R33).

**respond({candidate, project, text, disclose?, viewer, author})** (`op=contradictionrespond`)
- **R53** A member responds to the notice, sharing only what they choose.
  - **Refusals, in order:**
    - R51's first seven, in its order (through C-93.11);
    - a `project` that has not opted in is `RESPONSE_BEFORE_OPT_IN` (C-93.36);
    - a blank `text` is `RESPONSE_NO_TEXT` (C-93.37);
    - a `text` over 2,000 characters is `WORDS_MALFORMED` (C-93.33);
    - a malformed `disclose` is `DISCLOSURE_MALFORMED` (C-93.38): a key other than `cover` and `email`; a `cover` that is neither `true` nor a string; an `email` that is not one address of at most 254 characters;
    - a disclosure of someone else's is `DISCLOSURE_NOT_YOURS` (C-93.39): a `cover` string other than the author's own cover (`membership` R68), or an `email` another member has already disclosed as theirs in a response.
  - **What it writes.** Otherwise one row: the candidate, the project, the author, the instant, the text, and each disclosure chosen:
    - `cover`: the author's own, as `membership` holds it. `cover: true` fills it from R68. The plane never takes a cover it did not read for this author.
    - `email`: as the member stated it, marked `stated, not verified`, since `membership` holds no email address.

    Neither is required, and none is ever filled in.
  - **Never relayed:** the responder's handle and member id, and anything they did not choose.

**conflictResponses({candidate, project, after?, limit?, viewer})** (`op=contradictionresponses`)
- **R54** **The relay, and the read.**
  - **The relay.** Once revealed (R52), each response is relayed to the joined participants of every other opted-in party, as its text, the disclosures its responder chose, the responder's project (revealed) and its instant. Nothing else is relayed. A response made before the reveal is relayed from the reveal. Nothing is relayed before it.
  - **In the notice.** R50's `responses` for `project` are the relayed responses of other parties made after this project's own latest response (every one since the reveal when it has none), at most 20, newest first, with `responses_truncated`. `queue` carries them as the next notification the project's members receive (its R47).
  - **The read.** Refusals: R50's three for the project; `NO_CANDIDATE` (C-93.8); `NO_SUCH_CANDIDATE` (C-93.9) for a candidate absent, one of which the viewer may see neither side, or one of which `project` is not a party. Otherwise it answers this project's own responses, each with its author as attributed, and, once revealed, the other parties' as relayed, in the order written, at most 50 a page after `after`, with `truncated` observed by reading one past and `cursor`.

  It writes nothing and never throws.

**The connection owner** (T33-48; `connection-grammar` R2, R6–R9; scope §1 CONNECTIONS: `registerConnectionOwner` for contradiction; K1487)
- **R58** The module registers once at load through `connection-grammar.registerOwner`, owner `contradiction`, one kind "in tension with" (class `derived`, the members' word, K1486). Its `neighbours({node, kinds, at, page, viewer, scope})`, for a node that is a side's bundle (an inquiry, a document) or a money fact, answers each candidate of weight other than `not_shown` and state other than `dismissed` (R24, R26) on that node whose both sides the viewer may see (R10), in `connection-grammar`'s shape: `from` and `to` the two sides' nodes, `derived: {method, inputs}` the key and the run's judgement, `id` its candidate id (R15), labelled machine work, `grade.assertion` the lowest grade (a candidate is a proposal, never evidence). A candidate is never a basis: a chain through it is a lead (`connection-grammar` R13). Its owner-conformance battery runs in this module's tests. (K4323) For a flagged candidate `machine_work` is false and `judgement.origin` is `member`.
- **R61** (T51 fix round 2; UC-155; DEC-394 (3e); K4311; K4323) **A member flags two documents as contradicting.** `contradictionflag({here, other, reason, viewer, author})`, each passage `{capture, extent}`, found as the content row held for that capture and canonical extent in a bundle the viewer may see, records one candidate under key `FLAG`, label `world` (a lead, R24), `origin: member`, `proposed_by` the member, as R15's row; answers `{ok, wrote, candidate, key, weight, state, flagged_by}`. Refusals, in order: R30's machine-author refusal; `FLAG_NO_PASSAGE` (C-93.40); `FLAG_SAME_DOCUMENT` (C-93.41); `FLAG_NO_REASON` (C-93.42); `WORDS_MALFORMED` (a reason over 500). A candidate of any key already held and shown over the same two passages is answered with `already: true` and its state, and nothing is written. Declared (R60's row, with `needs: contribute`, stamps `author` and `viewer`, no machine class). The contradiction screen settles it as any candidate. (K5148; WALK-FINAL-05 R38) A passage of a reading the viewer may see that no content row yet holds is made citable by the flagging member (`content`'s mint, minted by that member) before the candidate is written; a passage not in the reading, not seen, or of an unread capture stays `FLAG_NO_PASSAGE`, nothing written.
- **R62** (T51 fix round 10, live walk C/E; K5271) Taking up a candidate writes the same title into the inquiry's envelope and its document (the document's safe form), so promotion's title comparison holds for any question, quotes included (walk C C-M13).

## Private

### Uses

- `setup-words`: `word`, `localize` (the words rule, K3930; K4018).
- `promotion` (N345): `promote` (R35, R36) and `registerStep` (R38).
- `record-grammar`: the shared grammar names this module once read from the check catalogue (frontmatter, types, ids, actors, labels, grades, `SHARED_ACT_CHECKS`), re-pointed in T19 (rule 1); the catalogue rows it owned are in its own code (K808, K820).
- `record-core`: `recordOf(ctx)`, `transact`, `declarePurge`; `bundles` by its read contract (R37 there), including the inquiry's subject entity column, and its `title`, for a revealed party's name (R52).
- `membership`: `membershipOf(ctx)`, `viewerPredicate` and the bundle gate (R10); `sight` (K5), `visibilityOf` (R85; R50, K2485), `isJoinedParticipant` and `projectOwners` (R24's reach); the existence answer (R77), `noSuchProject` (R78), `notAParticipant` (R87) and `memberFacts` (R68, the responder's own cover) for R50–R54. *(not declared)*
- `content`: `contentRow` and the rows of a capture (R8, R14), by service or a stated read contract on `content`.
- `events`: a capture's own dates (R9). `civil-time`: `compare` (R9). `money`: the facts and `reconcile` (K6; R8). `connection-grammar`: `registerOwner`, the `neighbours` contract, `ownerConformance` (R58). (T33-48)
- `extraction`: `readingOf` for a capture's doctype and date (R9). *(not declared)*
- `entities`: `resolutions` by its stated read contract (entities' Suggestion); `reportResolutionDefect` (its R38). *(not declared)*
- `inquiry`, `basis-versions`: the legs, versions and version legs K1–K3 join. `inquiry`: R46–R48. `basis-versions`: `conclude` (R36), `conclusionOf` (K5), `projectsDrawingOn` (R24), and the version legs (R29). *(`basis-versions` not declared)*

### Invariants

- **R17** Append-only: nothing updates or deletes a candidate but its bundles' purge (either side's bundle takes it).
- **R18** The pairing is deterministic: the same record and viewer give the same pairs; keys are added, never widened.
- **R19** No act here edits, grades or deletes a side, and no act but a member's (R31–R36) says what a candidate turned out to be. A candidate is shown to a member only by R25–R29, only to a viewer who may see both of its sides now (R10), and only at a weight R24 gives it. A conflict between projects that a viewer sees half is told to them only by R50's notice and R27's `unseen_conflict` mark, on their own side, and only when they are a joined participant of a party reached through that side (R49–R55; DEC-85).
- **R20** Each check moves here as an invariant with its test (K6): C-60.1, C-93.1–C-93.7; and C-60.2, C-60.3 and C-93.8–C-93.42 (N345; translations below).
- **R21** Whether a run is visible, running and the caller's is asked of a run gate `ai-runs` registers here as `registerRunGate(module, gate)`, `gate(run, viewer, caller) → {found, running, refusal}` (`found` false for blank, absent or invisible alike; `refusal` null or `run-rules` R5's `AI_RUN_NOT_PRINCIPAL`) (K31, K182); with none registered, R13's run checks refuse as C-93.2.
- **R22** `contradiction_candidates` is declared to record-core's purge by `a_bundle_id` and `b_bundle_id` (K23).
- **R23** No place is named in this module's behaviour or outward text.
- **R42** `contradiction_acts`, `contradiction_recommendations`, `contradiction_optins` (with the `revealed` rows, held in `contradiction_optins`) and `contradiction_responses` are append-only. A candidate's state, weight and marks are derived at the read from the candidate, those rows and the inquiry's document (R24, R26, R27). Nothing is copied that could disagree.
- **R43** A `duty` is never dismissed, muted or set aside, and leaves only by resolution. A `lead` never becomes a duty unless a member acts: taking it up, which leaves it a lead's inquiry, or a K5 `no_difference`.
- **R44** Nothing is silently preselected (DEC-77 item 3(c)):
  - every act names every value it records;
  - the plane fills in none;
  - an acceptance names a standing recommendation equal to what the act records (R30).

  Whether a screen showed a recommendation is the surface's to keep true (Suggestions).
- **R45** `precision` and `unrelated` candidates are never shown as a tension, and are counted wherever R25 answers.
- **R46** (DEC-24, DEC-84 item 5). A machine credential holds no act of R31–R36, and R37 recommends only coordinates.
- **R59** (plan T33, Rules (6)) This module declares its tables explicitly through `record-core.declareTable` (its R21), keeping R22's and R47's purges and R17's append-only rule (`version_chain: true`), each with the sight of the sides' bundles (R10), the opt-ins and responses with their project's; the other classes as `declarePurge`'s default form gives them.
- **R47** `contradiction_acts`, `contradiction_recommendations`, `contradiction_optins` and `contradiction_responses` are declared to record-core's purge by both sides' bundles, as R22 (K23); `contradiction_optins` and `contradiction_responses` also by `project_id`.
- **R48** (DEC-77 item 1). No key pairs an aspiration: aspirations are in contact, never in contradiction.
- **R55** (DEC-85). Nothing answered to a viewer who sees a conflict half names or counts its other side, that side's kind, bundle, source, project or members, or the number of parties. The two exceptions are the opted-in projects after R52 and what a responder chose to disclose (R53). (T41, D64; amended) R50's named non-hidden parties are a third exception. The machine's reason and a member's explanation are never answered to such a viewer.

Rows C-60.2, C-60.3 (`CONTRADICTION_PAIR_CHECKS`) and C-93.8–C-93.42 (`CONTRADICTION_CANDIDATE_CHECKS`) (R20; N345), with their translations; promotion stamps them:

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
| C-93.40 | `FLAG_NO_PASSAGE` | "Setting two documents side by side as a contradiction names a passage in each, as a document and the part of it. One of them is missing, is not held here, or is not one you can see; which of the two is named. Nothing was written." |
| C-93.41 | `FLAG_SAME_DOCUMENT` | "A contradiction is between two documents, and both passages are in the same one. Name a passage in a different document. Nothing was written." |
| C-93.42 | `FLAG_NO_REASON` | "Saying two documents contradict is a kept decision, and a kept decision says why. Give the reason in your own words. Nothing was written." |

### Satisfies

- `docs/development/CONTRADICTION-IDENTIFY-DESIGN.md` §2 (the split), §3, §4 (the keys; undetermined not formed), §5 (the labels; no cause), §6 (viewer, bound, the empty level), §7 (the gate, the pinned prompt), §8 (one append site, versions), §9 items 1 and 3.
- `docs/architecture/BIO_Case_Making_v0_1.md` §CONTRADICTION (IDENTIFY before PRESENT before RESOLVE).
- `docs/architecture/BIO_Assistant_and_AI_Roles_v0_1.md` §2 (CHECK), §3 rules 3, 4 and 10 (DEC-24, DEC-49).
- `docs/architecture/BIO_Membership_Architecture_v2.md` §7 (sight).
- `build/layers.md`, layer 6's contract: the AI checks and never concludes.
- N345: `BIO_Case_Making_v0_1.md` §CONTRADICTION, the two RULED 2026-09-29 subsections (DEC-76, DEC-77); DEC-84 items 1–5, 7, 11, 12, 14, 16 and 17; `CONTRADICTION-PRESENT-RESOLVE-DESIGN.md` §4–§9, §11 and §12; `BIO_Assistant_and_AI_Roles_v0_1.md` §3 (DEC-24: the machine recommends, a member disposes); `BIO_Membership_Architecture_v2.md` §7 (and §3, a cover is disclosed only by its member's choice: R53); DEC-85 and K456 (R49–R55; R19's, R25's, R27's and R29's DEC-85 parts).
- K5's judgement (N345): the judgement over K5 pairs uses R2's pinned prompt unchanged, and R3 renders a stance side as its claim text. A K5 arm (two stances, at least one agreeing pair and one differing wording of one claim) is added to the gate's corpus. It is measured, recorded in `MEASUREMENTS.md` and passing (no false conflict) before any K5 candidate is shown.
- What the judgement sees (K102): no change. The input stays as measured (R3, R4: each side's text, doctype, date and role, and K3's passage; 0/17 false conflicts, 9/9 recall, M-162), and the canon's text changes: CONTRADICTION-IDENTIFY-DESIGN §5 is amended to say so. The inquiry's question is added only with a new measurement on a corpus of real documents, the binding gap §7 names.

### Suggestions

- **Factory.** `contradictionOf(ctx)` answers the one instance per Durable Object storage and reaches `record-core`, `membership`, `content`, `extraction`, `entities`, `inquiry` and `basis-versions` through theirs (K61). The two op handlers move here (K3). `registerRunGate(fn)` is the slot for R21.
- **What stays out.** The gate harness and corpus (`test/contradiction-gate.mjs`, `contradiction-corpus.mjs`, the recorded runs) become this module's tests. Packaging the prompt into the skill pack is `skills`'.
- **T33 (T33-48).** P6: the module is 3,256 lines and takes nothing but K6, R9's dates and R58 (about +200). R58's class `derived` and its lowest grade are this fold's reading (a candidate is the pairing's and a run's derivation, labelled machine work); BOB may prefer `hunch`. K6's weight follows R24's rule for its label as K4's does; its sentence in R11's table is the job's to word.
- **Tests.** Each C-60 and C-93 refusal gets a negative control; R9 and R11 get the empty and undetermined arms §7 names; R15 an over-strictness arm (a re-proposal writes nothing).
- **For callers.** The control plane stamps `proposedBy`, `viewer` and `caller` and deletes any the body carries.
- **For callers (N345).** The control plane stamps `author`, `viewer`, `proposedBy` and `caller`, and routes the thirteen ops (the nine, and R50, R51, R53 and R54's four). A surface that offers "accept" shows the recommendation with its reason before the act, and sends `accepted` only when the member chose it (R44's other half).
- **Atomicity (R36).** Write the resolution through one `promotion.promote`, then `conclude`, inside one outer `record-core.transact`, as `conformance` R6 does. If `conclude` cannot nest, the job reports it.
- **R24's reach for `{project}`.** Use `basis-versions.projectQuestions` (its R41) to list the project's inquiries, then the candidates whose side's inquiry, or content row, is among them.
- **The recommender's prompt** is packaged into the skill pack by `skills`, as the judgement's prompt is.
- **R49's parties** are read with R24's reach, one query per side, so that a notice, an opt-in and the reveal count the same parties.
- **R52 in one act.** The opt-in row and the `revealed` row are written inside one `record-core.transact`, after re-reading the parties there, so that two last opt-ins at once record one reveal.
- **Tests for N345.**
  - **Refusals.** Every refusal has a negative control, in order.
  - **Sight.** A candidate with one side in a hidden project answers every read and act of R25–R36 as absent. `unresolvedRecordOn` answers it `unseen_other_side: true` with the seen side only, and no id, text, kind, source, project, members, explanation or inquiry of the other.
  - **DEC-85: the notice (R50).** A joined participant of the seen side's party gets the notice with that side only; the key, the reason and the party count are absent (R55: the notice's bytes are the same with one hidden party and with three). A participant of no party, a viewer at `EXISTENCE` and an outsider each get R50's refusals. A lead with a hidden side gives no notice. R27 marks the seen side `unseen_conflict` for a party member only.
  - **DEC-85: the opt-in (R51, R52).** Each refusal gets a negative control, in order. A repeat answers `already: true`. After one party opts in, the other's notice reads `asked_by_another: true` and names nobody. The last opt-in records one reveal, and the parties' names appear to each other; two last opt-ins at once record one. A truncated side records no reveal. A party arriving after the reveal is not revealed until it opts in. After the reveal, a member still may not see or act on the other side (R10, R30).
  - **DEC-85: responses (R53, R54).** Each refusal gets a negative control, in order. A response sharing another member's cover, or an email another member already disclosed, is refused C-93.39 and writes nothing. `cover: true` records the author's own cover. A response before the reveal is not relayed, and is relayed once the reveal happens. The relay carries the text, the chosen disclosures, the project and the instant, and never the handle or member id (checked over the notice's bytes). R50's `responses` holds only those after the project's own latest response, at most 20.
  - **Weight.** One case for each label and key (R24). The K5 weight changes after `no_difference`.
  - **State (R26).** Taken through each state by acts alone, including a reopened inquiry returning to `taken_up`.
  - **R27.** Each mark, over a claim, a leg and an extent.
  - **R30.** Accepting a stale recommendation is refused. An accepted act with no explanation records "no words of the member's own".
  - **R36 and the other door.** The same conclusion reached through `op=conclude`, with its resolution, reads the same kind.
  - **Over-strictness.** A repeated `recommend` writes nothing. A takeUp of a taken-up candidate writes nothing.
  - **R39 and R40.** Counts over a scripted sequence.
  - **R41.** The digest.
  - **Jobs.** `test/m/contradiction/`, with the gate harness's K5 arm, the recommender fixture, and a fixture of two projects, each hidden from the other, drawing on the two sides of one duty (DEC-85).

## Open for Bob

None: answered by Bob 2026-09-26 (K102).

- **R60** (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `contradictionresolve`, `contradictiondismiss`, `contradictionclarify`, `contradictiontakeup`, `contradictionoptin`, `contradictionrespond`. Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`). (T51 K4264) `contradictionresolve`'s absent `conclusion` is refused naming it by `BAD_READING`.
- **F1** *(not yet met: BD-14 Q9.5, investigation IV-10)* IV-10 (BD-14 Q9.5): a counter-proposal pass, a second AI act over the same document asking what cuts against the current answer; its finds are proposed separately, labelled 'cuts against'; finding nothing is recorded as a meaning-level look; it never measures a member (DEC-68); a group may switch it off with a reason; cost through ai-use. Design: docs/development/investigation-design-research/claude-ai/bd-14-requirements.md
