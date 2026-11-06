# W5: the ux lane's claude.ai artifacts, read whole (6 Nov 2026)

All nine reads succeeded. Four were too large to return inline (the UX substrate, Journeys, Visual language and Screens). For those, the saved HTML files were converted to text and read. The Screens viewer's embedded registry (`const REG`, 91 screens) and its per-screen mockup selectors were parsed from the saved file. Nothing was published, edited or commented on.

Citation form: **[Artifact § heading/anchor]**. Quotes are verbatim.

---

## 1. The UX substrate: https://claude.ai/artifact/JsPZAftab91EL9Ut91qWGx

- **Title:** "Civicsmith UX Substrate" (h1 "The UX substrate"). Version 1791243948-7c21, 860 KB, with 5 published files.
- **As of:** "main @ c1a27e41a5 (T11–T19 built; the Action layer built at the plane, with no member screens yet); Bob's rulings DEC-1–DEC-95 and K-rulings to K859". The header is **stale**: the body cites DEC-96…DEC-131 and K1471/K1473.
- **Purpose:** "What a Civicsmith member sees and works with, as the approved requirements and Bob's rulings define it today, and everything a designer needs to build its experience on."
- **Structure:**
  - **Part 1, For Bob:** #overview, #needed, #settled. The settled part has Words, OQ1–OQ36 and "Other rulings that shape what members see".
  - **Part 2, Design inputs:** #audiences, #usecases (172 UCs, 12 with no requirement), #experience (journeys (a)–(k), step by step), #screens, #weights, #words, #display (display primitives).
  - **Part 3, Reference:** #constructs (families 2–11), #roles, #flux, #disagree.
  - Header pills: "0 decisions still yours · 34 questions settled · 1 deferred · 24 constructs built · 27 built, with gaps".

**Canon to hold**
- **Overview [Substrate #overview]:** Evidence → Judgement → Publication and action. "the assistant finds, proposes and drafts, but a person makes every judgement and takes every act that commits the group." An action is addressed "to an office, an outlet or an organisation, never a private person." The requirements imply **38 screens**: 8 exist in the old interface, 14 in part, 16 never built. 230 acts, 158 with no control in the old interface.
- **Needed from Bob [#needed]:** "Nothing is waiting on you." OQ17 was folded into OQ36.
  - "Left to the design", settled by the designer without Bob:
    - scenarios as tabs or side by side;
    - branch drawing;
    - default reminder days;
    - how a nearing deadline changes the display;
    - the disposition chip for an undecided option (the view prints 'open'; ruling 7 says 'undecided'; 'done' and 'blocked' are not drawn);
    - where the matter page sits;
    - the hostile-response check's wording;
    - empty and loading states of the plan page, tray and Start preview;
    - how "describe it to the assistant" looks.
- **Settled words [#settled › Words]:**
  - "Rung" is the weight of an act: "can be undone, needs a reason, ends something, signed, cannot be undone". The sequence of acts (release, stand behind, ground, conclude, accept, ratify, publish) is the **path to publication** (K356).
  - **Finding** = a concluded question. The queue class is shown as **Noticed** (K356).
  - Project stages: forming, investigating, matured, closed. Three are computed; closing is the owner's reasoned act (K356, K362).
- **Settled design questions [#oq1s–#oq36s]:** all marked Settled except **OQ11, which is Deferred** (DEC-91).
  - OQ1, contradictions (DEC-76/77/84/85)
  - OQ2, a knock (DEC-78/88)
  - OQ3, stage and readiness bars (DEC-79, K362/364/904)
  - OQ4, the ceremony, five steps, browser key (DEC-80/81)
  - OQ5, strength phrase against the bar (DEC-82)
  - OQ6, Undetermined and its four neighbours (DEC-86)
  - OQ7, friction by rung, six judgement calls (DEC-87/88)
  - OQ8, no significance or priority field; decline to escalate (DEC-89; amended by K1471/K1473: a machine "hint" only in the hypothesis layer)
  - OQ9, the plan page (K590, K608(4))
  - OQ10, the docked assistant panel (DEC-90)
  - OQ11, onboarding, **Deferred** (DEC-91). Comes back when the redesigned surfaces are built and stable, or Bob asks.
  - OQ12, origin mark (DEC-92/96)
  - OQ13, the grade note shown once; Held captures (DEC-95/97)
  - OQ14, reminders without nagging (DEC-10/69/70/94)
  - OQ15, one vocabulary for empty, loading, failed and waiting (DEC-86/94/98)
  - OQ16, WCAG 2.2 AA and languages (DEC-99)
  - OQ18, "What changed" required (DEC-101)
  - OQ19, crediting levels: group, project, cover, name (DEC-102)
  - OQ20, the lens printed (DEC-103)
  - OQ21, hunches (DEC-104)
  - OQ22, the project's bar (DEC-105)
  - OQ23, withheld whole (K903)
  - OQ24, privacy-fence frames (DEC-106)
  - OQ25, our missed deadlines are never findings; 'To do' (DEC-107)
  - OQ26, the doorbell (DEC-108)
  - OQ27, the 'Who controls this copy' card (DEC-109)
  - OQ28, the queue's three kinds To do / Noticed / Status (DEC-110, DEC-131)
  - OQ29, the network and 'working on' notices (DEC-111)
  - OQ30, three forms of a case (DEC-112/119)
  - OQ31, the litigation hold (DEC-113)
  - OQ32, 'record', not 'bundle' (K899)
  - OQ33, the old app frozen (K633)
  - OQ34, 'Matters' (DEC-114)
  - OQ35, which Action sketches bind (DEC-115)
  - OQ36, the docket (DEC-100/116, K1480/K1493)
- **Other rulings [#settled › Other rulings]:**
  - the refusal pattern (DEC-83)
  - the 13 contradiction points (DEC-84)
  - unseen conflicts (DEC-85)
  - sources and self-registered keys (K509)
  - the Action layer's shape and D1–D6 (K590)
  - a plan closes only by a member (action-plans R20)
  - an unestablished premise (K600/K608)
  - the venue sets the standard of evidence (K597)
  - good faith and opposition (K597)
  - deferred: certification and joint action
  - confidential referral
  - the old UI and release cuts (K633)
  - the assistant's planning suggestions, best 5 then the next 5 (K660)
- **Screens [#screens]:** per-screen rules in the form Must show / Must never / **States to design** / Primary acts. For example, the Queue's states: Undetermined, Withheld, Refused, Truncated, Empty (**Open**), Loading (**Open**), Stale, Conflict, Ungrouped.
  - The "Every screen the requirements imply" table lists 38 screens with their build status: Queue, Question workspace, Reading review, Project stance, Document page, Add/capture, Review holding area, Finder, Subjects, Flows, Themes, Leads and observations, Plans list, Project directory, Case editor, Review copy, Publication ceremony, Published case, Standards and determinations, Consequences, Action page, Escalation, Monitoring, Assistant, Group lens, Goals, Inbox, Members and keys, My account, Setup page, Contradiction inquiry, A source and its disclosures, A source's consent by knocker secret, Conflict notices, Action plan, Assistant tray, Start and send, Matter page.
- **Weights [#weights]:** friction follows the rung (DEC-87).
  - Can be undone happens inline. Needs a stated reason opens a reason field in place. Ends something and Signed open a full dialog. Cannot be undone goes only through the ceremony.
  - DEC-88 graded 57 acts: 26 reversible, 29 reasoned, 2 terminal.
  - The six high-friction judgement calls: choose attribution, share to a project, register a subject, set the group default bar, and have the assistant work the objective (the lightest, with a reason field in place). Proceed on an unestablished premise, start a chosen option, and approve a filing or communication also open full dialogs.
  - "25 acts here show Weight not yet set … treated as needing a stated reason".
- **Words [#words]:** a glossary of terms, internal names and confusables, with 126 marked "working name". Display primitives [#display] list the canonical marks (Undetermined and its four neighbours, letters A–D, strength pair and bar, progress bars, weight marks, Machine work, origin mark, tension mark, co-attested, and others).
- **Flux and disagreements [#flux, #disagree]:** decided but unbuilt items. For example: DEC-88's rungs not yet in the plane (71 ops undetermined in code); 14 write ops with no rung, **"BOB's to assign"**; decline-to-escalate "owed, for Bob's approval"; no release cut until Bob says (K633).

---

## 2. Design principles: https://claude.ai/artifact/MvsMPnJnk3o32FBeqgdxT1

- **Title:** "Civicsmith Design Principles". Version 1791245205-92e1; private.
- **Status line:** "Design phase · step 1 of 5 · APPROVED by Bob, 3 October 2026 · the product renamed Civicsmith the same day · 8.5 amended 4 October (DEC-127) · 3.11 added 6 October (DEC-136)". Also: "A principle changes only by a later ruling."
- **Purpose:** "the yardstick every screen in steps 2 to 5 is checked against."
- **Structure:** nine families, 58 principles, and "Gaps, now ruled" (G1–G5). The footer cites DEC-24…DEC-118 and K1. Repository copy: docs/development/ux-substrate/design-principles.html.

**Every principle, verbatim (name, then statement)** [Principles § family]

**1. Respect the member**
- 1.1 Never nag, never second-guess: "In your words: “the workflow must not be nagging or second-guessing users… Anything short of that is a flaw.” Informing at the act, once, is respect; repeating it is not." (DEC-69)
- 1.2 Nothing chosen for a member unseen: "Any default is visible and changeable at the moment it applies. Nothing is preselected behind the member's back." (DEC-77; DEC-94(1))
- 1.3 Reminders are the member's own: "A reminder exists only because a member asked for it. "Overdue" is the one thing said unasked, once. Nothing reaches a member outside Civicsmith: no email, no push." (DEC-94, DEC-10)
- 1.4 Absent, not greyed: "What a member cannot do is not on their screen. The system still refuses it underneath, but the screen should make the refusal unnecessary."
- 1.5 You are who you signed in as: "No screen asks who you are, and no one can act as anyone else."
- 1.6 The member's words stay the member's: "The machine may shape and propose. Every reason, conclusion and signature is a member's own." (DEC-24, DEC-60, DEC-101)

**2. Simple on top, depth beneath**
- 2.1 Minimum visible complexity: "Simple interfaces even when the domain and the system are complex, with layers: simplicity at the top, more detail as a member drills down."
- 2.2 Show what matters at this level: "What carries weight at one level may be irrelevant at another. Relevant state always shows, named so a newcomer can learn it, signalled with colour, with its consequences: what it allows and what it forbids."
- 2.3 See connections at the right level: "Don't be myopic: let members see how things connect, at the level where the connection matters."
- 2.4 Organised the way members think: "Data, layouts and journeys follow how members think about the task, not how the system is built. The most common actions are the easiest to reach."
- 2.5 Density is signals, not cramming: "In your words: “Information density is not less whitespace; it is signals.” Colour, chips, type, hovers, menus, collapsibles and space, each drawn from deliberately."
- 2.6 Zoom out as easily as in: "A member focused on a detail can, once it is sorted out, step back to the big picture in one move, and land where that detail sits in it."

**3. Tell the truth about the record**
- 3.1 What we don't know is shown: ""Undetermined" is an answer, never an error. It always comes with its reason." (DEC-86)
- 3.2 Five gaps, five names: "Undetermined, Withheld, Unrated, Nobody looked and Refused each have their own look and one sentence pattern, never borrowed from another."
- 3.3 One vocabulary for ordinary states: ""Nothing here", "Still loading", "Could not read this, because…". Every wait names what, from whom, and by when." (DEC-98)
- 3.4 Never one score: "Strength is two grades side by side, how well the documents are held and how firmly they are linked, never combined." (DEC-44, DEC-82)
- 3.5 Each kind of measure has its own form: "Letters grade evidence, bars show progress, weights mark acts; no form is borrowed across them. Colour marks which scale, never how good the value is."
- 3.6 A grade is about checking, not truth: "A grade says how easily someone else could check the thing for themselves, never whether it is true."
- 3.7 History is the record: "Corrections are added, never erased. Nothing on screen implies deletion where the system corrects by adding." (DEC-116)
- 3.8 Change weighs as much as state: "What changed, is changing, or is about to change gets the same weight as what is."
- 3.9 Trust signals are always visible: "Where something came from and how far it is trusted show without asking." (DEC-92, DEC-96)
- 3.10 What you may not see is withheld whole: "No title, no count, no hint of what is hidden; at most, that something was withheld." (DEC-36; K903(4))
- 3.11 Never claim more protection than there is: "What Civicsmith keeps from the public and from the people a group examines is said plainly, and never called beyond reach: a court order the group cannot defeat can still require anything not public to be shown. Screens say "not public" or "only you can see this", never "secret" or "confidential", and the explanation is one hover away. Each group's administrator chooses whether members are also told when they join and the first time they record something not public. Civicsmith holds as little as it can." (DEC-136)

**4. Weight is felt**
- 4.1 The tool fades; the work stays in focus: "In your words: the tool should “fade into the distance so that users' focus is where it belongs — on the work”, while members still “appreciate the weight of the work they're doing”." (DEC-87)
- 4.2 Friction matches weight: "Reversible acts happen inline. Reasoned acts ask for a reason in place. Terminal and attested acts open a full dialog saying what ends and who signs. Irreversible acts only go through the publication ceremony." (DEC-87, DEC-80)
- 4.3 Weight is read before the click: "Every act's button carries its weight's name and mark." (DEC-87, DEC-82). **Since amended by S26/DEC-295 in Screens; see the contradictions section.**
- 4.4 Consequence in the world raises friction: "An act whose effect cannot be taken back outside the record opens the full dialog stating that effect, whatever its weight." (DEC-88)
- 4.5 Outward acts say so at the act: "Anything that becomes visible outside the group says so at the moment it is taken." (DR-13; DEC-111)
- 4.6 Refusals teach: "A refusal names what is wrong and why, in the member's own terms. Never "something went wrong"." (DEC-49)

**5. Always know where you are**
- 5.1 Two spaces, two frames: "The working record and the published record each have their own distinct frame. Publishing is the only crossing." (DEC-106)
- 5.2 In-between material is labelled: "Review copies and outgoing drafts sit in the working frame, with a band saying what they are and who can see them."
- 5.3 Every case shows its path: "Each document and case carries a small marker of where it stands on the way to publication."
- 5.4 Another group's work is marked and read-only: "A case imported from another group arrives in its own read-only project inside the working space. It carries the other group's name and its origin mark wherever it appears, and nothing in it can be edited. Its look always tells confirmed findings from unconfirmed ones: the system recreates each finding from the case file, and a finding that has not been recreated never looks like one that has. Using it in the group's own work is a further act: the group may accept what was recreated." (DEC-112, DEC-92, DEC-96, DEC-46(3))

**6. The machine looks; the member concludes**
- 6.1 The assistant proposes, never concludes: "It finds, pursues, extracts and checks. It never concludes, signs, sends, or chooses the question." (DEC-24/55/60)
- 6.2 Machine work looks like machine work: "Everything the machine produced carries one shared treatment, with who asked for it." (DEC-90)
- 6.3 Docked beside what it serves: "The assistant is a panel docked beside the screen it serves, which a member can widen; some of the work always stays visible. It never floats over the work." (DEC-90, DEC-99)
- 6.4 A wizard points; the member presses: "A wizard step highlights the real control and never presses it. It may place a labelled draft in a field for the member to edit and adopt; the act itself is always the member's." (DEC-120 G5)
- 6.5 No shortcut past an act's safeguards: "Anything the assistant starts still goes through the act's own checks, reason and receipt."
- 6.6 Any multi-step journey can be walked with a wizard: "A wizard takes the member through the real screens, one step at a time: it opens each screen, says what to do there and why, checks the step is done, and moves on. It runs from a wizard script for every group, with no AI needed; the assistant can also plan one on the fly. A step may place a labelled draft in a field for the member to adopt; only the member presses the act's button. Abandoning a wizard is a non-event." (DEC-120 G4/G5; DEC-27)
- 6.7 Wizards are found where they start, and kept working: "Wherever wizards begin, a standard mark sits in a standard place: hover shows the wizards that start there and how often members finish them; a click starts one, or records a new one from there. Members author by recording a walk-through or asking the assistant; the wizards the product depends on are required and must always work; a broken optional wizard is withdrawn until fixed, never shown broken. A script says what to do, never what to conclude." (DEC-121)

**7. Alive, not noisy**
- 7.1 Alive means live: "When something visible changes, the screen shows it promptly, as long as the update doesn't disrupt what the member is doing."
- 7.2 Motion only when action is needed: "Movement is used sparingly, only when a member needs to act."
- 7.3 Urgency changes the display, not the volume: "As a deadline nears, an item's position, colour or wording may change. That is display, not a notification." (DEC-94(2))

**8. For everyone**
- 8.1 Accessible to the international standard: "Every member screen and every published form (page, print and file) meets WCAG 2.2 at level AA, checked as each screen is accepted." (DEC-99)
- 8.2 Colour is never the only signal: "Every colour has a word, icon or texture beside it."
- 8.3 Every hover also opens on focus or tap: "Anything explained on mouse-over is also reachable by keyboard and by touch."
- 8.4 Usable in one session: "Someone with no civic experience can understand and use it within one session." (DR 11; DEC-82; DEC-91)
- 8.5 Every member in their own language: "The interface's words live in one place. Each member chooses their language; a group may translate the interface for its members, with the assistant drafting and a member who knows the language adopting each word. The group's own writing can be read in a member's language as a labelled machine translation, the original one tap away. Signed records stay in the language they were signed in, and a translated case is never presented as the signed case." (DEC-99; DEC-127)
- 8.6 Every device, honestly: "Phones, tablets, laptops and desktops each have their own possibilities and limits; a feature may be absent where it does not fit. On a phone a member reads everything and does everyday acts, including capturing a document; signing, publishing and sending happen on a larger screen for now, and the phone says where to finish." (DEC-122 G1)
- 8.7 The public reads least, so explain most: "Layered explanation matters most on the published case. The complete edition carries every layer, so anyone can review or recreate the case without Civicsmith." (DEC-112)
- 8.8 Light and dark: "Member screens come in light and dark, following the device's setting, with a choice in settings. The public case follows the reader's setting on screen; print and the complete edition are always light." (DEC-122 G2)

**9. One product, many groups**
- 9.1 One design language, one source of meaning: "One visual language throughout. What each state means is defined once, so it looks and reads the same wherever it appears."
- 9.2 No city in the product: "Outward text names the group and Civicsmith. Local facts (holidays, offices, laws) come from the group's own profile." (K1)
- 9.3 The group leads: "On every public face the group is the publisher and signer. Civicsmith is credited quietly. Believe in Cities appears only as links." (DEC-118)
- 9.4 The same for one group or a thousand: "Nothing in the design assumes a single group or a central host."
- 9.5 Built to evolve: "The workflow will change as experience and requirements grow; the design leaves room for it."
- 9.6 Nothing loaded from outside the group's copy: "Everything the interface needs (typefaces, icons, scripts) ships inside the group's own copy. No outside fonts, analytics or trackers, on member screens or the public case." (DEC-122 G3; DEC-31). **It still uses the word "copy" after DEC-149.**
- 9.7 Your standard: "Clean, self-evident, functional and consistent with the brand. Extra effort and outside-the-box thinking on every call; minimal-effort solutions are unacceptable."

**Gaps, all ruled [Principles #gaps]:**
- G1: a phone can do everyday acts. Now principle 8.6.
- G2: light and dark, yes. Now 8.8.
- G3: nothing loaded from outside, yes. Now 9.6.
- G4: wizards without the AI, yes. Principle 6.6.
- G5: labelled drafts in fields, yes. Principles 6.4 and 6.6.

---

## 3. Brand and voice: https://claude.ai/artifact/EipzYKnNxe5LG3YwWnTkpv

- **Title:** "Civicsmith Brand and Voice". Version 1791312701-a394.
- **Status line:** "step 2 of 5 · APPROVED by Bob, 4 October 2026 · revised for the name Civicsmith (DEC-124) · words and naming amended 5 October … (K1483–K1488, K1491) and DEC-131 · words for policies and standards added 6 October (DEC-145); one line saying what Civicsmith is (DEC-146); "your group's Civicsmith" replaces "your group's copy" (Bob, DEC-149); translation amended (DEC-157)".
- **Approval:** approved in full 4 Oct (DEC-125 to DEC-127). Step 2 is complete.
- **Structure:** 1 Who speaks, 2 Names, 3 Voice, 4 Tone by moment, 5 Words, then the answers V1–V4. Repository copy: docs/development/ux-substrate/brand-and-voice.html.

**1. Who speaks [Brand #who]**
- 1.1 The group leads: "Everything public is the group's: it publishes, it signs, it is accountable. Its name heads every public page and every member's workspace." (DEC-118)
- 1.2 Civicsmith is the tool, credited quietly: "Civicsmith appears as a small credit, never as the publisher, and never speaks for the group." The credit reads "Made with Civicsmith".
- 1.3 Believe in Cities is the network: "Inside Civicsmith it appears only as links to its directory and forum, and in the "working on" notices sent there."
- 1.4 Two voices: "The group's voice is the words the group writes … in its own "we". Civicsmith's voice is the interface's words: labels, explanations, refusals and the assistant. Civicsmith never says "we" on the group's behalf, and the group's words are never rewritten by Civicsmith."

**2. Names [Brand #names]**
- 2.1 Civicsmith: "One word, only its first letter capital. Never "CivicSmith", "Civic Smith", "CIVICSMITH" or "the Civicsmith". In lower case only in addresses and identifiers (civicsmith.org). It is software, never an organisation, a firm or a person: "made with Civicsmith", never "Civicsmith says" or "Civicsmith found"."
  - The credit links to a page that says it is “Free software for groups that check whether government keeps its own rules and promises”, with the longer line “Neighbourhood and issue groups, newsrooms, professional associations, and public offices checking their own work” (DEC-146).
- 2.2 Your group's Civicsmith: "Never "copy" …, "instance", "plane" or "server"." "Installation" is used only where the hosting is the subject (DEC-149).
- 2.3 The group's two names: the display name leads; the short name (slug) appears in addresses and beside signatures.
- 2.4 No city in the product: "Civicsmith's own words never name a city, county or state."

**3. Voice, seven traits, verbatim [Brand #voice]**
- 3.1 Plain: "Everyday words and short sentences, naming things as members know them. A term of art is used only when it is the right word, and then explained once, where it appears."
- 3.2 Exact: "Dates, numbers, names and sources, not adjectives. "Show your work. Always.""
- 3.3 Calm, especially under pressure: "Weight is carried by clarity, never by alarm. No exclamation marks, no capitals for emphasis, no red-alert words. You chose "pressure" over "attacks" for the same reason."
- 3.4 Honest about limits: "Says what is not known, and why, in the five fixed terms. Never guesses past a gap or softens it."
- 3.5 Respectful: "Informs once and trusts the member. No praise, no scolding, no "Are you sure?": instead, it states what the act does, and lets the member decide."
- 3.6 Neutral on policy: "Civicsmith's words take no position on what policy should be and never characterise a person or office. Words like "breach" appear only where a member's determination put them."
- 3.7 Disciplined output, human members: "Members may be angry, and their own notes may say so. What Civicsmith writes, and what it helps the group publish, stays disciplined."

**4. Tone by moment [Brand #tone]**

| Moment | Tone | Example |
|---|---|---|
| Everyday work | brief | “Tagged.” |
| A weighty act | states the consequence and who signs | |
| A refusal | teaches what, why and the way forward | “Can't sign yet: finding 2 rests on testimony…” |
| Waiting and empty | factual | |
| Something failed | owns it | |
| Pressure and legal threats | steady, procedural | |
| The assistant | modest, labelled machine work | |
| A wizard | step, what, why | |
| The public reader | explains from zero, never selling | |

**5. Words [Brand #words]**
- **Use:**
  - group, member, administrator, owner
  - project, question, finding, case, edition
  - document, capture, record (not "bundle")
  - matter (on a plan), action, determination
  - To do, Noticed, Status ("Status" replaced "Signal", DEC-131)
  - the connection kinds: positions and memberships; ties; took part; money; event links; law links; owes; mentioned together; same person?; overlaps; a "Connections" place; "Explore connections"
  - events; timeline with lanes "what they did" and "what we did"
  - money words by context: proposed/adopted/amended; committed/spent/paid; billed/collected; "money trail"
  - people, members, sources; position, career, credentials, memberships, interests; person page
  - hunch (a member's), hint (the machine's), hypothesis: never evidence
  - "claimed the same person, grade B, because …"
  - Undetermined, Withheld, Unrated, Nobody looked, Refused
  - wizard, wizard script, the assistant
  - your group's Civicsmith; "installation" only about hosting
  - Stated, Reported, Proven ("working on" notices)
  - a provision's force: "Requires/Recommends/Allows"; for a policy, "Required" or "At the discretion of <office>", with "criteria stated"/"no criteria stated"
  - "Standard · binds <body>" beside "Benchmark · not binding on <body>"; against a benchmark, "slower than", "below"
  - "Cited, not seen" and "Looked for, not found"
  - "Changed without notice"
  - a standard's access: "Free to read", "Reading room only", "Behind a paywall"
  - "Discretion used by <office>, <date>"
  - a policy always with its owner
- **Avoid:**
  - "user", "content", "data" for people and their work
  - "instance", "plane", "op", "token" in member text
  - "copy" for a group's Civicsmith (DEC-149)
  - "claim" on public pages
  - "Submit"
  - "Oops", "Something went wrong", "Are you sure?"
  - "AI" as a label
  - characterising words ("corrupt", "illegal", "fraud")
  - exclamation marks and capitals for emphasis
  - "knows", "network", "conflict", "suspicious", "most connected"
  - "most"/"largest" without naming the quantity, scope and period
  - "ledger", "diverted", "misused"
  - "is the same person"
  - "secret", "confidential", "safe" for anything not public
  - "signal" in member text
  - "violated"/"nonconforming" against a benchmark
  - "policy" without its owner; "practice" in Civicsmith's own words
  - "confidential" for a policy kept from the public
- **Addressing people:**
  - The member is "you" and the group is "your group".
  - Other members are named by handle.
  - Actions go to offices by role, showing who holds the office that day, "never to a person".
  - Dates are written out ("14 October 2026"), and times carry their zone.

**Answers [Brand #qs]**
- **V1, the mark: D, the plumb bob** (DEC-126). "the cap, collar and peg stay in every version". The source is marks/civicsmith-plumb-bob.svg. A trademark-search check of the proportions is **owed in step 4**.
- **V2:** a group may add its own logo, optional; the name always appears in words too (DEC-125).
- **V3:** the assistant says "I" in conversation and is "the assistant" in labels and records; it never says "we" (DEC-125).
- **V4, translation** (DEC-127, amended by DEC-157):
  - The administrator grants translation per language to named members.
  - A protected word that is changed from the assistant's draft waits for a second speaker or a back-translation.
  - Official names stay as they are.
  - Text going to an office is in the office's language.
  - Since K1502, the assistant runs on the member's own account. Since K1755, a group's API key can serve it too.

---

## 4. The new name: https://claude.ai/artifact/Fmr6rVd7GMifYDRaWcV7s8

- **Title:** "A New Name for CivicOS". Version 1791043177-d604; private.
- **Status:** "Design phase · before step 2 · DECIDED by Bob, 3 October 2026: Civicsmith (DEC-124)". Bob's words: "Civicsmith it is. I'll get the domains."
- **Purpose:** to replace CivicOS, which other projects already use. The first-round favourite, Plumb, was also taken.
- **Structure:** How people find it (four steps: hear and spell, search, type the address, store or GitHub); Six candidates (Civicsmith recommended; Heedwork runner-up; Factstand, Casesmith, Heedfast, Casestead); Set aside (about 25 names with reasons); Recommendation; Brand check (length, power, welcome, ease, judged per audience); Before the mailing list; What follows a choice.
- **Decision and status:**
  - **Decided** (DEC-124). "What this is not: A trademark search. A lawyer's clearance search comes before the name is registered or announced."
  - **Owed or awaiting Bob:**
    - register civicsmith.org/.com/.app/.net;
    - a lawyer's clearance search for US classes 9 and 42, then a decision on filing;
    - claim the GitHub org and social handles ("I couldn't check GitHub from here");
    - optionally a holding page.
  - Code renames go to the development process "as one handoff". Records already signed keep their old labels.
- **Brand cautions:** the name "promises craft, not ease", so ease must come from the product. The credit must show it is software (handled by Brand 2.1 and DEC-146).
- **Stale:** the recommendation text says "your group's copy of Civicsmith", which DEC-149 superseded.

---

## 5. Journeys: https://claude.ai/artifact/9hNPVCMcT8eyewWqKXfgSu

- **Title:** "Civicsmith Journeys". Version 1791312700-247c, 412 lines.
- **Status:** "step 3 of 5 · SETTLED by Bob, 6 October 2026 (DEC-128 to DEC-137) · re-checked against the stage under way, 5 October · updated 6 October" (the group's API key; policies and standards).
- **Structure:** 1 Who (three rings), 2 The wide path (8 rules), 3 Where members start, 4 Twenty-seven journeys, 5 Seventeen wizards, 6 Gaps to close, Questions.
- **Superseded in part:** Screens says step 3 was "folded into this page October 13", and its wizard library has grown to 23.

**Audiences [Journeys #who] (DEC-128)**
- **Inside, members:** newsroom staff (a core audience, added 5 Oct), newcomer member (the centre of gravity), experienced investigator, professional member, project owner, administrator (including installer and founder), the group's future members.
- **Invited in:** outside reviewer, the group's lawyer.
- **Outside:** someone handing over material, public reader, journalist outside the group, partner group, government office or official, oversight body.
- **Folded in:** operator and founder, project participant, residents addressed by an action, the assistant (an actor, not an audience).
- **Kinds of group:** professional, issue-specific, neighbourhood or community, catch-all. "a public body itself may run Civicsmith."

**The wide path, eight rules [Journeys #wide] (DEC-129)**
1. A front door in every journey.
2. Wizards on the main roads, never gates.
3. You can always see where you are.
4. Explained where it appears, and findable again.
5. Heavier steps slow you down.
6. Any order, and pick up where you left off.
7. Many front doors.
8. Fast for those who know.

**Where members start [Journeys #start]** (decided as J6 under DEC-137)
- **Problems first:** potholes, illegal dumping, a franchise, police overtime, services moved onto bond measures.
- **Then something read:** a person, a law or code, a court case, a news story, a budget, a payment or contract, a public meeting, a contract or franchise, a regulatory proceeding, a dataset, a tip, another group's case.
- The home asks **"What brought you here?"** and empty projects offer "Start from…". **Superseded in Screens by "What happened?" (DEC-198).**

**The 27 journeys [Journeys #j1–#j27].** Each card gives Front door / Wizard / What changed / Built now / Still to come / Steps, with heavy steps marked.

| # | Journey | Verdict |
|---|---|---|
| 1 | A group gets going | Amended. 10 steps; the short name is Permanent; the group's API key or members' own accounts; a second admin is optional (owed) |
| 2 | The group says who it is and why | New; DEC-132 |
| 3 | A member joins and finds their footing | New |
| 4 | Connecting your own Claude account | New. "Outward" disclosure; subscription by pasting a code (DEC-156) |
| 5 | Declaring your own ties | New. Reasoned, then Signed |
| 6 | From a problem to a question | New; the most common front door |
| 7 | Getting a record: find it, or ask for it | Amended. Outward send; due date Reasoned; Oakland first |
| 8 | Checking a deadline's basis | New |
| 9 | Checking a claim about the city's performance | New. Recorded random draw |
| 10 | Following a person | New. Identity is "claimed … grade B", never merged; removal Terminal |
| 11 | Building a timeline | New. Two lanes; frozen at signing (Irreversible) |
| 12 | Following a money trail | New |
| 13 | Exploring connections | New |
| 14 | Following a court case or proceeding | New |
| 15 | From a question to a published case | Confirmed, amended. Vouch Signed; conclude Reasoned; ties Signed; ceremony Irreversible; publish at a set time |
| 16 | A professional lends expertise | New |
| 17 | Working with the assistant | Amended. Closed book; legal information, not advice |
| 18 | Asking a standing question | New. An end date is required |
| 19 | The daily queue | Amended. Hints hidden until the false-alarm rate is at most 20% |
| 20 | From a knock to the record | Confirmed |
| 21 | A review copy, out and back | Confirmed |
| 22 | From suspicion to a closed plan | Amended. Absorbs "acting on a finding" |
| 23 | A source changes after publishing | Confirmed |
| 24 | Complying with a court order | New. Openly, never silently |
| 25 | Exchanging cases with other groups | Amended |
| 26 | Reading and checking a case | New |
| 27 | Changing the administrators | Confirmed |

**Wizards [Journeys #wizards]**
- 17 outlined. **Required:** Set up and claim; Welcome a new member (final words once the redesign settles); Publication ceremony.
- **Optional:** Get a record, Check a claim, Your first question, Say who your group is, Invite a member, Connect your Claude account, Your ties, Follow a proceeding, Follow the money, Build a timeline, Keep asking this, Use another group's case, Translate the interface, Start and send.
- "The three required wizards must always work, or the release is held."

**Gaps to close [Journeys #gaps]** (kept per J10):
- invitation links for the website (DEC-133)
- one administrator (DEC-134)
- the group's kind (DEC-132)
- **a member's private note: marked "Open: yours (J11)" even though J11 is answered (DEC-136). Stale.**
- asking an expert (DEC-135)
- the assistant's account (K1755 corrects K1547)
- connecting a subscription (DEC-156; Anthropic's terms leave points **U-7 open**)
- a place not held (DEC-150/151)
- publishing at a set time (DEC-147)
- the screens, still design work

**Questions [Journeys #qs]**
- J1 → DEC-128
- J2 → DEC-129
- J5 → DEC-130
- J7 → DEC-132
- J8 → DEC-133
- J9 → DEC-134
- J11 → DEC-136
- J13 → DEC-135
- Design detail J3, J4, J6, J10 → DEC-137
- **All answered.** The header's "How to answer" box still carries stale text ("Four are design detail I will decide unless you object").

---

## 6. Visual language: https://claude.ai/artifact/QuvX7DzX7XbxS6SQG4MtT1

- **Title:** "Civicsmith Visual Language". Version 1792253831-7788, with 16 published files (fonts and others).
- **Status:** "step 4 of 5 · decided 6 October 2026 (DEC-138) · open to your comments". "Decided as a working version beneath those rulings … tested by use: step 5's screens are drawn in it … and what those screens show will change it."
- **Structure:** 1 The idea, 2 Type, 3 Color, 4 Shape, space and motion, 5 Icons, 6 The marks, 6a Explained where it appears, 7 Acts, 8 Frames, 9 The plumb bob, 10 What it replaces, 11 Checks.
- The stylesheet is generated by build.py from palette.json, tokens.head.css and components.css.

**Five rules [VL #idea]**
1. "Color always means something." Verdigris is for acting and for Civicsmith; rust is attention only; there is one hue per evidence scale; machine work and another group's work carry no hue (told apart by edge, mark and word).
2. "Three voices in type." Serif for words people wrote; sans for Civicsmith's words; mono only for identifiers a machine checks.
3. "Lines before shadows, and square corners." No pills.
4. "Still until the member is needed." The only motion is the wizard ring (Alt+Shift+W, "Show me where").
5. "Never color alone." WCAG 2.2 AA in light and dark.

**Type [VL #type]**
- Source Serif 4, Source Sans 3 and Source Code Pro (OFL), shipped inside the product as "Civicsmith Serif/Sans/Mono". Latin, Latin Extended and Vietnamese subsets, about 0.8 MB.
- Scale: 44 (published masthead), 34 (case title), 26 (page title), 21 (record title), 18 (reading), 16 (working default; every field), 14 (secondary), 13 (marks; the smallest size).
- Tabular figures everywhere. Line length at most 68ch.

**Palette [VL #color], light / dark:**

| Token | Light | Dark |
|---|---|---|
| ground | #EDEFE9 | #11181C |
| ground-2 | #E3E7DF | #172026 |
| surface | #F8F9F5 | #1A242A |
| sheet | #FDFDFB | #1E2930 |
| ink | #15222C | #E3E9E4 |
| ink-2 | #334149 | #C3CCC6 |
| muted | #55635E | #9AA7A1 |
| rule | #C3C9BE | #33414A |
| rule-strong | #7E877C | #73817A |
| accent (verdigris) | #2B6A5D | #74C2AE |
| accent-strong | #1D4E44 | #9AD8C7 |
| accent-tint | #E2EEE9 | #1C332D |
| on-accent | #FFFFFF | #0D1A16 |
| signal (rust) | #A23B19 | #EE9874 |
| signal-tint | #F7E9E2 | #3A231A |
| capture | #1F5C9E | #8DB9EE |
| connection (plum) | #8A2F6E | #E39BCB |
| testimony (ochre) | #865300 | #E7B865 |
| subject (olive) | #55621A | #BACB6B |
| stage | #3A587F | #93B1DC |
| ready | #2E6E4A | #7FCB9E |
| ident | #9B3355 | #EC93AE |
| machine | #4A5560 | #AEB8C2 |
| elsewhere | #4B4F7A | #AEB2E6 |
| focus | #1D4E44 | #9AD8C7 |
| kind-money | #773AC1 | #A473FF |
| kind-part | #0092C3 | #007BAA |
| kind-mention | #DF407F | #D5305F |

The four evidence scales also have tints (light / dark): capture #E3ECF7 / #1B2B40, connection #F4E4EF / #36202F, testimony #F7ECD9 / #352A15, subject #EDF0DC / #2A3016. Machine work's tint is #ECEEF0 / #232B32, and another group's work's is #E8E9F2 / #24263B.

**Space, shape and motion [VL #form]**
- Space uses a 4 px base: 4, 8, 12, 16, 24, 32, 48, 64.
- Radii are 0, 2 and 4 px.
- Shadows only on a dialog, a menu or the hold strip.
- Motion takes 120–200 ms with no bounce; reduce-motion means none.
- Layout: rail 184, dock 380, masthead 52, tap 44. Buttons are at least 40 px and phone targets 44. Focus shows a 2 px verdigris ring.
- The dark theme is "drawn, not inverted". Print and the complete edition are always light.

**Contrast rules [VL #checks]**
- 4.5:1 for text and 3:1 for lines and marks. All listed pairs pass in both themes; check_contrast.py runs whenever the colors change.
- The lowest values are the money and connection kinds against surface: kind-part 3.37 / 3.32, kind-mention 3.84 / 3.32, and rule-strong on ground 3.21 in light.

**Icons [VL #icons]:** 46 symbols on a 16-unit grid, each always beside its word.

**Marks [VL #marks]**
- Grades are one shape; the scale's color and icon name the scale and the letter gives the value.
- The five gaps have distinct looks:
  - Undetermined: dashed, a half circle, always "because".
  - Withheld: a redaction bar.
  - Unrated: an empty grade.
  - Nobody looked: a dotted lens.
  - Refused: rust, and it teaches.
- The origin family is Machine work (dotted), Another group's (double rule), Not yet evaluated, Accepted, Flagged, and "Found by search" (DEC-164). Ours carries no mark.
- Recreation states: Not yet checked, Recreated, Recreated in part, Did not recreate.
- The queue kinds (To do, Noticed, Status) are told apart by icon and word, not color. A Hint is machine work with its method and false-alarm rate. A Hunch is the member's own.
- Due dates: near turns rust, and "Overdue" is said once.
- The security level reads Ordinary, Raised or High (DEC-165).
- Ladders: stage is solid, readiness striped, identity dotted, and dashed means not yet evaluated.
- Other marks: the path marker, the tension mark, the hold strip, the wizard mark ("a walked path, never a gear"), and labelled drafts (dashed edge, "Draft from the wizard · edit it until it is yours").

**Explanations [VL #explain] (DEC-159/161/224):**
- Hover waits 0.5 s, stays while hovered, and closes 0.5 s after the pointer leaves. Focus and tap open at once; Escape closes.
- "The cursor never announces an explanation."

**Acts [VL #acts]**
- Reversible happens inline with an undo. Reasoned opens a reason in place. Terminal and signed open a full dialog. Outward is tagged. Irreversible goes through the ceremony.
- The short name and a legally required removal are the "two other acts that can never be undone".
- Primary buttons are verdigris; "the color says 'this is the act', not how heavy it is." Nothing is greyed out.

**Frames [VL #frames]:**
- Working: paper ground, the group's masthead, a band.
- Shared for review: a rust-tint band.
- Imported: a double-rule band.
- Test Civicsmith: a dashed band across the whole frame (DEC-240/249).
- Published: a clean sheet, the group's name large, "Made with Civicsmith".

**Mark in use [VL #mark]:** the wordmark is the sans at semibold, in one color (verdigris or ink). A group logo is at most 24 px tall.

**What it replaces [VL #replaces]:**
- civicos-ui/tokens.css, BIO_Design_Language_v0_2 (lost), the action sketches' look, and the measures map's placeholders.
- Connection moves from teal to plum.
- Mono is narrowed to identifiers.
- **Owed:** the stylesheet, the color file and its check, icons and typefaces in docs/development/ux-substrate/visual-language/; the measures map's specimens are "redrawn in this look when it is next republished".

---

## 7. Screens: https://claude.ai/artifact/MjC8pWKDj5PrYwm417GLAV

- **Title:** "Civicsmith Screens". Version 1793174508-c8bf, 1.5 MB.
- **Status:** "step 5 of 5 · layouts and key screens · drafted October 6, 2026 · approved October 6 · step 3's journeys folded in October 13 · dashboard treatments drawn October 13". "Open to your comments. No question open for you."
- **Structure:** Who it is for (step 3 folded in), 1 Frames, 2 The assistant panel, 3 Journeys and wizards walked (an interactive viewer), Dashboards, Explained where it appears, Find in this, 4 Without the assistant, 5 As data, 6 Decided in this step (DEC-139), 7 For you (S1–S22), 8 Owed. Repository copy: docs/development/ux-substrate/layouts.html, built by screens/build_page.py.
- **Global view states:** with or without the assistant; desktop or phone; Auto, Light or Dark; a released copy or a test copy; explain promptly or on a longer pause; sources on or off.

**Frames [Screens #frames]**
- The masthead holds the group's name, search, the assistant (only if connected), the queue and you. Below it sits the band.
- Rail: Home · Queue · Find · Add · Projects · People · Settings, 184 px by default and resizable; under 120 px it shows icons only (DEC-155).
- The work is one column of about 68ch. The dock is on the right, 380 px.
- Phone: five tabs (Home, Queue, Add, Find, More), and the dock as a sheet.

**Screen list.** The registry has 91 screens; the page text elsewhere still says "69 screens and 281 acts". Mockup states, from each screen's "In this mockup, show" control, are in brackets.
- **site:** civicsmith.org [front page / Start a team / Teams at work / Teams at work before any team is listed]
- **install:** Create your Civicsmith team [17 states: first page … R2 not on … account already holds a Civicsmith … finished: one-time password]
- **update** [page / updating / stopped / finished]
- **front:** Your team's page [visitor / refused sign-in / sign-in paused / signed out / idle end / locked / signed in]
- **tour; reset** [link opened / password set / dead link]
- **forgot** [two ways back / recovery code / code failed]
- **setup** [before claim / just claimed / no handle yet / OTP reused / non-founder]
- **group-identity** [short name recorded / older installation]
- **join** [handle free / taken / bad characters / reusable link / dead link]
- **home** [busy team / new member who may start projects / new member who may not / no project open / founder of a new team / no AI account on]
- **members** [admin view / member view / removal under way / before withdrawing a key]
- **security** [hard week / ordinary week]
- **account** [usual / newer version live / making a signing key / revoking]
- **connect** (The assistant) [team key, no own account / own API key / own subscription / sign-in expired / members bring their own / material kept away from AI]
- **teamai; bias** [lens in force / writing / drafted from a policy / work under an earlier lens / no lens / whole team's lens]
- **places** [state with profile / without]
- **recovery** [held / new]
- **group** [usual / after a copy of the record is taken]
- **settings; more; updates** [release ready, seen by an admin without Cloudflare / with Cloudflare / nothing ready]
- **ties; notes** [notes / after a delete]
- **translations** [in use / English only]
- **wizards; projects** [in use / new team / may not start]
- **theme** [every theme / one]
- **dash-action; dash-project; unavailable** [dead address / not yours / out of reach]
- **elsewhere** [Oakland's places / none]
- **queue** [in use / empty / project invitation / choosing several / what happened / answered and set aside / an all-clear that can't be given]
- **finder** [in use / no results / browsing / citing the set / whole record as a table / three routes]
- **capture** (Add)
- **held**
- **archive** [opened / not opened / mailbox]
- **open-file** [low risk / high risk / held after a finding / added yourself / photo]
- **document** [in use / just captured, held until vouched]
- **contradiction** [conflict held / lead / taken up / unseen record / named / nothing proposed]
- **find-in**
- **project** [in use / new / admin when owners gone / non-member / owner standing down / preparing a notice / notice published / rerun of an imported case]
- **objective** [with a measure / without]
- **projectai** [owner with key / sign-in removed / non-owner / not joined]
- **question** [13 states: the question / per passage / new / assistant at work / proposals / limit reached / concluded / concluded on own reading / run ended / stopped / deferred / dismissed / no AI account]
- **answers** (Ask) [answer / at work / check failed / not ready]
- **assistant** (dock)
- **people** [7 states]
- **person** [person / organization / no connections / ordinance / office]
- **timeline** [two lanes / progression / steps]
- **money; calculation; help-records; help; explore** [from J. Ortega / nowhere to start]
- **proceeding; due-date; standard** [held / benchmark behind a paywall / cited not seen / looked for, not found]
- **plan** [one / several / none]
- **start-send** [records request / higher stakes]
- **glossary; actionnew; request** [offices known / none]
- **action** [waiting / date passed / asking about silence / read-only member / reply to a request for comment]
- **hold; holdnotice; counsel** [claim / defense]
- **grouprules; matter** [10 states: determination … paused escalation]
- **case-editor** [next edition draft / first case / just published]
- **review-copy** [sharing / save as file]
- **ceremony** [13 states: last steps / device confirms / signed, publishing at set time / published now / no key in this browser / on a phone / non-owner / a finding departs from a standard's use / time zone not set / nothing ready / open requests unreadable / minutes unreadable / declared bias step]
- **review-outside**
- **published** [whole / one correction / several / uncountable corrections / filtered / one finding / printed]
- **imported** [one / list / before any import]
- **docket; docket-public; inbox; doorbell; about-knocker; leads; watching; registers**
- **aiproviders** [checks as they start / after two unchecked]
- **aiconnect; aimine; aiproject; aimoments** (dock); **aitest; airesults**

**Wizard library [Screens #data]:** 23 wizards, 145 steps, 3 required.
- Required: Set up and claim (16 steps), Welcome (7), Publication ceremony (11).
- New since Journeys: Update your team's Civicsmith, Comment for the team, Demand a correction, Take an escalation to its next stage, Refer it to an oversight body, Pick up a plan.
- Each step is at most 300 characters, and "None names a place, a law or a venue."

**Without the assistant [Screens #noai]**, six rules:
- Absent, not greyed.
- Ask becomes "Find and count".
- Drafts come from the team's templates.
- Standing questions still run, their matches arriving as a list.
- Wizards are the same.
- What they cannot do is listed.

**Dashboards [Screens #dash]**
- One home for all, arrangement C (S20, DEC-218).
- Four areas: Investigation, Action, Members, Administration. Publication is not an area.
- No email digest (DEC-219).
- The home never shows a zero reading or an empty block.
- Three tiers: status (at most 4 readings), what needs you, everything else.
- Tests: what needs you within about 5 seconds; the commonest next step in at most 3 steps.

**Decided in this step [Screens #decided6] (DEC-139 and later):**
- the frame
- where acts sit
- Home's "What happened?" with five doors
- the wizard guide
- side trips (owed)
- **weights shown only on acts heavier than Reversible (S26, DEC-295)**
- Find in this (DEC-164)
- the security screen (DEC-165/166)
- archives (DEC-167)
- opening files (DEC-169/173)
- frame explanations
- row acts (DEC-176)
- spot-check photos optional (DEC-178)
- a 923-word translation list (DEC-179)
- photos obscured in publication (DEC-180/183/187)
- acts that can never be undone are not done on a phone (DEC-181)
- acts served (DEC-182)
- who pays for the assistant (DEC-188)
- handle checks (DEC-184)
- first-built screens (DEC-198)

**For you [Screens #question]:**
- S1 → DEC-147
- S2 → DEC-148
- S3 → K1755
- S4 → DEC-149
- S5 → DEC-151, DEC-404
- S6 → DEC-156
- S7 → DEC-157
- S8 → DEC-162
- S9 → DEC-166
- S10–S13 → DEC-168
- S14 → DEC-172
- S15 → DEC-173
- S16 → DEC-175
- S17 → DEC-180
- S18 → DEC-186, **replaced by S19**
- S19 → DEC-196/197 (handles never change or reuse; "For the time being")
- S20 → DEC-218
- S21 → DEC-208
- S22 → DEC-219
- **All recorded.** S23–S25 are not shown, but S26 is cited (DEC-295).

**Owed [Screens #owed]:** screens/registry.json, screens/library.json, the side-trip field, standing questions without the assistant, file and security tools, archive listing, the security screen, Find in this, and the earlier-ruling items (who the team is, the website key, one admin, expertise checks, notes, languages, the subscription-token guide).

---

## 8. Alpha walk questions: https://claude.ai/artifact/KXfceZqCJkEocZFxyrBAkf

- **Title:** "Alpha Walk Questions". Version 1793110715-2ba2; private.
- **Status:** "Questions for Bob · October 27, 2026 · from the live walk of 0.87.0". "All eight answered on October 27 … go to the beta's planning through BOB."
- **Structure:** eight questions, A1–A8, each with the issue, today, an example, options, a recommendation and a risk.

**Each question, all answered:**

| # | Question | Answer and record |
|---|---|---|
| A1 | Who is a question about? | **A** as recommended. Optional subject at opening, changeable later with a reason → **DEC-457** |
| A2 | Whose fiscal year does Money count in? | **B**: each government's own; never print "*" → **DEC-458** |
| A3 | Who sees where a handed-in file came from? | **A**: listed members see "A source"; others see "Handed in through the doorbell" → **DEC-459** |
| A4 | Can a member look at their own photograph? | “**B, but only drop metadata is necessary.**” A safe redrawn picture; when and where it was taken stays, shown beside it → **DEC-460** (a variation on the recommendation) |
| A5 | Two things called "Capture"; publishing an ungraded case | **B**: rename the two measures; signing lists ungraded passages; the edition says so → **DEC-461** |
| A6 | Signing keys: queue noise and the device box | **B**: one queue item per member; a sentence by the box → **DEC-462** |
| A7 | Documents from other projects in pickers | **B**: this project first; others on request, labelled → **DEC-463** |
| A8 | Can a typed page be cited once a second member has checked it? | “**B, with the proper grade assigned … only incrementally better.**” Citable at once, graded as the typist's word; a second check raises it **one step only** → **DEC-464**. **Bob did not take the recommended A.** |

---

## 9. Measures map: https://claude.ai/artifact/TfqcXNaJQ86SZzUA8Xn6Ni

- **Title:** "Civicsmith Measures Map". Version 1791240477-b05d.
- **Status:** "approved by Bob, 29 September 2026 (DEC-82)", "Approved · canon".
- **Purpose:** "Every scale a member meets, the plain question each one answers, and how they fit together."
- **Structure:** the frame (three mottos and three rules), Letters grade evidence (#evidence), Bars show progress (#progress), Weights mark acts (#acts), Marks that say what we don't know (#unknowns), Making each scale distinct (#choices).

**Rules, verbatim [MM header]**
- Mottos: "Letters grade evidence" (how easily it could be checked); "Bars show progress"; "Weights mark acts".
- "An answer is only as strong as the weakest thing it depends on. … The two are never merged into one score, because they measure different things."
- "A grade tells you how easily someone else could check it for themselves. It never tells you whether it is true."
- "What we don't know is shown, never hidden or guessed."

**Evidence scales A–D [MM #evidence]**
- **Capture:** "Can we trust this copy of the document?"
  - A: an archive-grade copy with a full record of how it was served ("no route builds one yet").
  - B: we fetched it ourselves and fingerprinted it on receipt.
  - C: only a public archive's copy, or a reference with no copy held.
  - D: no capture letter; a member's own account is testimony.
  - Never means "that the document is accurate".
- **Connection:** "Does this link really show what we say it shows?"
  - A: the source itself links the two, both ends captured.
  - B: the same identifier in both captures.
  - C: only a resemblance.
  - D: a member asserts it, with no document.
  - Never means "that the link is unimportant".
- **Testimony:** "Who says so?" Always D, a firsthand account, "never discounted". Never means "that the person is less credible".
- **Subject match:** "Is this document about the subject we think it is?"
  - A: a known name. B: a normalised match. C: the label only. D: a member says so.
  - Never means "that the subject did anything".
- **Combining:** each support is graded; the weakest counts; capture and connection are shown side by side, testimony beside them; the result is shown against the project's bar.
- States: Graded / "Unrated" / "Undetermined".

**Progress [MM #progress]**
- Project stage: Forming, Investigating, Matured, Closed. **Matured's rule: "the exact rule is still being worded (N300)"; owed.**
- Readiness: Draft, Internally checked · not yet evaluated, Externally compliant · not yet evaluated, Distributed.
- Source identity: Unknown, Same knocker, Partly known, Known to the group, Public.
- A closed project, for example "Closed · abandoned", "never reads as a finished one".
- "nobody sets a step by hand."

**Weights [MM #acts]:** "Weights never appear on evidence or progress."

| Pips | Weight | Examples |
|---|---|---|
| 1 | Reversible | cite a passage; accept an account of support |
| 2 | Reasoned | conclude a question; move an action |
| 3 | Terminal | retire a document |
| 4 | Signed | stand behind material; sign a case |
| 5 | Irreversible | publish |

**Unknowns [MM #unknowns]:** "Undetermined", "Nobody looked", "Machine work", "Newer version", "Withheld", "In tension" (DEC-77).

**Choices [MM #choices]**
- Color marks the scale, never the value.
- An icon per scale: document, link, speech, person.
- Different border shapes per scale were **removed**.
- One shared A–D scale.
- Hover and click everywhere.
- A color family and a texture per ladder.
- A newcomer meets only strength against the bar, and "Undetermined".
- Footer: "colours, icons and textures are placeholders until the visual language (design phase step 4)". **The page has not yet been redrawn in the visual language; that is owed.**
- Cited ids: DEC-44, DEC-72, DEC-77, DEC-78, DEC-79, DEC-82; K356, K364.

---

## Contradictions and drift between artifacts

1. **Weight marks on every button.** Principle 4.3, Substrate OQ7 and #weights, and MM #acts say every act's button carries its weight. Screens #decided6 says weights appear only on acts heavier than Reversible ("a button without them does something you can undo", S26, DEC-295). The later ruling wins; Principles 4.3 is not yet amended.
2. **"Copy" after DEC-149.** These texts still say "copy":
   - Principles 9.6 ("ships inside the group's own copy")
   - Substrate throughout (the #words entry "Copy (of Civicsmith)", OQ18, OQ27 "Who controls this copy", OQ30, #roles "claim the copy")
   - the New-name recommendation
   - the VL and Screens CSS comments, and the Screens group page state "after a copy of the record is taken"

   Brand 2.2 bans the word.
3. **"Team" against "group".** Brand and Principles use "group" ("Use: group, member…"). The Screens page body and registry say "team" ("Your team's home", "Create your Civicsmith team"), and so does Alpha walk ("your team's Civicsmith"). Yet Screens' own S-answers and DEC-149 say "your group's Civicsmith". No ruling for "team" appears in these artifacts. **Verify whether a later DEC renamed group to team.**
4. **"Confidential."** Alpha walk A3 says "Civicsmith keeps who handed it in ('the source') confidential". Principle 3.11 and the Brand avoid list ban "confidential".
5. **Home's question.** Journeys §3 has "What brought you here?". Screens (DEC-198, #decided6) has "What happened?", with five doors plus "Help for my own situation".
6. **Rail width.** Screens #frames says "184px by default" while its own "Desktop and laptop" note says "Rail 232 px". VL tokens say --rail: 184px.
7. **Screen and wizard counts.**
   - Substrate: 38 screens and 230 acts.
   - Screens #data: "69 screens and the 281 acts" in one paragraph, against "91 screens and 675 acts" in the next and the 91-entry registry.
   - Wizards: Journeys 17; S2 (DEC-148) approved "the seventeen scripts"; the Screens library now holds 23.
8. **Measures map placeholders.**
   - MM Connection is teal, which VL replaced with plum.
   - MM fonts are Bricolage, Public Sans and IBM Plex Mono, loaded from Google, which contradicts principle 9.6.
   - VL #replaces says the specimens will be redrawn: **owed**.
9. **Rung names.** The 4th rung is "attested" in Substrate DEC-87 and #words, and "Signed" in MM, VL and K356 ("signed"). It is the same rung under two names.
10. **Substrate is stale against later rulings.**
    - Its header says "DEC-1–DEC-95 … K859".
    - OQ16 says the "interface is in English for now … decided later", superseded by DEC-127 and DEC-157.
    - Queue states Empty and Loading are still marked "Open", though OQ15/DEC-98 settled them.
    - #words "Queue … and signals" against DEC-131's "Status".
    - "Subject (of a plan) … which word members see is Bob's to decide", settled as "Matters" by DEC-114.
11. **Journeys is stale in places.**
    - The gap row "A member's private note: Open: yours (J11)" against J11's DEC-136.
    - The header's "How to answer" text.
    - Journey 4's "no group-wide Claude account" against K1755, which allows the group's API key (journeys 1 and 17 and the Screens S3 answer reflect K1755).
12. **Capture used for two measures.** MM's "Capture" scale is "how trustworthy our copy". Alpha A5 found "Capture" also labels the record's ceiling. DEC-461 renames the two, but neither MM nor VL is updated yet.
13. **Typed text and the grade.** Substrate #words: transcription "counts more once a different member confirms it". DEC-464 sets it citable at once, at the typist's grade, with "one step only" for a check. Consistent, but more exact now.
14. **Photo metadata.** S17 (DEC-180): every published photo goes out without camera details. A4 (DEC-460): the in-group safe view keeps when and where it was taken. These are compatible (one is the public copy, the other in-group) but worth keeping distinct.
15. **The name's capitalisation.** Brand bans "CivicSmith". It appears in Bob's quoted words in Screens S22 and in the repository's own CLAUDE.md. That is in member text; the rule is for product text.

## Provisional, owed, or awaiting Bob

- **Awaiting Bob:**
  - Domains, the trademark clearance search and the GitHub org (New name).
  - 14 write ops with no rung, "BOB's to assign" (Substrate #flux).
  - Decline-to-escalate requirements, "owed, for Bob's approval" (#flux).
  - No release is cut until Bob says (K633).
- **Deferred:**
  - OQ11 onboarding (DEC-91).
  - Grade A capture (DEC-81 item 4).
  - Licensed certification and joint action.
  - "Meets standards" origin.
  - The public list of acceptances.
  - Sharing packs.
  - A group writing its own place's rules (after the first public release, DEC-151/404).
- **Provisional:**
  - VL is "a working version … tested by use".
  - The welcome wizard's final words come "once the redesign settles".
  - S19's handles are fixed "for the time being".
  - Hints stay hidden until the false-alarm rate is at most 20%.
  - The assistant's proposals are switched on after measurement.
  - Anthropic terms point U-7 is open.
  - Matured's rule (N300).
- **Owed to the development process:** see Screens #owed; VL's asset files; the measures map redraw; DEC-88's rung moves; DEC-132–135 requirements; DEC-147 set-time publishing; DEC-156 subscription paste.

## DEC and K ids cited (union)

- **DEC:**
  - DEC-2, 10, 12, 15, 16, 19, 20, 24, 27, 31, 32, 36, 39, 44, 46, 49, 51, 55, 60, 61, 69, 70, 72
  - DEC-76–92, 94–99, 100–116, 118–139
  - DEC-141, 145–151, 155–157, 159, 161–169, 172–188, 196–198, 208, 215–219, 224, 240, 249, 279, 280, 295, 308
  - DEC-401, 404, 405, 406, 412, 457–464
- **K:**
  - K1, K356, K360, K362, K364, K371, K446, K450, K455, K456, K459, K470
  - K481, K488, K490, K491, K509, K520, K530, K533, K557, K563, K565
  - K590, K597, K600, K607–K613, K624, K633, K651, K660
  - K701–K711, K717, K719, K723–K732, K739, K757, K830, K899, K901, K903, K904, K1019
  - K1364, K1366, K1429–K1508 (among them K1431, 1432, 1444, 1452, 1455, 1457, 1462–1469, 1471, 1473, 1474, 1478–1494, 1500, 1502–1506)
  - K1536, K1537, K1547, K1627, K1755, K1841, K1852, K1875, K2803, K3080, K3446

## Open questions

- Is "team" the current member-facing word, by a ruling not shown in these artifacts, or is it drift from Brand's "group"? This decides the words on every screen.
- Do Principles 4.3 and the Measures map need to be amended to DEC-295, so that reversible buttons carry no weight mark?
- Who republishes the Measures map in VL's look and fonts (and with DEC-461's renamed capture measures), and when?
- Should the Substrate, Principles 9.6 and New-name pages be swept for "copy" (DEC-149) and the other stale items above?
- Which counts are authoritative: 91 screens and 675 acts, or 69 and 281? 23 wizards, or 17?
- What are S23–S25? S26 (DEC-295) is cited, but the questions are not shown on the Screens page.
- Should A3's "confidential" wording be corrected to "not public" per 3.11?
- What is the exact rule for "Matured" (N300)?

## Ground truth

- Nine ux-lane artifacts exist and were all readable. Principles, Brand, Journeys, Measures map and Screens are approved or settled; Visual language is "decided" as a working version.
- The design phase has five steps: principles (approved 3 Oct), brand and voice (4 Oct), journeys (settled 6 Oct), visual language (DEC-138, 6 Oct), screens (approved 6 Oct, extended to about 15 Oct).
- The name is **Civicsmith** (DEC-124), one word, capital C only, never "the Civicsmith". The mark is the **plumb bob**, option D (DEC-126).
- 58 principles in 9 families. 3.11 (DEC-136) bans "secret" and "confidential". 4.3 is effectively amended by DEC-295 (reversible acts unmarked).
- Seven voice traits: Plain, Exact, Calm, Honest about limits, Respectful, Neutral on policy, Disciplined output. Civicsmith never says "we"; the assistant says "I" (V3).
- The group leads; Civicsmith is credited quietly ("Made with Civicsmith"). Members say "your group's Civicsmith", never "copy" (DEC-149).
- The measures map: letters grade evidence, bars show progress, weights mark acts. Strength is two grades side by side, never one score. A grade is about checking, never truth.
- Five gaps, five looks: Undetermined (always "because"), Withheld, Unrated, Nobody looked, Refused. None is styled as an error.
- Friction follows the act's weight: reversible inline, reasoned a reason in place, terminal or signed a full dialog, irreversible only through the ceremony. Consequences in the world raise friction (DEC-88).
- Colors: verdigris #2B6A5D (light) / #74C2AE (dark) means act and Civicsmith; rust #A23B19 / #EE9874 means attention only. Evidence hues: capture blue, connection plum, testimony ochre, subject olive. Machine and other-group work carry no hue (dotted edge, double rule).
- Type is Source Serif, Sans and Code, shipped locally. Serif is for people's words, sans for Civicsmith's, mono for identifiers. The working size is 16 px, reading 18 px, the minimum 13 px. Spacing is on a 4 px grid; corners are 2 px.
- WCAG 2.2 AA in light and dark (4.5:1 text, 3:1 marks), checked by check_contrast.py. Color is never the only signal. Every hover also opens on focus or tap (0.5 s delays, DEC-161).
- The assistant is docked, never floating. It is optional and runs on a member's own Claude account or the group's API key (K1755); otherwise it is absent, not greyed. Wizards run without AI and ring the real control, never pressing it.
- 27 journeys (plus journey 28 in Screens, DEC-201). 23 wizards, 3 required: Set up and claim, Welcome a new member, Publication ceremony.
- No email, push or nagging. "Overdue" is said once. A deadline changes only the display (DEC-94, DEC-219).
- The queue's kinds are **To do / Noticed / Status** (DEC-131). A machine "hint" is never evidence and stays hidden until its false-alarm rate is at most 20%.
- Every Bob question across the nine artifacts is answered: OQ1–36 (OQ11 deferred), V1–V4, J1–J13, S1–S22, A1–A8 (DEC-457–464). A8 and A4 departed from the recommendation.
- The Substrate, the Measures map and parts of the Journeys page are stale against later rulings. Treat later DECs (Screens §6–7, Alpha walk) as winning.
