# w6: current best practice for the ux lane, compared with the substrate

Research worker w6, 6 Nov 2026. Product checked at `705f8823d124a6c134cf5af3aa5aa297c8da18c4`, folder `docs/development/ux-substrate/` (written as `ux/` below). I read the repository and wrote nothing to it.

Legend: **Follows** / **Departs** / **Partly** / **Not checked**. "Fetched" means I read the source in this run. "Search only" means I relied on search summaries or secondary reports and did not open the primary text. I ran the contrast checker (`python3 check_contrast.py`): every listed pair passes in both themes. I also computed some extra pairs the checker does not list, given in §1.

---

## 1. Accessibility

### 1a. WCAG 2.2 (W3C Recommendation, 12 Dec 2024 edition, REC-WCAG22-20241212). https://www.w3.org/TR/WCAG22/ (fetched)
This is still the stable baseline. WCAG 3 is far off (see 1c), so design to 2.2 AA.

| SC (level) | Practice | Product |
|---|---|---|
| 1.4.3 Contrast (Minimum), AA | Text needs 4.5:1, or 3:1 for large text | **Follows.** `ux/visual-language/check_contrast.py:30-35` checks every `pairs.text` pair at 4.5:1 in both themes, and the run passes (lowest dark pair muted on sheet is 5.95). `palette.json` is the single source, and the checker also confirms that `civicsmith.css` carries exactly the palette values (`check_contrast.py:36-46`). |
| 1.4.11 Non-text Contrast, AA | UI components and the parts of a graphic needed to understand it need 3:1 against **adjacent** colours | **Partly.** The checker tests every `pairs.graphic` colour against `surface` only, apart from rule-strong and focus, which it also tests on `ground` (`palette.json` pairs). I computed: `kind-part` on sheet is 3.50 light and 3.12 dark, and on ground 3.07 light. These pass, but the margin is thin and these backgrounds are not in the checked set. `rule` is not in any pair and measures 1.6:1 on surface. That is fine for decorative rules, but it is also the border of unselected ladder steps (`components.css:221-226`) and of heat-map cells (`components.css:346`). The step text carries the state, so this passes, but the border must never be the only cue. Heat-map level 1 is a 20% tint (`components.css:347`) and probably sits below 3:1 against surface. That is acceptable only because each cell names its count on hover, focus or tap (`components.css:333-336`). The Analysis Function guidance (§6) would also want a text table. |
| 2.4.7 / 2.4.13 Focus Appearance (2.4.13 is AAA) | Focus indicator at least as large as a 2 CSS px perimeter, with 3:1 between focused and unfocused states | **Mostly follows.** `components.css:8` draws a 2px `--c-focus` outline with a 2px offset, and the offset ring is 9.3:1 on sheet. **Departs:** `--c-focus` is the same colour as `--c-accent-strong` (1.0:1) and only 1.49 light / 1.29 dark against `--c-accent`. Buttons override it to `--c-accent` (`components.css:100`), so a focused primary button's ring is accent on accent. The 2px offset keeps the ring on the ground, so it still passes, but only because of the offset. Keep the offset as a rule. `.cs-grip:focus-visible` sets `outline:none` and draws a 2px accent line instead (`components.css:291`). Check that line against 2.4.13's area test. |
| 2.4.11 Focus Not Obscured (Min), AA | A focused control must not be entirely hidden by author content such as sticky bars | **Not checked in a browser.** Risks: sticky action bars in dialogs (`ux/screens/page.src.html:300`, `:911`), a fixed tip (`components.css:319`), mobile bottom tabs (`components.css:306`), and the dock and hold strip. Nothing in the CSS sets `scroll-padding` (searched: 0 hits). The usual fix is `scroll-padding-block-end` equal to the sticky bar's height. |
| 2.5.8 Target Size (Min), AA | 24×24 CSS px, with exceptions for spacing, inline and others | **Follows, and exceeds it.** `--tap: 44px` (`tokens.head.css:56`), buttons `min-height: var(--tap)` (`components.css:85`), inputs 44px (`components.css:128`). Inline references fall back to inline size under the inline exception (`components.css:330-331`). |
| 3.2.6 Consistent Help, A | Help mechanisms repeated across pages appear in the same relative order | **Partly / not checked.** The design places "Help me write this" under the field (`page.src.html:577`) and one help page per method (`page.src.html:621`). I did not verify that a help link sits in the same place on every screen. |
| 3.3.7 Redundant Entry, A | Information already given in a process is auto-filled or offered for selection | **Follows in the install-to-claim journey.** The one-time password is "already filled in if you came straight from the installer" (`ux/screens/library.json`, script "Set up and claim", claim step). |
| 3.3.8 Accessible Authentication (Min), AA | No cognitive-function test unless there is an alternative or a mechanism. Password managers and paste count as a mechanism | **Follows in intent.** The words tell people to save the one-time password in a password manager (`library.json`, same script) and to paste the Anthropic code or API key (`layouts.html:1543`). **Not checked:** the substrate has no `autocomplete=` or `type="password"` markup (0 hits). The real forms must not block paste and must set `autocomplete="username"` / `"new-password"` / `"current-password"`, `"one-time-code"`. |

Also: motion is reduced under `prefers-reduced-motion` (`tokens.head.css:68`, `components.css:108,262,268`), which follows 2.3.3 and good practice. Tooltips state that they meet 1.4.13: dismissible, hoverable, persistent (`components.css:312-315`), and set `aria-describedby` (`page.src.html:889,904`). Small type: tab labels are 11.5px (`components.css:306`) and heat-map axis text is 11px (`components.css:344`). Contrast still holds at those sizes, but they are below the system's own 13px floor (`--t-xs`, `tokens.head.css:31`). There is no `forced-colors` handling (0 hits). Windows High Contrast removes backgrounds, so tinted gap and state chips need a border or an icon to survive. Most chips already have one.

### 1b. WAI-ARIA Authoring Practices Guide (W3C APG Task Force, living, ©2026). https://www.w3.org/WAI/ARIA/apg/ (fetched)
The APG gives patterns with working examples for landmarks, accessible names, tabs, dialogs, disclosure, tooltips and so on. It is a living note, not a standard. Its long-standing advice is to use native HTML first; I did not see that wording on the index page. **Product:** the tooltip pattern follows the APG's tooltip rules: Escape closes it, focus opens it. The tabs and the resizable rail (`components.css:288-291`, arrow keys plus Home) look like the APG "window splitter" pattern. **Not checked:** `role="separator"` with `aria-valuenow` on the grip.

### 1c. WCAG 3 / APCA status
- *WCAG3 Contrast as of April 2026*, Adrian Roselli, Apr 2026. https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html (fetched; expert secondary source). The contrast requirement in WCAG 3 is "Exploratory" and its algorithm is "yet to be determined". APCA was dropped from the drafts in 2023. The latest Editor's Draft is dated 8 Apr 2026, and a Working Draft was reportedly published on 3 Mar 2026 (search only). He does not expect WCAG 3 before about 2030.
- W3C WCAG 3 draft: https://w3c.github.io/wcag3/guidelines (search only).
- **Product:** it uses the WCAG 2 relative-luminance ratio (`check_contrast.py:12-22`), which is correct. It does not use APCA. **Follows.** APCA may be used as an extra advisory check for very light or very dark text, but must not replace the 2.x ratio.

### 1d. US law
- **ADA Title II web rule** (DOJ, 28 CFR part 35 subpart H, final rule April 2024). Interim final rule of 20 Apr 2026 moved the compliance dates to **26 Apr 2027** for public entities serving 50,000 or more people and **26 Apr 2028** for smaller ones. The standard is unchanged: **WCAG 2.1 AA**. Sources (search only; law-firm summaries agree): https://www.reedsmith.com/articles/doj-extends-digital-accessibility-compliance-dates-under-title-ii-of-the-ada/ , https://www.naco.org/news/doj-rule-grants-extension-ada-web-based-accessibility-requirements . Relevance: Civicsmith teams are private groups and not Title II entities. But (a) case files may be sent to councils and oversight bodies, and (b) a government user or partner would need WCAG 2.1 AA. Meeting 2.2 AA covers 2.1 AA.
- **Section 508** (US Access Board, 36 CFR 1194, 2017 refresh) still incorporates **WCAG 2.0 AA**. An update toward 2.1/2.2 is pending after a 2025 RFI (search only; I did not confirm on access-board.gov). It applies only to federal procurement.
- From prior knowledge, not re-checked this run: the European Accessibility Act has applied since 28 Jun 2025 (EN 301 549, which maps to WCAG 2.1 AA). The UK public sector regulations already point to WCAG 2.2 AA, as the Analysis Function page in §6 confirms (fetched).

## 2. Plain language

- **ISO 24495-1:2023, Plain language — Part 1: Governing principles and guidelines** (ISO, 2023). https://www.iso.org/standard/78907.html (ISO returned 403; scope and table of contents from national-body listings, search only). Four principles: readers get what they need (*relevant*), find it easily (*findable*), understand it (*understandable*) and can use it (*usable*). The search snippets confirmed only "relevant"; the other three are from prior knowledge. The standard is text-centred and defers to WCAG and EN 301 549 for accessibility.
- **Federal Plain Language Guidelines** (PLAIN, rev. May 2011). plainlanguage.gov was redirected to digital.gov guides in 2025 and the FPLG were taken down. The Center for Plain Language reposted the last version. https://centerforplainlanguage.org/the-federal-plain-language-guidelines-are-missing/ (fetched; post early 2026). Cite the CPL repost or the Wayback copy, not plainlanguage.gov.
- **GOV.UK Service Manual, "Writing for user interfaces"** (GDS, last updated 16 Apr 2018). https://www.gov.uk/service-manual/design/writing-for-user-interfaces (fetched). Use less copy and add help only where research shows it is needed. Keep one idea per sentence and front-load the words that matter. Avoid negative contractions ("can't", "don't"). Error messages are short and direct, with no "sorry" in validation and no humour. Link text must make sense on its own. Do not use colour, shape or position alone. The GOV.UK style guide says the same about contractions (not re-fetched).
- **Product:**
  - Sentence length **follows**: the 373 sentences in the wizard library average 11.0 words, and only 5 exceed 25 (computed from `ux/screens/library.json`). "What" and "why" are split on every step, which matches "say what to do, then why".
  - Error copy **mostly follows**: the words contain no "sorry" or "oops" (0 hits in `words-*.json`). Failures say what happened and what was or wasn't kept, for example `ux/screens/words-mod-1.src.py:908`: "…stopped with an error instead of answering, so nothing was saved."
  - Error copy **departs** in two places. (1) Raw protocol tokens reach members: "(invalid_grant)" in `ux/layouts.html:3080`, and "error {status}" (an HTTP code) in `ux/screens/words-drawn-2.src.py:1778`, `words-drawn-3.src.py:92`. Keep codes for a details disclosure or a support reference, never in the main sentence. (2) Negative contractions are common (can't 181, isn't 67, doesn't 54, couldn't 54 in the words sources). GOV.UK advises against them. ISO does not ban them, so this is a lane choice to make on purpose.
  - The DEC-86 "never an error" rule for unknowns (`components.css:151-161`) fits plain-language and uncertainty practice well.

## 3. Service design systems

- **GOV.UK Service Standard**, 14 points (GDS). https://www.gov.uk/service-manual/service-standard (fetched; no date shown). Points 1, 2, 4, 5 and 8 bear on the lane: understand users, solve the whole problem, make it simple, make sure everyone can use it, iterate.
- **GOV.UK Design System, Question pages pattern** (GOV.UK Frontend v6.2.0 era, Jun 2026). https://design-system.service.gov.uk/patterns/question-pages/ (fetched). Start with one question per page. Ask only for what you need, and only once. Put a Back link at the top and never break browser Back. Label the button "Continue", not "Next", and align it left. Make the h1 the question, as a `<legend>` or `<label>`. Mark optional fields "(optional)" and never use asterisks. Allow "I do not know". Test without a progress indicator first, then add "Question X of Y" only if needed. Avoid sliders.
- **Error summary component**. https://design-system.service.gov.uk/components/error-summary/ (fetched; changelog shows Frontend v6.2.0, Jun 2026). Always show a summary, even for one error. Its heading is "There is a problem", it sits at the top of `main` above the h1, focus moves to it, and each item links to its field. The text matches the inline message. Prefix the page `<title>` with "Error: ".
- **Notification banner component**. https://design-system.service.gov.uk/components/notification-banner/ (fetched). Use it sparingly and show only one per page. It is for things outside the current task or for the outcome of the last action. The success variant uses `role="alert"` and goes before the h1. Never use it for validation errors.
- **Start using a service pattern**. https://design-system.service.gov.uk/patterns/start-using-a-service/ (fetched). Say what the service does and whether it fits, its cost and how long it takes, and what you need before starting. Use a start button whose wording matches the action. Keep complex eligibility out of the start page.
- **USWDS**: the latest release is **v3.14.0** (18 Aug, year not shown on the page, presumably 2026). https://github.com/uswds/uswds/releases (fetched). It has comparable step-indicator, alert, validation and data-viz guidance at https://designsystem.digital.gov (not fetched).
- **NN/g, "Wizards: Definition and Design Recommendations"**. https://www.nngroup.com/articles/wizards/ (fetched; undated on page). Use wizards for infrequent, unfamiliar tasks and offer a faster route for repeat users. Show all the steps and the current step. Label Back and Next with the step names. Allow save and resume. Make each step self-contained, with help beside the step rather than over it.
- **Product:**
  - The install-to-claim script **follows** "what you'll need" before starting: a Cloudflare Workers Paid plan at $5 a month and about twenty minutes, in its first step (`library.json`, "Set up and claim"). It names the cost and the time, as the GOV.UK start pattern asks.
  - Wizard steps are short with a "why" beside them, which is NN/g's "help beside, not over", and there are 23 scripts.
  - **Not checked or open:** whether question screens put one decision per page with the h1 as the label; whether errors use an error summary that takes focus (no "There is a problem", error-summary pattern or `role="alert"` found in the substrate: 0 hits); whether the primary button says "Continue" or names the step. "Next" and "Back" appear only in the design mock's own viewer (`page.src.html:588`, `layouts.html:1263,2308`), so they are not product evidence.
  - The status vocabulary (`.cs-state`, `components.css:163-168`) and "only Overdue is said unasked" (DEC-94, `components.css:170`) match the GOV.UK advice to use notifications sparingly.

## 4. Design tokens and colour practice

- **Design Tokens Community Group, Design Tokens Format Module 2025.10**, the first stable version, 28 Oct 2025. https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ (fetched); spec at https://www.designtokens.org/tr/2025.10/ (search only). It is a JSON format with `$value`/`$type`, aliases and groups, plus a Color module (CSS Color 4 spaces including oklch and Display P3) and a Resolver module for themes and modes. Implemented by Style Dictionary, Tokens Studio, Terrazzo and Penpot, and supported by Figma and others. It is a Community Group report, **not a W3C Standard**, but it is now the interchange format.
- **Product departs, at low cost.** `ux/visual-language/palette.json` is a flat `{name: "#hex"}` map per theme with a custom `pairs` list, and `build.py` turns it into `civicsmith.css`. It works and is checked. But it is not DTCG, so tools cannot read it, and light/dark are two parallel maps where DTCG uses a resolver. Converting is an option, not a need. The `pairs` list is a good habit that DTCG has no slot for; keep it as `$extensions`.
- Contrast-checking practice (Analysis Function and WCAG): check every *actual* adjacency (text on each surface it can sit on, graphics against their neighbours), and check in both themes and in greyscale or with a colour-blindness simulation. **Product:** both themes, yes (`check_contrast.py:28`). Every adjacency, partly (§1a). Greyscale or colour-blindness simulation: none found. The three `kind-*` hues (`palette.json`, light `#773AC1`/`#0092C3`/`#DF407F`) need a CVD check, because blue next to pink or magenta is a common confusion pair under tritanopia.

## 5. Trust and transparency: AI use, provenance, uncertainty

- **EU AI Act (Reg. 2024/1689), Article 50**. Applies from **2 Aug 2026**. https://artificialintelligenceact.eu/article/50/ (fetched, unofficial consolidated text).
  - 50(1): tell people they are interacting with AI unless that is obvious.
  - 50(2): providers mark synthetic output in a machine-readable way.
  - **50(4): deployers who publish AI-generated text "to inform the public on matters of public interest" must disclose it, unless it "has undergone a process of human review or editorial control" *and* a person "holds editorial responsibility".**
  - 50(5): the disclosure must be "clear and distinguishable… at the latest at the time of the first interaction or exposure" and must meet accessibility requirements.
  - The **Code of Practice on transparency of AI-generated content** was finalised around 10 Jun 2026. The Commission also finalised EU icons for "AI-generated", "AI-modified" and a basic icon with a second layer (search only; Bird & Bird, DLA Piper, Orrick summaries: https://www.twobirds.com/en/insights/2026/taking-the-eu-ai-act-to-practice-the-final-transparency-code-of-practice , https://digital-strategy.ec.europa.eu/en/faqs/signing-code-practice-transparency-ai-generated-content).
- **NIST AI 600-1, AI RMF Generative AI Profile** (NIST, Jul 2024). https://doi.org/10.6028/NIST.AI.600-1 (primary text not opened; search only). Its key themes are content provenance, pre-deployment testing and incident disclosure. It names the risk of "human-AI configuration": over-reliance, automation bias and misplaced trust, mitigated by interface design and human oversight. **UK AI Playbook for Government** (GDS, 10 Feb 2025; search only): be open about where AI is used. The Algorithmic Transparency Recording Standard is the UK record format.
- **C2PA / Content Credentials, spec 2.3** (C2PA, 5 Jan 2026). https://spec.c2pa.org/specifications/specifications/2.3/specs/_attachments/C2PA_Specification.pdf (search only). Signed manifests record origin and edits. The UI shows them with a small "cr" pin that opens a layered panel. That fits images and PDFs better than text.
- **Product:**
  - **Follows the spirit of all three and goes further.** Assistant output is "labeled as machine work in everything it produces" (`layouts.html:1242`). It is "graded no higher than its method earns, and becomes a fact only by the same acts, by a member" (`layouts.html:1308`): human review plus editorial responsibility, which is exactly the 50(4) exemption condition. Machine work has its own neutral colour and mark (`tokens.head.css:9-13`, `palette.json` `machine`). There is a disclosure step before connecting an AI account (`disclosureshown`, `layouts.html:1543-1544`). Machine translation is marked as such (`layouts.html:1706`). Published cases are signed (the ceremony), which is provenance in the C2PA sense, but in the product's own format.
  - **Open:** (a) whether the published case's front matter states AI use at "first exposure", as 50(5) asks, even when the exemption applies. Best practice is to disclose anyway. (b) Whether to also emit C2PA manifests or the EU icon for interoperability. (c) The "machine work" label must reach screen readers as text, not as colour or edge (rule 5, `tokens.head.css:19`, says it does).
- **Showing evidence strength without a combined score.**
  - *Communicating quality, uncertainty and change*, UK Government Analysis Function (Dec 2018, live). https://analysisfunction.civilservice.gov.uk/policy-store/communicating-quality-uncertainty-and-change/ (search only). Put vital caveats up front and fit the depth to the audience, so an "inquiring citizen" gets less detail than an expert.
  - IPCC AR5 *Guidance Note on Consistent Treatment of Uncertainties* (Mastrandrea et al., 2010; search only) keeps **confidence** (evidence × agreement, in words) **separate** from **likelihood** (a calibrated probability), each with fixed calibrated terms.
  - Hullman et al., *In Pursuit of Error*, IEEE TVCG 2018, and Padilla et al. 2020 (search only): show the uncertainty directly, with intervals and distributions and words, rather than collapsing it into a single number.
  - **Product follows:** each evidence ladder has its own hue and texture and is never merged (`components.css:216-230`, DEC-79/82). The five kinds of "gap" have distinct looks, are never errors, and always give a reason (`components.css:151-161`). Shared origin is called out: "one error there could undo both" (`words-t48.src.py:337`). Lane rule to adopt: use fixed, calibrated words for each grade, in the IPCC style, the same everywhere.

## 6. Onboarding, installer, front door, dashboards

- **GOV.UK Start using a service** (above): before starting, give the cost, the time and what you'll need, with one clear start action. **NN/g Wizards** (above). The **GOV.UK Service Manual, writing for UIs**: ask eligibility questions one at a time, not as a list on the start page. For self-hosted tools, common practice (no single authority; synthesised, not sourced) is: one-page "what it is, who it's for, what it costs to run, what you need" → a single install button → a self-test → hand-over of the first admin credential. **Product follows this shape closely:** prerequisites, cost and time; short name with "can never change" explained; self-test on install; one-time password and claim (`library.json`, "Set up and claim", steps 1-5). Front-door pages (civicsmith.org): **not checked**, because they are outside the substrate.
- **Data-viz accessibility: "Data visualisation: colours"**, UK Government Analysis Function (sequential palette updated 12 Feb 2026). https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-colours-in-charts/ (fetched).
  - Chart parts need 3:1 and text 4.5:1.
  - Label directly instead of using legends, and never write "the green line".
  - Use a few consistent colours and check them in greyscale and for colour blindness.
  - Provide alt text that states the message.
  - Put RAG (red/amber/green) status in text as well as colour.
  - Sequential shades rarely reach 3:1 between neighbours, so use them sparingly.
- **Product:** the security heat map **partly follows**. It has a text level label (`.cs-risk` says "raised"/"high", `components.css:337-339`), texture on the top level, and a count on hover, focus or tap. It **departs** where its levels 1 and 2 are tints of one hue (`components.css:347-348`), which is the sequential-palette case the guidance warns about. Add a table or text alternative per row. The measures map was **not checked**: it is a claude.ai artifact, not in the repository.

## 7. Research practice

- **NN/g, "Why You Only Need to Test with 5 Users"** (Nielsen, 18 Mar 2000, still current guidance). https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/ (fetched). About 5 users per round for *qualitative* testing, run as several small iterative rounds rather than one big one. Use 3-4 per distinct user group. Quantitative metrics need about 20, and card sorting about 15.
- **NN/g, "Evaluate Interface Learnability with Cognitive Walkthroughs"**. https://www.nngroup.com/articles/cognitive-walkthroughs/ (search only). A task-based inspection from a new user's point of view, asking the four Lewis/Wharton questions at each step. It suits complex or novel interfaces, and should never be the only method.
- **Product:** the lane has walk tooling and walk triage (`ux/screens/check_walk.mjs`, `walk-T51b-triage.md`, "Questions from the alpha's live walk" artifact), which is a walkthrough practice. **Open:** whether any rounds include real members, especially an installer novice and a disabled participant, as Service Standard point 5 implies. A scripted walker is an inspection, not a usability test.

---

## Open questions

1. Is the product UI (bio-plane) rendering the error-summary pattern (summary at the top, focus moved to it, linked items, "Error:" in the title)? The substrate shows no such pattern.
2. Will the lane write `scroll-padding` for sticky dialog actions, bottom tabs and the dock, so that 2.4.11 holds? This needs a browser check at 390×844 and 1280×900.
3. Should `check_contrast.py` check graphic pairs against every background they sit on (`sheet`, `ground`, tints), not only `surface`, and add a colour-vision check for `kind-*` and the ladders?
4. Keep or drop negative contractions? GOV.UK says avoid them; the product uses them over 370 times.
5. Do raw codes (`invalid_grant`, HTTP `{status}`) move to a details line or support reference?
6. Does the published case state its AI use at first exposure (EU AI Act 50(5) style), even though human review and a signed editorial responsibility exempt it under 50(4)? Should it also carry the EU icon or C2PA?
7. Should the palette move to DTCG 2025.10 (`$value`/`$type`, resolver for themes), keeping `pairs` in `$extensions`?
8. Are the help mechanisms in the same relative place on every screen (3.2.6)?
9. Do password and code fields set `autocomplete` and allow paste (3.3.8)?
10. Should 11px and 11.5px text be raised to the 13px floor?
11. Should there be a `forced-colors` pass for tinted chips and the heat map?
12. Front door (civicsmith.org) and measures-map artifact: not reviewed here.

## Ground truth (best practice the lane should hold)

1. WCAG **2.2 AA** is the target in both themes. It covers ADA Title II (WCAG 2.1 AA, deadlines 26 Apr 2027 and 2028), Section 508 (2.0 AA) and EN 301 549. WCAG 3 and APCA are not standards; use APCA at most as an advisory check.
2. Text 4.5:1 (large 3:1). Every UI boundary and every meaning-carrying graphic 3:1 against **each** adjacent colour it can meet, checked by machine.
3. Never colour alone: every colour has a word or an icon, and chart series are labelled directly with a text alternative.
4. Focus is always visible, at least a 2px ring with 3:1 against what surrounds it, and never fully hidden behind sticky or fixed content.
5. Targets are at least 24×24 (the system holds 44). Inline links are the only exception.
6. No cognitive test to sign in. Allow paste and password managers, set `autocomplete`, and never ask for anything twice in one journey.
7. Help sits in the same place on every page.
8. Respect `prefers-reduced-motion`. Only move things when the member must act.
9. One thing per page for questions. The h1 is the question. Back never breaks. "Optional" is written out and asterisks are never used. "I do not know" is a valid answer.
10. Errors: a summary at the top that takes focus and links to each field, plus a message at the field that says what to do. No "sorry", no codes, no humour.
11. Notifications are rare, one at a time, and never used for validation.
12. Plain language (ISO 24495-1): relevant, findable, understandable, usable. Short sentences, important words first, terms kept consistent.
13. Start and install pages say what it is, who it's for, the cost, the time, and what you need, followed by one start action.
14. Wizards are for rare, unfamiliar tasks. Show the steps and where the member is, allow save and resume, and put help beside the step, not over it.
15. Disclose AI involvement clearly at first exposure, label machine work wherever it appears, and keep a human with editorial responsibility for anything published (EU AI Act Art. 50; NIST AI 600-1 on over-reliance).
16. Provenance is signed and inspectable (a C2PA-style layered disclosure: a short mark that opens to details).
17. Show strength of evidence as separate, calibrated dimensions in fixed words. Never as one combined score, and never hide gaps: state what is not known and why.
18. Tokens live in one checked source. DTCG 2025.10 is the interchange format to align with when tools need it.
19. Test with about 5 people per round, several rounds, per user group, including disabled and novice users. Walkthroughs and scripted walkers find problems but do not replace testing with users.
