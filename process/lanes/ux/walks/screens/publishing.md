Length: 400 lines. Last section: "Changes".

# Screens: Publishing

Page `publishing` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

Preparing a case, sharing a draft for review, the publication ceremony, the published case and its docket as anyone reads them, and another team's case brought in. What binds every screen (frames, rail, refusals, the assistant dock, the read-only note) is on the page "Every screen".

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `case-editor` | "{project}: draft case" / "{case} · Edition {n}" | `/app/case-editor/<project id>` | built |
| `review-copy` | "Share this edition for review" | `/app/review-copy/<project id>` | built |
| `ceremony` | "Publish {case}, Edition {edition}" | `/app/ceremony/<project id>` | built |
| `review-outside` | "A review copy from {group}" | `/app/review#grant=<link>` | built |
| `published` | the case's title | `/app/published/<case id>[/<edition>]` | built |
| `imported` | "Imported cases" / the imported case's title | `/app/imported[/<import id>]` | built |
| `docket` | "Docket" | `/app/docket/<project id>/<case id>` | built |
| `docket-public` | "{case} · Docket" | `/app/docket-public/<case id>` | built |

## How to read this page

- A key written with a leading dot (`.sub`) stands for `screen.<id>.sub` of the screen whose section it is in. Other keys are written in full.
- Weights (the mark on a button, from the design's `mock-kit.js` `WEIGHT`): **W1** no mark; **W2** "Asks for a reason" (`weight.reasoned.name`); **W3** "Ends something" (`weight.terminal.name`); **W4** "You sign this" (`weight.signed.name`); **W5** "Irreversible" (`weight.irreversible.name`). **Outward**: the button also carries the outward icon. A button's hover text is `act.<op>.does`.
- **Protected words** (`words.json` `protected: true`) must show, exactly, before an outward, signed or irreversible act is done; the actions tables list them under "Before it is done".
- The path strip on the three working screens of a draft: "Working" → "Shared for review" → "Published" (`mark.path.working.name`, `mark.path.shared-for-review.name`, `mark.path.published.name`), the current one marked.
- Working-frame screens (`case-editor`, `review-copy`, `ceremony`, `imported`, `docket`): a visitor without a session is shown `front`; a member who cannot see the project is shown `unavailable` ("You can't open this", `shell.unavailable.notyours.title`); a read-only member sees `shell.readonly` and no act button. Published-frame screens (`published`, `review-outside`, `docket-public`) need no session and show no rail; an address with no subject shows "Nothing is here. This address doesn't lead to any page of this Civicsmith." (`unavailable.public`).
- Without an AI account (the walk) the assistant is absent, not greyed: no "Help me write this" (`act.writinghelp.label.<id>`), no machine draft and no machine-only act.

---

## case-editor: "{case} · Edition {n}"

- **Address.** `/app/case-editor/<project id>`. **Frame.** Working. Path: Projects › {project} › "Case" (`.name`).
- **Who can see it.** A member who can see the project; owners set the details of this work. Anyone else: `unavailable`.
- **Purpose.** Prepare a case for publishing: scope, statement, findings, the people it names, what it leaves out (`.purpose`).
- **Entry points.** `project` and `question` (link "The case being prepared"); `ceremony` ("The case being prepared", "Add a finding"); `review-copy` ("Make a draft"); `docket` ("the case being prepared").

**Content (S1, a case's next edition, in draft)**
- C1. Heading "{case} · Edition {n}" (`.edition`); sub-line "Draft · prepared by {who}" (`.preparedby`). Path strip at "Working".
- C2. Choice "Which draft" (act label; options "Scope: {scope} · prepared {date}" `.drafts.item`, the newest marked "newest"; help `.drafts.help` + `.drafts.choose`). Line "{count} review links are live, {earlier} of them on an earlier draft." (`.links.live`; one: `.links.live.one`) as a link to `review-copy`.
- C3. Ladder "How ready it is" (`.ladder`): "Draft", "Internally checked", "Externally compliant", "Distributed" (`.rung.*`), each unmet rung "not yet evaluated" (`.rung.notyet`) or "Checked: something is missing" (`.rung.notmet`). Link "Read what outside readers said ({n})" (`.comments.go`) to `review-copy`, or "No outside reader has commented yet." (`.comments.none`).
- C4. Field "Scope" (`.scope.label`, help `.scope.help`).
- C5. Section "Findings and their roles" (`.findings_and_their_roles`): `.a_case_is_made_of_findings` + `.you_say_for_each_whether_the`; each finding "Finding {n}: its role in the case" (`.finding.role`) "Relied on" / "Supporting" (`.role.*`; help `.relied_on_the_case_rests_on` …).
- C6. Section "What it leaves out" (`.leavesout`): field "What the case does not cover" (help `.required_up_to_2000_characters_without` + `.a_case_silent_about_its_limits`); each item "Left out · {what}" with "Why: {why}"; fields "Something else it leaves out", "Why it is left out"; check "This case leaves nothing material out"; note `.an_empty_list_is_a_claim` + `.silence_is_not_say_either_what`; `.another_member_of_your_team_acknowledges` + `.acknowledgements_from_whoever_wrote_it_are`; rows "Acknowledged by {who}" (`.ack.by`); button "Acknowledge what it leaves out".
- C7. Section "The team's position": choice "Putting this case to the people it concerns" ("We asked, and they answered", "We asked, and had no answer", "We chose not to give notice"); field "Why the team took this position".
- C8. Section "Declared bias": the lens paragraph (`screen.ceremony.this_is_the_lens_in` + `.it_is_fixed_into_the`), link "Read or change the lens" (to `bias`), field "What this bias means for this edition" (help `.say_what_the_teams_declared_bias` + `.write_it_fresh_each_time_the`), note `screen.ceremony.declared_bias_never_blocks_publishing` + `…if_your_team_declared_none`.
- C9. Section "What it cites" (help `.the_passages_this_case_cites` + `.removing_one_takes_it_out_of`): each passage with "Remove" or, if removed, "Reinstate"; field "Your reason" (help `.it_is_kept_with_the_citation` + `.nothing_is_deleted_a_removed_citation`).
- C10. Section "People it names" (`.people`): each person, how named, the reason or "reason missing" (`.people.noreason`), button "Name a person with the reason".
- C11. Section "The account" (`.account`, help `.account.help`): field "The account"; button "See its earlier drafts".
- C12. Section "What changed since Edition {n}" (`.changed`): field "What changed" (help `.changed.help`); button "Prepare the draft", primary.
- C13. Section "Details of this work" (act label `act.owed_casedetails.label.case-editor`): `.details.intro1` + `2`, `.details.outward1` + `2`; four parts "Area of government", "Point of contact", "Related work", "Relationships" (`.details.name.*`), each "Not stated" or "Stated" (`.details.stated`), with "Add to the list" (`.details.list.add`), "Take out" (`.details.takeout`) and "Save this detail"; disclosure "When the details cannot be saved" (`.details.refused.*`).

**States**

| State | When | What shows |
|---|---|---|
| S1 next edition, in draft | A case with a draft | C1 to C13. |
| S2 a project's first case | No case yet | Heading "{project}: draft case", sub-line "Not yet drafted"; disclosure "A draft that names no case yet" (`.nocase.summary`); disclosure "When no question is concluded yet" (`.noconcluded`); section "Concluded questions, each with its findings" (`.whatgoesin`, note `.whatgoesin.note`); field "Scope"; button "Prepare the draft"; "Details of this work" with only `.details.first` ("The details of this work open once you have saved the case: …"). |
| S3 an edition just published | Latest edition published, no draft | Sub-line "Published: Edition {n}, {date}, signed by {who}" (`.published.sub`); note `.published.note`; row "Edition {n}" · "read by anyone with its address" (`.published.reach`) with link "Read Edition {n} as published" (`.published.read`) to `published`; section "The next edition" with `.next.lead` and link "Start the next edition" to `docket`. |
| S4 assistant unreachable | No AI account | Section "The account" has no "Order it", no "Draft the account with the assistant", no machine draft and no flagged-sentence list; no "Draft "what changed""; no "Help me write this". The fields are empty or the member's own. |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 choice "Which draft" (`act.casedrafts.label.case-editor`) | Several drafts | Same screen, that draft. W1. |
| A2 button "Prepare the draft" (`act.casedraft.label.case-editor`), primary | always | Same screen: "The draft is prepared." (`.prepared`). W2. |
| A3 button "Acknowledge what it leaves out" (`act.statementack.label.case-editor`) | A member other than the writer | Same screen, "Acknowledged by {who}". Asks "Your reason for acknowledging it" (`.ack.reason`). W2. |
| A4 button "Name a person with the reason" (`act.attribute.label.case-editor`) | A person named | Asks "How they are named" ("By name", "By a description that covers them", "As the project", "As the team"; `.level.*`) and "The reason the case must name them". W2. Before it is done: `consequence.attribute` (protected: "The level you choose is what this case edition publishes … this one never stops saying it. …"). |
| A5 button "Remove" (act "Remove a citation") | A cited passage | Same screen, the passage shows removed with the reason. W1. |
| A6 button "Reinstate" (`act.reinstate.label.case-editor`) | A removed passage | Same screen. W1. |
| A7 button "See its earlier drafts" (`act.accountdrafts.label.case-editor`) | always | Same screen, the drafts listed. W2. |
| A8 button "Draft the account with the assistant" (`act.accountpropose.label.case-editor`) | Assistant reachable | Same screen, a machine draft and `.account.use` + `.account.notasis`. W2. `AI` |
| A9 button "Draft "what changed"" (`act.whatchangedpropose.label.case-editor`) | Assistant reachable | Same screen: `.changed.kept`. W1. `AI` |
| A10 "Save this detail" (`act.owed_casedetailsset.label.case-editor`), "Add to the list", "Take out" | Case saved, project owner | Same screen, the part shows "Stated". W1. Before it is done: `.details.outward1` + `2`. |
| A11 links "Read what outside readers said ({n})", "{count} review links are live…" | Links or comments exist | `review-copy`. |
| A12 link "Read or change the lens" | always | `bias`. |
| A13 link "Read Edition {n} as published" / "Start the next edition" | S3 | `published` / `docket`. |

**Form messages** (each under a "When …" disclosure; each ends "Nothing was recorded.")

| Field | Condition | Message |
|---|---|---|
| V1 roles | no role or none relied on | "A finding has no role, or none is relied on. Choose a role for every finding, and rely on at least one." (`.a_finding_has_no_role_or` + `.choose_a_role_for_every_finding`) |
| V2 roles | relied-on finding below the standard | `.a_finding_you_rely_on_does` + `.make_it_supporting_or_strengthen_it` |
| V3 left out | item without what or why | `.an_item_names_nothing_or_has` + `.say_what_is_left_out_and` |
| V4 any long field | over 2,000 characters, quotation mark, backslash or line break | `.a_field_is_longer_than_2000` + `.shorten_it_or_reword_it_then` |
| V5 position | none or no reasoning | `.no_position_is_chosen_or_it` + `.choose_one_and_say_why` |
| V6 bias acknowledgement | missing or reused | `.the_acknowledgement_is_missing_or_it` + `.write_it_for_this_edition` |
| V7 citation | no reason, or not a member | `.you_gave_no_reason_or_you` + `.write_why_or_ask_a_member` |
| V8 account | missing | "The account is missing or can't be read. Write it, then save again." (under `.account.refused.summary`) |
| V9 scope; what changed | empty | "Write the case's scope first." (`.scope.needed`); "Write what changed first." (`.changed.needed`) |
| V10 details | not owner; body not followed; malformed; case not saved | `.details.refused.owner1`; `.details.refused.body` + `2`; `.details.refused.malformed1` + `2`; `.details.refused.nocase1` + `2` |

---

## review-copy: "Share this edition for review"

- **Address.** `/app/review-copy/<project id>`. **Frame.** Working, with the band "{n} people outside the team can read this until {date}" (`.band`, protected). Path: Projects › {project} › "Review copy".
- **Who can see it.** A member who can see the project. Anyone else: `unavailable`.
- **Purpose.** A draft shared with named outside readers before publishing; their comments come back here (`.purpose`).
- **Entry points.** `case-editor` (live-links line, "Read what outside readers said"); `ceremony` (live-links line); `project` and `question` (link "Review copies").

**Content (S1, the sharing)**
- C1. Heading "Share this edition for review" (`.heading`); sub-line "A named reader gets a view that you can stop at any time." (`.sub`). Path strip at "Shared for review".
- C2. Choice "Which draft" (as on `case-editor`).
- C3. "Named readers" (`.readers`): each reader, their role, and "can read Edition {edition} until you stop sharing" / "can read until {until}" (`.reads.stop`, `.reads.until`, protected) or "could read Edition {edition} until {until}: ended" (`.reads.ended`); button "Stop sharing" on each live one.
- C4. Buttons "Share with a named reader" (`.share`), primary, and "Save as a file".
- C5. Section "Every live review link" (`.links.heading`, help `.links.help`): each with the draft's scope, "shared {date}", "1 comment" / "{n} comments", button "Stop sharing"; note `.links.note`.
- C6. Section "The reader's link": the address `…/app/review#grant=…`, "For {who} · works until {until}, or until you stop sharing · Civicsmith sends no email: copy the link and send it yourself." (`.link.line`, protected); link "Copy the link"; `.link.once` (protected).
- C7. Section "Comments" (`.comments`): each comment with who ("{who}, an outside reader" `.from.reader`) and date, button "Reply" (act "Comment"); acknowledgements "{who}, an outside reader, read the draft and acknowledged it, {date}" (`.acked`).

**States**

| State | When | What shows |
|---|---|---|
| S1 the sharing | A draft exists | C1 to C7. |
| S2 saving a copy as a file | After "Save as a file" | Heading "Save this copy as a file"; refusal-styled box "A file can't be recalled. …"; section "What the file carries" (fingerprint, the date this copy last changed, its author, the minimum strengths, each "on every page") and note; check "I understand that this file can't be recalled"; button "Save the file", primary; disclosures "When the copy can't be stamped", "When this browser doesn't accept the file". Keyed under `screen.review_copy.*` (e.g. `screen.review_copy.save.this.copy.as.a`, `screen.review_copy.save.file`). |
| S3 no draft yet | No draft | Disclosure "When there is no draft yet" (`.nodraft.summary`): "There is no draft to share yet. Make a draft of the case first, then share it." (`.nodraft`), link "Make a draft" (`.nodraft.go`) to `case-editor`. |
| S4 time zone not set | Team has none | "Your team's time zone isn't set, and a review link's end date is counted in it. Set it under Settings, Your team, then share." (`.until.nozone`); a non-administrator sees `.until.nozone.member`. |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 button "Share with a named reader" (act "Share for review", `act.reviewgrant.label.review-copy`), primary | A draft; zone set | Asks "The reader's name", "Their role" (help `.role.help`), "Until" (help `.until.help`) and a reason; then C6 with the link, shown once. W2, Outward. Before it is done: `act.reviewgrant.does` ("Shares the draft with named people outside the team until a date. …", protected) and `mark.path.shared-for-review.means` (protected). |
| A2 button "Stop sharing" (`act.reviewrevoke.label.review-copy`) | A live link | Same screen; that reader shows "…: ended". W3. Before it is done: `act.reviewrevoke.does` "Stops sharing the review copy at once." (protected). |
| A3 button "Reply" (act "Comment", `act.reviewcomment.label.review-copy`) | A comment | Asks "Your reply" (`.reply.label`). W1. |
| A4 button "Save as a file" (`act.owed_reviewexport.label.review-copy`) | A draft | S2. In S2, "Save the file" saves a stamped file in the browser. W2. Before it is done: "A file can't be recalled. …" and the tick box. |
| A5 choice "Which draft" (`act.casedrafts.label.review-copy`) | Several drafts | Same screen. W1. |

**Form messages.** V1 reader: "Name the reader, their role and the date sharing ends." (`.reader.needed`). V2 until: "Choose a day that has not yet ended: the link cannot end in the past." (`.until.bad`, protected). V3 reply: "Write your reply first." (`.reply.needed`). V4 S2: "This copy could not be stamped …"; "This browser did not accept the file, so none was made. Nothing left this page."

---

## ceremony: "Publish {case}, Edition {edition}"

- **Address.** `/app/ceremony/<project id>`. **Frame.** Working. Path: Projects › {project} › "Publish" (`shell.step.ceremony`).
- **Who can see it.** A member who can see the project; only an owner signs (S7). Anyone else: `unavailable`.
- **Purpose.** The last checks, then signing; publishing is permanent and corrections come as a new edition (`.purpose`).
- **Entry points.** `project` and `question` (link "Publishing"); `dash-project` ("Prepare Edition {n}").

**Content (S1, the ceremony at its last steps)**
- C1. Heading "Publish {case}, Edition {edition}" (`.heading`); sub-line "Publishing makes this edition permanent and public. It can be corrected by a new edition, never removed." (`.permanent`, protected).
- C2. Step list "What", "Strength", "Leaves out", "People", "Photos", "Disclosures", "Bias", "Preview", "Ties", "Sign" (`.step.*`), the current step marked.
- C3. Choice "Which draft" and the live-links line (as on `case-editor`).
- C4. Section "Before publishing" (`.checks`): each finding and its strength, "Every check against the bar holds." (`.ready`) or "These stop the signing until they are put right:" (`.notready`); button "Check again" (act "Check before publishing").
- C5. Section "Details of this work": the four details, each "Stated" / "Not stated"; note `.details.ceremony.notstated1` + `2`; button "See the details of this work".
- C6. Section "Disclosed with the case" (`.disclosed`): "An unresolved contradiction: {what}" (`.disclosed.tension`, protected), "The timeline, frozen at signing ({n} events)" (`.disclosed.timeline`, protected); note `.disc.intro1` + `.disc.intro2`; checks "Contradictions to disclose with the case"; field "Your words about this contradiction (optional)" (help `.disc.words.help1` + `2`); disclosure "When a contradiction is refused"; button "See what must be disclosed".
- C7. Section "Documents without a second confirmation" (`.conf.heading`): `.conf.intro1` + `.conf.intro2`; each document with "no trusted time stamp, no outside copy" (`.conf.row.meta`); button "Ask for the confirmation again"; note `.conf.retry.note`; check "Publish {document} as self-attested only" (`.conf.self.tick`, under "If it stays unconfirmed"); field "Why you publish it as self-attested only"; note `.conf.self.note`; field "Your signed account of the capture (only {name}, who captured it, adds this)"; button "Add your signed account"; disclosure "When these are refused".
- C8. Section "Photos in this case" (`.photos`): each photo "taken by {by}, {date} · relied on by {findings}" with "Marked" / "Nothing to obscure" / "Not yet checked"; `.photos.copy`, `.photos.gate`, `.photos.rules` (protected); buttons "Mark who and what to obscure in a photo", "Withdraw a mark on a photo, with a reason".
- C9. Section "Your ties" (`.ties`): check "I have no undeclared tie to anyone this case concerns, including anyone paid in its money" (`.ties.confirm`, protected); button "Confirm your ties and prepare the edition for signing" (help `act.publish.here.ceremony`); note `.ties.part`.
- C10. Section "Open requests for comment" (`.openrequests.heading`, help `.openrequests.says`): one line per open request.
- C11. Section "The minutes beside the team's public comment" (`.minutes.heading`, help `.minutes.says`): the two texts side by side.
- C12. The signing box "Sign and publish Edition {edition}" (`.sign.edition`, protected): `signing.ceremony.who` (protected: "You sign as {signer}, an owner of {project}. The public page will read “Published by {group} · signed by {signer}”. …"); radio "When it becomes public" (`.when`): "Now" / "At a set time: {date}, {time} ({zone})" (`.when.chosen`, protected); `.when.note` (protected); field "Your password" (`shell.password`, help `session.reauth`, protected); `.signs.count` (protected: "One confirmation signs all {n}: …"); disclosure "What your key signs, exactly" (`.signs.exactly`) with lines and `.signs.lines`, `.signs.linesabout` (protected); disclosure "What you are signing, in plain words" (`.plain.head`, `.plain.1`-`.plain.4`); buttons "Sign and publish at {time} on {date}" (`.publishat.button`, protected), primary, and "Sign and publish now"; `.device.next` ("Next, your device asks you once to confirm with your signing key. Nothing is signed until you do.").

**States**

| State | When | What shows |
|---|---|---|
| S1 the ceremony, at its last steps | A prepared edition, owner, key in browser, computer | C1 to C12, step "Ties" marked. |
| S2 your device confirms the signature | After a signing button | Step "Sign"; box "Confirm on your device" (`.device.head`, protected): `signing.ceremony.device` (protected); an example window "Your device's own window (it looks different on each device)" (`.device.example`) with "Use your signing key?"; `.device.cancel` (protected: "If you cancel there, or your device doesn't confirm, nothing is signed or published, and you are back at the last step with everything as it was."). |
| S3 signed, publishing at the set time | Signed with a set time | Step "Sign" done; `signing.ceremony.signedat` (protected: "Signed. Edition {edition} becomes public on {date} at {time} ({zone}). Until then it waits, not public. …"); rows "Edition {n}", "Findings …", "The {n} pieces of evidence" (`.signed.evidence`) each "signed" (`.signed`); buttons "Move the publishing time", "Cancel publishing"; note `.signedat.note`. |
| S4 signed and published now | Signed now | `signing.ceremony.signednow` (protected: "Signed and published. Edition {edition} is public now: …") + `.signednow.told`; link "Open the public page" (`.publicpage`) to `published`. |
| S5 no signing key in this browser | No key here | Box with `signing.ceremony.nokey` (protected: "You have no signing key in this browser. Register one here: …"), `.nokey.keyfile`; check `signing.ceremony.keepkey` (protected); button "Register a signing key in this browser", primary; button "Use a key file you already have" (`shell.signer.load`); `.nokey.elsewhere`. While registering: `.registering`; after: `.registered`. |
| S6 on a phone | Phone width | `signing.ceremony.phone` (protected: "Signing and publishing finish on a larger screen. Everything here can be read on a phone. Open {project} on a computer to sign: the ceremony is where you left it."); no signing button. |
| S7 a member who isn't an owner | Not an owner | `signing.ceremony.notowner` (protected: "Only an owner of {project} signs its cases: {owners}. Everything you prepared stays as it is. Ask one of them to sign."); button "Ask an owner to sign". After: "The owners are asked to sign, in their queues." (`.asked`). |
| S8 a finding departs from how a standard may be used | Pre-flight fails | Step "Preview"; section "Fix these before you sign" (`ceremony.gate.heading`): `ceremony.gate.notargets`, link "Add a finding" (`.gate.addfinding`), `refusal.PUBLISH_NO_FINDING`, "This stops the signing: {what}. Put it right above, then check again." (`ceremony.gate.other`); "Before publishing" with a finding "not ready" and the refusals (a benchmark that does not bind; a copyrighted passage); button "Check again". |
| S9 your team's time zone isn't set | No zone | In the signing box: `refusal.PUBLISH_AT_NO_ZONE` ("Your team's time zone isn't set, and a publishing time is counted in it, so only "Sign and publish now" is offered. …"); only "Sign and publish now", primary. |
| S10 nothing ready to publish | No prepared case | Heading "Publish"; note `.nothing` ("Nothing is ready to publish: this project has no prepared case yet. Prepare one from its concluded questions."); link "The case being prepared" to `case-editor`. |
| S11 the open requests can't be read | Read fails | Section "Open requests for comment" holds only `signing.openrequest.unread` (protected). |
| S12 the minutes can't be read | Read fails | Section "The minutes beside the team's public comment" holds only `signing.minutes.unread`. |
| S13 the declared bias step | Step "Bias" | Step "Bias" marked; section "Declared bias": the team's statement in quotes, `.the_teams_own_statement_of` + `.every_published_case_carries_it`, `.this_is_the_lens_in` + `.it_is_fixed_into_the`, link "Read or change the lens" (to `bias`), note `.declared_bias_never_blocks_publishing` + `.if_your_team_declared_none`; help `.what_the_case_tells_its`. |

The assistant has no part in the ceremony: no state changes without it.

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 "Check again" (`act.publishpreflight.label.ceremony`: "Check before publishing") | always | Same screen, C4 redrawn; S8 if a check fails. W1. |
| A2 "See what must be disclosed" (`act.publishtensions.label.ceremony`) | always | Same screen, C6. W1. |
| A3 "Ask for the confirmation again" (`act.reattest.label.ceremony`) | An unconfirmed document | Same screen, C7. W1. |
| A4 "Add your signed account" (`act.captureaccount.label.ceremony`) | The capturing member | Same screen. W2; signed with the member's key. Before it is done: `act.captureaccount.does` ("… it cannot be removed."). |
| A5 "Mark who and what to obscure in a photo" / "Withdraw a mark on a photo, with a reason" | A photo | Asks "Draw a rectangle over each area to obscure" (`.areas.label`) and "What it covers" ("A person not part of a finding", "A number plate", "A city staff member at work"; `.area.*`), or "Why the mark is withdrawn"; the photo shows "Marked". W2. |
| A6 "Confirm your ties and prepare the edition for signing" (`act.publish.label.ceremony`) | Ties ticked | Same screen: "Edition {edition} is prepared for signing. Nothing is published yet." (`.prepared`). W5, Outward (design). Before it is done: `.ties.confirm`, `act.publish.here.ceremony`, `.permanent`. |
| A7 "Sign and publish at {time} on {date}" (`.publishat.button`; act `act.publishat.label.ceremony` "Sign now and publish at a set time, checked again then"), primary | Prepared, owner, key, zone set, computer | The password is asked again ("Enter your password again", `session.reauth.head`), then S2, then S3. W5, Outward. Before it is done: `.permanent`, `signing.ceremony.who`, `.when.chosen`, `.when.note`, `.signs.count`, `.device.next`, `act.publishat.does` (all protected). |
| A8 "Sign and publish now" (`act.caseratify.label.ceremony`) | Prepared, owner, key, computer | Password again, then S2, then S4. W4. Before it is done: `.permanent`, `signing.ceremony.who`, `.signs.count`, `.device.next`, `act.caseratify.does` ("Signs this edition, its findings and their evidence with your key, and publishes it now. …", protected). |
| A9 "Register a signing key in this browser" (`act.signerregisterown.label.ceremony`), primary | S5 | Same screen, S1 with "Your signing key is registered. Sign again when you are ready." W4. Before it is done: `signing.ceremony.nokey`, `signing.ceremony.keepkey`, `act.signerregisterown.does` (protected). |
| A10 "Ask an owner to sign" (`act.signrequest.label.ceremony`) | S7 | Same screen, `.asked`. W1. |
| A11 "Move the publishing time" (`act.publishatmove.label.ceremony`) | S3 | Asks "Date", "Time"; S3 with the new time. W2. |
| A12 "Cancel publishing" (`act.publishatcancel.label.ceremony`) | S3 | Same screen; the edition is not published. W2. |
| A13 "See the details of this work" (`act.owed_casedetails.label.ceremony`) | always | Same screen, the four details. W1. |
| A14 "Which draft" (`act.casedrafts.label.ceremony`) | Several drafts | Same screen. W1. |
| A15 links "Read or change the lens", "The case being prepared", "Add a finding", "Open the public page" | S13; S10; S8; S4 | `bias`; `case-editor`; `case-editor`; `published`. |

**Form messages**

| Field | Condition | Message |
|---|---|---|
| V1 contradictions | unlisted; listed but resolved; unreadable | `.disc.refused.notlisted1` + `2`; `.disc.refused.standing1` + `2`; `.disc.refused.unread` |
| V2 self-attested | unlisted; no reason; already confirmed; not the capturer | `.conf.refused.unlisted1` + `2`; `.conf.refused.noreason1` + `2`; `.conf.refused.standing`; `.conf.refused.actor` ("Only the member who captured a document adds an account of the capture.") |
| V3 ties | unticked | "Tick your confirmation first." (`.ties.needed`) |
| V4 set time | missing | "Give the date and time it becomes public." (`.when.needed`) |
| V5 photo areas | none drawn; staff without reason | `.areas.needed`; `.area.reason.needed` |
| V6 photo format | cannot be obscured | `.photo.format` |
| V7 signing | no document; no key; not owner | `.sign.nodoc`; `.refused.nokey`; `.refused.notowner` |

---

## review-outside: "A review copy from {group}"

- **Address.** `/app/review#grant=<link>` (the link the team sent). **Frame.** Published: no session, no rail.
- **Who can see it.** Anyone holding a live review link. Without one: "This address carries no review link. Open the link the team sent you." (`.nolink`). A stopped or ended link: the refusal for it.
- **Purpose.** What someone outside the team sees when asked to review a draft case (`.purpose`).
- **Entry points.** The review link only (copied from `review-copy` C6 and sent by a member).

**Content**
- C1. Heading "A review copy from {group}" (`.heading`); sub-line `.sub` (protected: "Before publishing, the team asks you to read this draft of its case and comment. It is not public: only people with this link can read it, until {date}."). The end is stated by `.until` ("… until {date} at {time} UTC.", protected), `.until.zone` or `.untilstopped` (protected).
- C2. Note `.comments.go` (protected: "Your comments go to the team. They may publish without your comments, and if they do, you can still file a response in the case's public docket, as anyone may.").
- C3. Section "The case: {case}, Edition {edition} (draft)" (`.draft`): the opening of the draft; link "Read the whole draft" (`.readall`).
- C4. Section "What the case says it does not cover": the statement in quotes; field "Your note" (required); button "Acknowledge it".
- C5. Section "Your comment" (`.comment`): field "What you would correct or add" (`.comment.label`, help `.comment.help`); button "Send your comment", primary.

**States.** S1 a live link (C1 to C5). S2 no link (`.nolink` only). S3 comment sent: "Sent to the team." (`.sent`). The assistant has no part here.

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 "Send your comment" (`act.reviewcomment.label.review-outside`), primary | S1 | Same screen, S3; the comment appears on `review-copy` C7. W1. |
| A2 "Acknowledge it" (act `act.statementack.label.review-outside`: "Acknowledge what the case does not cover") | S1 | Same screen; `review-copy` shows `screen.review-copy.acked`. W2. |
| A3 link "Read the whole draft" | S1 | The whole draft, same screen. |

**Form messages.** V1 comment empty: "Write your comment first." (`.comment.needed`).

---

## published: "{case}"

- **Address.** `/app/published/<case id>[/<edition>]`. **Frame.** Published: no session, no rail.
- **Who can see it.** Anyone with the address. An address with no case: `unavailable.public`.
- **Purpose.** A published case as anyone reads it: findings, their strength, the evidence, and how to check it without the team (`.purpose`).
- **Entry points.** `front` ("All our published cases"); `site`; `question`, `project` ("Published cases"); `case-editor` ("Read Edition {n} as published"); `ceremony` ("Open the public page"); `docket-public` ("Back to the case").

**Content (S1, the whole case)**
- C1. Heading: the case's title. Line "Edition {edition} · signed {signed} · published {published}" (`.dated`), earlier editions as links ("Edition {n}"). A withdrawn edition: "This edition is withdrawn. Its docket says why." (`.withdrawn`).
- C2. "This case is the work of {group}." (`.whose`) and `.howtoread`, link "How to read a case" (`.howtoread.link`).
- C3. "Findings" (`.findings`): each "Finding {n}" with its text and "Relied on · meets this project's bar (capture {capture}, connection {connection})" (`.meets`) or "Not relied on" / "below this project's bar" (`.below`), link "the evidence".
- C4. "Corrections and orders" (`.corrections.heading`): "None since it was published." (`.corrections.none`) then "Every correction, withdrawal and court order on this case is listed on its docket." (`.corrections`), "its docket" a link to `docket-public`.
- C5. "People named" (`.people`): "{name}, by title: {reason} (finding {n})." (`.named`, protected).
- C6. "Details of this work": the four details; note `.details.pub.current1` + `2`.
- C7. "Left out of this case" (`.what_this_case_leaves_out`): the statement; "Written by {writer} and published by {publisher}, {date}." ; "Who else read this statement" with names and dates; disclosures "When no one else has read the statement", "When the edition does not say".
- C8. "Contradictions the team disclosed" (`.contradictions_the_team_disclosed`): each with "One side: {side}", "The other side: {side}", "The team's explanation: {explanation}", "Read by {who} on {date}."; a finding set apart (undetermined mark); note `.a_contradiction_set_apart_this` + `.it_is_told_to_you`; disclosures "The other things a disclosed contradiction can say", "When the team disclosed none", "When the edition was signed before this was disclosed".
- C9. "How this team reads evidence" (`.the_lens_this_team_read`): the team's statement, each lens statement and why, "1 citation is held back, and which one is not said."; "What this set does not enforce"; "Lens" with its fingerprint; disclosures "When the edition carries only the lens's fingerprint", "When the team declared none".
- C10. Buttons "Check the signature", "Download the complete edition" (`.download`), "Print the case". After checking: "The signature checks: this is what the team published." (`.verify.ok`) / `.verify.no` / `.verify.none`.
- C11. "Read it at a minimum strength" (`.read.it.at.a.minimum`): note `.choose.the.weakest.strength.you` + `.the.page.then.shows.only`; "How well the documents are held" and "How firmly they are linked", each "No minimum", "C or better", "B or better", "A only" (`.min.*`); button "Show only findings this strong".
- C12. "Check a file you hold" (`published.check.title`, help `published.check.help`): "Choose the file" with `.your_computer_works_out_the` + `.the_file_itself_never_leaves`; "Its fingerprint, worked out on your computer: {fingerprint}"; "Or paste a fingerprint you already have"; button "Check it" (`published.check.go`); result `published.check.yes` / `published.check.no` (protected) / `published.check.elsewhere`; disclosure "When nothing can be checked yet".

**States**

| State | When | What shows |
|---|---|---|
| S1 the whole case | Default | C1 to C12; C4 "None since it was published." |
| S2 one correction since | One docket entry | C4: "One since it was published: {kind}, {date}." (`.corrections.some.one`; kind e.g. "a new edition"). |
| S3 several corrections since | Several | C4: "{count} since it was published. The latest: {kind}, {date}." (`.corrections.some`). |
| S4 corrections that can't be counted | Docket unreadable | C4 shows only `.corrections` with the docket link. |
| S5 a filtered view | After "Show only findings this strong" | Box: "A filtered view you built." `.you.asked.for.findings.held` `.this.is.part.of.the` (or `.many`) `.the.team.s.signature.covers`; buttons "Back to the whole case", primary, and "Print the case"; only the findings at or above the minimum; disclosure "When no finding meets the minimum" (`.no.finding.in.this.case` + `.lower.the.minimum.or.go`). |
| S6 one finding | A finding opened | Heading "Finding {n}"; line "{case} · Edition {n} · Back to the whole case"; the finding and its strength; "What would overturn it" (or disclosure "When the finding states nothing that would overturn it": `.falsifier.override`); "What this finding leaves out"; "What it rests on" (legs "Leg {n}" · "supports it" / "cuts against it", a document only named shows "A document, not published with the case" `.leg.namedonly`); "What rests on what" (`.read.each.line.from.the`); "Whether the question was divided". |
| S7 the printed case | After "Print the case" | On screen only: `.this.is.what.comes.out` and buttons "Print the case", primary, "Back to the whole case". Printed: title, "Edition {n} · published {date} · by {group}", each finding, "Rests on: {count} documents, not published with the case.", "Sources: none published with this case. …" (`.sources.nonepublished`), "Signed for {team} by {member} on {date}, with the key whose fingerprint is …" (`.signed.for.lakeshore.tenants.by`), `.check.the.signature.at.the`, "Signature: ______", "Printed in full: no minimum strength was set."; disclosure "When a minimum strength was set". |
| S8 case file not ready | Edition's files not built | One of `.casefile.being_prepared`, `.casefile.retrying`, `.casefile.stopped` (with a `.casefile.code.*` reason), `.casefile.waiting_on_members`. |

No assistant on this screen.

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 "Check the signature" (`act.verify.label.published`) | always | Same screen, `.verify.ok` / `.verify.no` / `.verify.none`. W1. |
| A2 "Download the complete edition" (`.download`; act "Read the case") | always | A file saved: "The complete edition is downloaded." (`.download.done`) or `.download.failed`. W1. |
| A3 "Show only findings this strong" (`act.owed_pubfloorset.label.published`) | always | S5. Done in the browser; nothing is sent. |
| A4 "Back to the whole case" (`act.owed_pubfloorclear.label.published`) | S5, S6, S7 | S1. |
| A5 "Print the case" (`act.owed_pubprint.label.published`) | always | S7 and the browser's print dialog. |
| A6 "Check it" (`published.check.go`) | A file chosen or a fingerprint pasted | Same screen, the result line. W1. |
| A7 links "its docket", "Edition {n}", "the evidence", "Finding {n}" | always | `docket-public`; that edition; the evidence; S6. |
| A8 "Details of this work" (`act.owed_casedetailspublic.label.published`) | always | Same screen, C6. W1. |

**Form messages.** V1 check, nothing given: `.choose_a_file_or_paste` + `.nothing_was_checked`. V2 unreadable file: `.your_browser_could_not_read` + `.choose_it_again_or_paste`. V3 no hashing in this browser: `.this_browser_cannot_work_out` + `.paste_one_instead_or_open`.

---

## imported: "{case}"

- **Address.** `/app/imported` (the list); `/app/imported/<import id>[/<edition>]` (one case). **Frame.** Working (the registry names an `imported` frame, which the shell draws as working); one case carries the band "Another team's case: {group} · Edition {edition} · read-only · {recreated} of {findings} …" (`.band`). Path: Projects › "Imported cases" › {group} · {case}.
- **Who can see it.** Every member. Anyone else: `front`.
- **Purpose.** Another team's published case, recreated here; nothing in it counts for the team until accepted (`.purpose`).
- **Entry points.** `projects` (link "Imported cases"); a row of the list.

**Content (S1, one imported case)**
- C1. Heading: the case's title; sub-line "From {group} · Edition {edition} · imported by {by}, {at}" (`.from`).
- C2. Section "Whose stake this states": the source team's identity and stake, unsigned; disclosures "When they were not recorded", "When its stake can't be read".
- C3. "Its findings, recreated here" (`.findings`): each finding "Recreated", "Recreated in part" or "Did not recreate" (`.result.*`).
- C4. Buttons "Import a case", "Accept what recreated" (`.accept`), primary, "Flag an issue" (`.flag`), "Watch the publisher's docket" (`.watch`).
- C5. Section "View under another lens" (`act.owed_importregrade.label.imported`): `.lens_what` + `.lens_does`; radio "As the source published it", "With the source's bias removed", "Under your team's lens" (`.lens_*`); button; "Shown here: with the source's bias removed." (`.lens_shown`); each finding `.lens_moved`, `.lens_bar_ours`, `.lens_bar_theirs`, `.lens_because`, or `.lens_unmoved`; disclosures "When your team has no lens in force", "When your team's lens can't be read".
- C6. Section "Re-run this work in your own project": `.rerun_what` + `.rerun_pairing_human`; choice "Which of your team's projects redoes this work" (first option "Choose one of your team's projects"); "Or start one and come back." (link to `project`); button; `.rerun_declares` + `.rerun_nothing` + `.rerun_compare_there`; disclosure "When it is refused".
- C7. Section "Accepted by your team" (`.accepted.heading`): each "accepted by {name}, {date}" with reason; field "Why your team withdraws its acceptance" (help `.withdraw.help`); button "Withdraw this acceptance, with a reason" (`.withdraw.button`); disclosure "When nothing of it is accepted".
- C8. Section "Rest one of your team's questions on this" (`.citeimp.head`, help `.citeimp.tip`): "Which of your team's questions", "How it bears on the question" ("It supports the question" / "It cuts against the question"), "A note (optional)"; button; notes `.citeimp.inherit1`, `.citeimp.inherit2`, `.citeimp.already`, `.citeimp.later`; disclosure "When it is refused" (`.citeimp.refd`).

**States**

| State | When | What shows |
|---|---|---|
| S1 one imported case | Address names an import | C1 to C8, with the band. |
| S2 the list of imported cases | `/app/imported`, some imported | Heading "Imported cases" (`.list`); sub-line `.list.says`; a row per case "{group} · Edition {edition} · imported by {who}, {date} · {recreated} of {findings} …" (`.list.row`, "{n} in part" `.list.row.part`), each a link to S1; button "Import a case", primary. No band. |
| S3 the list, before any import | None imported | Heading "Imported cases"; note "No case imported yet. Choose a case file to import the first." (`.list.none`); button "Import a case". |
| S4 assistant unreachable | No AI account | No "Help me write this" under "A note (optional)". |

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 "Import a case" (`act.caseimport.label.imported`) | always | Asks "The case file" (`.file.label`, help `.file.help`); then S1 for the new import. W2. |
| A2 "Accept what recreated" (`act.importaccept.label.imported`), primary | S1 | Asks "What you checked" and "Why your team may rely on it"; C7 lists it. W2. |
| A3 "Flag an issue" (`act.importflag.label.imported`) | S1 | Asks "The issue". W2. |
| A4 "Watch the publisher's docket" (`act.importwatch.label.imported`) | S1 | Asks "The publisher's address" (help `.publisher.help`). W1. |
| A5 "Withdraw this acceptance, with a reason" (act `act.importacceptwithdraw.label.imported`) | An acceptance | Same screen, the acceptance withdrawn. W3. Before it is done: `.withdraw.help`; `act.importacceptwithdraw.does` (protected). |
| A6 "View under another lens" (`act.owed_importregrade.label.imported`) | S1 | Same screen, C5's rows; nothing saved. W1. |
| A7 "Re-run this work in your own project" (`act.owed_rerunstart.label.imported`) | A project chosen | Same screen: `.rerun_compare_there`. W1. |
| A8 "Rest one of your team's questions on this" (act `act.owed_citeimported.label.imported`: "Rest one of our questions on this") | An accepted finding | Same screen. W1. |

**Form messages.** V1 case file: "Choose the case file first." (`.file.needed`). V2 checked: "Say what you checked first." (`.checked.needed`). V3 issue: "Describe the issue first." (`.issue.needed`). V4 publisher: "Give the publisher's https address." (`.publisher.needed`). V5 rerun: `.rerun_refused_owner` + `_next`; `.rerun_refused_already` + `_next`. V6 cite: `.citeimp.ref.notaccepted1` + `2`; `.citeimp.ref.machine1` + `2`. V7 withdraw: "No acceptance of this imported edition is in force, so there is nothing to withdraw. Nothing was written."

---

## docket: "Docket"

- **Address.** `/app/docket/<project id>/<case id>`. **Frame.** Working. Path: Projects › {project} › "Docket" (`.name`).
- **Who can see it.** A member who can see the project. Anyone else: `unavailable`.
- **Purpose.** The public record of every edition, correction and withdrawal of the team's cases (`.purpose`).
- **Entry points.** `project` (link "Docket"); `question` ("The published case's record"); `case-editor` S3 ("Start the next edition").

**Content**
- C1. Heading "Docket"; sub-line "The case's public record of corrections, withdrawals and orders." (`.sub`).
- C2. "Entries" (`.entries`): each dated, its kind (`.kind.*`) and summary, "posted" (`.posted`) or "drafted, not yet posted" (`.drafted`); e.g. "Edition {n} published, superseding Edition {prior}" (`.edition.published`, protected). None: "No entry yet. File the first one below." (`.none`).
- C3. Section "File a docket entry" (`.file`): "Kind of entry" (Response, Statement, Reaction, Outcome), "The edition it answers" ("Edition {n} · published {date}"), "The document it rests on" ("{title} · captured {date}"), "Not captured yet? Capture it first" (link to `capture`), "From whom", "What it says", "Where it goes" ("The team's record only", "The public docket", "Both"), "Your reason for that choice"; button "File a docket entry".
- C4. Button "Post it", primary (the design draws it "Post it, signed").
- C5. Note "An order is complied with openly: the next edition is stamped with what was sealed and why." (`.order`).
- C6. Section "Pressure marked on this case" (`.pressure.heading`): each "marked as a legal threat by {member}" with "No hold is placed for it yet."; note `.pressure.counsel`; link "Place a hold" (to `hold`).
- C7. Section "The next edition" (`.next.heading`): `.next.what`; checks "Findings it rests on"; a reopened question "reopened by {who}: conclude it again before it can go in." (`.next.reopened`); field "What the next edition covers" (help `.next.scope.help`); button "Start the next edition", primary; "The draft opens as the case being prepared." (`.next.opens`, link to `case-editor`).

**States.** S1 entries exist (as above). S2 no entry yet: C2 shows `.none`. S3 assistant unreachable: no "Help me write this" under "What it says".

**Actions**

| Control | When offered | Where it leads / weight |
|---|---|---|
| A1 "File a docket entry" (`act.docketfile.label.docket`) | always | Same screen, the entry "drafted, not yet posted". W2. |
| A2 "Post it" (`act.docketpost.label.docket`), primary | A drafted public entry | Signed with the member's key, then "Posted, signed." (`.posted.said`); the entry shows on `docket-public`. W4, Outward. Before it is done: `act.docketpost.does` ("Posts the entry to the public docket, where readers see it beside the case.", protected); `signpage.docket.signed`. |
| A3 "Start the next edition" (`act.casedraft.label.docket`), primary | A finding chosen and the scope given | `case-editor` for the new draft. W2. |
| A4 links "Capture it first", "Place a hold", "the case being prepared" | always | `capture`, `hold`, `case-editor`. |

**Form messages.** V1 entry: "Say who it is from and what it says." (`.file.needed`). V2 posting: "The entry can't be prepared for signing just now, so nothing was posted." (`.prepare.failed`). V3 next edition: "Choose at least one finding first. Nothing was started." (`.next.refused.nofinding`); "Say what the edition covers first. Nothing was started." (`.next.refused.noscope`); `.next.refused.nocase`; under "When the next edition cannot be started".

---

## docket-public: "{case} · Docket"

- **Address.** `/app/docket-public/<case id>`. **Frame.** Published: no session, no rail.
- **Who can see it.** Anyone with the address. No case: `unavailable.public`.
- **Purpose.** What happened to a published case after it was published, readable without an account (`.purpose`).
- **Entry points.** `published` (link "its docket").

**Content**
- C1. Heading "{case} · Docket"; sub-line `.sub` ("Everything that happened to this case after it was published: each new edition, correction, withdrawal and court order, dated and signed.").
- C2. Each posted entry dated, e.g. "Edition {n} published, superseding Edition {prior}" (`screen.docket.edition.published`), marked "signed".
- C3. Link "Back to the case" (`.back`).

**States.** One: the list of posted entries (the design draws one state; with no entry the list is empty).

**Actions.** A1 link "Back to the case" (`.back`): `published` for that case. No act.

---

## Differences seen in the code

- `ceremony` S2: the device confirmation is drawn by the shell's signing dialog, which reads `signing.ceremony.device` and `shell.signer.*`, not `.device.head`, `.device.example` or `.device.cancel` (bio-plane/src/interface-shell/browser.mjs:1405-1430).
- `ceremony`: the protected words `.when.note`, `.when.chosen`, `.signs.lines`, `.signs.linesabout`, `.publishat.button` and `.photos.rules` are not read by key in the screen (bio-plane/src/screens-publish/ceremony.mjs).
- `ceremony`: the refusal disclosures "When a contradiction is refused" and "When these are refused" (`.disc.refused.*`, `.conf.refused.*` except `.conf.refused.noreason1`) are not read (bio-plane/src/screens-publish/ceremony.mjs).
- `review-copy`: the band `.band` and the link line `.link.line` (both protected) and the live-link counts `.links.shared`, `.links.comments.*` are not read (bio-plane/src/screens-publish/review-copy.mjs).
- `review-outside`: the protected sub-line `.sub` and the link "Read the whole draft" (`.readall`) are not read (bio-plane/src/screens-publish/review-outside.mjs).
- `published`: the disclosures "When a minimum strength was set", "When no one else has read the statement", "When the edition does not say" and "The other things a disclosed contradiction can say" are not read, nor `.howtoread.link` (bio-plane/src/screens-publish/published.mjs).
- `case-editor`: the refusal disclosures V1 to V7 ("When the roles can't be saved" and the rest) are not read (bio-plane/src/screens-publish/case-editor.mjs).
- `imported`: the result words "Recreated", "Recreated in part", "Did not recreate" are read by prefix; `.lens_shown`, `.lens_bar_ours`, `.lens_bar_theirs` and the cite refusals `.citeimp.ref.machine*` are not read (bio-plane/src/screens-publish/imported.mjs).
- `docket`: the posted entry's line `.edition.published` (protected) and `.next.opens` are not read (bio-plane/src/screens-publish/docket.mjs).

## Changes

- 22 Nov 2026: written.
