Length: 217 lines. Last section: "Changes".

# Screens: Reading a document

Page `reading-a-document` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

This page holds two screens of the group "daily work": `document` and `contradiction`. The group's other thirteen screens are on the page `daily-work`, which also explains the conventions both pages use. In short: what every screen shares is on `every-screen`; both screens here use the working frame (signed out, a visitor sees `front`; a subject the member may not see, or none, shows `unavailable`); the walk has no AI account, so each screen says what shows with the assistant unreachable (absent, not greyed).

Words: exact words in quotes, keyed to `words.json`. A dot key is under `screen.<id>.` (on `document`, `.copy` is `screen.document.copy`), or else shares the stem of the key before it in the same brackets. Square brackets summarise a longer text. `{n}` comes from the record. Controls' words are in the Actions tables; Content cites them by number. Test data: index, section 5 (housing notice 2026-118 is the document the walks read).

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `document` | the document's title | `/app/document/<document>` | built |
| `contradiction` | "Two documents in tension" (S4, S5: their own headings) | `/app/contradiction/<contradiction>` | built |

---

## document: the document's title

- **Address** `/app/document/<document>`. **Frame** working; rail Projects; breadcrumb "{project} › Documents › {title}". **Who** members who may see the document; a held copy only its capturer (S2).
- **Purpose** One document as captured: its words by page, its copy's grade, its versions, its links, the names it carries, and what cites it (`.purpose`).
- **Entry points** `finder` results; `queue` "Decide on a newer version"; `capture` "Open it"; `held` "Open it"; `theme` and `contradiction` document names; `find-in` results; a question's citations.

**Content: the head**
- C1. Heading: the document's title (untitled web page: `document.untitled.web` ["A page from {site}, captured {date}"]); beneath, its issuer, date and "captured by {name} from {source}, {date}" (`.capturedby`) or "uploaded by {member}, {date}" (`document.uploaded.by`).
- C2. Facts: "Where it stands" (no word row on this screen; a state chip); "This copy" (`.copy`) with the grade and A3; "Fingerprint" (`.fingerprint`), card `.fingerprint.means`; "Its text" (`.text.label`): "Full: every page has text", "Partial: pages {pages} have no text", "None: no page has text", "Unread: this copy has not been read yet" (`.text.full`, `.text.partial`, `.text.none`, `.text.unread`), card `.text.tip`.
- C3. Standing: "Vouched for by {member}, {date}. Your team can use this copy." (`document.vouched`), or in S2 the held banner.
- C4. Who issued it, where not known: `.basis.added` or `.basis.fetched`.
- C5. A5.

**Content: "Read it" (`document.read.title`), help `document.read.help`**
- C6. Tabs A6.
- C7. Page bar: "Page {n} of {count}" (`document.read.page`), A7, "Select any words to cite them." (`document.read.select`), A8 (card `document.read.original.card`).
- C8. The page's words. Selected words show choice "Cite in which question" (`.cite.question`), help `.cite.question.help`, options "{question} ({project})" (`.cite.option`) or "Choose a question" (`.cite.choose`); fold "Captured for no question" (`.cite.none.summary`); radio "How it bears on the question" (`.cite.role`); A9.
- C9. Reading notes, as they apply: fold "When the document is a single picture" (`document.image.unread.summary`) with `document.image.unread`; `document.table.flattened` [check figures against the original]; `document.unread.pages` or `document.unread.page`; fold "When the document is a spreadsheet" (`.sheet.fold`) with `.sheet.read`, `.sheet.rows`, `.sheet.none`; `.encoding.assumed`; `.recovery.xref_reconstructed`, `.recovery.pages_missing`, `.recovery.pdf_truncated`; `.supporting.pictures`; `.archive.says`.
- C10. Unread pages: A10 (AI only), A11; row `.ocr.says` [read again with OCR; replaces this reading] with A12; fold "When it cannot be read again" (`.ocr.refused.summary`) [V6].
- C11. Typing a page: section "Pages your team's Civicsmith couldn't read" (`.unread.head`): field "The page" (`.unread.page`), field "The page's words, as written" (`.unread.words`).
- C12. Fold "A page typed by a member" (`.attest.summary`): row "Page {page}, typed by {name}, {date}" (`.attest.row`) with `.attest.status` [counts for no more than that member's word until checked]; field "What you compared" (`.attest.note`), help `.attest.note.help`; note `.attest.at` [you cannot confirm your own typing]; A13; fold "When it cannot be confirmed" (`.attest.refused.summary`); after: "Checked by {name}, {date}" (`.attest.checked`).
- C13. Compare tab (S3): two columns "The version your question cites" and "This copy" (`document.compare.cited`, `.this`), each "Captured {date} by {who}" (`document.compare.captured`); changed words marked; note `document.compare.same` ["{what}, which your question cites, reads the same in both, letter for letter."], `document.compare.changed` ["{what} changed."], "Your citations stay on the version you cited until you move them." (`document.compare.stay`); A14.

**Content: the sections below**
- C14. Section "Versions" (`document.versions.title`), help `document.versions.help` [newest first; a newer copy sits beside the older]: rows "Captured {date} by {who}" (`document.versions.captured`), "this copy" (`document.versions.thiscopy`); chip "Changed since the version your question cites" (`document.versions.changed`), card `.changed.tip`, with `document.versions.where` ["{changed} reads differently; {same} does not."] and A15; "The version your question cites" (`document.versions.cited`); "Reads the same as the {date} copy, letter for letter." (`document.versions.same`). A16; fold "If this address isn't being watched" (`.unwatched.head`) with `.unwatched` and A16's "Watch for changes".
- C15. Section "Your citations" (`.a34.your_citations_leg_by_leg`), help `.a34.one_line_for_each_question_that_rests_on`: note "A newer copy never moves a citation by itself." "Each question that rests on this document is asked about on its own." (`.a34.a_newer_copy_never_moves_a_citation_by_i`, `.a34.each_reasoning_that_rests_on_this_docume`); one row per question: its project, "rests on page {page}" (`.place.restson`), and one of "a newer copy exists, captured {date}" (`.a34.a_newer_copy_exists_captured_2_october`), "page {page} reads the same in both" (`.a34.page_same`), "page {page} reads differently" (`.a34.page_differs`), "not yet checked for a newer copy" (`.a34.not_checked_yet`), "no newer copy exists" (`.a34.no_newer`); A14 or A17 per row. Undetermined: `.a34.the_record_could_not_tell_whether_a_newe` "It does not guess." (`.a34.it_does_not_guess`). After A14: `.a34.moved` ["Citations moved to this copy by {member}, {date}: …"] or `.a34.kept` ["Kept citing the earlier version, by {member}, {date}: …"].
- C16. Section "The record of this copy" (`.a27.the_record_of_this_copy`), help `.a27.who_added_this_copy_who_vouched_for_it_a`: "Recorded by Civicsmith release {version}" (`.record.release`) with `.a27.the_release_of_civicsmith_that_wrote_thi`; note "Everything done to this copy's standing is kept here, oldest first." "None of it is ever changed or removed." (`.a27.everything_done_to_this_copy_s_standing_`, `.a27.none_of_it_is_ever_changed_or_removed`); rows "Added by {member}" (`.record.added`) "held until vouched for" (`.a27.held_until_vouched_for`); "Vouched for by {member}" (`.a27.vouched_for_by_dev`) "now used by the team" (`.a27.now_used_by_the_team`) with what was checked (`.checked.words_and_address`); grade changes. Fold "Earlier revisions of this record" (`.a27.earlier_revisions_of_this_record`): rows "Revision {n}" (`.revision.title`); choices "Compare" and "With" (`.revisions.compare`, `.revisions.with`); A18; side by side "Standing: …", "Grade:", "Vouched for by: …" (`.a27.standing_*`, `.compare.grade`, `.a27.vouched_for_by_*`); `.revisions.truncated`; `.revision.nobytes`; note `.a27.a_copy_that_came_as_a_set_of_files_such_`.
- C17. Section "Fingerprints" (`.fingerprints.head`), help `.a26.short_codes_computed_from_the_exact_byte`, `.a26.anyone_holding_the_same_bytes_computes_t`: rows "This copy's words and file" (`.a26.this_copy_s_words_and_file`) "computed from the exact bytes of this copy" (`.a26.computed_from_the_exact_bytes_of_this_co`); "This copy and the files captured with it" (`.a26.this_copy_and_the_files_captured_with_it`) "computed from the whole set, so the set can be checked as one" (`.a26.computed_from_the_whole_set_so_the_set_c`); each with A19; note `.fingerprint.setonly`.
- C18. Section "What cites it" (`document.backlinks.head`), help `document.backlinks.says`: rows "{project} · cites {where}, {how}" (`document.backlinks.row`; `.citedby.standard`, `.citedby.against`); note `document.backlinks.hidden` ["Something you can't see cites it too: …"]. Not in S2.
- C19. Section "Links this page carries" (`document.links.title`), help `document.links.help`, `.a30.each_is_grouped_by_where_it_leads_and_ca`: tally `.a30.6_links_on_this_page_4_lead_outside_the_` (`.a30.tally.one`, `.a30.tally.none`) and "The site's own navigation links are left out." (`.links.navleft`); groups "Inside this document · {n}", "Beside it · {n}", "Held by the team · {n}", "Outside the record · {n}", "Refused when captured · {n}" (`.links.group.inside`, `.beside`, `.held`, `.outside`, `.refused`); verdict words "Final", "Checked here", "Same version", "Different version", "Not established", "No capture held", "Refused" (`.links.verdict.final`, `.checked`, `.same`, `.different`, `.notestablished`, `.nocapture`, `.refused`); note `.a30.the_other_verdicts_a_held_link_can_carry`, `.a64.not_established_means_the_record_cannot_`; outside links with A20; a refused link "not an address the record will carry." "This is a refusal, not a gap in what was captured." (`.a30.not_an_address_the_record_will_carry`, `.a30.this_is_a_refusal_not_a_gap_in_what_was_`). None: "This page carries no links." (`document.links.none`).
- C20. A21; fold "When it finds no name" (`.people.none.summary`) with `.people.none`.
- C21. Section "People and organizations it names" (`document.names.title`), help `document.names.help`: per name its grade, how it was matched (`.names.matched.identifier`, `.reference_key`, `.label`, `.testimony` …), "{n} mentions · the mention that counts: page {page}, {chosen}" (`document.names.row`) with "chosen by the record (strongest grade)" or `document.names.chosen.member`; A22, A23. None: `document.names.none`.
- C22. Fold "The record matched a mention to the wrong subject" (`.defect.summary`): `.defect.says`; choice "Which match is wrong" (`.defect.which`); field "Why the match is wrong" (`.defect.why`); "A report stays in the record for as long as the record lasts and cannot be withdrawn here." (`.defect.at`); A24; fold "When it cannot be reported" (`.defect.refused.summary`).
- C23. Fold "A name the record did not match" (`.testify.head`): `.testify.note1` to `.note3` [your word, grade D, never lowers a stronger match]; choices "Which name" (`.testify.which`), "Who or what it is" (`.testify.who`); field "How you know" (`.testify.how`); A25.
- C24. Fold "This contradicts another document" (`.contradict.head`): `.contradict.note1`, `.note2`; choice "The passage here" (`.contradict.here`); picker "The other document and its passage" (`.contradict.other`): field "Find a document" (`.pick.find`), documents grouped by project, then "In no project" (`.pick.noproject`), an archive's files under it ("In {archive}", `.pick.member`), "{count} shown here. More are on the next page." (`.pick.more`), `.pick.none`; choice "The passage in it" (`.pick.passage`); field "How they disagree" (`.contradict.why`); A26. Section "Flags raised on this document" (`.flags.head`) with "{a} and {b}" (`.flags.pair`).
- C25. Note `.a31.the_grade_on_each_name_says_how_the_matc`, `.a31.it_says_nothing_about_how_far_to_trust_t`, `.a31.a_connection_to_another_document_takes_t`; A27.
- C26. Section "Connections you assert" (`.connect.heading`), help `.connect.help`: `.connect.says` [your assertion, grade D]; picker "The other document" (`.connect.other`) as C24; field "Why they are connected" (`.connect.basis`); A28; "If you asserted this pair before, nothing is written again and your earlier assertion stands." (`.connect.again`); fold "When it cannot be recorded" (`.connect.refused.summary`).
- C27. Section "Themes" (`theme.section`), help `theme.never.evidence`: rows `.theme.page` ["Page {page}, placed by {name}, {date}: …"], `.theme.whole`, a hunch `.theme.proposed` with A29's "It belongs", "Reject…"; A29.
- C28. Section "Steps it is threaded to" (`progression.threadedto`), help `act.captureprogressions.does`; A30.
- C29. Section "This copy" (`.copyacts.head`), help `document.thiscopy.says`: row "Route to your team: not checked yet." (`.route.standing`) with `.route.says` and A31; fold "What a check can record" (`.route.summary`): `.route.shown`, `.route.notshown`, `.route.same`; fold "When it cannot be checked" (`.route.refused.summary`) with `.route.refused`. Row "Useful when someone may later claim the document was changed after it was captured." (`document.attest.when`) with A32. Fold "Stop using this copy" (`document.retire.fold`): `document.retire.when`; A33.
- C30. Section "Where this document came from" (`.origin.head`), help `.origin.tip`: field "The system it came from" (`.origin.field`), help "For example, the city's records portal." (`.origin.eg`); A34; "A second declaration is added beside the first." "A second declaration never replaces the first." (`.origin.second1`, `.second2`); rows "Said by {member}, {date}" (`.said_by`).

**States**

| State | When | What shows |
|---|---|---|
| S1. A copy the team uses | vouched for | C1 to C30, tab "By page". |
| S2. Held until you vouch | a copy you just captured | C1, C2; banner `document.held.says` ["Awaiting review: held until you vouch for it. Only you can see this copy. …"] with A2; C5 to C17, C19 to C30. No C18. |
| S3. Beside the cited version | tab "Beside the version your question cites", or from a newer-version item | C1 to C5, C6, C13, then C14 onward. |
| S4. Not read in full | reading under way, partial, or failed | in C9's place, one of: `.reading.progress` ["Being read: {read} of {total} so far. …"]; "Read in full. Every line of this file can now be searched and cited." (`.reading.done`); `.reading.inpart` ["Read in part. Not yet searchable or citable: {where}."] with `.reading.inpart.going`; `.reading.notext` (`.reading.notext.one`); `.reading.toolarge`; `.reading.too_large` with `.reading.too_large.lost`; `.reading.repairable` with A35; `document.readnow.pending`; `.text.unread.next`; "Read {read} of {total} words" (`.text.read`). |
| S5. Retired | a member stopped using it | "This copy is retired: you can read it and its history, but new work cannot cite it." (`.retired_copy`); no A9. |
| S6. Assistant unreachable | no AI account | as S1 to S5. No A10; unread pages offer A11 and A12 only; no box of the assistant's reading; earlier hunches in C27 stay. |
| S7. Assistant reachable (`AI`) | an AI account | A10 shows beside unread pages; the assistant's reading, when asked, is marked machine work. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. the follow control (`every-screen`) | always | the document is followed |
| A2. button "Vouch for this copy" (`act.release.label.document`) | S2 | fields "What you checked" (`.release.ack`), "What the team does about what remains" (`.release.mitigation`); then S1, "Vouched for by …" |
| A3. button "Why {letter}?" (`.gradenote.head`; `gradenote`) | always | the grade note in place; none: `.gradenote.none`; ungraded: "Not graded" (`.gradenote.head.ungraded`) |
| A4. a state chip's card | always | what the state allows (`every-screen`) |
| A5. button "Find in this" (`act.findin.label.document`) | always | `find-in`, scope this document |
| A6. tabs "By page" (`document.read.tab.page`), "Beside the version your question cites" (`document.read.tab.compare`) | always | S1 view; S3 |
| A7. links "Previous page", "Next page" (`document.read.prev`, `.next`) | more pages | the page before or after |
| A8. link "Open the original file" (`document.read.original`) | always | `open-file` |
| A9. button "Cite this" (`document.read.cite`), help `document.read.cite.help` | words selected, question and role chosen | cited; the citation points at this copy, page and words |
| A10. button "Have the assistant read pages {pages}" (`.pagetranscribe.button`; `pagetranscribe`) | S7 only, unread pages | `AI`: "The assistant read {pages}. Its words are labeled as its reading." (`.pagetranscribe.done`) |
| A11. button "Type a page's words yourself" (`act.transcribe.label.document`) | unread pages | C11; then "Your typing was recorded for page {page}, labeled as yours." (`.transcribe.done`) |
| A12. button "Read this document again with OCR" (`act.pdfstructure.label.document`) | pages without text | a fresh reading replaces this one |
| A13. button "Confirm that this typing matches the page" (`.attest.button`) | a page typed by another member | "Checked by {name}, {date}" (`.attest.checked`) |
| A14. buttons "Move my citations to this copy" (`act.adoptversion.label.document`), "Keep citing the version I cited" (`act.keepversion.label.document`) | S3, C15 | `.a34.moved` or `.a34.kept` on that row |
| A15. link "Compare them" (`document.versions.compare`) | changed | S3 |
| A16. buttons "Check for a new version now" (`act.monitor.label.document`), "Watch for changes" (`act.monitorset.label.document`) | C14 | "Checked for changes just now." (`.monitor.done`); `.monitorset.done` ["Watching this document's address: …"] |
| A17. button "Ask whether a newer copy exists" (`.a34.ask_whether_a_newer_copy_exists`) | row not yet checked | the row says whether one exists, or that the record could not tell |
| A18. button "Compare these two" (`.revisions.compare.act`) | two revisions chosen | they show side by side; nothing is sent |
| A19. button "Copy" (`shell.copy`) | C17 | the fingerprint is copied |
| A20. an outside link's name; then "Open it anyway" (`.a30.open_anyway`), "Stay in the record" (`.a30.stay_in_the_record`) | outside the record | dialog "You are about to leave the record" (`.a30.you_are_about_to_leave_the_record`) with `.a30.this_page_carried_this_address_and_the_r`, `.a30.what_is_at_the_address_now_the_record_do`, `.a27.opening_it_leaves_the_record_and_nothing`; the site opens outside, or the dialog closes |
| A21. button "Find the people and offices it names" (`act.resolve.label.document`) | always | C21 fills, or C20's note |
| A22. button "Choose the mention that counts" (`act.connectionchoose.label.document`) | a name | the row reads "chosen by {who} on {date}: …" |
| A23. button "Say this is a person we follow…" (`act.identityclaim.label.document`, "Say this is a person we follow") | a name | fields "The person the record follows" (`.claim.label`), "How sure, and from what" (`.claim.basis`: "The same name", "The same name, and something else that matches", "The same identifier"), "Why you think so" (`.claim.note`) |
| A24. button "Report this match as wrong" (`.defect.button`) | C22 | the report is kept beside the match |
| A25. button "Say who this name is" (`act.resolvetestify.label.document`) | C23 | recorded as the member's word, grade D |
| A26. button "Say these two contradict" (`act.contradictionflag.label.document`) | C24 | "Flag raised. The two passages are set side by side as a lead for the team to read." (`.flag.recorded`), or `.flag.already`; the pair opens on `contradiction` |
| A27. button "Explore connections" (`act.explore.label.document`), help `document.names.explore.help` | always | `explore` from this document |
| A28. button "Assert this connection" (`.connect.button`) | C26 | the connection is listed, graded D, with your name |
| A29. buttons "Place it in a theme…" (`theme.place`), "Propose it for a theme…" (`theme.propose`); on a hunch "It belongs" (`theme.confirm`), "Reject…" (`theme.reject`) | C27 | placed, proposed as a hunch, confirmed, or rejected with a reason; a theme's name leads to `theme` |
| A30. button "Thread it to a step…" (`progression.thread.here`; `thread`) | C28 | the step is listed; its progression leads to `timeline` |
| A31. button "Check whether its route can be shown" (`.route.button`) | C29 | one of `.route.shown`, `.route.notshown`, `.route.same` |
| A32. button "Get an independent timestamp" (`document.attest.label`) | C29 | "A timestamp was recorded for this copy." (`.attest.done`) |
| A33. button "Stop using this copy…" (`document.retire.label`) | vouched, not retired | reason "Why stop using it?" (`.retire.reason`); S5 |
| A34. button "Say where this document came from" (`act.owed_declareorigin.label.document`) | C30 | a row "Said by {member}, {date}" is added |
| A35. button "Read it" (`.reading.repairable.door`) | S4, repairable | the reading starts: `document.readnow.pending` |
| A36. registry labels "Compare two revisions", "Copy a fingerprint", "Open an outside link" (`act.owed_revisioncompare.label.document`, `act.owed_hashcopy.label.document`, `act.owed_linkopen.label.document`) | — | the registry's names for A18, A19 and A20 |
| A37. "Follow this item into another dimension", "Search the registers" (`act.owed_followfrom.label.document`, `act.owed_registersearch.label.document`) | — | `not built` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. A9 | no question | "Choose the question to cite this in first." (`screen.find-in.questionfirst`); no question at all: "Open a question first: a passage is cited in a question." (`.cite.noquestion`) |
| V2. A9 | passage not citable yet | "This passage cannot be cited yet. Do one of the steps below, then cite it again." (`.cite.repair.says`) |
| V3. A2 | fields empty | "Say what you checked, and what the team does about what remains." (`.release.empty`) |
| V4. C11 | words empty | "Type the page's words first." (`.unread.empty`) |
| V5. A13 | own typing; no note | `.attest.refused.self` ["You typed this page yourself, so you cannot confirm it. …"]; `.attest.refused.note` ["Say what you compared first, in no more than 2,000 characters: …"] |
| V6. A12 | no permission; no OCR tool; never read | `.ocr.refused.capable`; `.ocr.refused.member`; `.ocr.refused.unread` [each: nothing was read] |
| V7. A23 | person or reason missing | "Choose the person and say why." (`.claim.empty`) |
| V8. A24 | no reason; match gone | "Say why the match is wrong first. Nothing was reported." (`.defect.refused.why`); `.defect.refused.gone` |
| V9. A25 | no basis | "Say how you know this first. Nothing was recorded." (`.testify.refused`) |
| V10. A28 | no reason; other document not found | `.connect.refused.basis` ["Say why they are connected first, in no more than 4,000 characters. …"]; `.connect.refused.other` |
| V11. A31 | not found or not visible | `.route.refused` ["Civicsmith cannot find this document, or you cannot see it. …"] |
| V12. A33 | not vouched or already retired; still cited | `.retire.refused.illegal`; `.retire.refused.cited` ["This copy is cited by {questions}. Remove those citations first, …"] |
| V13. A34 | from the assistant; empty; not a document | `.origin.ref.machine1` `.machine2`; "Name the system it came from." (`.origin.ref.empty`); `.origin.ref.notdoc` |
| V14. A35 | no copy; copy not whole | `.readnow.refused.NO_HOME`; `.readnow.refused.NO_WHOLE_OBJECT` |
| V15. C24 picker | nothing matches | `.pick.none` ["No document you can see has “{text}” in its name."] |

---

## contradiction: "Two documents in tension"

- **Address** `/app/contradiction/<contradiction>`. **Frame** working; rail Projects; breadcrumb "{project} › Two documents in tension". **Who** members of a project holding a side; a member who sees only one side gets S4 or S5; one who sees neither, `unavailable`.
- **Purpose** Two passages in your team's record that are in tension: see both as written, then settle it (`.purpose`).
- **Entry points** `home` "Needs the team" and `queue` link "Open both"; `document` A26; a queue item "Possible contradictions" (`queue.kind.contradiction-lead`).

Keys below starting with a dot are under `screen.contradiction.`; most are long, shown as written in `words.json`.

**Content (S1)**
- C1. Heading "Two documents in tension" (`.name`); beneath "Two passages from your team's documents that may not agree." "Both are shown as they are written; nothing here changes either one." (`.two.passages.from.your.team.s`, `.both.are.shown.as.they.are`).
- C2. Two blocks "First passage" and "Second passage" (`.first.passage`, `.second.passage`): the document's name (a link) and page; the passage in quotes; "Dated {date} · {kind} · captured by {member} on {captured}" (`.passage.meta`), the kind a `.doctype.*` word.
- C3. Section "Why they are side by side" (`.why.they.are.side.by.side`), help `.help.why.these.two.were.put.together`, `.help.the.sentence.in.quotes.is.the`: a sentence on what both state (e.g. `.both.passages.say.when.the.rent`); mark "The assistant's judgment, not a finding: a conflict in the world" (`.the.assistant.s.judgement.not.a`) with the assistant's quoted sentence; rows "Stated dates: {first} · {second}" (`.stated.dates`), "Kinds: {first} · {second}" (`.kinds`). A lead a member raised instead: "{member} said these two contradict, {date}" (`.flagged.by`) and `.lead.member` ["A member raised this lead. It is not a finding: …"], no machine mark.
- C4. Section "How strongly it binds" (`.how.strongly.it.binds`): "This is a conflict the record holds." "It stays open until someone resolves it, and a case that rests on either passage discloses it." (`.this.is.a.conflict.the.record`, `.it.stays.open.until.someone.resolves`).
- C5. Section "Say how they differ" (`.say.how.they.differ`), help `.help.use.this.when.the.two.passages` [both right, about different times, scopes, meanings or viewpoints]: checkboxes "They differ in" (`.they.differ.in`): "Time or occasion", "Scope", "Meaning", "Who saw it, or how", "What it is about" (`.time.or.occasion`, `screen.case-editor.scope.label`, `.meaning`, `.who.saw.it.or.how`, `project.start.title`: the code borrows the two keys outside this screen); field "Say in your own words how they differ" (`.say.in.your.own.words.how`), help `.required.unless.you.accept.all.of` and "It is recorded as yours." (`.it.is.recorded.as.yours`); fields "What holds for the first passage", "What holds for the second passage" (`.what.holds.for.the.first.passage`, `.second.passage`), help "Optional. At most 200 characters." (`.optional.at.most.200.characters`); checkboxes "What in the record shows it" (`.what.shows.it`): "The two stated dates the documents give", "Another passage you name" (`.the.two.stated.dates.the.documents`, `.another.passage.you.name`); note `.with.something.that.shows.it.the`, `.with.only.your.words.the.tension` [with proof it is resolved; with words only it stays open, marked unproven]; A1.
- C6. Section "Say that one of them is wrong" (`.say.that.one.of.them.is`): choice "Which one is wrong" (`.which.one.is.wrong`): "The first passage", "The second passage" (`.the.first.passage`, `.the.second.passage`); field "Why it is wrong" (`.why.it.is.wrong`), help "Every member who sees this will read it." (`.every.member.who.sees.this.will`); note "The passage is never deleted." (`.the.passage.is.never.deleted`) `.it.is.marked.as.corrected.with`; A2. Fold "When it cannot be recorded" (`.when.it.cannot.be.recorded`) [V1 to V5].
- C7. Section "Take it up as a question" (`act.contradictiontakeup.label.contradiction`): `.opens.a.new.question.in.the` [a new question with both passages as evidence]; field "The question" (`screen.calculation.question`), help `.the.question.shown.is.the.default` [required; at most 500 characters]; choice "Which passage the question is about" (`.ask.it.around`): "The first passage", "The second passage", help `.the.passage.you.choose.is.listed`; A3; fold "When it cannot be taken up" (`.when.it.cannot.be.taken.up`) [V6, V7].

**States**

| State | When | What shows |
|---|---|---|
| S1. A conflict the record holds | proposed and held as a conflict | C1 to C7. |
| S2. A lead, not yet a conflict | the assistant's guess, or a member's flag | C1 to C3; "How strongly it binds" with "This is a lead: the assistant's guess that the two may conflict." "It asks nothing of anyone until a member says otherwise." (`.this.is.a.lead.the.assistant`, `.it.asks.nothing.of.anyone.until`); section "Dismiss this lead" (`.dismiss.it`): choice "Why it is not a conflict worth keeping" (`.why.it.is.not.a.conflict`): "They state the same fact, at different precision", "They are not about the same matter", "It is a real conflict, but we will not pursue it" (`.they.state.the.same.fact.at`, `.they.are.not.about.the.same`, `.it.is.a.real.conflict.but`); field "Anything to add" (`.anything.to.add`), help "Optional. At most 500 characters." (`.optional.at.most.500.characters`); note "Dismissing ends this lead, and it stays dismissed." "Your reason and your name are kept with it." (`.dismissing.closes.this.lead.and.it`, `.your.reason.and.your.name.are`); A4; fold "When it cannot be dismissed" (`.when.it.cannot.be.dismissed`) [V8, V9]; C7. |
| S3. Already taken up | taken up as a question | C1 to C3; section "Taken up" (`.taken.up`): "{member} took this up as a question, {question}, on {date}." (`.member.took.this.up.as.a`) "It stays open here until the question is concluded." (`.it.stays.open.here.until.the`); section "Conclude it" (`.conclude.it`): choice "What it turned out to be" (`.what.it.turned.out.to.be`): "They do not really conflict: they differ in a way I can name", "One misquotes the other", "One was misread or mistyped", "One is a version that was replaced", "One is simply wrong", "Someone said one thing and then the opposite", "A rule says one thing and the act did another", "Two rules conflict", "They truly conflict and nothing settles it" (`.they.do.not.really.conflict.they`, `.one.misquotes.the.other`, `.one.was.misread.or.mistyped`, `.one.is.a.version.that.was`, `.one.is.simply.wrong`, `.someone.said.one.thing.and.then`, `.a.rule.says.one.thing.and`, `.two.rules.conflict`, `.they.truly.conflict.and.nothing.settles`); fold "If they differ in a way you can name" (`.if.they.differ.in.a.way`): "They differ in" as C5 plus "Precision", "A matter of opinion" (`.precision`, `.a.matter.of.opinion`), the two "What holds" fields; fold "If one is wrong, or was replaced" (`.if.one.is.wrong.or.was`): "Which one is wrong", "Why it is wrong", help "Required for these answers." (`.required.for.these.answers`); fold "If two rules conflict" (`.if.two.rules.conflict`): choice "How they are reconciled" (`.how.they.are.reconciled`): "The higher rule governs the lower", "The later rule governs the earlier", "The specific rule governs the general", "They can be read together", "They are not reconciled" (`.the.higher.rule.governs.the.lower`, `.the.later.rule.governs.the.earlier`, `.the.specific.rule.governs.the.general`, `.they.can.be.read.together`, `.they.are.not.reconciled`); field "Your conclusion" (`.your.conclusion`), help `.say.in.your.own.words.what`; field "What would change it" (`question.conclude.falsifier`), help "Required unless you tick the box below." (`.required.unless.you.tick.the.box`); checkbox "Nothing could change it (you will be asked who decided that)" (`question.conclude.nofalsifier`); note `.concluding.records.what.the.contradiction.turned`, `.if.it.is.reopened.the.contradiction`; A5; fold "When it cannot be concluded" (`.when.it.cannot.be.concluded`) [V10 to V12]. The question's name leads to `question`. |
| S4. A conflict with a record you cannot see | one side is in a project the member cannot see | heading "Something your project rests on is in conflict" (`.something.your.project.rests.on.is`); beneath "It conflicts with a record you cannot see." "Neither that record nor who holds it is shown to you." (`.it.conflicts.with.a.record.you`, `.neither.that.record.nor.who.holds`); block "The passage you can see" (`.the.passage.you.can.see`); section "What you can do": "Your project can ask to resolve it." (`.your.project.can.ask.to.resolve.it`) `.if.every.project.holding.a.side`; "Another project has already asked." (`.another.project.has.already.asked`) when so; choice "Which project asks" (`.ask.for`); field "Anything to tell them" (`.anything.to.tell.them`), help `.it.is.seen.by.the.other` and the 500-character limit; note `.asking.cannot.be.taken.back.once`, `.no.other.project.is.named.until`; A6; fold "When it cannot be asked" (`.when.it.cannot.be.asked`) [V13 to V15]. |
| S5. Once the projects are named | every project holding a side has asked | heading "A conflict between two projects" (`.a.conflict.between.two.projects`); beneath "Every project that holds a side has asked to resolve it, so the projects now know each other." "Nothing else of them is shown." (`.every.project.that.holds.a.side`, `.nothing.else.of.them.is.shown`); section "The projects that asked" (`.the.projects`): each project, "Asked on {date}" (`.party.asked`); section "Responses" (`.responses`): each response with who and when; section "Respond" (`.respond`): field "Your response" (`.your.response`), help `.it.reaches.the.other.projects.as`; checkboxes "Share with the other projects" (`.share.with.the.other.projects`): "My cover name", "My email address" (`.my.cover.name`, `.my.email.address`); field "Your email address" (`.your.email.address`), help "Shown only if you tick it above." "It is shown as you typed it, not checked." (`.shown.only.if.you.tick.it`, `.it.is.shown.as.you.typed`); note `.a.response.cannot.be.taken.back`, `.nothing.about.you.is.shared.except`; A7; fold "When it cannot be sent" (`.when.it.cannot.be.sent`) [V16 to V18]. |
| S6. Nothing proposed | no pair proposed to the member | heading "Two documents in tension"; beneath "Pairs of passages your team's documents give that may not agree." (`.pairs.of.passages.your.team.s`); note "Nothing has been proposed to you." with `.finding.passages.that.may.conflict.is` [the assistant's work; not available yet]; note `.until.it.is.available.no.document` ["Until it is available, no document is marked as contradicted, and no item about one reaches your queue."] "A pair that was proposed before stays here, and you can act on it." (`.a.pair.that.was.proposed.before`). |
| S7. Assistant unreachable | no AI account | S6 reads "Nothing has been proposed to you." (`.nothing.has.been.proposed.to.you`) with `.finding.passages.that.may.conflict.is.2` ["Finding passages that may conflict is the assistant's work, and the assistant is off for you, so nothing appears here on its own."]. A pair a member flagged (from `document` A26) opens as S2 with `.lead.member`. No A8 anywhere; no assistant suggestion in C5. |
| S8. Assistant reachable (`AI`) | an AI account | C5 shows the assistant's suggestion `.the.assistant.suggests.they.differ.in`, marked machine work; A8 beside the fields a member words. |

**Actions**

| Control | When | Leads to |
|---|---|---|
| A1. button "Say how they differ" (`.say.how.they.differ`; `contradictionclarify`) | S1 | resolved, each passage carrying the note; or softened and open, the notes marked unproven |
| A2. button "Mark it wrong, with a reason" (`.mark.it.wrong.with.a.reason`; `contradictionclarify`) | S1 | the passage is marked corrected, with reason, name and time |
| A3. button "Take it up as a question" (`act.contradictiontakeup.label.contradiction`) | S1, S2 | a new question; this page shows S3 |
| A4. button "Dismiss this lead, with a reason" (`.dismiss.this.lead.with.a.reason`; `contradictiondismiss`) | S2 | the lead ends, dismissed, with reason and name |
| A5. button "Conclude the question" (`act.contradictionresolve.label.contradiction`) | S3 | the question ends; what it turned out to be is recorded |
| A6. button "Ask to resolve it" (`.ask.to.resolve.it`; `contradictionoptin`) | S4 | asked; when every project has asked, S5 |
| A7. button "Send my response" (`.send.my.response`; `contradictionrespond`) | S5 | the response is listed under "Responses" |
| A8. button "Help me write this" (`act.writinghelp.label.contradiction`) | S8 only | `AI`: the assistant words the field from what was typed |
| A9. a document's name in C2 or S4 | always | `document` |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1. C5, C6 | already resolved or dismissed | "Someone already resolved or dismissed this, and it stays as they left it." "Open it from the list to read what they decided." (`.someone.already.closed.this.and.it`, `.open.it.from.the.list.to`) |
| V2. C5 | ways named, no words | "You said they differ but gave no words of your own." "Say how they differ, or accept all of the assistant's suggestions." (`.you.named.a.respect.but.gave`, `.say.how.they.differ.or.accept`) |
| V3. C5 | proof not visible or not stated | `.one.of.the.things.you.named` "Choose something else, or remove it." (`.choose.something.else.or.remove.it`) |
| V4. C6 | no passage or no reason | "You did not say which passage is wrong, or why." "Choose one and say why, then try again." (`.you.did.not.say.which.passage`, `.choose.one.and.say.why.then`) |
| V5. any act | cannot see both passages | "You cannot see both passages, so you cannot act on this." "A member who can see both can." (`.you.cannot.see.both.passages.so`, `.a.member.who.can.see.both`) |
| V6. C7 | closed already | `.someone.already.closed.this.and.it` with `.if.it.was.already.taken.up` [you are shown the question it became] |
| V7. C7 | empty or no side | "The question is empty, or the side to ask it around is not chosen." "Word the question and choose a passage, then try again." (`.the.question.is.empty.or.the`, `.word.the.question.and.choose.a`) |
| V8. A4 | it is a held conflict | `.this.is.a.conflict.the.record.2` "Say how the two differ, or take it up as a question." (`.say.how.the.two.differ.or`) |
| V9. A4 | already closed | "Someone already dismissed or resolved it, or took it up as a question." "It stays as they left it." (`.someone.already.dismissed.or.resolved.it`, `.it.stays.as.they.left.it`) |
| V10. A5 | not from a visible contradiction | "This is not a question taken up from a contradiction you can see." "Open it from the contradiction itself." (`.this.is.not.a.question.taken`, `.open.it.from.the.contradiction.itself`) |
| V11. A5 | a part missing | `.part.of.your.answer.is.missing` "Fill in that part and try again." (`.fill.in.that.part.and.try`) |
| V12. A5 | conclusion or what would change it missing | `.the.question.could.not.be.concluded` "Add what is missing, then try again." (`.add.what.is.missing.then.try`) |
| V13. A6 | project not resting on it | `.that.project.does.not.rest.on` "Choose a project that does." (`.choose.a.project.that.does`) |
| V14. A6 | only a lead | `.this.is.a.lead.not.a` ["This is a lead, not a conflict between projects, … Take it up as a question instead."] |
| V15. A6 | closed | "Someone already resolved or dismissed it, and it stays as they left it." (`.someone.already.closed.it.and.it`) |
| V16. A7 | not asked yet | "Your project has not asked to resolve this yet, so you cannot respond." "Ask first." (`.your.project.has.not.asked.to`; "Ask first." no separate word row) |
| V17. A7 | empty | "The response is empty." "Say something in your own words, then send it." (`.the.response.is.empty`, `.say.something.in.your.own.words`) |
| V18. A7 | sharing what is not yours | "You can share only your own cover name or your own email address." "Untick what is not yours." (`.you.can.share.only.your.own`, `.untick.what.is.not.yours`) |
| V19. A8 (S8) | field empty | "Write something first; the help works from what you typed." (`.help.needed`) |

---

## Differences seen in the code

Read, not run. The design is the authority.

- `document` C14: the code heads the section "Its versions" (`screen.document.versions.head`), not "Versions" (`document.versions.title`) (bio-plane/src/screens-inquiry/document.mjs:797).
- `document` A37: "Follow this item into another dimension" and "Search the registers" are in the key list only, in no screen (bio-plane/src/screens-settings/keys.mjs).

## Changes

- 22 Nov 2026: written.
