Length: 247 lines. Last section: "8. Conflicts, gaps and what was not read".

# UX research 01: what the founding documents say about the user's experience

UX lane research, 2026-11-22. Rank of each source follows `process/ranking.md` ("The ranking"): mission (Roadmap §§1–5) > principles (Design Requirements; DEC-n; `process/decisions-owner.md`) > standards (construct designs, Functional Architecture, System Design) > module requirements > design decisions and this lane's folder. A lower text never overrides a higher one.

Path abbreviations used below (all under `docs/architecture/` unless shown):
RM = `BIO_Complete_Roadmap_v5.md` · DR = `BIO_Design_Requirements_v2.md` · FA = `BIO_Functional_Architecture_v3.md` · SD = `BIO_System_Design.md` · IC = `BIO_Interaction_Constructs_v0_1.md` · AI = `BIO_Assistant_and_AI_Roles_v0_1.md` · MB = `BIO_Membership_Architecture_v2.md` · PB = `BIO_Publication_v0_1.md` · INV = `BIO_Investigation_v0_1.md` · CM = `BIO_Case_Making_v0_1.md` · ACT = `BIO_Action_v0_2.md` · DIST = `BIO_Distribution_v0_1.md` · DEC = `docs/development/DECISIONS.md` · UIK = `docs/development/UI-KICKOFF.md` · CANON = `requirements/README.md`.

## 1. What civicsmith is, for whom

**Mission and stance.**
- Origin: the Oakland sewer-fund investigation; the pivot was "from a tactical legal campaign to the design of a distributed civic operating system", the sewer fund being "the proof-of-concept, not the endpoint" (RM §1, §2).
- Premise: what the city "cannot ignore is SUSTAINED ATTENTION applied through legal mechanisms"; citizen apathy is "rational learned helplessness", so "the system must demonstrate a credible path to results"; a "compliance-verification framework (not policy advocacy) is genuinely non-partisan" (RM §2).
- Preamble: "We believe Oakland can be the city it's supposed to be… sustained attention, grounded in facts and guided by law, is how citizens make that happen." Portable: "Believe in Richmond", etc. (RM §3; DR §15).
- Purpose of the software: "Civicsmith exists to answer questions, make a case, tell a story, and take action to affect a living civic system"; it supports "a member through the winding path of *questioning, exploring, discovering, documenting, and impacting*" (SD §1; same frame CM "The frame, in Bob's words").
- The product is "the trustworthiness of the record"; "A defect that lets the record claim more than it can support is worse than a missing feature." Three governing rules: "undetermined is first-class and must be stated"; "an equality or outcome that costs nothing to produce is not evidence"; "derived things inform, authored acts bind — the machine may do the LOOKING, the member does the CONCLUDING" (SD §1).
- Stance: "BETTER GOVERNMENT"; "all stakeholders are presumed to want better outcomes; bad actors are identified by EVIDENCE, never assumed by role" (SD §1, §7; ACT §4 rule 12).
- "The distribution model IS the product": each group installs its own sovereign instance in its own Cloudflare account; "no hosted service, no central record, no operator who can read a group's evidence" (DIST §1, §2; SD §2).
- Public self-description (owner rulings): "Free software for groups that check whether a government keeps its own word: the laws it passed, the court decisions that bind it, the rules it set itself, the promises it made" (DEC-221 (1), refining DEC-146); never "civic groups" alone; second line names "Neighbourhood and issue groups, newsrooms, professional associations, and public offices checking their own work" (IC §L, DEC-146). civicsmith.org headline "Hold your government to its own word" (DEC-206 (1)).

**Four core values** (RM §4; DR "Reference: Core Values"), "our" voice: (1) accountability only with sustained attention; (2) duty to verify the government acts lawfully; (3) "Accountability is built on credible facts. Nothing else holds up."; (4) government must follow the law and its stated policies, "No exceptions."

**Eight operational principles** (RM §5), each with UX weight:
1. "We take no position on what the policies should be." → no policy/advocacy output (ACT §4 rule 9).
2. "Show your work. Always." → methods, sources and reasons visible.
3. "The clock runs. Deadlines are deadlines." → every deadline names its basis (ACT §4 rule 6).
4. "When the evidence changes, the findings change." → re-evaluation notices, editions.
5. "Credibility is demonstrated by the work. Not by credentials…" → declared expertise "gates nothing" (MB §1.3, §5).
6. "Compliance restored. Consequences addressed." → escalation end condition (ACT §3).
7. "No group speaks for Believe in Oakland."
8. "Pressure against supporters is evidence… Document everything." Wording note: "pressure" chosen over "attacks" ("too alarming for newcomers"); "residents should be allowed to be angry; civic OS OUTPUT must be disciplined, but humans can be human" (RM §5).

**Group workflow** (RM §10): Orient → Investigate → Document → Escalate (if warranted) → Monitor; "At every phase: AI skills provide support. Humans make every decision." Functional layers Information / Analysis / Action are concurrent, not phases (FA "The three layers"); Analysis outputs are Compliant / Noncompliant / Unclear, and "Documenting compliance is important" (FA "Analysis outputs").

## 2. Audiences and roles

**Three rings (DEC-128, Bob, 2026-10-04; IC §R).**
- *Inside the group (members):* newsroom staff ("a core audience"); **the newcomer member — "the centre of gravity: a community activist or volunteer with no civic-records experience"**; the experienced investigator; the professional member (journalist, lawyer, accountant, auditor, engineer, policy analyst; "declared expertise gates nothing"); the project owner; the administrator; future members.
- *Invited in:* the outside reviewer of a review copy; the group's lawyer receiving a counsel packet.
- *Outside:* someone handing material through the doorbell; the public reader; outside journalists; partner groups; government offices and officials; oversight bodies.
- Not audiences: installer and founder are "moments of the administrator's role"; project participant / member outside a project are "states"; "the assistant is an actor, not an audience"; residents addressed by an action "meet the group's words, not its screens".
- Across every ring: other-language readers, screen-reader and keyboard users, phone users. Group kinds differ (professional, issue, neighbourhood, catch-all), and "a public body may itself run a copy, so the design never assumes the group stands outside government" (IC §R).
- Earlier order (UIK "Who this is for"): member, reviewer at release, project manager, admin, public.
- Publication audiences are READERS of a case (eight professional roles), not user types; they differ by output act (PB §6; CM "The frame").

**Member roles and states (MB).**
- **Cover and handle**: cover is assigned by an administrator, "explicitly NOT a claim about who someone is"; the field must not invite a legal name; handle is chosen by the member, unique, and "is what appears in the record"; only administrators see the pairing (MB §3). Handle is "chosen when they join and never changed, and no handle is ever reused" (DEC-196, DEC-197; IC §V). While typing, the field says free/taken/invalid, "never says who has a handle" (DEC-184).
- **Group of one**: "the entire membership apparatus stays invisible until a second person exists" (MB §4.1; DR §2 "genuinely useful to one person with a few hours a week").
- **Administrators**: custodial, not authorities over content (DR §1; MB §2). Two-administrator floor is now a recommendation: "Setup recommends a second administrator once, saying why, and never again"; asks who holds the hosting account (DEC-134; MB §4). Administrator status cannot be taken away; only last administrator is stopped from stepping down (MB §4.4, DEC-134). Root of trust = whoever holds the hosting account (MB §4.6), told plainly on the claim page (DEC-109).
- **Capabilities**: contribute, publish, create projects, administer; "A capability a member does not hold is absent from their interface, not present and refused" (MB §5; UIK "Constraints"). Joining default is contribute (MB §6, DEC-133).
- **Expertise**: declared by the member, confirmed by an administrator; "Confirmation gates nothing"; a check can be asked "by expertise" (DEC-135; MB §1.3).
- **Projects**: owners hold authority; administrators "direct nothing" (MB §7). Invited vs joined via a checkbox; leaving is a greyed "request to leave"; only an owner removes (MB §7.4–§7.7). Discoverable or Hidden, chosen at creation "with NEITHER option preselected"; hidden = "the uninvited see nothing" (MB §7.14). Admins see of a hidden project only existence, name, owners (MB §7.3, D54).
- **Membership is "Not a security boundary"**: interfaces "must not imply otherwise" (MB §2).
- Founder: chooses their own handle at the claim; `admin` is internal only (DEC-230, K3265).

**Public readers**: public page, complete edition, case file; verifiable "without a Civicsmith copy" (PB §5C); docket with standing for named subjects (PB §5D). Public pages never use the word "claim" (DR §10 DEC-111 note).

## 3. Principles and design requirements binding screens and wording

From the mission and requirements:
- DR intro: "The system fails if any requirement is violated." DR governs RM on conflict (RM "Companion documents"; SD §2).
- **DR 2**: one individual can learn, gather, produce, escalate and publish "without requiring assistance from or approval by anyone else".
- **DR 3/4**: no permission to form a group; "No review board. No approval process." Standards are human-readable and AI-executable; "Neither path requires a gatekeeper."
- **DR 5**: each group keeps its own accepted body of work; acceptance "public and traceable".
- **DR 6 (amended K1483)**: people materially involved are named with documented acts, positions, ties; every person named "has a recorded basis, checked before publication".
- **DR 7 (amended)**: "a met trigger proposes the next stage, with its age; a member advances it or declines with a reason. The protocol never advances itself."
- **DR 8**: three risk tiers; Tier 3 → counsel packet, "never published, and never in a form that can be filed".
- **DR 11**: starter materials "understandable by someone with no prior civic engagement experience and usable within one session"; security practices guide.
- **DR 12**: tools "advisory, transparent, and optional"; "No tool has authority to approve, reject, or gate any work product or action. No tool is required for participation."
- **DR 13**: "designed with the assumption that the protection system will attempt to disrupt, co-opt, discredit, infiltrate, and legally harass".
- RM §12 key UX principles: "Most common actions are most accessible"; "organized by user intent, not system architecture"; "Trust signals are ambient (always visible), not interrogative"; "Skills are invisible infrastructure; users see functions, not tools"; "System prevents errors before publication"; tooltips on marks; provenance carries into Context; "works identically whether there is 1 group or 1,000".

Bob's UX principles, verbatim and standing (UIK "Bob's UX principles", canon per CANON): "Minimum visible complexity"; "layered abstractions"; "A user experience from the user's perspective"; "Spacious, welcoming, alive, information-rich surfaces"; workflow "will evolve". Refinements: relevant load-bearing state "always shown… named explicitly so a newcomer can recognize it"; one semantics table for states; "Change deserves weight equal to current state"; "Information density is not less whitespace; it is signals"; "Alive means live". Constraints "that are law": privacy fence visible; capabilities absent-not-greyed; "Identity is server-stamped"; outward-visible acts "say so at the point of the act"; append-only shown as such; "Refusals teach" (UIK "Constraints that are law").

From the interaction constructs and rulings:
- **No nagging (DEC-69)**: "THE WORKFLOW MUST NOT NAG OR SECOND-GUESS MEMBERS." Inform at the act, once; no "are you sure" on reversible/reasoned acts; members are "ENABLED to act singly or in bulk and… FORCED into neither" (DEC-69 amended).
- **Never put words in a member's mouth**: "No templates, no 'suggested reason', no LLM-drafted default"; assembling the member's own prior words is permitted (IC §J). Help with writing never in a reason field (K1841, IC §P).
- **Nothing preselected** in sets (IC §S, DEC-69) or at project visibility (MB §7.14), AI payment choice (IC §R, K1755, DEC-172).
- **Refusals**: "a surface may RENDER a refusal it received from the plane. It may never COMPUTE one" (IC "RULED 2026-08-01", DEC-8); every refusal has a code and canned translation (AI §3 rule 10, DEC-49).
- **Friction matches weight** (DEC-87, IC §F), see §4.
- **Measures map** (DEC-82, IC §M): "letters grade evidence, bars show progress, weights mark acts"; three taught sentences: "An answer is only as strong as the weakest thing it depends on"; "A grade tells you how easily someone else could check it for themselves; it never tells you whether it is true"; "What we don't know is shown, never hidden or guessed". Never one combined badge (DEC-44 via IC §M).
- **Access and language** (DEC-99, IC §L): WCAG 2.2 AA for every screen and the published case, checked when each screen is accepted; colour never the only signal; words in one place for translation; member-chosen language with English fallback "word by word, never blank" (DEC-127); protected words need a second speaker (DEC-157).
- **Devices** (DEC-122, DEC-181): phone does reversible/reasoned acts incl. capture; Irreversible ones on a larger screen; light and dark; "no outside fonts, analytics or trackers".
- **Working and published** (DEC-106, IC §W): two spaces, each framed; review copy and outgoing drafts banded inside the working frame ("Shared for review: 2 people outside the group can read this"); a path-to-publication marker on each item.
- **The wide path, eight rules** (DEC-129, IC §R): a front door in every journey; wizards "never gates"; "You can always see where you are"; explained where it appears and findable again; heavier steps slow you; any order and resume; many front doors ("most often a problem they live with"); fast for those who know.
- **Visual language** (DEC-138, IC §V): verdigris = acting, rust = attention only, a hue per evidence scale; machine and another team's work no hue (dotted / double edge); serif = people's words, sans = Civicsmith's, mono = identifiers; "Never colour alone".
- **Every screen's path** in one place (DEC-154); every mark and act explains itself; "nothing is ever hidden" (DEC-161, 162, 174, 175, 177); table rows acted on where they are (DEC-176).
- **Buttons**: pressed, working, answered, refused; sounds off by default (DEC-280).
- **Setup in parts** (`.cs-part`), choices that say what they mean, acknowledgement beside the field, explanation by layers; "Every other long task follows this pattern" (DEC-279).
- **Voice/brand**: design principles page (DEC-123) and brand-and-voice page (DEC-125) are the yardsticks; the assistant says "I" in conversation, "the assistant" in labels, never "we" (DEC-125, AI §5). American English, month-first dates "October 8, 2026" (DEC-221 (2), DEC-333).
- **Names**: product "Civicsmith" (DEC-124); an instance is "your team's Civicsmith", never "copy" (DEC-149 as reworded by DEC-281); "team", not "group", in every text people read (DEC-281); the group leads everywhere it acts, "Made with Civicsmith" in small type (DEC-118); "To do" not "Obligation" (DEC-107); queue kinds "To do", "Noticed", "Status" (DEC-110 amended by DEC-131); a machine judgment score is a "hint" (DEC-131); "Matters" for what a plan addresses (DEC-114, ACT §7); member-facing phases "inquiry / finding / case" (CM "Naming").
- **No email to members, ever** (DEC-219 (1)); no outside channel reaches a member (DEC-94 (3)); reminders only by the member's own request; overdue notifies once (DEC-94; ACT §4 rule 6).
- **Home**: one home for everyone (arrangement C), a "nerve centre"; never a reading at zero or an empty block; four areas: Investigation, Action, Members, Administration (DEC-216, DEC-218, DEC-219 (2–3)).
- **Narrative vs evidence**: "make a supported case easy to build and an unsupported one hard to state" (CM §4a); a case "carries no stories" (INV §11, D57); answers give "no verdict, likelihood or rating words" and say "cause not established" (INV §6).
- **No score on people or members**: "No attribute of a member or user gates, filters or orders anything"; nobody's reading tracked (ACT §4 rule 10); nothing measures a member (INV §1 table).
- **Court reach honesty**: never claim more protection than there is; never "secret" or "confidential" (DEC-136, IC §R).

## 4. Constructs a member sees and acts on; display primitives

**Interaction constructs** (IC "The revised set"; SD §3 row 12):
- **QUEUE** — "things that want me, grouped by the case they belong to": dispatch an obligation (do / forward / resolve) or judge a noticed item (adopt / defer / dismiss). One standing entry per (member, case); re-sortable by time added, time due, case, type and collapsible (DEC-10, DEC-110). Resolution is attributed, "never a deletion" (DEC-16). Mutes are personal and scoped to kinds present (IC). Invisible ancestors stated as incompleteness only (DEC-36).
- **ACT** — "choose, see what it will refuse and why BEFORE it runs, author the reason, get a receipt"; ballots and bulk are acts.
- Types inside them (IC v0.1 sections): **Task** (never silently dropped; addressed or "unassigned"); **Ballot** (shows the denominator: "2 of 3 endorsements"); **Proposal** (must look derived; only adopt / defer / dismiss); **Justified transition** (reason required, never prefilled); **Attestation** (states what becomes permanent and "what it will and will not claim": a hash asserts "bytes, address, date and route", not authenticity); **Selection-scoped action** (lease or enumerated set; per-item answers; "Visibility may only ever SHRINK a selection").
- **Find in this** (DEC-164): find people, money, dates, requirements, names in a scope; "Nothing is recorded by finding"; a result becomes a fact only by the act that makes that kind of fact.

**The rung ladder** (IC table; FW-14; DEC-19): reversible · reasoned · terminal · attested (signed) · IRREVERSIBLE (publishing). Friction: reversible inline and undoable; reasoned opens a reason field; terminal/attested open a full dialog; irreversible only through the ceremony (DEC-87, IC §F). Effects outside the record open the full dialog whatever the rung (DEC-88). Only acts heavier than Reversible show the weight mark (dots 2–5); scale explained once (DEC-295). Expunge and the team's short name show Irreversible weight (DEC-142, DEC-143). Undetermined rung treated as reasoned (IC §F).

**UNDETERMINED** — one component, fixed mark, mandatory "because…" line; four distinct neighbours: "Withheld", "Unrated", "Nobody looked", "Refused"; none dressed as an error (DEC-86, IC §U). Ordinary states: "Nothing here", "Still loading", "Could not read this, because…"; every wait names what, from whom, and the date (DEC-98).

**Evidence and progress marks** (DEC-82, IC §M): A–D letters per evidence scale (capture, connection, testimony, subject match), colour marks the scale not the value; progress bars (project stage, work-product readiness, source identity), dashed = not yet evaluated; strength vs the project's bar ("Meets the bar", "Short on connection", "Short on capture", "Unrated"). Project stage as stacked coloured bars (DEC-79).

**Origin mark** (replaces the five trust levels as a ladder): "Ours", "Another group's", "Accepted by our group", "Not yet evaluated", "Flagged" (member's evaluation only); "Meets standards" waits (DEC-92, RM §11; DEC-96).

**Record constructs a member works with** (SD §3; INV; ACT; PB):
- Capture / document — release (vouch) or set aside held captures, singly or as a list (DEC-95, DEC-97); a captured archive's files (DEC-167); file risk Low/High, safe view (DEC-169, DEC-173).
- Content / passage — cite a passage; transcribe; narrow to the on-point part.
- Question (inquiry) → finding → case: pose, draw legs with grades, conclude with a falsifier (or stated override), reopen, divide (SD §3 row 8).
- Project / investigation — objective and its condition, computed gaps; "No member act declares an objective met"; steps, waits, milestones, status reports (INV §2–§3).
- Hunch / hypothesis / lead / private note (IC §R DEC-136, DEC-144; INV §5, §8).
- Declared bias — statements, acknowledgement at publication (SD row 7).
- People, events, money (SD row 17); People = those the record follows, team members under Settings (DEC-203, DEC-154).
- Action layer: standard, determination, consequence, success record, action plan ("Matters"), action, filing/communication, escalation (ACT §3); "Humans decide" (ACT §4 rule 1).
- Publication: the five-step ceremony ("what becomes permanent"; "what this rests on"; "what you are leaving out"; "the edition this creates"; "sign"), preflight before the first screen, signing in the browser (PB §5, DEC-80, DEC-207); publish now or at a time (DEC-147); new edition's "What changed in this edition, and why" (DEC-101); docket and withdrawal (DEC-100, DEC-116); review copy (PB §6A); "working on" notices (DEC-111); import and recreate another team's case (DEC-112).
- The doorbell's inbox, "like an email inbox" (DEC-108).
- Security screen for administrators (DEC-165, DEC-166).

**Seven-category UX of record (RM §12)**: Context, Search, New Developments, Monitoring, Communications, Projects, Settings. Built shell (DEC-139): rail Home, Queue, Find, Add, Projects, People, Settings; phone tabs Home, Queue, Add, Find, More. See §8 for the divergence.

## 5. The assistant in the user's experience

**Boundary** (DEC-24 via AI §1): "THE MACHINE MAY DO THE LOOKING; THE MEMBER DOES THE CONCLUDING." Four roles FIND, PURSUE, EXTRACT, CHECK; plus request capture and initiate an act (AI §2).

**May**: search and read any public site (nothing so read enters the record); read held files a few pages at a time; propose passages, connections, readings, questions, steps, hunches, options and drafts, each tied to a quote and labelled; ask to capture only addresses the record already holds (AI §3 rules 11–12; INV §5–§6). Conduct wizards: "the assistant CONDUCTS; the member ACTS"; opens the real screen, never a copy; may place a "labelled draft" in a field (IC §P, DEC-120). "Help me write this" in descriptive own-words fields, label "Draft · the assistant's, asked by <handle>" (DEC-152, DEC-153). Draft a case's written account, every sentence checked against evidence before publication (AI §3 rule 9, D56; INV §11). Draft "What changed" statement, labelled (DEC-101).

**May not**: write a member's reason ("Show the reasoning; never the sentence", AI §3 rule 1, K1841); choose the question or set project defaults silently (rule 2; IC §P); conclude, attest, ratify, publish, file or send (rule 4; ACT §2, §4 rule 1); give a single confidence score or connection-density ranking (rule 9); mint a D grade (rule 3); run an EXTRACT or any run unattended except a member's standing question and owner-enabled exploring (AI §7.3 (7), K1481, K1468); explore a person on its own (INV §9); travel on a member's token (rule 5).

**Acts needing human judgment** (FA Layer 2 Function 4; ACT §4 rule 1; INV §5): significance; every determination; concluding; declaring standards; assessing consequences; choosing options; approving and sending; advancing or stopping a stage; accepting any proposal (as proposed, edited, or own); vouching captures; signing. "One accepting act for every kind of proposal" (INV §5).

**Labelling**: one "machine work" look; attribution "the assistant did this, at <member>'s request"; docked panel, never floating; a wizard step highlights the real control, never fills or presses it (DEC-90). Machine text never presented as publisher text (AI §3 rule 3). Live progress, answer shown only after Civicsmith's check: "You never see unchecked words" (K3602, DEC-298). Machine judgment = labelled "hint" with method and false-alarm rate, never a grade (INV §5, DEC-131). Voice transcription shown for correction first (IC §P).

**Without the assistant** (K1547, DEC-139, IC §R): "Absent, not greyed"; "Ask" becomes "Find and count"; drafts from team templates; standing questions still run; every wizard runs from its script; "Every journey is drawn both ways". Accounts: member's own subscription/key first, project key, team API key (off by default), or none; "keep our material away from AI" switch (K1755, DEC-172, AI §6, DEC-188). Cost estimate before, actual after, to payers only (INV §6). **The alpha ships without the assistant; the first beta carries it** (DEC-405); many-provider design is first-beta (DEC-420); unassisted public registers must be in the alpha (DEC-406).

## 6. First use, install, invitation and sign-in

**Install (founder)**: `newgroup` in a browser: OAuth, checks, Workers Paid required, no domain needed, then install and verify (DIST §2, §5). Before installing: "Get ready" guide, "Check my account" checklist, and "Install now" offered only when every line is ready (DEC-415, DIST §5). Absent fleet members are stated per member, never silent (DIST §4 rule 4). Founding journey starts on civicsmith.org ("Start your group", "See groups at work") (DEC-206). The short name is permanent and Irreversible-weighted (DEC-143).

**Claim and setup**: one-time password shown once; claim page tells "the whole truth" that whoever controls the hosting account controls the instance (DEC-109); founder chooses own handle (DEC-230); setup in collapsible parts, AI section hidden if AI is kept out (DEC-279); second administrator recommended once (DEC-134); team kind/focus optional, shapes the welcome (DEC-132); AI choice nothing preselected (IC §R). First Home: numbered next steps "Invite your first members", "Say who your team is", "Open your first project" (DEC-285). Teams in places Civicsmith holds no rules for get fallback text and are told when rules arrive (DEC-150, DEC-151).

**Invitation**: burner URL, one-time, "spent on use", "reveals neither the group nor the invitee"; the system "takes no position on that channel" (MB §6). Website key and reusable join link, off by default, daily cap, members only, warning shown once (DEC-133). At enrolment: handle (fixed) and password; cover and capabilities not editable by the member (MB §6). Ten recovery codes shown once on joining (DEC-202 (3)). "Civicsmith sends no email" (DEC-133; DEC-219).

**Sign-in**: the team's own public page ("Your group's page": logo, purpose, published cases, doorbell, "How we work", sign-in panel) (DEC-202 (1)); device "my own" (locks after 30 min, re-sign after 12 h) or "shared or public" (15 min) (DEC-202 (2)); re-authentication before signing, publishing, changing administrators, connecting Claude (DEC-202 (2)); forgot password via recovery code or an administrator's reset link (DEC-201 (2), DEC-202 (3)); sign out here / everywhere (DEC-201 (3)).

**First use / onboarding**: newcomer meets "strength against the project's bar, and 'Undetermined'" first (IC §M). One door "What happened?" leading to six places (INV §7); with the assistant free text, by hand guided starts (INV §7). Required wizards: set up and claim, welcome a new member, publication ceremony (DEC-121, DEC-139, DEC-148). Guidance explanations on for new members, asked once after a month (DEC-162). **Onboarding design is DEFERRED by Bob "until the new UX is in place and stabilized"** (DEC-91); the welcome wizard is "a first version" (DEC-148).

## 7. Owner rulings that shape UX

Status: "Bob" = typed by Bob; "ds" = decided by the design session under delegation (P17), per each entry's `decided:` line in DEC. DEC-1…DEC-67 are not in DEC (archived to `docs/archive/ledgers/DECISIONS-2026-08.md`, DEC line 91); those cited here are quoted from canon documents.

**Archived, quoted in canon**: DEC-8 refusals rendered, not computed · DEC-10 queue by case · DEC-12 editions · DEC-16 shared resolution · DEC-17 strength is declared · DEC-19 publishing irreversible, attestation never silently undone · DEC-20 only a hunch refuses publication (DR) · DEC-24 machine looks, member concludes (AI §1) · DEC-27 assistant (IC §P) · DEC-36 withheld ancestors · DEC-44 no combined score (all IC unless shown).

**In DEC (Bob unless marked)**:
- DEC-25 deferred: whether any of an action plan is published.
- DEC-31 review copy (later answered, PB §6A).
- DEC-33 ceremony deferred (superseded by DEC-80).
- DEC-69 no nagging; enable bulk, force neither.
- DEC-77 contradictions presentation (inline/where they sit; per question).
- DEC-79 project stage as stacked bars.
- DEC-80 the five-step ceremony built; browser signing.
- DEC-82 measures map. DEC-83 refusal sentence per act vs shared.
- DEC-86 Undetermined and four neighbours. DEC-87 friction matches weight. DEC-88 57 acts given rungs; effect outside record → full dialog.
- DEC-89 reason to escalate; "decline to escalate" act.
- DEC-90 docked assistant panel; machine-work treatment.
- DEC-91 onboarding deferred.
- DEC-92 origin mark replaces trust ladder. DEC-93 action plan surface moved to Actions session.
- DEC-94 reminders only on request; overdue once; no outside channel.
- DEC-95 capture grade told at capture; held captures. DEC-96 acceptance and flags.
- DEC-97 held-captures list, bulk acts. DEC-98 empty/loading/failed/waiting. DEC-99 WCAG 2.2 AA; language.
- DEC-100, DEC-116 docket, standing, withdrawal. DEC-101 "What changed" statement; watch other teams' editions.
- DEC-102 credit level before signing; "by name" = handle. DEC-103 lens statements printed. DEC-104 hunch never in strength. DEC-105 project bar shipped with plain meanings.
- DEC-106 two spaces, banded in-between, path marker.
- DEC-107 "To do". DEC-108 doorbell inbox like email. DEC-109 claim page truth about hosting account. DEC-110 queue kinds, re-sort, collapse.
- DEC-111 "working on" notices; directory believeincities.org. DEC-112 public page, complete edition, case file; import/recreate.
- DEC-113 litigation hold of transcripts. DEC-114 "Matters". DEC-115 action sketches bind.
- DEC-117 lens closing sentences. DEC-118 the group leads; "Made with…". DEC-119 off-the-record material may support a case.
- DEC-120 wizards and labelled drafts. DEC-121 wizard libraries. DEC-122 phone, themes, nothing from outside.
- DEC-123 design principles page approved. DEC-124 name "Civicsmith". DEC-125 brand and voice. DEC-126 plumb-bob symbol. DEC-127 translation by groups.
- DEC-128 three rings. DEC-129 wide path, eight rules. DEC-130 every wizard written. DEC-131 (ds) "Status", "hint". DEC-132 welcome fits the team.
- DEC-133 website key, join link. DEC-134 one administrator enough. DEC-135 check by expertise. DEC-136 court reach; private notes.
- DEC-137 (ds) journeys as listed (27); one action journey. DEC-138 (ds) visual language. DEC-139 (ds) frames, rail, Home doors, registry, 17 scripts, no-assistant rules. DEC-140 (ds) "Show me where", Alt+Shift+W. DEC-141 (ds) held captures show whose question.
- DEC-142–146 (ds): expunge and short name Irreversible; notes deletable; provision words; one-line description.
- DEC-147 publish at a set time. DEC-148 wizard library approved. DEC-149 "your group's Civicsmith". DEC-150/151 places without rules. DEC-152/153 help with writing. DEC-154 every screen's path. DEC-155 (ds) rail width. DEC-156 connecting a Claude subscription by link and pasted token. DEC-157 translation process.
- DEC-158–164: copying wizards (ds); explanations, hover delay, two levels; Find in this (ds).
- DEC-165 (ds) security screen; DEC-166 counts by country, never addresses. DEC-167 (ds) archive files. DEC-168/169/173 file risk, safe view, opening high-risk originals.
- DEC-170 (ds, replaced by DEC-181) expunge on phone. DEC-171 (ds) assistant settings screen name. DEC-172 members may bring own account unless "keep our material away from AI".
- DEC-174 (ds) every act's button explains itself. DEC-175 nothing hidden; two timings. DEC-176/177 (ds) table rows; one explanation.
- DEC-179 (ds) word list `words.json`, protected words. DEC-178, 180, 183, 185, 187 photos: bystanders obscured; Photos step a gate.
- DEC-181 (ds) Irreversible acts done on larger screen. DEC-184 (ds) handle field. DEC-186 → replaced; DEC-195/196/197 handle fixed at joining, never reused.
- DEC-188/189 (ds) who pays for the assistant; one panel; exploring limits.
- DEC-201 (ds) the way in drawn whole. DEC-202 (Bob K3060/K3061 via ds) team page front door, device trust, recovery codes, walk-through. DEC-203 (ds, BOB delegation) People screen. DEC-204 Bob: the Civicsmith Screens artifact is the working document; Journeys page folded into it. DEC-205 (ds) drawing points.
- DEC-206 founding journey from civicsmith.org. DEC-207/208 signing ceremony in the interface; one button; reauth + device. DEC-209 records-request template. DEC-210, DEC-266 (ds) signing key kept on device or as a key file.
- DEC-214 (ds) plumb bob in screens; visual elements. DEC-215 (ds) AI cost over time; connection graphs. DEC-216 home as nerve centre. DEC-218 one Home, arrangement C. DEC-219 no email; four areas; no zero readings.
- DEC-221 opening line; American English. DEC-222 (ds) escalation stage names. DEC-223, DEC-225, DEC-247 civicsmith.org pages. DEC-226 release update as administrators' To do. DEC-227 (ds) "Help for my own situation" door.
- DEC-190–200, DEC-228–278 (ds, except DEC-254/255/270) drawing and word-keying passes.
- DEC-230 founder chooses own handle. DEC-231 (ds) stake in a matter. DEC-254 a member may write a reading herself (no-assistant conclusion). DEC-255, DEC-270 civicsmith.org listing rule.
- DEC-279 setup for a newly made administrator. DEC-280 buttons' four states; sounds off. DEC-281 "team", not "group".
- DEC-282–294 (ds; DEC-283 Bob) the live walk's fixes: installer, assistant settings, Members, first Home, plain member, jargon, file risk, security, People.
- DEC-295 only heavier acts carry the weight mark. DEC-296–300 (ds) run cost, assistant progress (K3602), layout/wording findings.
- DEC-301–400 (ds) keys; undrawn-controls census (DEC-374–378); 390px walk (DEC-316); DEC-333 month-first dates.
- DEC-401 federal offices (A now). DEC-404 places in layers after alpha. DEC-405 alpha without assistant. DEC-406 public registers unassisted in alpha. DEC-408 home address/phone only in member notes, never published. DEC-409 all meaningful connections; most direct path in first beta. DEC-410/411 (ds) drawn.
- DEC-415 Get ready / Check my account gate; DEC-416, DEC-426, DEC-430, DEC-431 (ds) installer drawn.
- DEC-417–453 (ds) T51/T52 words; AI providers (DEC-420/421, first beta).

**Owner decisions under Process4** (`process/decisions-owner.md` "The paused tranche T53"): one entry, "Start from main as it is. T53 stays where it is as history" (22 Nov 2026). It does not shape what a user sees.

## 8. Conflicts, gaps and what was not read

Conflicts between documents (higher-ranked or newer stands, per `process/ranking.md`):
1. **Navigation**: RM §12 "Seven categories" (Context, Search, New Developments, Monitoring, Communications, Projects, Settings; FA intro repeats them) vs DEC-139's rail (Home, Queue, Find, Add, Projects, People, Settings) and DEC-219's four areas. RM is rank 1 but its own front matter marks §12's platform "Platform (resolved, v4)" as describing the retired client (RM "Incomplete sections"); the categories themselves are not formally superseded by Bob. Needs ARCH's word.
2. **Trust levels**: RM §11 five-level ladder vs DEC-92 origin mark; RM is annotated with DEC-92, consistent. DR §10 "displays compliance status" vs DEC-92/96 "Meets standards" deferred.
3. **Administrators**: DR §1/§14 "at least two individuals"; MB §4.2–4.3 vs DEC-134 (recommendation, not a gate). DR §1 carries DEC-134's note; MB §4 too.
4. **Directory domain**: DR §10 believeinoakland.org → believeincities.org/<place> (DEC-111) vs civicsmith.org "Groups at work" listing (DEC-255, PB §5E). Two public directories exist in the rulings; their relation is not stated.
5. **Group vs team**: IC §L (DEC-281) says members read "team"; most canon (MB, PB, INV, IC) still writes "group"; DEC-149's "your group's Civicsmith" reworded to "your team's Civicsmith".
6. **Front door words**: "What brought you here?" (IC §R DEC-132; DEC-139 (3), five doors) vs "What happened?" (INV §7, six places; DEC-218, DEC-285; DEC-227 sixth door). Newer (INV, DEC-218) appear to stand.
7. **Founder's handle**: DEC-201 (1) "the founder's handle is admin" vs DEC-230 (K3265) founder chooses their own; `admin` internal only.
8. **Handle change**: DEC-186 (changeable until first publication) replaced by DEC-196/197 (fixed at joining); IC §V records both.
9. **Phases vs stages**: RM §10 five phases; MB §7 project lifecycle forming/investigating/matured/closed; DEC-79 stage bars; INV §3 "quiet" is "a display, not a stage". Which names members see is not fixed in the founding texts read.
10. **Email**: RM §12 Settings lists "Notifications"; MB §8.1 leaves email transport "Bob's (D-98)"; DEC-219 settles "does NOT email members", DEC-94 no outside channel.
11. **Assistant availability**: canon (IC §P/§R, AI §6, INV §6) designs the assistant throughout; DEC-405 says the alpha has none. Journeys must be walkable unassisted first.
12. **AI providers**: AI §6 names Anthropic accounts only; DEC-420 designs many providers for the first beta.
13. **Rung names**: IC table "attested"; DEC-280/295 use "Signed" and "Outward" weights; the mapping of "Outward" to a rung is not in IC's ladder.
14. **Classification fact/analysis/judgment**: DR §6 and FA Layer 2 Function 3 require it; DEC-380 mentions Bob's 2026-07-27 removal of that classification and K4169 (not read).
15. **IC's own status**: filename v0_1, body v0.2; falsifier "outcome unrecorded"; §P letter collides with §P Proposal (IC "Incomplete sections").

Gaps:
- **Onboarding/starter materials** (DR §11) deferred (DEC-91); no first-session design of record beyond the welcome wizard's first version.
- **Action-plan publication** deferred (DEC-25); **root of trust** deferred (DEC-2, MB §9).
- **Assistant flow** (FIND end to end, prompt entry, pilot wizard) designed but not built (AI §5, §8); EXTRACT review surface undesigned (AI §7.3 (7)).
- **Standards catalogue by audience** owed (PB §7); project bar has "no audience guidance" (DEC-105).
- **Authority of design-session rulings**: many DEC entries are decided "by the design session (P17)" under delegation, not typed by Bob; `CLAUDE.md` counts only Bob's own typed messages as his decisions. Their rank (DEC-n = rank 2 per `process/ranking.md`) should be confirmed by ARCH.
- No Process4 owner decision yet bears on UX (`process/decisions-owner.md`).

Not read, or skimmed:
- Skimmed: MB (§§1–7.3, §7.14, §8), PB (§§1–2, §5–§6, §7 start), CM (naming, frame, §4a), ACT (§§1–4 rules 1–12, §7–8), DIST (§§1–5); INV in full.
- DEC: all 397 headings indexed; about 60 entries read in full.
- Archived DEC-1…DEC-67 (`docs/archive/ledgers/DECISIONS-2026-08.md`) not opened.
- Binding pages outside this brief, next to read: `docs/development/ux-substrate/` (design-principles DEC-123, brand-and-voice DEC-125, measures-map DEC-82, visual-language DEC-138, journeys, layouts, `screens/registry.json`, `library.json`, `words.json`); the Screens artifact (DEC-204); `NOTIFICATIONS.md`; `ASSISTANT-PILOT.md`.
