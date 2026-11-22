Length: 359 lines. Last section: "Changes".

# Screens: Outside the team

Page `outside-the-team` of the Screens document (index: ../index.md). Written 22 Nov 2026 by a worker for civicsmith ux lane #1.

What comes from outside the team: material handed in through the doorbell, what becomes known about the person who handed it in, leads a member was told, the addresses the team watches, and the public registers it brings in. What binds every screen (frames, rail, loading and read-failure lines, refusals, the weight marks under buttons, the `unavailable` screen) is on the page "Every screen" and is not repeated here. Placeholders in braces (`{group}`) are filled with the record's data; with the test data `{group}` is "Lakeshore Tenants".

## The screens on this page

| id | heading | address | built? |
|---|---|---|---|
| `inbox` | "Inbox" | `/app/inbox`, one knock at `/app/inbox/<knock id>` | built |
| `doorbell` | "Hand material to {group}" | `/doorbell`, `/app/doorbell` | built |
| `about-knocker` | "A source" | `/app/about-knocker/<capture fingerprint>` | built |
| `leads` | "Leads" | `/app/leads`, one lead at `/app/leads/<lead id>` | built |
| `watching` | "Watched addresses" | `/app/watching` | built |
| `registers` | "Public registers" | `/app/registers` | `not built` |

---

## inbox: "Inbox"

- **Address.** `/app/inbox`; one knock (one delivery) at `/app/inbox/<knock id>`.
- **Frame.** Working. Rail place Queue; path "Queue › Inbox" (`screen.inbox.name`).
- **Who can see it.** Every signed-in member and administrator. Signed out: the shell shows `front` and keeps the address to return to.
- **Purpose.** Material handed to the team through its doorbell, moved into the record or discarded with a reason.
- **Entry points.** The door "Inbox" (`screen.inbox.name`) on `queue` and `home`, drawn while at least one knock is new; a knock's reference anywhere in the product opens `inbox` at that knock; direct address.

**Content**
- C1. Heading "Inbox" (`screen.inbox.name`); under it "Material handed in through your doorbell." (`screen.inbox.sub`).
- C2. A list, one row per knock, newest first. Each row's title is a link naming what was handed in and when: "{size} handed in on" (`screen.inbox.knock`) followed by the date; the size is "{n} MB" (`size.mb`), "{n} KB" (`size.kb`) or "less than 1 KB" (`size.small`), never a byte count.
- C3. Under each title, its status word: "New" (`screen.inbox.status.new`), "In the record" (`screen.inbox.status.pulled`) or "Discarded" (`screen.inbox.status.discarded`).
- C4. The file name and kind of file as the sender gave them, labelled "File name, as the sender gave it" (`screen.inbox.knock.name`) and "Kind of file, as the sender gave it" (`screen.inbox.knock.type`), only when the sender stated them.
- C5. "Their note: “{note}”" (`screen.inbox.note`), or "No note came with it." (`screen.inbox.nonote`).
- C6. Where other knocks share the secret phrase: "Same knocker as {count} other knocks here" (`screen.inbox.same`).
- C7. On a discarded knock: "Discarded: “{reason}”" (`screen.inbox.resolved`).
- C8. One knock open (address names it): a section headed with the same "{size} handed in on {date}" words, the facts of C3 to C7, then "Fingerprint" (`screen.document.fingerprint`) and the knock's fingerprint.
- C9. The ladder "What is known of who handed it in" (`screen.inbox.ladder`), five rungs in order: "Unknown" (`screen.inbox.ladder.unknown`), "Same knocker" (`.same`), "Partly known" (`.partly`), "Known to the team" (`.group`), "Public" (`.public`). The current rung is marked: "Same knocker" when the knock came with a secret phrase, "Unknown" when not, or the source's own rung once the knock is in the record. Under it the explanation `screen.inbox.ladder.basis` (6 sentences: what each rung means; the inbox shows only what a secret phrase can tell).
- C10. Section "Other material from this knocker" (`screen.inbox.knocker.heading`), when another knock carries the same pseudonym: the other knocks, oldest first, each a link as in C2; "Each knock listed here presented the same secret phrase." (`screen.inbox.knocker.same1`) "That says it is the same knocker; it says nothing about who they are." (`.same2`). Its help: "Every knock that presented this knocker's secret phrase, oldest first." (`screen.inbox.knocker.help1`) "It lists the knocks; it never names anyone." (`.help2`).
- C11. For a knock in the record whose source is known: a row "What is known about this source, and what may be published about them." (`screen.inbox.source.line`) with a link "A source" (`screen.about-knocker.name`).
- C12. A folded "Reference" (`reference.label`) holding the knock's id (and its source's id); ids appear nowhere else.
- C13. Short explanations on hover or focus, `screen.inbox.tip.*` (12 rows: material not yet in the record counts for nothing; recognized by the secret phrase; the sender's earlier material; where the source stands; recording what is known without naming them).

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 Nothing handed in | The team has no knock | "Nothing has been handed in." (`screen.inbox.empty`); no list |
| S2 The list | At least one knock; no knock named in the address | C1 to C7, C13 |
| S3 A new knock open | Address names a knock with status New | C8 to C12, the buttons A1 and A2 with the field of V1 |
| S4 A knock in the record | Address names a pulled knock | C8 to C12 without A1 and A2; the linking part of A3 (V2) when the source is known, else "Move it into the record first: a source is recorded for material once it is in the record." (`screen.inbox.link.nosource`) |
| S5 A discarded knock | Address names a discarded knock | C8, C7, field "Your reason" (`shell.reason`) and button "Put it back" (`act.inboxresolve.label.inbox.putback`) |
| S6 Just moved in | After A1 | Status line "Moved into the record. It waits in Held captures until a member vouches for it." (`screen.inbox.pulled`) |
| S7 Already moved | After A1 on a knock moved in before | "Already in the record: this knock was moved in before." (`screen.inbox.existed`) |
| S8 Same file already held | After A1 when the record holds the same bytes | "Already held: {holder} brought in the same file. Marked as brought in; nothing new was written." (`screen.inbox.alreadyheld`), `{holder}` a link to that `document`; when the member may not see it, "Already held: the same file is already in your team's records. Marked as brought in; nothing new was written." (`screen.inbox.alreadyheld.other`) |
| S9 Just discarded | After A2 | "Discarded, with your reason." (`screen.inbox.discarded`) |
| S10 Put back | After "Put it back" | "Put back in the inbox as new. The discard and its reason stay on the record." (`screen.inbox.putback.done`) |
| S11 More than 200 | The doorbell holds more than the list shows | A line saying how many are shown (no inbox word row; see Differences) |

No assistant is offered on this screen; nothing changes when it is unreachable.

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Move into the record" (`act.inboxpull.label.inbox`) | Knock is New | Same screen, S6, S7 or S8; the knock's status becomes "In the record" and the capture appears on `held` |
| A2. button "Discard with a reason" (`act.inboxresolve.label.inbox`) | Knock is New | With a reason: same screen, S9, status "Discarded". Without: refusal V1 |
| A3. button "Record what is known of the source" (`act.sourcelink.label.inbox`) | Knock in the record, its source known, and another source to link to | Same screen, "Recorded with the source. The two sources each keep their own history." (`screen.inbox.link.done`). With no other source: "No other source has handed in anything yet, so there is nothing to link it to." (`screen.inbox.link.none`) instead of the form |
| A4. button "See this knocker's other material" (`act.knocksof.label.inbox`) | Knock carries a pseudonym | Same screen; C10 lists the other knocks |
| A5. button "Put it back" (`act.inboxresolve.label.inbox.putback`) | Knock is Discarded | Same screen, S10; status "New" |
| A6. link on a knock's title (C2, C10) | Always | `inbox` at that knock |
| A7. link "A source" (C11) | Knock in the record, source known | `about-knocker` for that knock's capture |

**Form messages**
| Field | Condition | Message |
|---|---|---|
| V1. field "Why discard it? (asked before anything is discarded)" (`inbox.discard.why`) | Empty when A2 is pressed | "Say why first: a knock is discarded only with a reason, and it stays as it was until you give one." (`refusal.RESOLVE_NO_REASON`); the knock stays New |
| V2. choice "The same person as source" (`screen.inbox.link.to`), each choice "{source}, who handed in {knock}" (`screen.inbox.link.choice`) or "{source}, the same knocker, who handed in {knock}" (`.samechoice`); field "What shows it is the same person" (`screen.inbox.link.evidence`) | Either empty when A3 is pressed | "Before it is recorded, say: {fields}." (`screen.inbox.link.missing`), `{fields}` naming the empty ones |
| V3. field "Your reason" (`shell.reason`) | Empty when A5 is pressed | As V1 (`refusal.RESOLVE_NO_REASON`) |

---

## doorbell: "Hand material to {group}"

- **Address.** `/doorbell` and `/app/doorbell`.
- **Frame.** Public: no rail, no session read; the team's name above the heading.
- **Who can see it.** Anyone, signed in or not, with no account.
- **Purpose.** The page where someone outside the team hands it documents or a tip, told exactly what happens to them.
- **Entry points.** `front`, section "Have something for us?" (`screen.front.doorbell`), link "Hand material to the team" (`screen.front.doorbell.go`); `tour`, "Have something for us?" (`screen.tour.doorbell`); direct address.

**Content**
- C1. The team's public name, then heading "Hand material to {group}" (`screen.doorbell.heading`).
- C2. "You don't need an account. Here is exactly what happens to what you send." (`screen.doorbell.sub`).
- C3. A list of four: "Your files go only to this team's own Civicsmith." (`screen.doorbell.happens.only`); "A member reads them and decides whether to use them." (`.happens.reads`); "You can add a secret phrase, so later material can be recognized as yours without anyone knowing who you are." (`.happens.phrase`); "Nothing here is beyond a court's reach." (`.happens.court`).
- C4. File field "A file" (`screen.doorbell.file.label`), help "A document, a photo or a recording." (`screen.doorbell.file.help`).
- C5. Text area "A note (optional)" (`screen.doorbell.note.label`).
- C6. Password field "A secret phrase (optional)" (`screen.doorbell.secret.label`), help "At least 20 characters. This page keeps no copy of it: remember it yourself." (`screen.doorbell.secret.help`).
- C7. Checkbox "Make one for me" (`screen.doorbell.secret.make`), then "A long random phrase is made for you and shown once, on the receipt. Write it down: nobody can show it to you again." (`screen.doorbell.secret.make.help`).
- C8. Section "If the team asked to publish something about you" (`screen.doorbell.consent.heading`): "Say yes, or take your yes back, with the secret phrase you used." (`.consent.intro1`) "Nothing here asks who you are." (`.consent.intro2`); a secret-phrase field; field "The detail you are answering about" (`.consent.detail`), help "The reference the team gave you for it." (`.consent.detail.help`); choice "Who may be told it" (`.consent.audience`) with "Only the members listed for it" (`.consent.audience.member`); the answer, "I agree to this being published" (`.consent.yes`) or "I take back my agreement" (`.consent.no`); then "Agreeing is permanent for anything published under it: what is published stays published, even if you later take your agreement back." (`.consent.permanent1`) "Taking it back binds only what is published afterward." (`.consent.permanent2`).
- C9. Explanations on hover or focus, `screen.doorbell.tip.*` (15 rows: the team's own Civicsmith on its own hosting account; a member decides before anything is used; the secret phrase never names you; a court can order the team to hand over what it holds).

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 Ready | On opening | C1 to C8 |
| S2 Received | After A1 is accepted | Status line "Received on {at}. A member of the team will read it. Keep the reference and the date: they are all you have to ask about it, because this page does not know who you are." (`screen.doorbell.received`); "Fingerprint of what you sent: {fingerprint}" (`.receipt.fingerprint`) with "The same file always has the same fingerprint, so anyone can later check a copy against this one." (`.receipt.fingerprint.help`); "Size: {size}" (`.receipt.size`); heading "After you hand it over" (`.after.head`) and "Your reference: {reference}" (`.reference`). The note and phrase fields are emptied |
| S3 Received with a phrase | S2, a phrase given or made | Also "Your pseudonym: {pseudonym}" (`.receipt.pseudonym`) with "Material sent later with the same secret phrase shows under the same pseudonym. It says nothing about who you are." (`.receipt.pseudonym.help`) |
| S4 Received with a made phrase | S3 with C7 checked | Also "Your secret phrase: {secret}" (`.receipt.secret`) and "Write it down now. This page shows it once and nobody can show it to you again; without it you cannot answer a request to publish something about you." (`.receipt.secret.note`); a reload no longer shows it |
| S5 Refused | A1 refused | One of V1 to V5 beside the button; nothing is received |
| S6 Answer refused | A2 refused | V6 or V7 beside its button |

No assistant is offered. If the team's Civicsmith cannot be reached, `unavailable` shows as on "Every screen".

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Hand it over" (`act.knock.label.doorbell`) | Always | Same page, S2 to S4; the knock appears on the team's `inbox` as New |
| A2. button "Send my answer" (`act.knockerconsent.label.doorbell`) | Always | With a phrase, a detail and an answer: the agreement or its withdrawal is recorded on the source's `about-knocker`; the phrase field is emptied. With any of the three missing, nothing is sent |

**Form messages**
| Field | Condition | Message |
|---|---|---|
| V1. "A file" | No file chosen | "Choose a file to hand over first." (`screen.doorbell.refused.empty`) |
| V2. "A file" | Larger than the doorbell takes | "That is too large to hand over here." (`screen.doorbell.refused.large`) |
| V3. "A secret phrase (optional)" | Fewer than 20 characters | "A secret phrase needs at least 20 characters." (`screen.doorbell.refused.weak`) |
| V4. the page | Too many hand-overs | "Too many hand-overs just now. Try again in ten minutes." (`screen.doorbell.refused.rate`) |
| V5. "A file" | Unreadable, or not kept | "That file can't be read as it was sent." (`screen.doorbell.refused.content`); "It could not be kept just now, so nothing was handed over. Try again." (`screen.doorbell.refused.notstored`) |
| V6. consent phrase | Not recognised | "That secret was not recognised, so nothing was recorded." (`screen.doorbell.consent.refused.secret`), under the fold "When your answer is not accepted" (`.consent.refused.summary`) |
| V7. consent form | Too many tries | "Too many tries have come from here lately." (`.consent.refused.rate`) "Wait a while, then try again." (`.consent.refused.rate.next`) |

---

## about-knocker: "A source"

- **Address.** `/app/about-knocker/<the pulled knock's capture fingerprint>`. With no fingerprint, or a malformed one: "Nothing is here" (`shell.unavailable.nothing.title`), "This address doesn't lead to anything in your team's Civicsmith. It may have been typed wrong, or the link is old." (`shell.unavailable.nothing.says`), link "Go to Home" (`shell.unavailable.home`).
- **Frame.** Working. Path "Queue › Inbox › A source".
- **Who can see it.** Every member and administrator; a stored detail's value is shown only to the members listed for it.
- **Purpose.** What became known about someone who handed material in, who may read it, what they agreed to publish, and the person they are.
- **Entry points.** `inbox`, a knock in the record, link "A source" (C11 there); a source's reference anywhere.

**Content**
- C1. Heading "A source" (`screen.about-knocker.name`); "Someone who handed material to your team." (`screen.about-knocker.intro1`) "Only members you list can read what is stored about them." (`.intro2`).
- C2. The ladder of `inbox` C9, at the source's rung, with `screen.inbox.ladder.basis` under it.
- C3. Section "What became known" (`screen.about-knocker.known.head`), help "Each thing that became known, with how and to whom." (`.known.help1`) "An entry is never edited; a later one takes its place when read." (`.known.help2`). One row per standing entry: what it is ("Occupation" `.attribute.occupation`, "Employer" `.attribute.employer`, "Role" `.attribute.role`, "A name" `.kind.name`, "A link to another source" `.kind.link`) and its value; beside it how it became known ("Told by the source themselves" `.how.self`, "It is in a public filing" `.how.opt.filing`, "Told by someone else" `.how.third`), to whom ("known to the team" `.knownto.group`, "One member" `.audience.member`, "The public" `.audience.public`), and "agreed to publish to members only" (`.consent.members`) where so. An entry known but not stored adds "not recorded" (`.notrecorded`). A hostile claim is its own row: "Named by {name} on {date}; not confirmed by the team" (`.hostile.claim`) with "Claimed by someone hostile to the source" (`.how.hostile`).
- C4. Section "Record what became known" (`act.sourcedisclose.label.about-knocker`): choice "What became known" (`.known.head`) of "A link to another source" (`.kind.link`), "An attribute: occupation, employer or role" (`.kind.attribute`), "A name" (`.kind.name`); choice "Which attribute" (`.attribute.label`), help "Only for an attribute." (`.attribute.help`); field "What it is" (`.value.label`), help "At most 400 characters." (`.value.help`); choice "How it became known" (`.how.label`) of "The source said it themselves" (`.how.opt.self`), "It is in a public filing" (`.how.opt.filing`), "Someone else told us" (`.how.opt.third`), "Someone hostile to the source claimed it" (`.how.opt.hostile`); field "Who made the claim" (`.claimedby.label`), help `.claimedby.help1` and `.claimedby.help2` ("Only when someone hostile to the source claimed it." "It is kept as their claim, not as a fact."); field "When they made it" (`.claimedat.label`), help "Only for a claim." "A date such as 2026-10-06." (`.claimedat.help1`, `.help2`); choice "Who knows it" (`.knownto.label`) of "One member", "The team", "The public" (`.audience.member`, `.audience.group`, `.audience.public`); radio "Whether to store it" (`.store.legend`): "Store what it is, for the members I list" (`.store.yes`), "Record only that the team knows it, without storing it" (`.store.no`); checkboxes "Members who may read it" (`.sight.legend`), one per member by handle; field "Your evidence" (`.evidence.label`), help "It is kept with the entry." (`.evidence.help`); where a hostile claim stands, choice "Confirms a claim made against this source" (`.confirms.label`) with "No claim" (`.confirms.none`), help "Confirming a hostile claim needs the source's consent before anything is published." (`.confirms.help`); then "Every member you list can read this entry, and each time one reads it, the read is logged." (`.read.logged1`) "The entry is never edited or removed." (`.read.logged2`). Refusals fold under "When it is refused" (`.refused.summary`).
- C5. Section "What may be published" (`.publish.heading`), when a stored detail exists: "Only what the source agreed to, or what is already public elsewhere, is ever shown." (`.publish.intro1`) "Your team is never the first to make a detail more public." (`.publish.intro2`); choice "Which detail" (`.consent.detail`); choice "Who may be told it" (`.audience.label`); field "Evidence of their agreement" (`.consent.evidence`); then "This consent is permanent for anything published under it: what is published under it stays published, even if the consent is later withdrawn." (`sources.consent_permanent_anything`) and "This withdrawal binds only later publications: what was published under the consent stays published." (`sources.withdrawal_binds_later`).
- C6. Section "Say who this is" (`.person.heading`), when the record follows at least one person: "If you have evidence this source is a person your team follows, say so." (`.person.intro1`) "It is a claim with its evidence; it does not merge the records." (`.person.intro2`); choice "Which person" (`.person.which`); field "Your evidence"; checkboxes "Members who may read it"; then "Saying it again for the same person replaces the earlier claim; the earlier one is kept, with who replaced it and when." (`.person.replace`).

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 Nothing known yet | The source has no entry | C1, C2, C4, C6; no C3; no C5 |
| S2 Entries standing | At least one entry | C1 to C6 |
| S3 Assistant reachable | The member's assistant is on and an account serves it | Also button "Help me write this" (`act.writinghelp.label.about-knocker`) under "Your evidence" |
| S4 Assistant unreachable | No AI account, or the assistant is off (the internal walk) | No "Help me write this" button; nothing greyed in its place |

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Record what became known" (`act.sourcedisclose.label.about-knocker`) | Always | Same screen; a new row in C3 |
| A2. button "Record their agreement" (`act.sourceconsent.label.about-knocker`) | C5 shown | Same screen; the detail's row shows the agreement |
| A3. button "Record that they took it back" (`act.sourceconsentwithdraw.label.about-knocker`) | C5 shown | Same screen; the agreement no longer shows on the row |
| A4. button "Say this source is that person" (`act.sourcepersonlink.label.about-knocker`) | C6 shown | Same screen; the claim is recorded |
| A5. button "Help me write this" (`act.writinghelp.label.about-knocker`), `AI` | S3 only | Fills "Your evidence" with a draft, kept only if the member then presses A1. With the field empty: "Write something first: the assistant helps word only what you told it." (`screen.capture.help.empty`) |

**Form messages**
| Field | Condition | Message |
|---|---|---|
| V1. C4's choices | A value not among the choices | "A disclosure names what was revealed (a pseudonym link, an attribute or a name), how it became known, and to whom it is known, each from the listed choices. The field that is not one of them is named. Nothing was written." (`refusal.BAD_DISCLOSURE`) |
| V2. "Your evidence" (C4, C6) | Empty | "What is recorded about a source is recorded with its evidence. Name the evidence. Nothing was written." (`refusal.NO_EVIDENCE`) |
| V3. "Members who may read it" | "Store what it is" chosen, no member checked | "A detail about a source that is stored can be read only by the members listed for it, and none is listed. List at least one member, or record that the detail is known without storing it. Nothing was written." (`refusal.NO_SIGHT_LIST`) |
| V4. the source | Not one the member can see | "No source you can see answers to that id. Nothing was written." (`refusal.NO_SUCH_SOURCE`) |
| V5. "Which detail" | Not in the history, or a wider consent stands | "That consent cannot be recorded: the detail it names is not in this source's history, or consent to a wider audience already stands. Nothing was written." (`refusal.CONSENT_NOT_STANDING`) |
| V6. "Which person" | An organization | "That is an organization, not a person." (`.person.refused.org`) "Choose a person your team follows." (`.person.refused.org.next`) |

---

## leads: "Leads"

- **Address.** `/app/leads`; one lead at `/app/leads/<lead id>` (ids begin `LEAD-`).
- **Frame.** Working. Rail place Add; path "Add › Leads" (`screen.leads.name`).
- **Who can see it.** Every member and administrator. A lead is read by its writer, and by members of a project it was shared with.
- **Purpose.** Write down something you were told, record who looked into it and what they found, and share it with a project.
- **Entry points.** `capture` (Add): "Something you were only told, and want to look into?" (`screen.capture.lead.line`) with link "Write down a lead" (`screen.capture.lead.link`); a lead's reference; direct address.

**Content**
- C1. Heading "Leads" (`screen.leads.name`); "Something you were told, or have reason to believe, and where it might be found." (`screen.leads.intro1`) "A lead is somewhere to look, never evidence." (`.intro2`).
- C2. Section "Write down a lead" (`.write.heading`): text area "What you were told or suspect" (`.write.words`); field "Where it might be found" (`.write.where`); "Only you can read a lead until you share it with a project." (`.write.note1`) "Writing one down looks nothing up." (`.write.note2`).
- C3. Section "Your leads" (`.mine.head`), help "Every lead you can read: your own, and those others shared with a project you have joined." (`.list.help`). One row per lead: its words in quotes, a button to open it, and its state: "Nobody has looked yet" (`.state.never`), "We looked and could not tell" (`.state.unclear`), "We looked and it is not there" (`.state.absent`), "We looked and found part of it" (`.state.part`), "We looked and it is there" (`.state.found`).
- C4. Section "One lead" (`.one.head`), once a lead is open: its words; "Written by you on {date}" (`.written`) for its writer; each look, "{name} looked on {date}: {words}" (`.look.line`) with that look's state word; each share, "Shared with {project} on {date}" (`.shared.line`) with the reason.
- C5. In C4, the part "Record a look" (`.look.head`): choice "What the look found" (`.look.state`) of "It is not there" (`.look.opt.absent`), "Could not tell" (`.look.opt.unclear`), "Found part of it" (`.look.opt.part`), "It is there" (`.look.opt.found`); choice "What it found, if it found something" (`.look.kind`) of "Nothing to point at" (`.look.kind.none`), "A document in the record" (`.look.kind.doc`), "A passage of a document in the record" (`.look.kind.passage`), help "Only a look that found something can point at anything." (`.look.kind.help`); field "Which one" (`.look.which`); text area "Where you looked and what you found" (`.look.detail`).
- C6. In C4, the part "Share it with a project" (`.share.head`): choice "Which project" (`.share.project`), help "Only projects you have joined." (`.share.project.help`); text area "Why you are sharing it" (`.share.reason`), help "It is kept with the share." (`.share.reason.help`); then "Sharing puts what you were told in front of the project's participants, with your reason, and it cannot be taken back." (`.share.note1`) "Only you, as its writer, can share it." (`.share.note2`).
- C7. Each form's refusals fold under "When it is refused" (`.refused.summary`).

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 No leads | The member can read no lead | C1, C2; no C3, no C4 |
| S2 Leads listed | At least one readable lead | C1 to C3 |
| S3 One lead open | After A2, or the address names a lead | C1 to C6 |
| S4 Assistant reachable | Assistant on, an account serves it | Also button "Help me write this" (`act.writinghelp.label.leads`) under "What you were told or suspect" |
| S5 Assistant unreachable | No AI account (the internal walk) | No "Help me write this"; nothing greyed in its place |

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Write down the lead" (`act.lead.label.leads`) | Always | Same screen; the lead heads C3 with "Nobody has looked yet"; the fields empty |
| A2. button "Open a lead" (`act.leadread.label.leads`), one per row | S2 | Same screen, S3 for that lead |
| A3. button "Record the look" (`act.leadlook.label.leads`) | S3 | Same screen; a new look line in C4; the lead's state word changes in C3 and C4 |
| A4. button "Share it with the project" (`act.leadshare.label.leads`) | S3 | Same screen; a new "Shared with" line in C4; the lead is readable by that project's members |
| A5. button "Help me write this" (`act.writinghelp.label.leads`), `AI` | S4 only | Fills "What you were told or suspect" with a labelled draft, kept only by A1. Empty field: "Write something first: the assistant helps word only what you told it." (`screen.capture.help.empty`) |

**Form messages**
| Field | Condition | Message |
|---|---|---|
| V1. "What you were told or suspect" | Empty | "The lead is empty. Write what you were told or suspect, and where it might be found; nothing is filled in for you." (`refusal.LEAD_NO_WORDS`) |
| V2. either field of C2 | Longer than one passage | `refusal.LEAD_TOO_LONG`, 3 sentences: the lead is refused rather than cut; write it more briefly or split it |
| V3. "What the look found" | None chosen | `refusal.LEAD_LOOK_STATE`, 2 sentences: say which of the four it found; "Nobody looked" is never recorded |
| V4. "Which one" | Not a document or passage the member can read, or a look that found nothing pointing at something | `refusal.LEAD_LOOK_REFERENT`, 2 sentences: capture the document first |
| V5. "Where you looked and what you found" | Empty | "Say in your own words where you looked and what you found. A look is recorded with the account of the member who made it, and a look with no account is a result nobody can check or follow up." (`refusal.LEAD_LOOK_NO_DETAIL`) |
| V6. the lead | Not one the member can read | `refusal.LEAD_NOT_FOUND`, 2 sentences |
| V7. "Which project" | A project the member has not joined | "You can share a lead only to a project you have joined. Sharing it somewhere you are not working would put your words in front of people you are not working with." (`refusal.LEAD_SHARE_NOT_A_PARTICIPANT`) |
| V8. A4 | The member did not write the lead | "Only the member who wrote a lead can share it. A lead is what one person was told; passing someone else's on is theirs to decide." (`refusal.LEAD_SHARE_NOT_AUTHOR`) |
| V9. "Why you are sharing it" | Empty or over 2,000 characters | `refusal.LEAD_SHARE_NO_REASON`, 2 sentences, beginning "Say why you are sharing this lead with that project, in no more than 2,000 characters." |
| V10. "Which project" | Already shared there | "This lead is already shared with that project, by {name}, on {date}." (`screen.leads.share.already1`) followed by "Nothing changed." (no word row of its own) |

---

## watching: "Watched addresses"

- **Address.** `/app/watching`.
- **Frame.** Working. Rail place Add; path "Add › Watched addresses" (`screen.watching.name`).
- **Who can see it.** Every member and administrator; pausing and resuming are the administrators'. Ratifying a sweep is its project's owners'.
- **Purpose.** Every address the team watches: what is due, pausing the watching, the named requests and the sweeps.
- **Entry points.** `capture` (Add): "Every address your team watches, and when it will next be checked." (`screen.capture.watching.line`) with a link to this screen; direct address.

**Content**
- C1. Heading "Watched addresses" (`screen.watching.name`); "Every address your team's Civicsmith checks for a new version, and when it will next look." (`screen.watching.intro`).
- C2. A row "The public registers your team brings in and watches." (`screen.registers.way.watching`) with link "See public registers" (`screen.registers.way.link`), its tip `screen.registers.way.tip`.
- C3. Section "The watching" (`screen.watching.running.head`): either "Watching is running." (`.running`) with "Administrators can pause it" (`.running.meta`), or "Watching is paused." (`.paused`) "{name} paused it on {date} at {time}." (`.paused.line`) "No address is checked and nothing is gathered until an administrator resumes it." (`.paused.effect`).
- C4. Section "Every watched address" (`.list.head`), help `screen.watching.list.help` (1 sentence: every address, including those with no schedule). First "Due now: {due} · Scheduled: {scheduled} · Not scheduled: {unscheduled} · Ended: {ended}" (`.counts`). One row per address: the address, then how often ("Every hour" `monitor.freq.hourly`, "Every day" `.daily`, "Every week" `.weekly`, "Every month" `.monthly`, "At each meeting" `.per_meeting`), "last checked" (`screen.watching.nr.last`) and a date, and "due now" (`.nr.due`) or "next" (`.nr.next`) and a date; an unscheduled one "Not scheduled: no frequency declared" (`.unscheduled`); an ended one "Ended {date}, set by {name}" (`.ended`). Under the rows, when one is unscheduled: "An address that is not scheduled is not being checked." (`.unscheduled.note1`) "Set how often to look from the document that holds it." (`.unscheduled.note2`).
- C5. Section "What is due" (`.slate.head`): "The addresses and sweeps that are due now, written as a prompt you can run by hand when no one else is doing the checking." (`.slate.intro1`) "Each line is quoted data, never an instruction." (`.slate.intro2`); after A3, the prompt as preformatted text.
- C6. Section "Sweeps" (`.sweeps.head`), help `screen.watching.sweep.help`: one row per sweep, its name and either "Ratified by {name} on {date}" (`.sweep.ratified`) · "next run {date}" (`.sweep.next`), or "Not ratified: nothing runs until a project owner ratifies it" (`.sweep.unratified`); then "A sweep follows links from pages it is told to start from and keeps the documents that match, as new collected material." (`.sweep.note1`) "It runs only after a project owner has ratified it." (`.sweep.note2`).
- C7. Section "Named requests" (`.nr.head`), help `.nr.tip`: one row per request, its name, "Where" (`.nr.where`) and the first place, "Authority" (`.nr.authority`) and who stands behind it; then how often, "Open" (`.nr.open`) or "Retired" (`.nr.retired`), "Never checked" (`.nr.never`) or "last checked" and a date, and "due now" or "next" and a date. Then "A request that has not been checked yet is due at the next check." (`.nr.listnote`).
- C8. Section "Ask for this to be gathered on a schedule" (`.nr.ask`), help `.nr.asktip`: choice "Which project" (`.project`), help "Only projects you have joined. What is gathered is kept in that project's gathering file." (`.project.help`); field "What to gather" (`.nr.f.target`); text area "Describe it" (`.nr.f.desc`); field "Where to find it" (`.nr.f.loc`), help "Put the publisher that holds the authoritative copy first." (`.nr.f.lochelp`); button "Add another place" (`.nr.f.add`); field "Who stands behind the source" (`.nr.f.auth`), help "For example, the department that publishes it." (`.nr.f.authhelp`); choice "How much it matters" (`.nr.f.matters`) of "Crucial", "Supporting" (`.nr.f.crucial`, `.nr.f.supporting`); choice "How often" (`.nr.f.often`) of "Every hour", "Every day", "Every week", "Every month", "Not on a schedule" (`.nr.f.c.hour` … `.nr.f.c.none`); then "Asking does not fetch anything by itself." (`.nr.n1`), "A new request is due at the next check." (`.nr.n2`), "A retired request is no longer gathered, and it stays in the list." (`.nr.n3`).
- C9. Section "Define a sweep" (`.sweepdef.head`), help `.sweepdef.tip`: "Which project"; field "Name of the sweep" (`.sweepdef.title`); text area "Sites it may visit" (`.sweepdef.sources`), help "One site on each line. It never leaves these sites." (`.sweepdef.sourceshelp`); text area "Pages it starts from" (`.sweepdef.seeds`); text area "What to keep" (`.sweepdef.match`), help "Say what a page must be to be kept, for example agendas and staff reports." (`.sweepdef.matchhelp`); choice "How often" (`.sweepdef.often`) with the five of C8; field "The most it may fetch in one run" (`.sweepdef.budget`); then "Defining a sweep does not start it." (`.sweepdef.n1`) "Nothing runs until an owner of the project ratifies it." (`.sweepdef.n2`).
- C10. Section "Ratify or stop a sweep" (`.sweepdef.rathead`), help `.sweepdef.rattip`: each sweep with "Sites: {hosts} · The most it may fetch in one run: {budget}" (`.sweepdef.scope`), `{budget}` "{count} pages" (`.sweep.pages`) or "1 page" (`.sweep.pages.one`); for one not ratified: "Ratifying sends your team's fetches to the named sites, within the scope and budget shown." (`.sweepdef.rat1`) "Each thing found is filed as collected material, never higher." (`.sweepdef.rat2`); then "Only an owner of the project can ratify a sweep." (`.sweepdef.ratnote1`) "Any member who can write to the project can stop it." (`.sweepdef.ratnote2`).

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 Running | The watching is not paused | C3 "Watching is running." |
| S2 Paused | An administrator paused it | C3 "Watching is paused." with who and when |
| S3 Not an administrator | A member who is not an administrator | Under the fold "If you are not an administrator" (`screen.watching.notadmin.summary`): `refusal.NOT_AN_ADMIN` ("Only an active administrator of this team can do that, and the account asking is not one of them here. The record reads who is asking from the signed-in session, never from the request. Nothing was changed.") |
| S4 Nothing watched | The team watches no address | No rows in C4 (no word row for an empty list) |
| S5 No sweeps | No sweep is defined | No rows in C6 and C10 |
| S6 Assistant reachable | Assistant on, an account serves it | Also button "Help me write this" (`act.writinghelp.label.watching`) under "Describe it" |
| S7 Assistant unreachable | No AI account (the internal walk) | No "Help me write this"; nothing greyed |

**Actions**
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "Pause the watching" (`screen.watching.pause`) | S1, administrator | Asks a reason; same screen, S2 |
| A2. button "Resume the watching" (`screen.watching.resume`) | S2, administrator | Asks a reason; same screen, S1 |
| A3. button "Show what is due" (`act.monitorslate.label.watching`) | Always | Same screen; C5 shows the prompt |
| A4. button "List every watched address" (`act.monitoring.label.watching`) | C4 shown | Same screen; C4 read again |
| A5. button "See the sweeps" (`act.sweeps.label.watching`) | C6 shown | Same screen; C6 read again |
| A6. button "List every named request" (`screen.watching.nr.list`) | C7 shown | Same screen; C7 read again |
| A7. button "Ask for this to be gathered on a schedule" (`screen.watching.nr.ask`) | Always | Same screen; the request heads C7 as "Open", "Never checked", "due now" |
| A8. button "Retire this request" (`screen.watching.nr.retire`) | On an open request | Same screen; the row shows "Retired" |
| A9. button "Define a sweep" (`screen.watching.sweepdef.head`) | Always | Same screen; the sweep in C6 as "Not ratified" |
| A10. button "Ratify this sweep" (`screen.watching.sweepdef.ratify`) | Unratified sweep, the member owns its project | Same screen; C6 shows "Ratified by" and "next run" |
| A11. button "Stop this sweep" (`screen.watching.sweepdef.stop`) | Ratified sweep | Same screen; the sweep is "Not ratified" |
| A12. button "Help me write this" (`act.writinghelp.label.watching`), `AI` | S6 only | Fills "Describe it" with a draft |
| A13. link "See public registers" (`screen.registers.way.link`) | Always | `registers` (`not built`) |

**Form messages**
| Field | Condition | Message |
|---|---|---|
| V1. "What to gather" | Empty or over 200 characters | "Say what to gather, in one line of no more than 200 characters." (`screen.watching.nr.ref.target`) "Nothing was saved." (`.nr.ref.nothing`) |
| V2. "Where to find it" | A place not starting `https://` | "Every place must be a public address that starts with https://." (`.nr.ref.https`) "Nothing was saved." |
| V3. A7 | Sent by the assistant | "The assistant cannot ask for this." (`.nr.ref.machine1`) "Only a member can, so nothing was saved." (`.nr.ref.machine2`) |
| V4. A10 | Not an owner of the project | "Only an owner of the project can ratify a sweep." (`.sweepdef.ref.owner1`) "Ask {owners}." (`.sweepdef.ref.owner2`) |
| V5. A9, A10 | Sent by the assistant | "The assistant cannot define or ratify a sweep." (`.sweepdef.ref.machine1`) "Only a member can, so nothing was changed." (`.sweepdef.ref.machine2`) |

Refusals fold under "When it is refused" (`screen.watching.nr.refd`, `screen.watching.sweepdef.refd`).

---

## registers: "Public registers"

Mark: `not built`. No code draws it; until a module builds it, `/app/registers` draws `unavailable` in its state for an address that leads nowhere. Every act is owed (rulings DEC-406, K4403, DEC-409) except Search and Explore connections.

- **Address.** `/app/registers`.
- **Frame.** Working. Rail place Add; path "Add › Public registers" (`screen.registers.crumb`).
- **Who can see it.** Every member and administrator.
- **Purpose.** The public registers the team holds: bring one in whole or in part, search it and cite a row, watch a filer, license or docket by its number, and connect outside alerts. None of it needs the assistant.
- **Entry points.** `capture` (Add): "Public registers your team brings in and watches." (`screen.registers.way.add`) with link "See public registers" (`screen.registers.way.link`); `watching` C2.

**Content**
- C1. Heading "Public registers" (`screen.registers.title`); explanation `screen.registers.intro` (2 sentences; ends "None of it needs the assistant.").
- C2. Section "Registers your team holds" (`.held.head`): one row per register, its name, "From {source} · brought in {date} · {rows} rows · next check {date}" (`.held.row`), or for one read ahead "From {source} · read ahead for the team {date} · {rows} rows · no project has asked yet" (`.held.row.preread`); then "Kept with it, and what watching looks for: {filter}" (`.held.filter`) or "Read in whole: watching looks for any change" (`.held.whole`).
- C3. Section "Registers we know" (`.known.head`): "Each is listed with where it comes from and how big it is." (`.known.about`); one row per register, "From {source} · {url} · {bytes} bytes · {rows} rows" (`.known.row`); the company-officers register tagged "Not in the alpha" (`.known.officers.tag`) with "Bringing in company officers in bulk comes in the beta." (`.known.officers.note`). A fold "A register we know that is not listed" (`.known.door.head`): "Give its name, its address and who publishes it. It is proposed for the list, and nothing is brought in." (`.known.door.note`); fields "Name of the register" (`.known.door.name`), "Its address (URL)" (`.known.door.url`), "Who publishes it" (`.known.door.source`).
- C4. Section "Bring in a register" (`.import.head`): explanation `.import.about` (2 sentences: kept whole as a capture; read in the background; the queue says when it is ready); "Importing runs by fixed steps and never uses the assistant." (`.import.mech`); choice "Which register" (`.import.which`) of the six registers (`.import.which.netfile`, `.calaccess`, `.fec`, `.form700`, `.lobbyists`, `.licenses`). Sub-heading "Whole or in part" (`.import.part.head`): "Leave every box empty to bring in the whole register." (`.import.part.empty`); "Filled in from the project {name}; change it as you like." (`.import.part.prefill`); fields "Names or organizations" (`.import.part.names`), "Smallest amount" (`.search.min`), "Largest amount" (`.search.max`), "From this date" (`.search.from`), "Up to this date" (`.search.to`), "Filer numbers" (`.import.part.ids`). After A5: "Compared with what your record holds: {rows} new rows, {bytes} bytes, about {time} to read in." (`.import.delta.row`). Then "The filter is kept with the import and shown as what watching looks for." (`.import.kept`); "Phone and address columns are left out as it arrives." (`.import.dropped`); "Reading it ahead keeps the register, whole or in the part you chose, as a resource for the team before any project asks." (`.import.preread.note`).
- C5. Section "Search the registers" (`.search.head`): fields "Person or organization" (`.search.who`), "Smallest amount", "Largest amount", "From this date", "Up to this date"; choice "In which register" (`.search.in`) with "Every register your team holds" (`.search.in.all`) and each held register. Each result row: the name, amount and date, then "{register} · row {row} · brought in {date}" (`.search.row`). "A cited row travels as a labeled extract of the file it came from." (`.search.cite.note`); a cited row shows "Cited as an extract of {file}, fingerprint {fingerprint}, {date}" (`.search.cite.extract`). For rows of the federal register: "Under 11 CFR 104.15, the names and addresses of contributors may not be sold or used to ask for contributions or for commercial purposes." (`.search.fec.notice`) and "Rows from this register cannot be exported as a donor list." (`.search.fec.noexport`).
- C6. Section "Watched filers, licenses and dockets" (`.watch.head`): "A watch starts by itself only for what a project has said it is interested in, and it is shown with that project and its interest." (`.watch.auto`); one row per watch, "{register} · watched for the project {project}, which has an interest in {interest}" (`.watch.row.project`) or "{register} · watched since {date} · no change yet" (`.watch.row.quiet`), and "{count} changes since you last looked" (`.watch.changes`); choice "In which register" (`.watch.in`), including "Federal court dockets (CourtListener)" (`.watch.in.court`); field "Filer number, license number or docket number" (`.watch.number`); "Each change to a watch is one item in your queue, with how many changes there have been since you last looked." (`.watch.told`).
- C7. Section "Alerts from outside services" (`.alerts.head`): "CourtListener sends an alert when a federal court docket changes. It needs your team's own key, and a few alerts are free." (`.alerts.courtlistener`); field "Your team's CourtListener key" (`.alerts.key`), help "It is sealed when you give it and never shown again, to you or to anyone." (`.alerts.key.help`); "A county court such as Alameda's cannot be watched automatically. It is re-checked when a member asks." (`.alerts.county`).
- C8. Section "Ask across the registers" (`.ask.head`): a part "Ask in plain words, and have matches and watches proposed" (`.ask.title`) marked "Comes after the alpha" (`.ask.later`); text area "Ask in plain words" (`.ask.field`) and buttons "Ask across the registers" (`.ask.go`), "Propose matches to your team's subjects" (`.ask.match`), "Propose watches" (`.ask.propose`), all disabled; "This needs the assistant, which comes after the alpha, once your team can use more than one AI provider and it has been tested." (`.ask.note`).
- C9. Section "What these registers never do" (`.never.head`), a list of three: "A watch is always of a named filer, license or docket, never a search for a person." (`.never.watch`); "An import never copies home addresses or phone numbers. A member may keep one in their own notes, and it is never published." (`.never.keep`); "The Federal Election Commission's donor data may not be used to ask donors for money or for commercial purposes." (`.never.fec`).

**States**
| State | When | What shows (exact) |
|---|---|---|
| S1 Registers held | The team holds at least one register | C1 to C9 |
| S2 None held | The team holds none | In C2: "Your team holds no register yet. Bring one in below." (`.held.none`), as drawn under "When your team holds none" (`.held.none.head`) |
| S3 None watched | No watch stands | In C6: "Your team watches no filer, license or docket yet." (`.watch.none`), under "When your team watches none" (`.watch.none.head`) |
| S4 Assistant, any | Always, until after the alpha | C8 shows with its controls disabled; nothing else depends on the assistant, so the screen is the same without an AI account |

**Actions** (all `not built`)
| Control | When offered | Where it leads |
|---|---|---|
| A1. button "List the registers your team holds" (`.held.list`) | Always | Same screen; C2 read again |
| A2. button "Propose this register" (`.known.door.go`) | Fold open | Same screen; proposed, nothing brought in |
| A3. button "Bring in this register" (`.import.go`) | Always | Same screen; the register joins C2; the queue later says it is ready |
| A4. button "Read it ahead, for the team" (`.import.preread`) | Always | Same screen; the register joins C2 with the read-ahead line |
| A5. button "Work out what it would add" (`.import.delta.go`) | Always | Same screen; C4's comparison line |
| A6. button "Search" (`.search.go`) | Always | Same screen; result rows in C5 |
| A7. button "Cite this row" (`.search.cite`) | On a result row | Same screen; the row shows its extract line |
| A8. the "Follow" control on a result row (act `followfrom`, no word row) | On a result row | `money` |
| A9. button "Watch it" (`.watch.go`) | Always | Same screen; a row in C6 |
| A10. button "Stop watching" (`.watch.stop`) | On a watch | Same screen; the row leaves C6 |
| A11. button "Connect CourtListener" (`.alerts.connect`) | Always | Asks a reason; the key is sealed |
| A12. buttons of C8, `AI` | Disabled until after the alpha | Nothing |

No form messages are designed for this screen yet.

---

## Differences seen in the code

- `screens-publish/doorbell.mjs:47`: "Who may be told it" offers one choice; the mockup draws three, two of them with no word row ("The whole team", "Anyone").
- `screens-publish/doorbell.mjs:45`: the answering form's phrase field is labelled "A secret phrase (optional)"; the mockup labels it "Your secret phrase" (no word row).
- `screens-publish/doorbell.mjs:48`: the answer is a select labelled with the section heading; the mockup draws a radio group "Your answer" (no word row).
- `screens-publish/doorbell.mjs:34`: the reference is shown last, under "After you hand it over"; the mockup folds the whole receipt under that summary, reference first.
- `screens-publish/doorbell.mjs:20`: the mockup's link "What that means" after the court line (no word row) is not drawn.
- `screens-intake/inbox.mjs:52`: the sender's file name and kind are drawn without their labels `screen.inbox.knock.name` and `.type`.
- `screens-intake/inbox.mjs:63`: more than 200 knocks borrows the Held captures line `screen.held.more`; no inbox row exists.
- `screens-intake/about-knocker.mjs:72`: "What became known" lacks the choice "A link to another source".
- `screens-intake/about-knocker.mjs:121`: an empty required field is refused with `capture.fieldneeded` ("This can be captured only once “{field}” is filled in.") before sending, not with `refusal.NO_EVIDENCE` (also :147, :158).
- `screens-intake/about-knocker.mjs:90`: the two permanence notes `sources.consent_permanent_anything` and `sources.withdrawal_binds_later` are not drawn.
- `screens-intake/leads.mjs:36`: the row button reads "Open a lead"; the mockup reads "Open it" (no word row).
- `screens-intake/watching.mjs:130`: no row or link to `registers` (C2).
- `screens-intake/watching.mjs:26`: pause and resume are not offered to a member who is not an administrator, so the fold of S3 is never drawn.
- `screens-intake/watching.mjs:84`: no button "Add another place"; places are typed one per line.
- `screens-intake/watching.mjs:102`: a sweep's "How often" offers three choices, not five.
- `screens-intake/watching.mjs:158`: an empty "Who stands behind the source", and an empty sweep name, sites, pages or budget (:179-181), are refused with `capture.fieldneeded`; the design has no message for them.

## Changes

- 22 Nov 2026: written.
