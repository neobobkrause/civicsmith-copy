Length: 367 lines. Last section: "6c. Rules for both templates (checklist for authors)".

# Best practice for the Screens document and journeys

Research for the civicsmith UX lane, 22 Nov 2026. Question: how to write the Screens document (one page per group of screens) and the journey pages (one page per journey) so that they are unambiguous, checkable by an AI or automated walker on a deployed copy, and good UX design. Each finding cites its source by URL. Findings marked **Advice** are this research's own recommendation drawn from the sources, not a quotation.

Sources were read on 22 Nov 2026. Where a page was only partly readable, that is said.

---

## 1. Screen specifications

### 1.1 What a good screen spec contains

No single public standard defines a "screen spec", but the public design systems describe every screen pattern with the same parts. Taken together, a screen spec needs:

| Part | What it says | Source |
|---|---|---|
| Purpose | The one job of the screen, stated from the user's side. GOV.UK: give each page one `h1` that describes its purpose, and base the page title on it. | https://www.gov.uk/service-manual/design/writing-for-user-interfaces |
| Entry points | Every way the user arrives (link, button, redirect, direct URL, back link). GOV.UK question pages require a Back link at the top and say the browser back button must return users to the previous page "in the state they last saw it". | https://design-system.service.gov.uk/patterns/question-pages/ |
| Content | Headings, labels, hint text, fixed text, data shown. GOV.UK check-answers lists each element by name (back link, heading, section headings, summary rows, "Change" links, statement, button). | https://design-system.service.gov.uk/patterns/check-answers/ |
| States | Normal, empty, loading, error, not found, unavailable, permission denied, success. See 1.2. | NN/g, GOV.UK, USWDS below |
| Actions and destinations | Every control, its exact label, and where it leads. GOV.UK: the Continue button is labelled "Continue", not "Next"; start buttons are worded for the action ("Start now", "Sign in", "Apply now"); a secondary call to action is a link, not a second button. | https://design-system.service.gov.uk/patterns/question-pages/ ; https://design-system.service.gov.uk/patterns/start-using-a-service/ |
| Validation | What is rejected, what is quietly accepted, the exact message, where it shows. See 1.3. | https://design-system.service.gov.uk/patterns/validation/ |
| Words | Exact text of heading, button, label, hint, messages. GOV.UK rules: sentence case, no full stop in headings and labels, no "please", no instructions by colour or position, link text that makes sense out of context. | https://www.gov.uk/service-manual/design/writing-for-user-interfaces |

### 1.2 States, with what each must show

- **Empty.** Never leave a container blank: users cannot tell loading, failure and "nothing here" apart. Show a short message that there is no content, teach how content gets added, and give a direct path (for example a "Create" button). Never show the "no records" message while still loading. https://www.nngroup.com/articles/empty-state-interface-design/
- **Loading.** Show a progress indicator while work is going on, so loading is not taken for an empty result. https://www.nngroup.com/articles/empty-state-interface-design/
- **Error (validation).** Error summary at the top of `main`, below the back link and above the `h1`, headed "There is a problem"; keyboard focus moves to it; each summary item links to its field and matches the inline message word for word; page `<title>` starts "Error: ". https://design-system.service.gov.uk/components/error-summary/
- **Error (system).** Say what went wrong in plain words, no codes or jargon unless needed, no blame, give a next step, keep the user's input. https://www.nngroup.com/articles/error-message-guidelines/
- **Not found.** Title "Page not found – service name"; `h1` "Page not found"; short text that does not blame the user ("If you typed the web address, check it is correct."); no "404", no "oops", no red warning text. https://design-system.service.gov.uk/patterns/page-not-found-pages/
- **Unavailable.** Heading "Sorry, the service is unavailable"; when it returns; what happens to answers already entered; contact or other route. https://design-system.service.gov.uk/patterns/service-unavailable-pages/
- **Permission denied / not eligible.** GOV.UK says do not use validation to check eligibility or permissions; send the user to a page that explains it. https://design-system.service.gov.uk/patterns/validation/
- **Success / status.** USWDS: alert text begins with a word naming its type; do not rely on colour or icon alone; `role="alert"` for errors, `role="status"` for success. https://designsystem.digital.gov/components/alert/

**Advice.** Every screen-group page lists every state above for every screen, and writes "Not applicable: <reason>" where a state cannot occur. A state left out is a gap the walker cannot judge.

### 1.3 Validation

From GOV.UK's validation pattern (https://design-system.service.gov.uk/patterns/validation/):

- Validate when the user submits (Continue or Submit), not when they leave a field or while typing.
- Reject what cannot be correct, what is too ambiguous to use, and required information that is missing.
- Ignore, rather than reject, stray spaces, punctuation and other harmless format differences.
- The message says what went wrong and how to fix it.
- Redisplay the page with the user's entries intact.
- Validate on the server always.

**Advice.** Write each rule as a row: field, condition, exact message, where it shows. A walker can then trigger each condition and compare the message.

### 1.4 Making each statement checkable

- **One observable fact per line.** Gherkin practice: a Then step is a query with no side effects; several outcomes are joined by "And", one each. https://martinfowler.com/bliki/GivenWhenThen.html
- **A fixed sentence shape.** EARS puts every requirement in one of five templates: "The <system> shall <response>" (always), "While <state>, …", "When <trigger>, …", "If <unwanted trigger>, then …", "Where <feature>, …". A fixed order (state, trigger, system, response) removes most ambiguity. https://alistairmavin.com/ears/
- **Exact wording in quotation marks.** GOV.UK patterns quote the exact text ("There is a problem", "Continue", "Page not found"). Quoted text can be compared character for character; paraphrase cannot. https://design-system.service.gov.uk/components/error-summary/
- **Stable names a walker can find.** Playwright recommends finding elements the way users and assistive technology do: by role and accessible name (`getByRole`), by label (`getByLabel`), by visible text; CSS and XPath selectors break when the DOM changes. https://playwright.dev/docs/locators
- **Describe behaviour, not implementation.** Ask "would this wording change if the implementation did?"; if yes, raise its level. https://cucumber.io/docs/bdd/better-gherkin/
- **Reference style.** Reference documentation is neutral, austere, consistent, mirrors the structure of the product, and leaves no doubt. https://diataxis.fr/reference/

**Advice for civicsmith.** Name each element by its role and its accessible name, for example `button "Save case"`, `link "Change"`, `heading 1 "Your cases"`, `field "Case title"`. That is what a browser walker sees in the accessibility tree, and it doubles as a check of WCAG 2.5.3 Label in Name. Never name an element by colour, position or CSS class. Give every screen a stable ID (`S-CASE-03`) that never changes when the screen's title does.

---

## 2. Journeys, scenarios and acceptance criteria

### 2.1 Journey maps, task flows and use cases

- **Journey map.** A visual of one actor's goals, actions, thoughts and emotions across a scenario, divided into phases; one point of view per map; built on research. It is a design and research tool, not a test script. https://www.nngroup.com/articles/customer-journey-mapping/
- **User journey vs user flow.** A journey spans channels and may take days; a flow covers one task in one product in minutes, and records only user actions and system responses. A flow can be a deep dive into one step of a journey. https://www.nngroup.com/articles/user-journeys-vs-user-flows/
- **Use case / test case.** ISO/IEC/IEEE 29119-3 defines a test case as preconditions, inputs (including actions) and expected results. https://en.wikipedia.org/wiki/Test_case ; https://standards.ieee.org/ieee/29119-3/7499
- **User story.** Actor, need, goal ("As a … I need … so that …"); acceptance criteria are a short checklist of outcomes, usually "it's done when …". https://www.gov.uk/service-manual/agile-delivery/writing-user-stories

**Advice.** What civicsmith calls a "journey" is, in these terms, a **task flow written as an end-to-end test case**: one actor, one goal, in one product, with preconditions, steps and expected results. Emotion and channel content from journey maps belongs in research notes, not on the walker's page.

### 2.2 Given / When / Then and specification by example

- Given = starting state; When = the behaviour; Then = expected outcomes; "And" joins several of one kind. Given is setup; Then is a check with no side effects. https://martinfowler.com/bliki/GivenWhenThen.html
- Concrete examples serve as the specification; the specification is "living documentation" kept true by running it. https://gojko.net/books/specification-by-example/ (book page only; details not read)
- Prefer declarative steps ("the resident submits the case") over imperative ones ("click Submit at the bottom") unless the exact control is what is being checked. https://cucumber.io/docs/bdd/better-gherkin/

**Advice.** Journeys stay declarative at the level of steps, and point to the Screens document for the exact controls and words. A journey then survives a label change; the Screens page is what fails. This is "one source of truth" (section 5) applied to journeys.

### 2.3 How to state an expected result

- Grade the outcome, not the path: check the state at the end (the record exists), not just what the screen said. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Every expected result is observable on the deployed copy: a screen and state reached (by ID), exact text visible, a record visible somewhere else (for example on a list screen, after reload), or something absent.
- An expected result is never "works", "is correct", "looks good" or "is shown properly".

### 2.4 Naming and numbering steps

**Advice** (drawn from 29119-3's structure and Gherkin):
- Journey ID `J-<AREA>-<NN>` that never changes; title is the actor's goal as a verb phrase ("Resident files a records request").
- Steps numbered `1, 2, 3 …`; each step is one action by one actor and ends with one or more expected results numbered `1.1, 1.2 …`. A walker reports a failure as "J-CASE-02 step 4.2".
- When steps are added, renumber freely but keep a changelog line (section 5); IDs of journeys never get reused.

### 2.5 Preconditions and test data

- Preconditions are part of the test case. https://standards.ieee.org/ieee/29119-3/7499
- **Advice.** State each precondition so a walker can create or confirm it: who is signed in and with what role, what records exist (by name), what settings are on. Name a seed data set ("seed: demo-county") rather than describing data in prose. Use clearly fake data (names like "Test Resident A") so nothing is mistaken for a real person; civic data may name real officials.
- State the postcondition (what is left behind) and whether the journey must be run on a fresh copy, since civicsmith walkers share a deployed copy.

### 2.6 Scoping a journey

- One task per transaction; scope around what the user recognises as a task, named descriptively; join up with the wider journey. https://www.gov.uk/service-manual/design/scoping-your-service
- One point of view per map. https://www.nngroup.com/articles/customer-journey-mapping/
- **Advice.** One actor (or a named hand-off between two), one goal, start to end. Start = a screen the actor can reach from outside (home, sign-in, a link in an email). End = the goal reached and confirmed. A journey that needs more than about 15 steps is probably two journeys joined; split and say which follows which.

---

## 3. Checking non-deterministic (AI) output

### 3.1 Principles

- Use three kinds of grader: code-based (fast, cheap, reproducible, but brittle to valid variation), model-based (flexible, needs calibration), human (gold standard, slow). Combine as all-must-pass, weighted threshold, or hybrid. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Score each dimension separately, ideally one judge per dimension; give the judge an explicit "Unknown" option; vague rubrics give inconsistent results. Same source.
- Prefer binary pass/fail to scales; scales are harder to manage. https://hamel.dev/blog/posts/evals/
- Assertions like unit tests: cheap checks organised by feature and scenario, plus checks that apply everywhere (for example a regex that catches leaked internal identifiers). Same source.
- LLM grading rubrics: define the terms used, constrain the answer format ("Output only yes or no"), wrap the graded text in tags, use a different model to grade where practical. https://platform.claude.com/docs/en/test-and-evaluate/develop-tests (first part read)
- Behaviour varies run to run: run several trials; pass@k (at least one of k succeeds) suits tools where one good answer is enough; pass^k (all k succeed) suits user-facing features that must work every time. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

### 3.2 Assertion kinds that fit a walker

promptfoo's assertion vocabulary is a good model for "what must be present" (https://www.promptfoo.dev/docs/configuration/expected-outputs/):

| Kind | Meaning |
|---|---|
| `contains` / `icontains` | Text includes a string (case-sensitive / not) |
| `contains-all` / `contains-any` | All / at least one of a list |
| `regex` | Matches a pattern (for example a date, a citation marker) |
| `not-…` | Any of the above, negated |
| `is-json` | Structured output parses (and fits a schema) |
| `llm-rubric` | A model judges against a written rubric |
| `factuality` | Agrees with stated facts |

### 3.3 Property-based and metamorphic checks

- A property-based check needs only an invariant that must hold whatever the wording; semantic invariants need an evaluator (embedding similarity, rule-based classifier, or LLM judge). https://tianpan.co/blog/2026-04-12-property-based-testing-for-llm-systems
- Metamorphic testing checks a relation between related inputs (a rewording should give the same verdict) instead of a known right answer; expect many false alarms (about 60% in one study's manual review), so a violation is triaged before it is called a flaw. https://arxiv.org/abs/2511.02108v1

### 3.4 What this means for civicsmith journey pages

**Advice.** For each AI step write a "What must be present" block with three tiers:

1. **Hard checks** (code-like, every run): structural facts a walker can check without judgement. Examples for an evidence-backed case: every claim shows at least one citation; every citation links to a source document that exists in the case; no source is cited that the user did not supply or approve; names of officials appear only as written in the sources; the answer is in the language of the interface; no internal IDs, prompt text or stack traces leak.
2. **Must-not checks:** things that make the result wrong whatever else is true: invented facts, invented quotations, a claim of wrongdoing stated as fact when the source does not say so, legal advice stated as certain.
3. **Rubric checks** (judge, binary, one question each, with "Unknown" allowed): "Does the summary state the main finding of source X? yes / no / unknown."

Rules: never assert exact AI wording; assert facts drawn from the seeded test data (so the expected facts are known); grade the saved result (what is stored and shown after reload), not only the streamed text; and state the trial rule, for example "pass if 3 of 3 runs pass" (pass^k) for anything a resident relies on.

---

## 4. Public-service and civic design standards

### 4.1 GOV.UK Service Manual and Design System

- **Pattern pages** have a fixed shape: what it is, when to use it, when not to use it, how it works, research. Model screen-group pages on the same habit of saying when a screen is and is not reached. https://design-system.service.gov.uk/patterns/check-answers/
- **Start page:** service name that reflects the problem; brief explanation, cost and time; sign in / resume options; other ways to use the service; what you'll need. Start button worded for the action. https://design-system.service.gov.uk/patterns/start-using-a-service/
- **Question pages:** one thing per page to start with; the question is the heading; no repeated headings across pages; Back link; "(optional)" in labels, never asterisks; hints one short sentence with no links; "Continue" button. https://design-system.service.gov.uk/patterns/question-pages/
- **Check answers:** heading says what to do and that the task is not finished; sections; each row has a "Change" link with hidden text naming the item; Change returns to this page; skipped optional answers show "Not provided"; a statement and a button such as "Accept and send". https://design-system.service.gov.uk/patterns/check-answers/
- **Confirmation:** reference number if any; what happens next and when; contact details; links to likely next tasks; feedback link; a way to keep a record. https://design-system.service.gov.uk/patterns/confirmation-pages/
- **Writing:** fewer words, key words first, one idea per sentence, no humour, no "please", apologise only for serious failures, "you" when the service speaks, spell out acronyms. https://www.gov.uk/service-manual/design/writing-for-user-interfaces

For civicsmith: creating a case, filing a request or publishing a finding are transactions; the start, question, check-answers, confirmation shape gives each a predictable set of screens and gives the walker a fixed list of things to look for.

### 4.2 USWDS

- Patterns are grouped by what they help users do ("Complete a complex form", "Create a user profile", "Select a language"). https://designsystem.digital.gov/patterns/
- Alerts: info, warning, success, error, emergency; short title; tell users what to do next; no blame; limit alerts to those relevant to the current goal; a destructive action gets a confirmation step. https://designsystem.digital.gov/components/alert/

### 4.3 Plain language

- US federal plain language guidance: write for your audience; write, design and test for understanding. https://digital.gov/guides/plain-language
- **Advice.** Civic groups include residents with no training in law or records. Each screen page records the words the product uses for its own concepts (case, evidence, source, finding) in one glossary, and the walker flags any screen that uses a different word for the same thing (this is also WCAG 3.2.4 Consistent Identification).

### 4.4 WCAG 2.2 AA items a walker can observe

New in 2.2 (https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/): 2.4.11 Focus Not Obscured (AA), 2.5.7 Dragging Movements (AA), 2.5.8 Target Size Minimum 24×24 CSS px (AA), 3.2.6 Consistent Help (A), 3.3.7 Redundant Entry (A), 3.3.8 Accessible Authentication (AA). 4.1.1 Parsing is removed.

W3C's "easy checks" give a walker-sized list: page title, alt text, headings, contrast, text resize, keyboard and visible focus, form labels and errors, moving content, media, reading order. https://www.w3.org/WAI/test-evaluate/preliminary/

Criteria a browser walker can check on a screen, with the observable fact (criterion list: https://www.w3.org/WAI/WCAG22/quickref/):

| SC | Observable check |
|---|---|
| 1.1.1 | Every informative image has a text alternative; decorative ones are empty |
| 1.3.1 | Headings, lists, tables and labels are real markup (visible in the accessibility tree) |
| 1.3.5 | Personal fields (name, email) have autocomplete purposes |
| 1.4.1 | No state is shown by colour alone (errors, statuses, required) |
| 1.4.3 / 1.4.11 | Text contrast at least 4.5:1 (3:1 large); controls and focus at least 3:1 |
| 1.4.4 / 1.4.10 | At 200% zoom and 320 CSS px width, nothing is cut off and no sideways scroll |
| 2.1.1 / 2.1.2 | Every action works by keyboard; no trap |
| 2.4.2 | Each screen has a unique title naming it |
| 2.4.3 / 2.4.7 / 2.4.11 | Focus order follows reading order, is visible, and is not hidden by sticky bars |
| 2.4.4 / 2.4.6 | Link text and headings say where they go / what follows |
| 2.5.3 | A control's accessible name contains its visible label |
| 2.5.7 / 2.5.8 | Dragging has a click alternative; targets at least 24×24 px or spaced |
| 3.1.1 | Page language is set |
| 3.2.3 / 3.2.4 / 3.2.6 | Navigation, names of the same things, and help links are consistent across screens |
| 3.3.1 / 3.3.2 / 3.3.3 | Errors identified in text, fields labelled, fix suggested |
| 3.3.4 | Submitting legal or data-changing actions can be checked, corrected or reversed |
| 3.3.7 / 3.3.8 | Nothing already entered is asked again; sign-in needs no memory or puzzle test |
| 4.1.2 / 4.1.3 | Controls expose name, role, value; status messages are announced (live region) |

**Advice.** Put these once, in a shared "Every screen" page (section 5), and do not repeat them on each screen-group page. A screen-group page lists only exceptions and screen-specific items (for example "the evidence table has column headers").

---

## 5. Organising documentation for a walker that reads only its area's pages

- **Consistency and mirroring the product.** Reference docs are consulted, not read; consistent patterns let readers find things where they expect; structure mirrors the product. https://diataxis.fr/reference/
- **Changelog.** For people, newest first, dated, grouped as Added / Changed / Deprecated / Removed / Fixed / Security, each version linkable. https://keepachangelog.com/en/1.1.0/
- **Living documentation.** A specification stays true only if it is run against the product. https://gojko.net/books/specification-by-example/

**Advice for civicsmith** (no single source covers walker-scoped reading; drawn from the above):

1. **Each page stands alone for its area.** A walker that reads only its area's pages must not need another page to judge a flaw. Rules that apply to every screen (WCAG checks, writing rules, glossary, layout shell, standard error and not-found screens) go in **one shared page**, "Every screen", which every walker reads along with its area pages. Nothing else is shared.
2. **One source of truth per fact.** The exact words of a screen live only on its Screens page. A journey refers to the screen by ID (`S-CASE-03`) and to a control by its name, and never restates the full screen. If a fact appears in two places, one is a link.
3. **Cross-references by stable ID**, not by page title or heading text: `S-<AREA>-<NN>` for screens, `J-<AREA>-<NN>` for journeys, `R-<AREA>-<NN>` for a rule if needed. IDs are never reused.
4. **An index page** listing every area, its pages, each screen ID and title, and each journey ID, title, actor and the screens it passes through. The index is the only place a walker learns which pages belong to its area. A screen that no journey reaches, or a journey step that names a missing screen ID, is a documentation flaw the index makes visible.
5. **Page size.** Keep a page small enough for a walker to hold in full with the product open: **Advice**, about 3–8 screens per screen-group page and one journey per journey page, roughly under 15,000 bytes each. Split a group when it passes that, by user task, not by technical component.
6. **Versioning.** Each page carries a "Last changed" date and the version of the product it describes; a short changelog at the foot of each page (newest first, Added / Changed / Removed / Fixed); the index carries the document version. A walker records the document version and the product build it checked, so a reported flaw can be traced to both.
7. **Status per item.** Mark a screen or step `Planned` when the product does not have it yet, so the walker reports it as not built rather than as a flaw in what exists. **Advice.**

---

## 6. Recommended templates

### 6a. Screen-group page

```markdown
# <Area>: <group name>   (e.g. Cases: create and edit a case)

ID range: S-<AREA>-01 to S-<AREA>-NN · Doc version: <n> · Product build: <tag> · Last changed: <YYYY-MM-DD>
Reads with: Every screen (shared rules) · Index

## What this group is for
<One or two sentences: the user task these screens serve, and who uses them (role).>

## Screens in this group
| ID | Title (h1) | Page title | Status |
|---|---|---|---|
| S-CASE-01 | "Your cases" | "Your cases – civicsmith" | Built |

---

## S-CASE-01 "Your cases"

**Purpose.** <one sentence>
**Who can see it.** <roles>. Anyone else: <screen ID of permission-denied state>.
**Entry points.**
- From S-HOME-01 `link "Cases"`.
- Direct URL `/cases`.
- Back from S-CASE-02.

**Content (normal state)** — one fact per line, exact words in quotes, elements by role and name:
1. `heading 1 "Your cases"`.
2. `button "Start a new case"`.
3. `table "Cases"` with column headers "Title", "Status", "Last changed".
4. Each row's title is a `link` to S-CASE-02 for that case.

**States**
| State | When | What shows (exact) |
|---|---|---|
| Empty | User has no cases | Text "You have no cases yet." and `button "Start a new case"`. No table. |
| Loading | List is fetching | Indicator with accessible name "Loading cases". Empty text not shown. |
| Error | List fails to load | `heading 2 "There is a problem"`, text "Your cases could not be loaded. Try again later.", `link "Try again"`. |
| Permission denied | Role lacks access | Goes to S-SHARED-03. |
| Not applicable | <state> | <reason> |

**Actions and destinations**
| Control | Condition | Result |
|---|---|---|
| `button "Start a new case"` | always | Goes to S-CASE-03 with empty form. |
| `link "<case title>"` | always | Goes to S-CASE-02 for that case. |

**Validation** (forms only)
| Field | Condition | Message (summary and inline, exact) |
|---|---|---|
| `field "Case title"` | empty on Continue | "Enter a case title" |
| `field "Case title"` | over 120 characters | "Case title must be 120 characters or fewer" |
Input is kept after an error. Page title starts "Error: ". Focus moves to the error summary.

**Screen-specific accessibility** (beyond Every screen)
- <for example: the status column states status in words, not colour alone>

---
<next screen …>

## Changelog
- <YYYY-MM-DD> Changed: S-CASE-01 empty-state text. (newest first)
```

### 6b. Journey page

```markdown
# J-<AREA>-<NN>: <actor> <goal as a verb phrase>
(e.g. J-CASE-02: Resident builds a case from two council minutes)

Doc version: <n> · Product build: <tag> · Last changed: <YYYY-MM-DD> · Status: Built | Partly built | Planned
Screens used: S-HOME-01, S-CASE-01, S-CASE-03, S-CASE-04, S-CASE-02
Follows: <journey ID or "none"> · Followed by: <journey ID or "none">

## Goal
<One sentence: what the actor achieves, in the actor's words.>

## Actor
<Role, signed in or not, permissions.>

## Preconditions
1. Copy: fresh deployed copy | shared copy, seed "<name>".
2. Signed in as "Test Resident A" (role: member of group "Test Watchdog").
3. Exists: source documents "Minutes 2026-03-04.pdf" and "Minutes 2026-04-01.pdf" in the group library.
4. Not present: any case titled "Road budget".

## Test data
| Item | Value |
|---|---|
| Case title | "Road budget" |

## Steps
Each step: one action by the actor (declarative; exact controls are on the screen page), then numbered expected results, each one observable fact.

1. Starts a new case from S-CASE-01.
   - 1.1 S-CASE-03 shows, form empty.
2. Enters the case title from Test data and continues.
   - 2.1 S-CASE-04 shows with heading "Add evidence".
3. Adds both source documents as evidence.
   - 3.1 Both titles are listed under "Evidence".
4. **AI step.** Asks the assistant to summarise what the minutes say about the road budget.
   - What must be present (hard, every run):
     - 4.1 At least one citation per claim; each opens one of the two documents.
     - 4.2 The amount "$1.2 million" (from the seed) appears.
   - Must not be present:
     - 4.3 Any source not in the case; any quotation not found in the cited document; any statement that an official acted unlawfully.
   - Rubric (judge, yes / no / unknown):
     - 4.4 "Does the summary say the budget changed between the two meetings?"
   - Trials: pass if 3 of 3 runs pass 4.1–4.3 and 4.4 is "yes" in at least 2 of 3.
5. Saves the case.
   - 5.1 S-CASE-02 shows with status "Draft".

## End state (how to verify the result, not only the screen)
1. After reload, S-CASE-01 lists "Road budget" with status "Draft".
2. Opening it shows the summary from step 4 with the same citations.

## Ways this journey can fail (alternatives to try)
- A1 At step 2, title left empty: S-CASE-03 error "Enter a case title"; journey resumes at step 2.
- A2 At step 4, assistant unavailable: message per S-CASE-04 error state; the case can still be saved without a summary.

## Cleanup
<What to delete or reset afterwards, or "fresh copy: none".>

## Changelog
- <YYYY-MM-DD> Added: alternative A2.
```

### 6c. Rules for both templates (checklist for authors)

1. Every statement is one observable fact; no "works", "correct", "properly", "nice".
2. Exact words are quoted and appear only on the Screens page.
3. Elements are named by role and accessible name, never by colour, position or CSS.
4. Every screen lists every state, or says "Not applicable: <reason>".
5. Every action names its destination by screen ID.
6. Every journey has one actor, one goal, preconditions, numbered steps, numbered results, an end state checked after reload, and a cleanup.
7. Every AI step has hard checks, must-not checks, rubric questions with "unknown" allowed, and a trial rule; none asserts exact AI wording.
8. Shared rules live once on "Every screen"; the index lists all IDs; each page has a changelog.
