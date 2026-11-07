# Funding disclosure: what the product already says and records

Research for the `publication` design lane (BD-13; BD-14 Q9.6). Read-only.

**Commits.** The checkout made by the setup (`git clone /home/user/civicsmith-copy` then `origin/tranche`) is **`e2edad2bac`** (5 Nov, "Merge PR 480"). That is the local `tranche` branch of the source repository. The remote tranche is newer: **`a9d2f5b1a7`** (7 Nov, "Merge PR 764: lane/publication"), and `e2edad2bac` is its ancestor. Unless marked `@a9d2`, a citation is `path:line` at `e2edad2bac`. Between the two commits, none of the requirement text cited here changed in meaning. The ids' line numbers moved slightly at `@a9d2`: case-authoring R76 is at :248, and screens-publish R83 and R94 are at :148 and :159. `bio-plane/src/case-disclosures/index.mjs` and `screens-publish/ceremony.mjs` gained lines, and the Ties step moved to ceremony.mjs:355 `@a9d2`. BD-7 to BD-14, the IFCN research and the lane's open asks exist only at `@a9d2`.

---

## 1. Canon and rulings

### 1.1 Where the hand-off comes from
- **BD-13** (BOB, 7 Nov) draws the border between the investigation and publication lanes. It ends: "Funding disclosure (the investigation lane's Q9 item 6) belongs to the publication lane." (`DECISIONS.md:122` @a9d2; whole record :112–122.)
- **BD-14 Q9.6** (Bob): "An optional reason on a leg, in the member's own words: 'B'. Funding disclosure goes to the publication lane (BD-13)." (`DECISIONS.md:132` @a9d2; consequences :138.)
- **The source of the gap**, in the investigation lane's research (`docs/development/investigation-design-research/best-practice.md` @a9d2):
  - IFCN commitment 3, "ensure that funders have no influence over the conclusions" (:212).
  - "Who paid for the system's finds is shown only to the account owners (INV:111), and shared costs are worked out privately (INV:72) … nothing in INV requires a *published case* to disclose who funded or sponsored the investigation." (:221)
  - The open question: "Should a published case carry a funding/sponsorship statement alongside the bias statement (DEC-103)?" (:224)
  - Its scorecard marks "Funding disclosure (IFCN 3)" as **Lacks** (:401).
- **The lane's own note** (`docs/development/publication-design-research/open-asks.md:17–23` @a9d2): funding disclosure is "Owed; not started". It suggests "a signed `/11` field beside `review`?" and says what is Bob's: "whether disclosure is required, and its threshold". It also says: "Coordinate with the `/11` format so the signed format changes once (BD-7's rule)."
- **BD-6** (Bob): trust and transparency developments are adopted voluntarily, "never a claim of compliance" (`DECISIONS.md` BD-6 @a9d2). Adopting the IFCN commitment would be such a choice.

### 1.2 Canon that bears on funding
| Source | What it says |
| --- | --- |
| Design Requirements v2, DR6 (`docs/architecture/BIO_Design_Requirements_v2.md:138–148`) | Every published work product carries a metadata form that includes "disclosure of any relationships between the producing group or its members and the government entities, officials, contractors, or other stakeholders being analyzed". **Relationships are required; funding is not named.** K1483 amends DR6 (:150ff) on naming people, their ties and their financial interests. |
| DR14 (:392) | "No single person, group, platform, **funding source**, attorney, or institutional relationship is essential to continued operation." This is resilience, not disclosure. |
| Escalation (:236) | "The system minimizes financial barriers to escalation but does not provide or manage funding." |
| Investigation v0.1, INV:72 (`BIO_Investigation_v0_1.md:72`) | When projects share a costed step, the owners are told the total and which projects share it, and "work out among themselves how, and how much, each pays. Civicsmith splits nothing." No notice is sent if any of those projects is hidden. |
| INV:71 (:71) | A step's money cost (a copying fee, a purchase) "is the group's working figure. It is not a money fact (K1463)." AI use is not counted here. |
| INV:111 (:111) | "Which account paid for [the system's finds] is shown only to that account's owners: what a project spends is its own business." |
| INV §9 (:147) | An investigation may concern "a contractor's owner, **a donor**, a landlord…". Donors are subjects of investigation. |
| Declared Bias v0.1, DEC-46 (`BIO_Declared_Bias_v0_1.md:472–500`) | The bias **manifest** is computed and stamped. The bias **acknowledgement** is authored by the publisher at export, fresh for each edition, and refused if absent (`NO_BIAS_ACKNOWLEDGEMENT`), if carried forward (`BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD`) or if written by a machine (`MACHINE_CANNOT_PUBLISH`). It is "a DISCLOSURE, never a bar". |
| DEC-103 (:553–563) | The full lens is printed into the signed case. Each statement carries its justification and evidence, citing only public material and stating how many citations are withheld. The publisher sees exactly what will be printed before signing. Earlier cases keep only the fingerprint. DEC-117 (:560–563) fixes two verbatim closing sentences. |
| The two-audience choice (:594–600) | Opponents will quote the published lens, and that trade is accepted deliberately. The same reasoning would apply to a published funder statement. |
| Publication v0.1 §3 rule 4 (`BIO_Publication_v0_1.md:104`) | "Bias is public; hunches are cleared first" (DEC-20). |
| §3 rule 11 (:113–114) | The exclusion statement's second-person check is "DISCLOSED, never enforced". A gate that pushes a member to recruit a signature is a bug, because a group may be one person (DR2). This is the precedent for *disclose, don't gate*. |
| §3 rule 13 (:115, :120ff) | A new required disclosure arrives as a **format bump** (`/3` carried the bias manifest and the acknowledgements). A document silent about it is refused, never the publication for want of content. |
| §5 signing (:300–310) | The ceremony's steps: what becomes permanent; what this rests on; what you are leaving out (exclusion, searched, bias acknowledged, contradictions, source consent); the edition; sign. |
| Action v0.2, rule 9 (`BIO_Action_v0_2.md:54`) | Civicsmith takes no policy or vote position. |
| Action v0.2, rule 21 (:78) | "Power without misuse": nothing is prepared "that asks anything for the benefit of the group or its members". "**Everything the group sends or publishes carries its public identity and declared stake**, and a claim resting on another group's findings shows that group's identity and stake too." |
| Action v0.2, deferrals (:97) | "compensation claims for formal parties … wait until a group needs them". |
| Capability Ladders (`BIO_Capability_Ladders_v0_1.md:506, :646`) | Contributions, gifts, behested payments and donors are **subjects** under MONEY (B6: "Did the councilmember's top donors win contracts?"). This is distinct from who funds the group. |

### 1.3 Rulings (`build/rulings.md`)
- **K1490** (:1492, Bob, "C7: A"). Each member declares their own ties (employer, relative, business). A case concerning that entity discloses the tie at the attribution level the member chooses. "each publishing member attests at publication that they have no undeclared tie, vendors named in the money included." This carries DR6's relationship disclosure for pseudonymous members. **It is the closest existing precedent.**
- **K1483** (:1485). DR6 is widened: people are named with their ties and financial interests where these bear on the finding.
- **K1463** (:1465, Bob). The group's own money "is not named as the group's. But it's followed just as it is for everybody else." There is "no mark that it is the group's". The ban on cost and budget keys in the group's own action plans stands.
- **K2774 / K2775** (:2775–2776). Bob ruled Actions D28 "all as recommended", which created rule 21, and approved v0.2 as a whole.
- **K2896** (:2897). instance-setup R77 `declaredStakeSet` was merged. A stake per matter (rule 9) was routed as N933.
- **K3230** (:3231, Bob, "N933: B"). The group-wide declared stake stays. A group may also declare an optional stake for one matter (the project by default; an action may state its own), "shown beside the group's statement only on what is sent or published for that matter, each change dated and attributed". For higher-stakes actions the screen asks whether the group has a stake beyond its usual one: "a prompt, never a gate".
- **K2748 / K2749** (:2749–2750). Actions D15 "as recommended". Party participation is a Tier 2 action kind. "intervenor compensation deferred until asked" (N882).
- **K3041** (:3042) and **K3096** (:3097). The K1490 attestation joins the signing act, and case-authoring R76 takes `tieAttested`. **K3075** (:3076) records "K1490's attestation inside `publish`".
- **K5459** (:5453, Bob). When a team or project pays for AI, its administrators see each member's use and cost by name. A member's own subscription stays private.
- **K2350 / K2352** (:2352, :2354). Accounts are tried in a fixed order: the project's account, then the member's own, then the group's. Each account owner sets its own limits.
- **DEC-172** (`BIO_Interaction_Constructs_v0_1.md:899–903`). Whether the group pays for AI is a separate setup choice, and a member may always bring their own account.
- **DEC-188** (:1013–1017). One panel shows what each account pays for. Its use is summed without naming any member. A member stopped by a limit is told whose limit, never a cost.
- `docs/development/DECISIONS.md:1156` concerns funding a vendor account, which is Bob's money and risk. It is internal and does not bear on case disclosure.
- Background: `docs/archive/research/PROBLEM-DOMAIN.md:1054` @a9d2 (F23) says groups die of "funder concentration, fiscal-host collapse". The topic was known as a risk, never as a disclosure.

**No canon, ruling or requirement mentions** funder, sponsor, fiscal sponsor, grant to the group, IFCN, or a funding statement in a case (searched with `grep -ri` across `docs/architecture`, `build/rulings.md`, both `DECISIONS.md` files and `build/requirements`). Every hit for grant, donor or contribution is either a subject of investigation or an access grant.

---

## 2. What is recorded today, by module

| Module | What it holds | Field names | Who sees it | Funding relevance |
| --- | --- | --- | --- | --- |
| **instance-setup R77** (`build/requirements/instance-setup.md:29`), R11 (:28) | The group's **declared stake**: "what the group itself has at stake in the matters it works on, in its own words". It is set by an administrator's act, and a machine is refused. | setting `declared_stake`; `{stake, set_by, set_at}` plus history; one line of 1–1,000 characters, or `null`; `STAKE_MALFORMED` | Public, beside the group's identity | **The nearest group-level field.** It holds free text about interests, not funders. The design words (`docs/development/ux-substrate/layouts.html:1856`): "what it stands to gain or lose. It is shown beside your team's name wherever its work is published." |
| **project-roster R31/R32** (`project-roster.md:51`) | The project's (matter's) stake beyond the usual one | `op=projectstakeset`; `MACHINE_CANNOT_SET_STAKE`; joined participant or administrator | Public, on what this project sends or publishes | Per-matter precedent (K3230) |
| **action-records R17** (`action-records.md:53`), actions R105 (`actions.md:148`) | An action's own stake | `op=actionstake`, `own_stake` | On what the action sends | |
| **public-read R34/R36** (`public-read.md:96–105`, :23) | `groupFields()` → `{group, name, domain, domain_verified_at, stake, detail}` plus `matter_stake` | `stake: null` when none was declared, `"undetermined"` when unreadable | Public, no credential | **On a published case, `group_fields` is "labelled as current, never read from or written into the signed document or the case file's bytes" (R34 :102; R36 :23).** It sits in the in-band stamp beside `hash` and is never covered by it. |
| **case-import R4, R25** (`case-import.md:54`, :118) | The source group's identity, stake and matter stake, recorded at import | — | Importing group | Recorded "since they are never in the signed edition or the case file's bytes" |
| **conformance R32** (`conformance.md:86`) | An accepted finding's `basis` carries `identity, stake` | — | | |
| **member-roster R44/R45** (`member-roster.md:71–72`); publication R65 (`publication.md:124`) | The group's self-description | `kinds` (`professional`, `issue`, `community`, `catch-all`, `other`), `otherKind`, `focus` (≤1,000), `purpose` (≤4,000), `visibility` (`members`/`public`); appended, never overwritten | Public only when `visibility: public` | **No organisation, legal form, fiscal sponsor or funder field.** |
| **people R20** (`people.md:47`); schema `bio-plane/src/people/schema.mjs:82–94` | A member's own **ties** `MTI-` | `member_ties(tie_id, member, entity, kind, note, attribution, at, withdrawn_*)`; `kind` ∈ `employer`, `relative`, `business`, `other`; `attribution` = a level | The member and administrators only; any other viewer reads none | A tie is **member to entity**. The **group** has no ties. A funder of the group is not expressible here, except as each member's `other` tie. Export class `never` (R33 :113; K1490). |
| **steps R13–R15** (`steps.md:48–50`) | A step's money cost and cost sharing | `stepCostAdd({kind: fee|purchase, amount, currency, what})`; `costShares`; `costMessage` | Owners of the sharing projects; never published | "Costs are the group's own money: never `money`'s facts, never a finding (K1463)." This is INV:71–72. |
| **ai-accounts** (`ai-accounts.md:11, :25`), **ai-use** (`ai-use.md:11, :42`) | Which account pays for each AI act: a member's own, a project's, or the group's API key. Spend is counted per account and member. | `accountFor`, `aiUsage({owner, viewer, month})`, the payer flag (R45, R68) | Account owners, summed without names (R4). Since K5459, administrators of a paying team or project see use per member. A member's own account stays private. | The payer is recorded **per run** (ai-runs R91, R92, R102: segments, hops, `payer_change`), but never reaches a published case (INV:111). |
| **money** (`money.md:11, :22, :36, :137`) | **Money facts** `MNY-`: one source's reading of one amount, with `from`/`to` parties `{entity?, fund?, account?, as_written}` and kinds including `contribution`, `gift`, `behested` | `fact_id, amount, kind, phase, basis, period, from, to, …` | Follows the document's sight | **Money about the subject, not funding of the investigation.** R6 forbids any field marking a fact as "the group's own" (K1463). R22 forbids the word "conflict". A grant to the group *could* be recorded as a money fact from a captured document, but nothing would mark it as the group's. |
| **action-plans R26** (`action-plans.md:133`) | — | refuses `budget`, `cost`, `assignee`, `hours`, … (`OPTION_KEY_REFUSED`) | | A plan holds no resources (Bob, 29 Sep). |
| **Civicsmith's own credit** (`public-read.md:89`, R30) | `creditPage()`: "Free software for groups that…" | | Public | How Civicsmith itself is funded is outside the case. |

**The difference to keep (K1463, money R6).** A money fact is evidence about a public body's money. The group's own money, when followed at all, is followed like anyone's, with no mark that it is the group's. Funding of the investigation is **who pays the group or the project to do this work**: a statement the group makes about itself, as the declared stake is. It belongs with the stake, ties and bias, not with money facts.

---

## 3. How disclosures reach the signed case today

### 3.1 The pattern (the lens, the ties and the acknowledgements)
1. **Judged before signing** in `case-disclosures`, which "judges each against the owner's lists and the record at the act" (`case-disclosures.md:12–22`). `case-authoring`'s `publishCase` asks the judgments in order. The pre-flight (case-authoring R34) lists all refusals, without writing, before the first ceremony screen (`BIO_Publication_v0_1.md:305`).
2. **Spelled once** as flat front-matter blocks in `case-grammar` (rows of scalars, K549), with a reader `…Of(fm)` that answers empty for a document without the block.
3. **Frozen per format.** A new block or wording means a new `CASE_DOCUMENT_FORMAT`, and earlier formats re-render byte for byte.
   - The current format is `bio-case-document/10` (`bio-plane/src/case-grammar/formats.mjs:42`; case-grammar R35 :200).
   - R33 (`case-grammar.md:184–191`) is the rule: "/8 states exactly what /7 states … differ only in the words". `caseWordsOf(fm)` picks "group" or "team" by format. A prepared but unsigned document keeps its own format.
   - `/11` is planned, carrying per-sentence `origin` and `review: {ratified_by, standard, affirmed}` (`open-asks.md:11` @a9d2; BD-8 `DECISIONS.md:79–81`, BD-9 :85–87 @a9d2). It is not yet in requirements.
4. **Printed in the complete edition** (case-grammar R14, `case-grammar.md:82–92`). In order: claims, findings, materials, what was searched, **the declared bias (lens, R9)**, contradictions, strength, method, how to check. Every page carries the case, edition, group, declared bias, floors and hash (:89).

### 3.2 The tie attestation, the closest precedent (K1490)
- **Requirement.** case-disclosures R27 (`case-disclosures.md:153`). `tieAttestationJudged(signers, named, moneyParties, attested, viewer)`:
  - Each signer attests that they hold "no undeclared tie to any entity the case names, the payers and payees of the money facts it cites included".
  - With no attestation the case is refused `TIE_ATTESTATION_MISSING` (C-120.16), named to that signer only.
  - Each **declared** tie to such an entity becomes a `member_ties:` row at the member's chosen level. At `group` or `project` it shows no handle, key or signature. At `cover` or `name` it shows that identity.
  - The attestation is recorded "with the signer and instant in the document the signer signs, never as a separate table".
- **Code.** `bio-plane/src/case-disclosures/index.mjs:1047–1106`:
  - The refusal is in the DEC-49 region `is-tie-attested` (:1077–1085), using `checks.mjs:129`.
  - The attestation row `{row: "attestation", signer, at}` is built at :1089. It carries the signer's **member id**, `bare(s)`.
  - Each tie row `{row: "tie", entity, kind, level, shown}` is built at :1102. The tie's `note` never enters the document.
  - A failed ties read goes to `undetermined`, never a guessed fill.
- **Where it is called.** `case-authoring/index.mjs:214–216` (`attestedBy`: `tieAttested === true` gives the signer and the act's instant) and :834–837. **Only the publishing member is passed as `signers`** (`[who]`), not every owner. The block is written at :1200 (`memberTiesBlock: memberTieLines(tiesJ.rows)`). case-authoring R76 (`case-authoring.md:250`): `op=publish` always asks for `tieAttested`, and any value other than `true` is no confirmation.
- **Spelling.** case-grammar R21 (`case-grammar.md:134`); `bio-plane/src/case-grammar/people.mjs:20–48, :74–77` (`MEMBER_TIE_FIELDS = row, signer, at, entity, kind, level, shown`).
- **Re-check after signing.** ratification R41 (`ratification.md:58`; `bio-plane/src/ratification/schedule.mjs:87–95`) records under `checked.ties` what signing read: each signer's declared ties to the named entities and money parties, with whether each stands withdrawn, so R42 can compare later.
- **On screen.** The ceremony's "Your ties" step (`bio-plane/src/screens-publish/ceremony.mjs:339–342`; screens-publish R83 :150 places it after "Photos" and "Passages not graded yet"; R94 :161 covers a member who is not an owner). The words are in `docs/development/ux-substrate/screens/words-modules.json:11836–11858`:
  - `screen.ceremony.ties.confirm`, **protected**: "I have no undeclared tie to anyone this case concerns, including anyone paid in its money".
  - `…ties.part`: "The member who signs confirms this for themselves, and the confirmation is part of what they sign."
  - Journey 5, "Declaring your own ties" (`docs/development/ux-substrate/journeys.html:197–198`).
- **What a reader sees.** `member_ties:` is in the **signed front matter**, so it travels in the case file. But **the complete edition does not print it**: `case-grammar/complete.mjs` has no ties or people section, and R14's order omits it. **public-read does not serve it** either: the only other reader is `publication/index.mjs:519–528`, a handle guard. Unlike the lens (DEC-103), the tie disclosure is signed but not displayed.

### 3.3 What else the signer attests or authors today
- The bias acknowledgement, authored and fresh for each edition.
- The exclusion statement and its acknowledgements (rule 11).
- Self-attested captures, with a reason (case-disclosures R2, R3).
- People's bases (R25).
- Disclosed tensions (R1).
- The tie attestation (R27).
- **Planned (BD-9):** `review.affirmed`, inside the signed document. The signer affirms "that every AI use in the text is recorded" (`DECISIONS.md:85–87` @a9d2).

None of these concern money paid to the group or project.

---

## 4. Gaps for a funding statement

1. **There is no record of who funds the group, a project or an investigation.**
   - No field holds a funder, sponsor, fiscal sponsor, grant or in-kind support (sections 1.3 and 2).
   - The group description has kinds, focus and purpose only.
   - Member ties are member to entity, and a group has none.
   - The declared stake is free text about interests, not sources of money.
2. **What the product does know about payment stays private by doctrine.** Step costs and their sharing (INV:71–72, steps R13–R15), and which AI account paid (INV:111, ai-use, K5459), are owners-only working material. Publishing any of it would reverse INV:111's "what a project spends is its own business". So a funding statement must be a new **authored** statement, not a projection of these records.
3. **The stake is not in the signed bytes.** Rule 21's identity and stake reach a published case only as *current* `group_fields` (public-read R34, R36). A funding statement placed there would change with every later declaration and would not travel with the case file, which fails the "survives the group's system going away" test DEC-103 set for the lens. Placing it in the signed document needs a format bump, and the only one in sight is `/11`.
4. **The tie attestation is signed but not shown.** If funding follows the K1490 pattern, the lane must decide whether it is printed (as the lens is, R14 item 5) or only carried (as `member_ties:` is today). The same gap applies to the ties themselves.
5. **The tie attestation's scope.** Its subject is "entities the case names". A funder who is *not* named in the case is outside it, so a member funded by an interested party who does not appear in the case attests truthfully. IFCN's test ("no influence over conclusions") is about the funder, whoever it is.
6. **Only the publishing member attests** (`[who]`, case-authoring index.mjs:835). Other contributors and owners do not. A funding attestation would face the same question of who answers for it.
7. **There is no vocabulary.**
   - Funding needs kinds: grant, donation, membership dues, fiscal sponsor, in-kind, self-funded or volunteer, commissioned or paid by a party.
   - It needs levels: group-wide, project, case.
   - It needs a period.
   - A recorded **statement of no funding** is needed so that "none" is said, not silence. The stake and the bias manifest already do this ("no manifest was in force"; `stake: null` with `detail`).
8. **Privacy of individual donors.**
   - K1483 and DR6 govern naming people in cases, and K1493 forbids publishing addresses and phones.
   - K5499 and K5500 (`rulings.md:5493–5494`) treat *subjects'* donor lists, not the group's own donors.
   - Nothing says whether a group's small individual donors may or must be named.
9. **Language limits.** money R22 forbids the product's own words saying "conflict" (`money.md:137`). Any funding wording that implies influence has to respect it, and Action rule 21's "nothing … for the benefit of the group".
10. **A commissioned case.** Nothing records that a case was commissioned or paid for by a party with an interest in its outcome, for example a litigant, a competitor or a campaign. INV §9 lists "a donor" only as a subject.
11. **Imported cases.** case-import R4 and R25 record the source group's identity and stake at import. A funding statement would need the same treatment so an importing group can weigh it.

---

## 5. Open questions and whose call

### Bob's: values and policy (as with DEC-103, K1490 and K3230)
1. **Required, optional, or required-to-state-none?**
   - Option a: a case must carry a funding statement, with refusal if absent (as with the bias acknowledgement).
   - Option b: the statement is optional.
   - Option c: it is required, and "none / volunteer-run" is a valid answer.
   - Rule 11 and K3230 lean towards *disclose, never gate*. DEC-46 is a required authored statement.
2. **What counts as funding:** money only, or in-kind support too (hosting, a lawyer's time, AI credits paid by a third party)? Does a member lending their own AI subscription count (K2352 (1))?
3. **Thresholds.** Should any source above an amount or a share of the budget be named? Should it be per case or per period?
4. **Naming individual donors.** Should they be named, aggregated ("individual donors, N, none over $X"), or withheld? This interacts with DR6/K1483 (people are named where their act bears on a finding) and with members' and donors' safety (Membership v2 §3 cover).
5. **Funder interest in the subject.** Should a funder that is also an entity the case names, or a party to its money, be disclosed at that point, extending K1490's attestation from members to the group's funders?
6. **Commissioned work.** May a case be commissioned by an interested party at all, and if so must it say so?
7. **The IFCN commitment itself.** Under BD-6, does Civicsmith adopt IFCN commitment 3 voluntarily, and say so in the published review standard (BD-8)?
8. **Should Civicsmith's own funding** be stated on the credit page (public-read R30)?

### BOB's: requirements and placement (P17, BD-13)
1. Which module records the statement:
   - an extension of instance-setup R77 and project-roster R31 (stake-like, dated, attributed, administrator or owner act); or
   - a new `case-disclosures` judgment (R27-like, authored at the act).
2. **Format.** Fold it into `/11` alongside `review:` so that the signed format changes once (BD-7's rule; open-asks :23). Name the block, for example `funding:` with flat rows `{level, kind, source, shown, period, words, by, at}`, and its reader for `/10` and earlier (`not_stated`, as `/11`'s provenance plans).
3. Its refusal rows (C-120, the next free number) if it is required. Its place in the pre-flight (case-authoring R34) and in `publishCase`'s order (R55).
4. Ratification R41/R42: does a later change to the group's funding declaration lapse or flag a signed case, as ties are re-checked?
5. public-read and case-import: serve it from the signed bytes. Is the *current* group-level statement also shown, as `group_fields` is, labelled current?
6. Export class for any group-level funding record. Members' ties are `never`, but a group statement meant to be public is presumably `yes`.

### The lane's: design and wording, within BD-3 (ux owns screens and words)
1. Whether the statement sits beside the lens in the edition (R14 item 5, "the lens this case was produced under") as part of a "who made this and who paid" section, or beside identity and stake in the in-band stamp.
2. Whether it is a fresh, authored, per-edition statement (DEC-46) or a group setting stamped in (manifest-like), or both, as with the bias manifest and the bias acknowledgement.
3. The ceremony step: next to "Your ties", or merged with it as one confirmation.
4. Its relation to the tie attestation's display gap (section 4, item 4). Propose printing `member_ties:` and funding together.
5. The wording needs to hand to ux:
   - the attestation sentence;
   - the "none" sentence;
   - the withheld-donors sentence;
   - a reader's explanation of why the group declares funding, which could parallel DEC-117's two sentences.
