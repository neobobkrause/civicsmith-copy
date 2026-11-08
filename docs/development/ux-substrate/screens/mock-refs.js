/* The per-screen references (DEC-160, widened October 6): for each screen, the things it names, what each is, and why it
   matters to what the member is doing there. Merged into REFS from mock-shell.js; GLOBAL_REFS cover things named everywhere. */
const SCREEN_REFS = {
  "archive": [
    ["Sewer fund transfers","project","<b>Sewer fund transfers</b> · a project · where sewer-fee money moved between funds, FY2022 to FY2024 · owner: Ana","The project the packet was captured for."]
  ],
  "find-in": [
    ["Report to council: street maintenance performance","document","<b>Report to council: street maintenance performance</b> · 2026 · could be captured: B · the city's own account of its repair times","Where the money figure and the claim about closed reports were found."],
    ["Public Works work orders, FY2025","document","<b>Public Works work orders, FY2025</b> · CSV, 903 rows · captured from the city's open-data portal","A table: its dates are counted through a calculation, not recorded one by one."],
    ["Mai's observation, October 4","document","<b>Mai's observation, October 4</b> · testimony, grade D · what she saw at 6012 Seminary Ave","Its dates are hers, as she recorded them."],
    ["K. Osei",null,"<b>K. Osei</b> · named in the council report · a person your team does not follow yet","Search does not know this name; the assistant's proposals, later, would."]
  ],
  "install": [
    ["Cloudflare account",null,"<b>Cloudflare account</b> · the hosting account · your team's Civicsmith and all its records live in it · the free plan is enough to start","Whoever can sign in to it controls everything, so use a team account rather than a personal login."],
    ["Workers Paid",null,"<b>Workers Paid</b> · Cloudflare's paid plan · $5 a month, with a payment method · can be added later","Needed only for recomputing members' spreadsheets and for members signing in with a Claude subscription."],
    ["short name",null,"<b>Short name</b> · your team's fixed label · in every web address and beside every signature","Chosen once, here: it can never change without installing again, so an unnamed team picks one that reveals nothing."],
    ["lakeshore-tenants",null,"<b>lakeshore-tenants</b> · the short name typed here · becomes lakeshore-tenants.rosa-m.workers.dev and the label on every signature","This exact label is what every case your team signs will carry."],
    ["Signed release verified",null,"<b>Signed release</b> · the Civicsmith release you installed · its signature checked before anything ran","Confirms the software in your account is the release as published, unaltered."],
    ["Record store ready",null,"<b>Record store</b> · where your team's records are kept · inside your own Cloudflare account, nowhere else","Your team's work is stored here from the moment you claim it."],
    ["one-time password",null,"<b>One-time password</b> · shown once, on this page · spent when you claim the team in the next part","The only way to become the first administrator; if lost before claiming, only the Cloudflare account can set a new one."],
    ["first administrator","setup","<b>First administrator</b> · the person who claims the team with the one-time password · invites members and can add administrators","That is you, in the next part; a second administrator later means the team never depends on one person."]
  ],
  "setup": [
    ["one-time password","install","<b>One-time password</b> · shown once on the installer's last page · spent when you claim","Claiming with it makes you the first administrator; after that you sign in only with your own password."],
    ["Cloudflare account",null,"<b>Cloudflare account</b> · the hosting account your team's Civicsmith runs in · owner recorded below: Rosa Medina","It is the way back in if the one-time password is lost, and whoever holds it controls everything."],
    ["lakeshore-tenants",null,"<b>lakeshore-tenants</b> · your team's short name · fixed at install · in every web address and beside every signature","Changing the team name here leaves it as it is."],
    ["records laws","due-date","<b>Records laws</b> · each place's public records law, with its source · for Oakland, a 10-day response window","Civicsmith counts your requests' due dates from it, so the place you choose sets those clocks."],
    ["Council District 3",null,"<b>Council District 3</b> · a seat on the city council · held by J. Ortega since 2023, from Legistar","Confirming the seat lets the record follow whoever holds it, not only today's holder."],
    ["Anthropic's Claude",null,"<b>Claude</b> · Anthropic's AI model · runs the assistant only if your team chooses one of the options below","A member's question goes to Anthropic only when they ask, under whichever account serves them."],
    ["Workers Paid",null,"<b>Workers Paid</b> · Cloudflare's paid plan · $5 a month, with a payment method","Members can sign in with their own Claude subscription only if your team's Civicsmith is on it."],
    ["daily limit",null,"<b>Daily limit</b> · the most the assistant may spend per member each day on the team's key · $5.00 entered below","Caps what the team pays Anthropic; it binds only members served by the team's key."],
    ["published case","published","<b>A published case</b> · a signed, permanent edition of a project's findings · corrected only by a new edition","A verified website lets readers confirm a case under your team's name really comes from it."],
    ["shield laws",null,"<b>Shield laws</b> · laws in many states, California among them, that can protect journalists from being forced to reveal unpublished sources","A member such as a reporter may have protections the rest of the team does not."]
  ],
  "group-identity": [
    ["how members are welcomed","home","<b>The welcome</b> · what a member sees first on Home · “What happened?” and its starting points","The kind and focus you give here decide which starting points Home offers first."],
    ["Draft · the assistant's",null,"<b>Draft · the assistant's</b> · a label on words the assistant wrote · stays until a member edits and keeps them","Nothing here is saved as the team's own until a member keeps it."]
  ],
  "join": [
    ["October 13, 2026",null,"<b>Expires October 13, 2026</b> · an invitation lasts seven days · this one created by Rosa on October 6 · works once","After that the link stops working and Rosa must create a new one."],
    ["contribute",null,"<b>Contribute</b> · what this invitation lets you do · add to the record, open questions, take part in projects","It sets what you can do once you join; an administrator can change it later."],
    ["handle",null,"<b>Handle</b> · the name the record shows on your work · not your legal name unless you choose · chosen when you join and never changed","No other member can ever take it, so a handle always means the same person."],
    ["pen name",null,"<b>Pen name</b> · a handle that is not the name people know you by · the administrators still know who you are","Shields you from pressure if a published case names your work."],
    ["administrators",null,"<b>Administrators</b> · members who invite and manage members · Lakeshore Tenants has one, Rosa","They know who you are even under a pen name, and see the ties you declare."],
    ["public cases","published","<b>Public cases</b> · a team's signed, published findings · permanent, corrected only by a new edition","A handle on your work there is public too; that is the choice the guidance weighs."]
  ],
  "home": [
    ["3 copies you captured at Seminary Avenue","held","<b>Photos · Seminary Avenue</b> · captured by you for Pothole repairs · could be captured: B · held, not yet vouched for","Until you vouch for them they cannot support the pothole question."],
    ["records request","action","<b>Records request: inspection logs</b> · to the Office of the City Clerk · sent October 2 by Mai · acknowledged October 3, ref. R26-0412","The reply decides the next step of the pothole plan."],
    ["due October 14","due-date","<b>Due October 14</b> · the 10-day public records window from October 2 · rolled past a Sunday and a city holiday","If no reply is recorded by then, your queue says so once and the plan can move on."],
    ["Rents and leases on city land, and the streets we live on.","group-identity","<b>Your team's focus</b> · written by Rosa in Who your team is · seen by members only","It shapes which starting points Home offers you first."]
  ],
  "members": [
    ["hosting account",null,"<b>Hosting account</b> · the Cloudflare account the team's Civicsmith runs in · holder recorded at setup: Rosa Medina","Whoever signs in to it controls everything; with one administrator, the team depends on Rosa and on whoever holds it."],
    ["cover",null,"<b>Cover</b> · how the team knows a member, beside their handle · not a legal name · recorded when they are invited","Lets administrators know who each handle is without the record holding legal names."],
    ["Mai K.",null,"<b>Mai K.</b> · invited to contribute as mai-k · cover: <span class=mk-data>from the Seminary Ave block</span> · link works once, for seven days","Withdraw it if it went to the wrong person; until it is used, anyone holding the link can join."],
    ["declared: CPA",null,"<b>Declared: CPA</b> · Ana's own statement · certified public accountant · not yet confirmed here","Confirming it records that an administrator checked it; members ask her to check calculations either way."],
    ["contribute",null,"<b>Contribute</b> · a capability · add to the record, open questions, take part in projects","Every member here holds it; it is what an invitation grants by default."],
    ["administer",null,"<b>Administer</b> · a capability · invite and remove members, hold the team's key, change the team's settings","Only Rosa holds it, so the team depends on Rosa alone."],
    ["$31.40 this month",null,"<b>$31.40 this month</b> · Anthropic's charges to the team's key, October so far · split by member","The team pays it; administrators see who spent what, never what was asked."]
  ],
  "account": [
    ["mai-k",null,"<b>mai-k</b> · your handle · shown on your work in the record and on any public case it is in","You can still change it: none of your work is in a published case yet. After that it is fixed."],
    ["check work in your field",null,"<b>Checks by expertise</b> · a member asks another with declared expertise to check their work · e.g. <span class=mk-data>Ana, a CPA, checked a calculation</span>","Declaring yours, such as Spanish–English interpreting, lets members send you checks in that field."],
    ["signing key",null,"<b>Signing key</b> · a key held in this browser · signs what you approve under your handle, such as a case you own","Without one registered here you cannot sign; revoking it ends this browser's key for good."]
  ],
  "connect": [
    ["the team's key",null,"<b>The team's API key</b> · held by Lakeshore Tenants · switched on by Rosa, October 6 · the team pays Anthropic for each use","It serves you now; your own account, if you connect one, replaces it for you alone."],
    ["Anthropic",null,"<b>Anthropic</b> · the company that makes Claude · receives your question and the material read to answer it, only when you ask","This is where your questions go, under whichever account serves you."],
    ["$5.00 a day for each member",null,"<b>Daily limit · $5.00</b> · set by your administrators for every member on the team's key","You have used $0.80 of it today; when it is reached the assistant stops serving you until the next day."],
    ["Workers Paid",null,"<b>Workers Paid</b> · the Cloudflare plan your team's Civicsmith can run on · $5 a month, paid by the team","Signing in with a subscription needs it; without it, connect with an API key instead."],
    ["Pro or Max plan",null,"<b>Pro or Max</b> · Claude's paid subscription plans · billed to you by Anthropic, not to your team","Only these plans can serve your questions through a subscription."],
    ["console.anthropic.com",null,"<b>console.anthropic.com</b> · Anthropic's Console, where API keys are made · needs a payment method","Where you would make your own key; Anthropic then bills you for each use."]
  ],
  "ties": [
    ["East Bay Transit",null,"<b>East Bay Transit</b> · your employer · a declared tie · disclosed without naming you","If a case the team publishes concerns it, the case says a member of the team works there."],
    ["Planning Commission",null,"<b>Planning Commission</b> · a City of Oakland commission that reviews land-use and development decisions · its staff work for the city","A case about city land may concern it; this tie would be disclosed naming you."],
    ["disclosed to readers of the case","ceremony","<b>Disclosure of ties</b> · a published case lists its workers' ties to anyone it concerns · confirmed by the signer before publishing","A tie you declare here is what the owner checks at the ties step before signing."],
    ["administrators",null,"<b>Administrators</b> · Lakeshore Tenants has one, Rosa","Besides you, only she can see this list."]
  ],
  "notes": [
    ["closed","document","<b>“Closed”</b> · how the city's work orders mark a report done · Administrative Instruction 4.12, passage 5: when the crew reports the work complete","The open question whether “closed” means “repaired” turns on it; the foreman's answer could become an observation."],
    ["60th",null,"<b>Seminary Ave at 60th</b> · a block in Pothole repairs · one of the held photos was taken here","Members spot-checked closed reports on this stretch; what the crew says applies to them."]
  ],
  "translations": [
    ["Undetermined",null,"<b>Undetermined</b> · a status the record gives when it cannot settle something, and says why · a protected word","A loose translation would change what members think the record shows."],
    ["from the release",null,"<b>From the release</b> · translated by Civicsmith and shipped with this version · not your team's own wording","Your team can still change it; the change is recorded with what it replaced."],
    ["Nobody looked","finder","<b>Nobody looked</b> · a gap mark · no member has searched a source for this yet","Members act on it, so the Spanish must read as a gap, not as a finding."],
    ["needs a second check",null,"<b>Second check</b> · a protected word changed by one speaker waits for another granted speaker or an administrator","Until Teo or Rosa confirms it, members reading Español see the English."],
    ["Held together","finder","<b>Held together</b> · a set of documents a member holds in Find to count, cite or act on as one","Still untranslated: members reading Español see it in English."],
    ["Asks for a reason",null,"<b>Asks for a reason</b> · the mark on an act that asks for a reason, which becomes part of the record","Ana's suggestion, “Pide un motivo”, waits for a granted speaker to keep it or explain why not."]
  ],
  "wizards": [
    ["Get a record, Oakland style","request","<b>Get a record, Oakland style</b> · your team's copy of Civicsmith's Get a record · approved by Rosa","Civicsmith's original changed since the copy; a wizard editor decides whether to bring the change across."],
    ["Get a record","request","<b>Get a record</b> · Civicsmith's wizard · walks a member through asking an office for records · finished by 14 members","The original your team's Oakland copy is based on."],
    ["Our council-meeting checklist",null,"<b>Our council-meeting checklist</b> · your team's own wizard · approved by Rosa","Written by your team, so only your team's approvals change it."],
    ["Check a pothole report","capture","<b>Check a pothole report</b> · a draft wizard by Dev · for visiting a closed report and recording what you see","Not offered to members until it is submitted and approved."]
  ],
  "queue": [
    ["The Coliseum lease","project","<b>The Coliseum lease</b> · project · owner: Dev · 3 items for you here","Waiting on you: a decision on the newer lease amendment; also a disagreement on dates and a reply due October 9 with none recorded."],
    ["Pothole repairs","project","<b>Pothole repairs</b> · project · whether potholes are repaired within the seven days Administrative Instruction 4.12 sets · 6 items for you here","Waiting on you: Ana's request to check the 812 of 903 count, due October 16."],
    ["the rent adjustment","matter","<b>The 2024 rent adjustment</b> · a matter in The Coliseum lease · signed by the City Administrator, March 2024, without a council vote","Two documents disagree on its date; a member must judge which one holds."],
    ["A council member","explore","<b>J. Ortega</b> · Council District 3 since 2023 · his Form 700 for 2025 lists income from Bayline Properties","A lead, never a finding: nothing is evidence until a member opens a question and cites the documents."],
    ["38 disclosure filings",null,"<b>38 disclosure filings</b> · <span class=mk-data>Form 700 statements of economic interests</span> your team holds · council members' filings","The hint is only as complete as these filings; a missing year would hide a match."],
    ["6 of 50",null,"<b>6 of 50</b> · this check's past hints that members looked into and found false · <span class=mk-data>most often two firms with similar names</span>","Check the firm's name in the filing yourself before opening a question."],
    ["standing question","finder","<b>Standing question</b> · a search kept running for you · “pothole work orders” · reports new matches in what your team holds","Its 3 new documents may change the input of the count Ana asked you to check."]
  ],
  "finder": [
    ["data.oaklandca.gov",null,"<b>data.oaklandca.gov</b> · the City of Oakland's open-data portal · where Dev captured the work orders on October 2","A copy from the city's own portal holds up better than one found elsewhere."],
    ["passage 3","document","<b>Passage 3</b> of Administrative Instruction 4.12 · “within seven calendar days of the report, weather permitting”","The words your search matched; cite this passage, not the whole policy."],
    ["within seven calendar days","standard","<b>Repair reported potholes within seven calendar days</b> · a standard · Administrative Instruction 4.12, §3 · in force since 2023","The rule the city is checked against; the work orders show how often it was met."],
    ["public archive copy",null,"<b>Public archive copy</b> · captured from a public web archive, not the city's own site · could be captured: C","Capture it from the city's site before relying on it; that copy would hold up better."],
    ["2 documents held together",null,"<b>2 documents held together</b> · <span class=mk-data>the FY2025 work orders and Administrative Instruction 4.12</span> · held for you until 4:40 PM today","A held set can be counted, cited or acted on as one; let it go when you are done."]
  ],
  "capture": [
    ["the office's own site",null,"<b>The office's own site</b> · the website of the office that issued the document · for Oakland, <span class=mk-data>oaklandca.gov</span>","A copy fetched there carries its source with it, so a reader can fetch the same page and compare."],
    ["public archive",null,"<b>Public archive</b> · an outside service that keeps dated copies of public web pages · not run by the city or by your team","It can rescue a page the city has removed, but it learns which address your team asked for."],
    ["testimony",null,"<b>Testimony</b> · one of the four grade scales · a person's own account of what they saw or heard","What you write here can support or cut against a question, labeled as yours, as Mai's Seminary Ave visit does."],
    ["grade D",null,"<b>Grade D</b>: A is easiest to check; D rests on a person's word. A grade never says whether something is true.","D does not mean doubtful: it tells a reader your account can be checked only by asking you."]
  ],
  "held": [
    ["Agenda packet, City Council, May 14, 2024 (ZIP)","archive","<b>Agenda packet, City Council, May 14, 2024</b> · a ZIP archive · 41 entries · captured by Ana from the city's meeting site, could be captured: B","Its 36 files wait here beside it; vouching for the archive does not vouch for them."],
    ["Photo · Seminary Ave at 60th","document","<b>Photo · Seminary Ave at 60th</b> · a held capture · taken October 4 · could be captured: B · Pothole repairs","Picked for this batch: vouching for it lets it stand beside Mai's account of the unrepaired pothole."],
    ["Photo · Seminary Ave at 61st","document","<b>Photo · Seminary Ave at 61st</b> · a held capture · taken October 4 · could be captured: B · Pothole repairs","Picked for this batch with the 60th Street photo; both are vouched for in one act."],
    ["vouched for",null,"<b>Vouching</b> · a member signs that a capture is what it says it is · until then it is held and counts toward nothing","Nothing on this list supports or cuts against any question until a member vouches for it."],
    ["Were the FY2022 transfers authorized?","question","<b>Were the FY2022 transfers authorized?</b> · Ana's question in Sewer fund transfers · waiting on the FY2024–25 budget","Setting the budget aside sends your reason to Ana on this question."],
    ["FY2024–25 budget","document","<b>City budget FY2024–25, adopted</b> · PDF, 412 pages · captured October 2 · held, not yet vouched for","The third row above, not picked: vouching for it would end Ana's wait."],
    ["crucial to a finding",null,"<b>Crucial to a finding</b> · a capture a finding would fall without · vouched for one at a time, never in a batch","The March 2024 amendment carries a finding in The Coliseum lease, so it gets its own look."]
  ],
  "document": [
    ["Public Works",null,"<b>Public Works</b> · a city department · <span class=mk-data>repairs streets and fills potholes</span> · headed by the Director of Public Works, today L. Chen","The department that issued this instruction is the one it binds."],
    ["oaklandca.gov",null,"<b>oaklandca.gov</b> · the City of Oakland's own website · where the city publishes its policies","Captured from the issuer's own site, so a reader can fetch the same page and compare its fingerprint."],
    ["revised 2023",null,"<b>Revised 2023</b> · the version this copy holds · the version in force when captured on October 2, 2026","FY2025 repairs are tested against this version, so a later revision would not change past counts."],
    ["The Director",null,"<b>The Director</b> · in this instruction, the Director of Public Works · held today by L. Chen","Passage 3 puts the seven-day duty on an office, so it binds whoever holds the post."],
    ["seven calendar days","standard","<b>Seven calendar days</b> · the standard passage 3 sets · weekends and holidays count · held as a standard in Pothole repairs","The window the 812 of 903 count is measured against."],
    ["weather permitting",null,"<b>Weather permitting</b> · the instruction's own exception to the seven days · nothing shown here says how it is recorded","A late repair may fall under it; check the work order for a weather note before counting it against the city."],
    ["recorded as closed","question","<b>Closed</b> · the city's status for a report · per passage 5, set when the crew reports the work complete, not after an inspection","This passage is why the project asks whether \"closed\" in the city's records means \"repaired\"."],
    ["L. Chen","person","<b>L. Chen</b> · a person the record follows · Director of Public Works since March 2022 · named in 14 documents","This copy names L. Chen; claiming the same person links the document to that page."],
    ["2026 performance report","document","<b>Report to council: street maintenance performance</b> · 2026 · could be captured: B · claims 90% of potholes filled","It counts reports \"closed\", which passage 5 sets at the crew's report, not an inspection."]
  ],
  "project": [
    ["its own policy","document","<b>Administrative Instruction 4.12</b> · Public Works' pothole repair policy · could be captured: B · sets seven calendar days","The project measures the city against its own rule, not against an outside standard."],
    ["Bar: B/B",null,"<b>The project's bar</b> · copy B, connection B · a question meets it when both of its grades reach B","The main question is at B and C: one step short, on connection."],
    ["Investigating",null,"<b>Investigating</b> · the project's stage · after Forming · Matured comes when its questions meet the bar","The project stays here until a question reaches B/B."],
    ["2026 report","document","<b>Report to council: street maintenance performance</b> · 2026 · could be captured: B · claims 90% of potholes filled","Its 90% means something different depending on which seven days it counted."],
    ["seven working days",null,"<b>Seven working days</b> · a looser count than the seven calendar days Administrative Instruction 4.12 sets · skips weekends and holidays","If the city counted working days, its 90% would not test the instruction's standard."]
  ],
  "question": [
    ["2024 budget PDF","held","<b>City budget FY2024–25, adopted</b> · PDF, 412 pages · a held capture · set aside by Ben, October 6","This question waits on it; restoring it returns it to the held list for a member to vouch for."],
    ["Ben","members","<b>Ben</b> · member of your team","Set the budget PDF aside on October 6; the reason, \"wrong year\", stays on the record."],
    ["seven calendar days","standard","<b>Seven calendar days</b> · the standard Administrative Instruction 4.12 sets in passage 3 · weekends and holidays count","The standard this question tests the city against."],
    ["passage 3","document","<b>Passage 3</b> of Administrative Instruction 4.12 · \"The Director shall repair each reported pothole within seven calendar days of the report, weather permitting.\"","The passage Dev cited as support."],
    ["computed fact",null,"<b>Computed fact</b> · a figure worked out from captured data by a stated method · recomputed when an input changes","Anyone can rerun the 812 from the city's work orders and get the same count."],
    ["Ana","members","<b>Ana</b> · member of your team · owns Sewer fund transfers · declared expertise: accounting (CPA, confirmed)","Checked the 812 of 903 calculation on October 5."],
    ["marked closed on September 15",null,"<b>Report at 6012 Seminary Ave</b> · reported September 12 · marked closed September 15 · still open when Mai visited on October 4","A closed report that was not repaired: the kind of case the 812 cannot show."],
    ["Mai","members","<b>Mai</b> · member of your team · translates Español · joined October 2","Visited 6012 Seminary Ave on October 4; that account cuts against the count as testimony, grade D."],
    ["Hunch",null,"<b>Hunch</b>: a member's suspicion, labeled as one. Never evidence, and it never moves a finding.","Dev's hunch is what the records request for inspection logs is meant to test."]
  ],
  "assistant": [
    ["812 of 903 reports closed within 7 days","calculation","<b>Reports closed within seven days, FY2025</b> · a calculation from the city's work orders · checked by Ana","Ask the assistant how it was counted; it answers from the method and the work orders your team holds."],
    ["2024 budget PDF","held","<b>City budget FY2024–25, adopted</b> · PDF, 412 pages · a held capture · set aside by Ben, October 6","The assistant can search what your team holds for another source; restoring this one is a member's act."],
    ["Ben","members","<b>Ben</b> · member of your team","Ben's reason, \"wrong year\", is on the record; ask the assistant which year this question needs."],
    ["seven calendar days","standard","<b>Seven calendar days</b> · the standard Administrative Instruction 4.12 sets in passage 3 · weekends and holidays count","Ask the assistant whether the city's 2026 report counted calendar or working days; it says where it looked."],
    ["passage 3","document","<b>Passage 3</b> of Administrative Instruction 4.12 · \"The Director shall repair each reported pothole within seven calendar days of the report, weather permitting.\"","Ask the assistant to set it beside passage 5, which says when a report counts as closed."],
    ["computed fact",null,"<b>Computed fact</b> · a figure worked out from captured data by a stated method · recomputed when an input changes","The assistant can explain the method; only a member's check, like Ana's, is recorded as a check."],
    ["Ana","members","<b>Ana</b> · member of your team · owns Sewer fund transfers · declared expertise: accounting (CPA, confirmed)","Checked the count on October 5; the assistant's work is labeled machine work and is not a check."],
    ["marked closed on September 15",null,"<b>Report at 6012 Seminary Ave</b> · reported September 12 · marked closed September 15 · still open when Mai visited on October 4","Ask the assistant for this report's work order: it would show what the crew recorded on September 15."],
    ["Mai","members","<b>Mai</b> · member of your team · translates Español · joined October 2","Mai's account is testimony; the assistant can find related records but cannot raise its grade."],
    ["Hunch",null,"<b>Hunch</b>: a member's suspicion, labeled as one. Never evidence, and it never moves a finding.","Ask the assistant what records would test Dev's hunch; it stays a hunch until a source supports it."]
  ],
  "answers": [
    ["work orders","document","<b>Public Works work orders, FY2025</b> · CSV, 903 rows · from the city's open-data portal · captured by Dev","The only source this answer counts; it records closing dates, not repair dates."],
    ["903 reports",null,"<b>903 reports</b> · every row in the FY2025 work orders · each with a reported date and a closed date","The whole that the 812 is counted against."],
    ["812 were closed within 7 calendar days","calculation","<b>Reports closed within seven days, FY2025</b> · a calculation · 812 of 903 · checked by Ana","The same count as the calculation; open it to see the method rather than rely on this answer."],
    ["passage 5","document","<b>Passage 5</b> of Administrative Instruction 4.12 · \"Repairs are recorded as closed when the crew reports the work complete.\"","Why the answer warns that it counts \"closed\" as the city records it."],
    ["14 documents","finder","<b>14 documents</b> · what the assistant searched for this answer · all held by your team","None of them is an inspection record, so the answer cannot say whether closed reports were repaired."],
    ["inspection records","action","<b>Records request: inspection logs</b> · to the Office of the City Clerk · sent October 2 by Mai · response due October 14","What this answer lacks; the request asks the city for them."],
    ["812 with closed − reported ≤ 7 days","calculation","<b>Reports closed within seven days, FY2025</b> · a calculation · 812 of 903 · checked by Ana","The count behind the question's 812 of 903; open it for the method and Ana's check."],
    ["your queue","queue","<b>Your queue</b> · what waits on you · new matches arrive there as one list","Keep asking this sends new matching rows there instead of interrupting you."]
  ],
  "person": [
    ["14 documents","finder","<b>14 documents</b> · held by your team · each names L. Chen · among them Administrative Instruction 4.12","Each fact on this page cites one of them."],
    ["city roster",null,"<b>City roster</b> · the City of Oakland's published list of officials and their posts","The source for the current post; when it changes, this page shows who holds the office next."],
    ["council minutes",null,"<b>Council minutes</b> · the council's official record of its meetings · published on Legistar","The source for the earlier post, 2018 to 2022."],
    ["Deputy Director, Transportation",null,"<b>Deputy Director, Transportation</b> · a post in Public Works · held by L. Chen 2018–2022, from council minutes","The post that links L. Chen to \"Lin Chen\" in the 2019 minutes."],
    ["state license register",null,"<b>State license register</b> · <span class=mk-data>California's public register of licensed engineers</span>","Following it brings any change to this license into your queue."],
    ["Form 700",null,"<b>Form 700</b> · California's Statement of Economic Interests · filed yearly by officials · lists income, property and gifts","The 2025 filing reports none; a later filing would show any change."],
    ["Lin Chen",null,"<b>“Lin Chen”</b> · a name in <span class=mk-data>the 2019 council minutes</span> · claimed the same person · subject match B","If the claim is wrong, the 2019 facts belong to someone else; withdraw it with a reason."],
    ["grade B",null,"<b>Subject match B</b> · rests on the same post held on the cited dates, not on a shared identifier","A shared identifier, such as a license number on both records, would make it easier to check."],
    ["2019 voter file",null,"<b>2019 voter file</b> · the county's voter registration list · the source of the home address being removed","The value taken from it is what this removal erases for good."],
    ["the docket","docket","<b>The docket</b> · each published case's public record of corrections, withdrawals and orders","Published cases that cite the address are dealt with there, openly, not by this removal."]
  ],
  "timeline": [
    ["Rent adjusted without a vote","matter","<b>The 2024 rent adjustment, made without a council vote</b> · a matter · noncompliant, established · against lease §7.2","The event the project's main finding rests on; its date is known only to the month."],
    ["month known",null,"<b>Month known</b> · the source gives a month but no day · never guessed to a day","Why this event and the April notice cannot be put in order."],
    ["Council",null,"<b>Council</b> · Oakland City Council · its votes are recorded in minutes on Legistar","Approved amendment 1 in January 2024; no vote of the council is recorded for the March rent change."],
    ["City Administrator",null,"<b>City Administrator</b> · an office · <span class=mk-data>runs the city's departments and answers to the council</span>","Signed the March 2024 adjustment; no vote of the council stands behind it in this record."],
    ["We requested the rent schedules","action","<b>Request: the rent schedules</b> · a records request to the Office of the City Clerk · September 4, 2026 · answered September 18","The team's own act, in its own lane, beside the reply it got."],
    ["April notice",null,"<b>April notice</b> · <span class=mk-data>the city's notice of the new rent</span> · dated April 2024, month only","Its order against the March adjustment is undetermined; a source dated to the day would help order them."],
    ["Memo on rent indexing","document","<b>Memo on rent indexing</b> · a document · no date on its face","Kept apart until a source dates it; it may show how the 2024 rent was set."]
  ],
  "money": [
    ["Sewer Fund 3100",null,"<b>Sewer Fund 3100</b> · <span class=mk-data>the city fund that holds sewer-fee revenue</span> · <span class=mk-data>kept apart from the general fund</span>","Transfers out of it are what Ana's question asks were authorized."],
    ["adopted",null,"<b>Adopted</b> · a stage · the amount in the budget the council adopted for the year","Set against the paid figure to show what moved beyond the budget."],
    ["actual (paid)",null,"<b>Actual (paid)</b> · a stage · what was paid, from the city's annual financial report","$550,000 above the adopted figure for the same transfer."],
    ["Overhead charge",null,"<b>Overhead charge</b> · what the sewer fund pays for shared city services · recorded apart from transfers","Left out by Ana as a different transfer; the reason stays on the record."],
    ["$550,000 more paid than adopted",null,"<b>$550,000</b> · $4,750,000 paid against $4,200,000 adopted · FY2022 · Sewer Fund 3100","The gap the trail rests on; What authorized it looks for the act behind the extra."],
    ["the budget",null,"<b>Adopted budget, FY2022</b> · the council's spending plan for the year · reports by fund","The source of the adopted figure."],
    ["the financial report",null,"<b><span class=mk-data>Annual financial report, FY2022</span></b> · the city's year-end accounts · reports by department","The source of the paid figure; its basis differs from the budget's, so figures need matching first."],
    ["Ana","members","<b>Ana</b> · member of your team · owns Sewer fund transfers · declared expertise: accounting (CPA, confirmed)","Started this trail for the question \"Were the FY2022 transfers authorized?\""]
  ],
  "calculation": [
    ["812 of 903",null,"<b>812 of 903</b> · <span class=mk-data>reports whose closed date is within 7 calendar days of the reported date</span> · FY2025","It counts \"closed\" as the city records it: when the crew reports the work complete, not after an inspection."],
    ["7 calendar days","standard","<b>Seven calendar days</b> · the standard Administrative Instruction 4.12 sets in passage 3 · weekends and holidays count","The window the method counts from report to close."],
    ["Public Works work orders FY2025","document","<b>Public Works work orders, FY2025</b> · CSV, 903 rows · from the city's open-data portal · captured October 2","The only input; if the city changes the file, the count is recomputed and your queue says so."],
    ["CPA, confirmed",null,"<b>CPA, confirmed</b> · Ana's declared expertise, <span class=mk-data>certified public accountant</span> · confirmed in the team","Ana's check is the second member's check; the result still needs a member to accept it."],
    ["recorded random draw",null,"<b>Recorded random draw</b> · a sample picked from a recorded seed · anyone with the seed gets the same picks","It keeps members from visiting only the reports they expect to fail."],
    ["40 of 812 closed reports",null,"<b>40 of 812</b> · the closed reports drawn for members to visit · seed 2026-10-05-7f31","Visits like Mai's on Seminary Ave test whether closed reports were repaired."]
  ],
  "explore": [
    ["Coliseum lease","project","<b>The Coliseum lease</b> · a project · whether the city kept the terms of its lease of the Coliseum land · owner: Dev","The end point of this search; each chain found ends in a payment under the lease."],
    ["voted for",null,"<b>Voted for</b> · a step from <span class=mk-data>the council minutes of January 12, 2024, item 7</span> · 5 for, 2 against","The step that ties J. Ortega to the amendment, cited to the vote record."],
    ["paid under",null,"<b>Paid under</b> · a step from <span class=mk-data>the city's annual financial report, FY2024</span> · could be captured: B","Ties the amendment to the $1.2M paid; open the report to check the line."],
    ["weakest step B",null,"<b>Weakest step</b> · a chain is graded by its weakest link · here B on connection","No single strong step carries the chain; each must hold."],
    ["declared, not evidenced",null,"<b>Declared, not evidenced</b> · a link someone stated with no source attached · connection D","Attaching a source could raise this step; until then the chain is a lead."],
    ["four steps",null,"<b>Four steps</b> · the search's limit · longer chains are not followed","A link further out may exist; the search says it did not look rather than that there is none."]
  ],
  "proceeding": [
    ["Superior Court",null,"<b>Superior Court</b> · Alameda County Superior Court · the state trial court for Oakland","Where this case is heard; its register lists every filing."],
    ["a neutral label",null,"<b>Neutral label</b> · a short name for a proceeding that takes no side · used wherever the case is named","Members and readers see \"the lease rent case\", not either party's framing."],
    ["Lakeshore Tenants Association",null,"<b>Lakeshore Tenants Association</b> · the petitioner · the name your team, Lakeshore Tenants, is a party under","Your team is a party, so its own filings belong on this register."],
    ["City of Oakland",null,"<b>City of Oakland</b> · the respondent · the party the court's orders bind here","The party ordered to produce the 2024 rent schedules."],
    ["Hon. M. Ferris","person","<b>Hon. M. Ferris</b> · a person the record follows · judge of the Superior Court · from the court's register","Issued the October 1 order on demurrer."],
    ["Order on demurrer",null,"<b>Order on demurrer</b> · October 1, 2026 · the ruling on whether the petition states a claim the court can hear","New on the register; the order to produce the rent schedules is held from it."],
    ["Opposition filed",null,"<b>Opposition</b> · September 14, 2026 · a written answer to the demurrer","The filing the October 1 order ruled on, with the demurrer."],
    ["The City shall produce the 2024 rent schedules",null,"<b>Order to produce the 2024 rent schedules</b> · held as an obligation on the city · reply due October 30","Held as an obligation, a missed date reaches your queue like any other."]
  ],
  "due-date": [
    ["your records request","action","<b>Records request: inspection logs</b> · to the Office of the City Clerk · sent October 2 by Mai · acknowledged October 3, reference R26-0412","The request this date belongs to; a reply recorded there meets it."],
    ["public records law",null,"<b>Public records act</b> · the law named in your team's profile · sets the time an office has to respond","The basis of this count; a different law would give a different date."],
    ["10-day response window",null,"<b>10-day response window</b> · counted in calendar days from the day the office receives the request","Counted from October 2, the day you recorded sending it."],
    ["your team's profile","group-identity","<b>Your team's profile</b> · names the law your requests go under and your city's holidays","The 10 days come from it; correct it there if the law is wrong."],
    ["your profile","group-identity","<b>Your team's profile</b> · names the law your requests go under and your city's holidays","The October 13 holiday comes from it; correct it there if the date is wrong."],
    ["close of business",null,"<b>Close of business</b> · the end of the office's working day on the due date","A reply that arrives after then on October 14 is late."],
    ["your queue","queue","<b>Your queue</b> · what waits on you","Once confirmed, this date waits there and is flagged once if no reply comes."]
  ],
  "standard": [
    ["§3","document","<b>Passage 3</b> of Administrative Instruction 4.12 · Public Works · could be captured: B · the sentence quoted below","The exact passage this standard holds; passage 5 of the same instruction defines “closed” as the crew reporting the work complete."],
    ["in force since 2023",null,"<b>In force since 2023</b> · when this version of the instruction took effect · revised 2023, per the copy Dev captured","Every report in the FY2025 work orders falls under this version, so one standard covers them all."],
    ["Public Works",null,"<b>Public Works</b> · a city department · repairs streets · run by the Director of Public Works, held today by L. Chen","The department that set this standard for itself, and whose own work orders test it."],
    ["Director","person","<b>The Director</b> · the Director of Public Works · held today by L. Chen, since March 2022","The duty falls on the office, so it binds whoever holds the post on the date of each report."],
    ["seven calendar days","calculation","<b>Seven calendar days</b> · the measure this standard sets · counted from the report, weekends included","The calculation “812 of 903 reports closed within 7 days” counts the same calendar days."],
    ["weather permitting",null,"<b>Weather permitting</b> · the one exception in passage 3 · the instruction does not define it","If the city answers that weather delayed repairs, this is the clause it would rely on."],
    ["90% of potholes filled within 72 hours",null,"<b>90% of potholes filled within 72 hours</b> · a performance target in the 2026 budget · proposed by the assistant, not adopted","A budget target, not a rule: adopt it only if the team judges the city bound itself to it."],
    ["Proposed standard",null,"<b>Proposed standard</b> · a requirement suggested for the record · held as a standard only once a member adopts it, with a reason","Until someone adopts it, nothing in the project is measured against it."]
  ],
  "plan": [
    ["Scenario A",null,"<b>Scenario A · Records first</b> · the scenario laid out so far · phase 1: the records request, then a checkpoint judged by a member","The check above is about this scenario: it has no branch for a refusal or a stall."],
    ["hostile response",null,"<b>Hostile response</b> · a refusal, obstruction or retaliation in answer to an action · for example a blanket denial, or silence past the due date","Scenario A says nothing about what follows one; a branch can be added before the reply is due on October 14."],
    ["Is the city repairing…?","question","<b>Is the city repairing reported potholes within seven days?</b> · question · copy B, connection C · short on connection","The inquiry this plan comes from; its weak link is why the plan starts with records."],
    ["Pothole reports marked closed before repair","question","<b>Subject 1</b> · the suspected breach this plan addresses · against passage 3 of Administrative Instruction 4.12 · rests on the question whether “closed” means “repaired”","Every option is chosen against it; if the logs show closed means repaired, the plan has nothing to address."],
    ["hypothetical: not yet shown",null,"<b>Hypothetical</b> · a matter the plan assumes · no finding supports it yet","The options here rest on something unproven; the inspection logs could show it or rule it out."],
    ["regulated end date",null,"<b>Regulated end date</b> · the date a law or rule closes an option, such as a filing deadline or a response window","Sorting by it puts first the options that lapse if the team waits."],
    ["Story with a reporter",null,"<b>Story with a reporter</b> · an option · awareness · undecided · Teo, a member, reports for the Bay Courier","Going public before the logs arrive is scenario B; a story by a member's own newsroom needs his tie declared."],
    ["agendize",null,"<b>Agendize</b> · to put an item on a public meeting's agenda · a council committee can discuss and act only on what is on it","The assistant's suggestion: a way to get repair performance discussed in public, not yet in the plan."],
    ["B · Go public",null,"<b>Scenario B · Go public</b> · an alternative scenario, not laid out yet · would start with the story with a reporter","The fallback if the City Clerk refuses or stalls on the records request."],
    ["logs show inspection dates",null,"<b>Checkpoint</b> · “logs show inspection dates” · judged by a member, with a reason, once the reply comes","Dates of inspection and repair are what would show whether a report was closed before the repair."],
    ["Response due 14 Oct","due-date","<b>Due October 14, 2026</b> · close of business · 10 calendar days under the public records law the team's profile names, rolled past a Sunday and a city holiday","Phase 1's checkpoint can't be judged before the reply, or before this date passes without one."]
  ],
  "start-send": [
    ["records request",null,"<b>Records request</b> · a kind of action · asks an office for copies of public records under the public records law · the office must reply within its window","This action only asks for records; it accuses no one."],
    ["Subject 1: reports closed before repair","plan","<b>Subject 1</b> of the plan “Repairs: closed is not repaired” · reports marked closed before repair, against Administrative Instruction 4.12 §3","The action rests on it, so the request asks for the records that could show it or rule it out."],
    ["hypothetical: not yet shown",null,"<b>Hypothetical</b> · the matter is assumed, not shown · no finding supports it yet","Since nothing is shown, the request asserts no breach and asks only for records."],
    ["the law your profile names",null,"<b>The public records law</b> · named in your team's profile · an office must answer a records request within 10 days","The request is made under it, so the office's duty to reply comes from it, not from Civicsmith."],
    ["10 days","due-date","<b>The response clock</b> · 10 calendar days from the day the office receives the request · rolled past weekends and city holidays","The due date is worked out from the day you record sending it."],
    ["Asserts a breach",null,"<b>Asserts a breach</b> · whether the action tells the office it broke a rule · here, no","A plain request can't be read as an accusation; a complaint later would be."],
    ["Approving fixes the text",null,"<b>Approving</b> · fixes the text on the record exactly as it will be sent · a later change is a new version","What the office receives must match what the record says was sent, so approve only the final wording."],
    ["Civicsmith sends nothing",null,"<b>Civicsmith sends nothing</b> · every outward message goes by a member's own hand · the record keeps the approved text and the date you record","Record the sending on the day it goes: the 10-day clock counts from it."]
  ],
  "request": [
    ["Look first","finder","<b>Find</b> · searches everything your team holds · the FY2025 work orders came from the city's open-data portal","Inspection logs may already be public; a search costs nothing and tells no office what you are looking at."],
    ["capture it instead","capture","<b>Capture</b> · adding a copy of a public record from its address · a copy from the office's own site holds up best","A capture needs no request and no wait, and gives the record a fingerprinted copy."],
    ["by its role",null,"<b>Addressed by role</b> · the request names the office, not the person · City Clerk, held today by Asha Rao","If the post changes hands before the reply, the request still stands."],
    ["City Clerk",null,"<b>City Clerk</b> · an office · keeps the city's records and answers records requests · held today by Asha Rao","The office that answers records requests and can route this one to Public Works, which keeps the inspection logs."],
    ["anyone it shares the request with",null,"<b>Who else sees a request</b> · an office may forward it to the department holding the records · a request is itself usually a public record","Write it so it reads well to anyone, including the department whose records you ask about."]
  ],
  "action": [
    ["Office of the City Clerk",null,"<b>Office of the City Clerk</b> · <span class=mk-data>keeps the city's records and answers records requests</span> · held today by Asha Rao · 4 requests from your team, 3 answered on time","The office that must reply; its record with your team so far is 3 of 4 on time."],
    ["sent October 2",null,"<b>Sent October 2, 2026</b> · recorded by Mai on the day it was sent","The response clock counts from this date."],
    ["Mai","members","<b>Mai</b> · member of your team · owns Pothole repairs · sent this request and recorded the sending","A reply that reaches her by mail or in person should be recorded here, so the clock stops."],
    ["Response due October 14","due-date","<b>Due October 14, 2026</b> · close of business · 10 calendar days from receipt on October 2, rolled past Sunday October 12 and a city holiday on October 13","If no reply is recorded by then, the queue says so once; the plan's checkpoint waits on it."],
    ["City Clerk",null,"<b>City Clerk</b> · an office · <span class=mk-data>keeps the city's records and answers records requests</span> · held today by Asha Rao","Its reply, or its silence by October 14, decides the plan's next step."],
    ["acknowledgment",null,"<b>Acknowledgment</b> · a reply · the office confirms it received the request · not an answer","It is not the records: the October 14 due date stands unless the office gives notice of an extension."],
    ["R26-0412",null,"<b>R26-0412</b> · the City Clerk's reference for this request · from its acknowledgment of October 3","Quote it in any follow-up so the office can find the request."]
  ],
  "matter": [
    ["noncompliant",null,"<b>Noncompliant</b> · a determination · the act did not meet the rule it is measured against · recorded by a member, with a reason","What the team has determined from its evidence, not what a court has decided."],
    ["established",null,"<b>Established</b> · the determination is settled on the record · its finding meets the project's bar, B/B","Strong enough to act on: escalating does not wait for more evidence."],
    ["lease §7.2","document","<b>Lease §7.2</b> · a clause of the Coliseum lease · a change to the rent needs a council vote","The rule this matter is measured against; the 2024 adjustment had no vote."],
    ["Notification","action","<b>Stage 2 · Notification</b> · the city has been told · the letter “Demand to rescind”, sent to the City Administrator September 19 · reply due October 9","The stage the matter is at; its reply decides whether stage 3 is needed."],
    ["Clock starts",null,"<b>Stage 3 · Clock starts</b> · the next stage · a deadline the city must answer by starts running, tracked in your queue","Advancing to it is the next act offered here; it normally follows the reply due October 9, or its absence."],
    ["$38,000 in rent above the schedule","calculation","<b>Rent above the schedule, 2024–2026</b> · a calculation · $38,000 · from the rent schedules, could be captured: B","The consequence the team would cite on escalating; check it still holds before stage 3."],
    ["the rent schedules","document","<b>Rent schedules</b> · released by the City Clerk on September 18 in answer to the team's request · could be captured: B","The source of the $38,000: a different schedule would change the figure."]
  ],
  "case-editor": [
    ["Shared for review","review-copy","<b>Shared for review</b> · the next step · a named outside reader gets a view you can stop at any time · nothing public yet","After this draft, an outside reader can catch what the team missed before it is permanent."],
    ["Internally checked",null,"<b>Internally checked</b> · a readiness step · the case passes Civicsmith's own checks: bar met, people named with reasons, what it leaves out · not run yet","The missing reason for J. Ortega would hold it back."],
    ["Externally compliant",null,"<b>Externally compliant</b> · a readiness step · the case meets outside rules it must follow, such as court orders and sealing · not run yet","Checked before publishing, so nothing public breaks an order."],
    ["Whether the rents are fair",null,"<b>Left out: whether the rents are fair</b> · a policy question · the case asks only whether the lease's own rules were followed","Saying so keeps readers from taking the case as a view on rent levels."],
    ["the 2019 negotiation",null,"<b>The 2019 negotiation</b> · the talks that produced the Coliseum lease · before the scope, January 2024 to September 2026","Left out on purpose; readers see that it was considered and set aside."],
    ["City Administrator",null,"<b>City Administrator</b> · an office · <span class=mk-data>runs the city's departments and answers to the council</span>","Named by title, not by name: the case concerns the office's act, whoever held the post."],
    ["signed the March 2024 adjustment","timeline","<b>March 2024: rent adjusted without a vote</b> · an event on the timeline · signed by the City Administrator · could be captured: B · dated by month only","The reason the office is named; a reason must come from the case's own evidence."],
    ["J. Ortega","person","<b>J. Ortega</b> · Council District 3 since 2023 · voted for Lease amendment 1 on January 12, 2024 · his Form 700 for 2025 lists income from Bayline Properties","A person named needs a reason the findings show; a lead from a hint is not one."],
    ["reason missing",null,"<b>Reason missing</b> · every person a case names needs the reason, drawn from its evidence","The case can't pass its checks until J. Ortega has a reason or is taken out."],
    ["Edition 1","published","<b>Edition 1</b> of The Coliseum lease · a published case · stays public, marked as corrected, once Edition 2 is published","Its readers see “what changed” first: say what is new and what it corrects."]
  ],
  "review-copy": [
    ["can read until October 20",null,"<b>Review copy ends October 20</b> · after that the reader's view stops · you can stop it sooner","Comments must come in by then; a later reading needs a new review copy."],
    ["Teo","members","<b>Teo</b> · member of your team · a reporter at the Bay Courier · declared expertise: journalism","The advance copy goes to his newsroom, so his tie to it is declared on the case."],
    ["embargoed advance copy",null,"<b>Embargoed advance copy</b> · a newsroom may read it before publication but not report on it until it is public","The Bay Courier can prepare its story; nothing runs before Edition 2 is published."],
    ["Finding 2",null,"<b>Finding 2</b> of Edition 2 · that two rent adjustments had no council vote · meets the bar, B/B","The reviewer asks it to name its schedule; answer or change it before publishing."],
    ["which schedule the council approved","document","<b>The schedule the council approved</b> · the rent terms in Lease amendment 1, approved January 12, 2024 · Council minutes, item 7","Naming it lets a reader compare the approved rent with the March 2024 rent directly."],
    ["Prof. Iyer",null,"<b>Prof. N. Iyer</b> · housing-law professor · an outside reader named by Dev · can read until October 20","An outside reader, not a member: the comment advises, and the team decides."],
    ["Published","published","<b>Published</b> · the last step · permanent and public · corrected only by a new edition","Deal with reviewers' comments before this step; after it, any change needs Edition 3."]
  ],
  "ceremony": [
    ["a new edition","docket","<b>A new edition</b> · how a published case is corrected · posted on the case's docket · the earlier edition stays public","Nothing here can be unpublished; a mistake found later costs a new edition."],
    ["Bias", null, "<b>Declared bias</b> · the team's own statement of any stake it has in what it examines, in its own words · every published case carries it", "Readers judge the case knowing what the team may favor."],
    ["Ties","ties","<b>Ties</b> · a step · each member confirms any tie to people or firms the case concerns · Teo's tie to the Bay Courier is declared","If a member's confirmation changes after you sign, a scheduled publish stops."],
    ["Finding 1",null,"<b>Finding 1</b> · <span class=mk-data>the 2024 rent adjustments were made without the council vote the lease requires</span> · copy B, connection B","The case's central claim; it meets the bar, so it can be relied on in public."],
    ["Finding 2",null,"<b>Finding 2</b> · <span class=mk-data>two rent adjustments had no council vote</span> · copy B, connection B · Prof. Iyer asked it to <span class=mk-data>name which schedule the council approved</span>","Check the reviewer's comment was answered before you sign."],
    ["meets the bar",null,"<b>The project's bar</b> · B/B · the least copy and connection grades a finding needs to be relied on","Every finding meets it, so none is published as weaker than the team claims."],
    ["An unresolved contradiction","timeline","<b>Two dates for the rent notice</b> · two documents disagree · in tension, not resolved · both dated only by month","Disclosed with the case, so readers see it; it does not stop publishing."],
    ["The timeline, frozen at signing","timeline","<b>Timeline of The Coliseum lease</b> · 9 events · fixed as it stands when you sign","Events recorded after you sign go into the next edition, not this one."],
    ["the key registered in this browser",null,"<b>Your signing key</b> · registered in this browser for Dev · anyone can check the signature on the public page","Signing from another device needs that device's key registered first."]
  ],
  "published": [
    ["Edition 2",null,"<b>Edition 2</b> · the current edition of this case · published September 18, 2026 · corrects Edition 1, which stays readable","Corrections, if any, come as a new edition listed on the case's public docket."],
    ["Lakeshore Tenants",null,"<b>Lakeshore Tenants</b> · the team that made this case · <span class=mk-data>tenants near the Oakland Coliseum, meeting since 2025</span>","The authors; the case is signed by one of them and can be checked without them."],
    ["council vote the lease requires",null,"<b>Lease §7.2</b> · a clause of the Coliseum lease · a change to the rent needs a council vote","The rule this finding measures the rent adjustments against."],
    ["this project's bar",null,"<b>The project's bar</b> · the least copy and connection grades a finding needs to be relied on · here B for both grades","This finding meets it; the bar is the team's own, set before publishing."],
    ["capture B",null,"<b>How well it could be captured: B</b> · how well a document could be captured, A to D · A is easiest to check; D rests on a person's word","A grade says how checkable the documents are, never whether the finding is true."],
    ["connection B",null,"<b>Connection grade B</b> · how firmly the documents are linked to the claim, A to D","The link from these documents to the finding is firm, though not the firmest."],
    ["What we did",null,"<b>The team's lane</b> · what the team itself did, kept apart from what the government did","The team's own acts are never mixed in with the city's."],
    ["Council approves amendment 1",null,"<b>Lease amendment 1</b> · approved by the city council on January 12, 2024 · recorded in the council minutes, item 7","The change the council did vote on; the March 2024 rent adjustment had no vote of its own."],
    ["Rent adjusted",null,"<b>The March 2024 rent adjustment</b> · signed by the City Administrator · dated by month only in the documents","The act finding 1 is about."],
    ["We requested the schedules",null,"<b>The team's records request</b> · for the rent schedules · made September 4, 2026 · the City Clerk released them September 18","How the team got its documents: anyone can make the same request."],
    ["by title",null,"<b>Named by title</b> · the office, not the person who held it","The finding concerns the office's act, not who held the post in March 2024."]
  ],
  "imported": [
    ["West Oakland Neighbors",null,"<b>West Oakland Neighbors</b> · another team · published this case · its work counts here only as far as a member accepts it","The publisher: if it corrects the case, a new edition appears on its docket."],
    ["Edition 2",null,"<b>Edition 2</b> of Port lease revenue · the published case of West Oakland Neighbors · the edition imported here","The edition recreated here; a later edition from them would need recreating again."],
    ["The shortfall was not reported to council",null,"<b>The shortfall was not reported to council</b> · West Oakland Neighbors' finding · recreated in part","Only the part that recreated can count here, once a member accepts it."],
    ["The 2025 calculation of arrears",null,"<b>The 2025 calculation of arrears</b> · West Oakland Neighbors' calculation · could not be repeated from what they published","It cannot count for your team; flag the issue so the publisher can see it."],
    ["Recreated in part",null,"<b>Recreated in part</b> · some of the finding's support was repeated here from the publisher's documents and method, not all","Accept only what recreated, and say why in the reason."],
    ["Did not recreate",null,"<b>Did not recreate</b> · repeating it here from the publisher's documents and method did not give their result","Not a judgment that they are wrong: it just cannot count here."],
    ["Recreated",null,"<b>Recreated</b> · repeated here from the publisher's documents and method, with the same result","It still counts for your team only once a member accepts it, with a reason."]
  ],
  "docket": [
    ["withdrawals",null,"<b>Withdrawal</b> · the team withdraws a finding or a whole case, publicly · the earlier edition stays visible, marked withdrawn","None so far for this case."],
    ["superseding",null,"<b>Superseding</b> · Edition 2 replaced Edition 1 as the current edition · Edition 1 stays public, marked as corrected","Every new edition is a docket entry; this is the case's first."],
    ["Order of October 2","proceeding","<b>Order of October 2, 2026</b> · Superior Court · in the lease rent case · captured by a member","It binds the team's published case; posting it here is how the team complies in the open."],
    ["Superior Court","proceeding","<b>Superior Court</b> · the state trial court for Alameda County · hears the lease rent case, RG26-114502","Its orders reach what the team publishes as well as what it files."],
    ["exhibit 4",null,"<b>Exhibit 4</b> · a document in Edition 2's evidence · contains a tenant's address · the order seals it","Sealing removes that address from the public case; the next edition says what was sealed and why."],
    ["not yet posted",null,"<b>Not yet posted</b> · a draft docket entry · public only once a member posts it, signed","Readers of the public case can't see this entry until it is posted."],
    ["the next edition","case-editor","<b>The next edition</b> · Edition 3, not yet started · would carry a stamp saying what was sealed and why","Complying with the order needs a new edition; prepare it once the entry is posted."]
  ],
  "inbox": [
    ["doorbell","doorbell","<b>Your doorbell</b> · the team's public page where anyone can hand over material, without an account","Everything here came through it, so the sender may be anyone."],
    ["3 PDFs",null,"<b>3 PDFs</b> · handed in October 3 · not yet in the record","Nothing in them counts until a member moves them into the record and they are graded like any other document."],
    ["inspection sheets","action","<b>Inspection sheets</b> · what the sender calls these files · claimed, not checked · the team's records request asks the City Clerk for inspection logs, due October 14","Compare them with what the City Clerk releases; sheets that match would raise their standing."],
    ["same knocker as September 12",null,"<b>Same knocker</b> · recognized by the secret phrase the sender added · the sender also handed in material on September 12","Still unnamed, but how the earlier material held up tells you something about this."],
    ["Same knocker",null,"<b>Same knocker</b> · where this source stands · recognized across deliveries, nothing more known","Weigh the material by what can be checked in it, not by who might have sent it."],
    ["Partly known",null,"<b>Partly known</b> · the next step · a member records what is known of the source, such as role or access, without naming them","Recording it helps weigh the material without exposing who sent it."]
  ],
  "doorbell": [
    ["Lakeshore Tenants","published","<b>Lakeshore Tenants</b> · a tenants' team near the Oakland Coliseum, meeting since 2025 · checks whether the city keeps its own rules and promises","The team that receives what you send; its published case shows how it uses material."],
    ["this team's own Civicsmith",null,"<b>The team's own Civicsmith</b> · runs on the team's own hosting account · no other team sees it","Only this team's members can open what you send."],
    ["A member reads them",null,"<b>A member</b> · one of the team's members · may use your material, or set it aside with a reason kept on the team's record","Nothing is published as it arrives: a member decides first, and anything used is checked like any other document."],
    ["a secret phrase",null,"<b>A secret phrase</b> · any words you choose · a later delivery with the same phrase is marked as from the same sender · it never names you","Worth adding if you may send more: the team can weigh new material by how your earlier material held up."],
  ]
};
for (const [k, v] of Object.entries(SCREEN_REFS)) REFS[k] = (REFS[k] || []).concat(v);

/* Guidance (proposed information level 2, question S8): what each screen is and what a member can do there, on its heading;
   and what each section of the rail holds. */
// What a screen's title names, when it names a particular thing: its explanation leads with that thing (Bob, October 7:
// titles' mouseovers lacked context); the screen's own purpose (SCREEN_HELP) follows in lighter type.
const TITLE_HELP = {
  "join": "<b>You're invited to Lakeshore Tenants</b>: Rosa's invitation for you to contribute to the team. This link works once and expires on October 13, 2026.",
  "home": "<b>Lakeshore Tenants</b>: your team, <span class=mk-data>tenants near the Coliseum meeting since 2025</span>, six members. Its focus: <span class=mk-data>rents and leases on city land, and the streets members live on</span>.",
  "archive": "<b><span class=mk-data>Agenda packet, City Council, May 14, 2024</span></b>: a ZIP archive Ana captured from the city's meeting site on October 2, 2026, for Sewer fund transfers. Every file inside is listed with what happened to it: filed, held for review, or set aside.",
  "open-file": "<b><span class=mk-data>Pothole repair policy, Administrative Instruction 4.12</span></b>: the city's PDF that Dev captured from its website on October 2. Before it opens, this says how risky opening it is and why.",
  "document": "<b><span class=mk-data>Pothole repair policy, Administrative Instruction 4.12</span></b>: <span class=mk-data>Public Works' policy, revised 2023</span>, captured by Dev from oaklandca.gov on October 2, 2026. It holds <span class=mk-data>the seven-day repair rule</span> the Pothole repairs project tests the city against.",
  "project": "<b>Pothole repairs</b>: your team's project asking <span class=mk-data>whether the city repairs reported potholes as its own policy requires</span>. Its questions, how strong each is against the project's bar, its members and its plan are here.",
  "question": "<b><span class=mk-data>Is the city repairing reported potholes within seven days?</span></b>: Dev's question in Pothole repairs, opened October 3. It tests the city against its own seven-day rule in Administrative Instruction 4.12; what supports it and what cuts against it are listed below.",
  "assistant": "<b><span class=mk-data>Is the city repairing reported potholes within seven days?</span></b>: Dev's question in Pothole repairs, opened October 3, with the assistant beside it. It answers only from what your team holds and never concludes, signs or sends.",
  "person": "<b><span class=mk-data>L. Chen</span></b>: Director of Public Works since March 2022, named in 14 documents your team holds. Every fact about them here cites the document it comes from.",
  "timeline": "<b>Timeline of The Coliseum lease</b>: what happened in the lease, in order, the city's acts and your team's in two lanes.",
  "money": "<b>Sewer fund transfers, FY2022</b>: Ana's money trail of three figures read from the city's budget and its financial report, following money out of the Sewer Fund, mostly to the General Fund, in fiscal year 2022 (July 1, 2021 to June 30, 2022).",
  "calculation": "<b><span class=mk-data>Reports closed within seven days, FY2025</span></b>: a fact your team worked out from the Public Works work orders for fiscal year 2025: <span class=mk-data>812 of 903 pothole reports (89.9%) were marked closed within seven calendar days of being reported</span>. Its method is shown below, Ana checked it on October 5, and it is worked out again if an input changes. <span class=mk-data>It counts reports closed, not potholes repaired.</span>",
  "explore": "<b>Explore connections</b>: chains from J. Ortega to the Coliseum lease, through money and votes, as of 2026, each step cited and graded.",
  "proceeding": "<b><span class=mk-data>Lakeshore Tenants Assn. v. City, RG26-114502</span></b>: a Superior Court case the record follows, shown under a neutral label, \"the lease rent case\". Its parties, filings and orders, with their dates, are here.",
  "due-date": "<b>Due October 14, 2026</b>: the day the City Clerk must reply to your team's records request. The law it comes from and how the days were counted are below.",
  "standard": "<b><span class=mk-data>Repair reported potholes within seven calendar days</span></b>: a requirement the city set itself, in Administrative Instruction 4.12 §3, a Public Works policy in force since 2023. Your team's questions test the city against it.",
  "plan": "<b><span class=mk-data>Repairs: closed is not repaired</span></b>: Dev's action plan, opened October 3 when the inquiry began, about <span class=mk-data>reports marked closed when the pothole may not be repaired</span>. Its options, the order to try them and what to check are here.",
  "start-send": "<b>Start \"Records request: inspection logs\"</b>: the first step of that option in the plan. Nothing is sent until you confirm; this shows what it will say and what it rests on.",
  "action": "<b>Records request: inspection logs</b>: your team's request to the Office of the City Clerk, sent by Mai on October 2. What was sent, when the reply is due and what came back are here.",
  "matter": "<b><span class=mk-data>The 2024 rent adjustment, made without a council vote</span></b>: what your team is pursuing about this one problem, judged noncompliant with lease §7.2 and established, from the first letter to the outcome.",
  "case-editor": "<b>The Coliseum lease · Edition 2</b>: Dev's draft of the next edition of your team's published case. Nothing here is public until an owner signs and publishes it.",
  "review-copy": "<b>Share this edition for review</b>: lets named outside readers see the draft of The Coliseum lease, Edition 2, before it is published. You can stop a reader's access at any time.",
  "ceremony": "<b>Publish Edition 2</b>: the last checks and the signing of The Coliseum lease, Edition 2. Publishing makes this edition permanent and public. It can be corrected by a new edition, never removed.",
  "published": "<b>The Coliseum lease</b>: your team's published case as anyone reads it: Edition 2, published September 18, 2026, which corrects Edition 1.",
  "imported": "<b>Port lease revenue</b>: a case published by West Oakland Neighbors (Edition 2), imported by Dev on October 1. Nothing in it counts for your team until a member accepts it.",
  "doorbell": "<b>Hand material to Lakeshore Tenants</b>: the page where anyone can give the team documents or information, without an account. It says exactly what happens to what is sent.",
};
const SCREEN_HELP = {
  bias: 'The lens your team reads evidence through, stated so a reader can discount it. Write a set, draft one from an outside policy, adopt it, and settle work made under an earlier lens.',
  site: 'Civicsmith\'s own website: what it is, a team\'s published work, the teams that chose to be listed, and how to start a team.',
  install: 'Creates your team\'s Civicsmith in a Cloudflare account your team controls: what you need, a permanent short name, Cloudflare\'s permission, then your one-time password.',
  update: 'Updates your team\'s Civicsmith to the signed release chosen in Settings › Updates, and no other. Records, members and settings are kept.',
  updates: 'Administrators only: the release your team\'s Civicsmith runs, the release ready to install and what changes in it, and the choice: Update, Not now or Skip this version.',
  front: 'Your team\'s own page: who it is, what it has published, how to hand it material and how it works, with members\' sign-in beside it.',
  glossary: 'What the terms and marks in the record mean, in plain words: money terms, how the record is kept honest, and what each state allows.',
  actionnew: 'Start an action of any kind: who it goes to, what it asks, how carefully to act, what it rests on, and when it is due and why.',
  'help-records': 'What the law requires of the office you ask for records, the faster request, and what the city\'s portal shows.',
  tour: 'How your team works, in six short steps, for anyone: no account needed, nothing recorded.',
  reset: 'Choose a new password from the one-time reset link an administrator made for you.',
  forgot: 'How to get back in without email: use one of your recovery codes, or ask an administrator for a one-time reset link.',
  group: 'Administrators only: your team\'s name, website, languages, what a court can reach, who holds the hosting account, and its bar.',
  settings: 'Every setting in one list: yours first, then the team\'s.',
  more: 'The places the tabs do not hold: projects, people and settings.',
  theme: 'The team\'s themes: lenses that gather documents and passages, never evidence.',
  projects: 'Every project you can see: its stage, who works on it, how busy it is, and when it last changed.',
  'dash-action': 'The Action area as a dashboard: clocks and whose move it is first, then what needs you, then every action.',
  'dash-project': 'One project as a dashboard: your next steps here, the project at a glance, its story so far, and its activity.',
  people: 'The people and organizations your team\'s record follows, those named in your projects first, each with how often the record names them. Your own members are under Settings › Members.',
  unavailable: 'What you see when an address leads nowhere, when something isn\'t yours to see, or when your team\'s Civicsmith can\'t be reached.',
  elsewhere: 'What you see when what you need is not Civicsmith\'s work: the places your team\'s place lists for it, each with what it does, how to reach it and where that came from. Opening it records nothing.',
  'review-outside': 'What someone outside the team sees when asked to review a draft case: the draft and a place to comment.',
  setup: 'The first administrator\'s setup: claim the installation, then name the team, choose its places and languages, and decide how members reach the assistant.',
  'group-identity': 'What kind of team yours is, what it focuses on and why it exists. It shapes how members are welcomed and locks nothing.',
  join: 'Your invitation to join a team. Choose your language, the name the team will know you by, and a password.',
  home: 'Your team\'s home, the nerve center: what needs you, what needs the team, every area at a glance, the projects and what changed since you last looked. Start here each day.',
  members: 'Everyone in your team and what each may do. Administrators invite members, set what they may do, and see who holds the hosting account.',
  places: 'Administrators only: the places whose rules your team\'s Civicsmith follows (deadlines, holidays, offices, records laws), and the offices and seats your team deals with.',
  recovery: 'Your own recovery codes, which let you set a new password if you lose yours. Each works once.',
  security: 'Administrators only: how hard your team\'s Civicsmith is being tried, by kind and by hour, against its own usual. Counts only; nothing names who tried.',
  account: 'Your own settings: your handle, password, signing key, language and expertise.',
  teamai: 'Administrators only: the team\'s API key, what it pays for, its limits, its use summed over members, and keeping the team\'s material away from AI.',
  connect: 'Whether and how the assistant serves you: on your team\'s key, your own Claude account, or not at all. Set your limit and suggestions here.',
  ties: 'Your own ties to people or organizations the team may look into. Only you and the administrators see this list.',
  notes: 'Your private notes. Only you can see them in your team; turn one into an observation, a hunch or a question when you choose.',
  translations: 'The words members see, in your team\'s languages. Members given the grant translate them, the assistant drafts where it can, and protected words are checked twice.',
  wizards: 'Step-by-step walk-throughs of the real screens. Civicsmith\'s own come with each release; your team can write its own or copy one and change the copy.',
  queue: 'Your queue: everything waiting on you, in one list. To do needs your act, Noticed is something new nobody has judged, and Status tells you where something stands.',
  finder: 'Find what your team holds, or look outside for something it doesn\'t yet. Capture what you find into the record.',
  capture: 'Add something to the record: a document from its address, a file, or what you saw yourself, in your own words.',
  'open-file': 'Before a file opens: whether it is low or high risk and why, its safe view, the checks it has had, and how a held file is released.',
  archive: 'One captured archive and every file in it: which are filed and held for review beside it, which were already held, and which were not filed and why.',
  held: 'Captures waiting for a member to vouch for them before they enter the record. Release them, or set them aside with a reason.',
  'find-in': 'Look through a document, the documents you are holding together, or a project for people, money, dates, requirements or a word. Each result shows its passage; you record what matters with the usual act.',
  document: 'One document as captured: its words by page, its copy\'s grade, its versions beside each other, the links it carries, the people and organizations it names, and what cites it. Cite from here.',
  project: 'A project: its questions, their strength against the project\'s bar, its members and its stage. Open a question or a plan from here.',
  leads: 'Write down something you were told, record who looked into it and what they found, and share it with a project.',
  registers: 'The public registers your team holds: bring one in whole, search it and cite a row, watch a filer, license or docket by its number, and connect outside alerts.',
  aiproviders: 'The team\'s AI: the accounts in use in order, budgets and alerts, the seven privacy and origin checks, what members may use, and the catalogue of providers and their plans.',
  aiconnect: 'One plan, connected step by step: what it is sent and which terms bind your use, signing up, giving the key, what you accept, a test, and turning it on.',
  aimine: 'Your own AI: what serves you now, your choices among what the team allows, your own accounts, the checks in force for you and what you have used.',
  aiproject: 'The AIs this project uses, its budget and order, and the checks that apply to the work done directly in it.',
  aimoments: 'What the assistant shows when an account reaches its limit, a provider stops answering, a model is retired or material is about to go to a new provider.',
  aitest: 'Test a custom endpoint or an unlisted plan before it is used: the cost first, the result by part, and exactly what would be sent.',
  airesults: 'What other teams\' tests found for each AI: the parts it passed, its limits, its speed and cost, and the grade.',
  watching: 'Every address your team watches: what is due to be checked, pausing the watching, and the sweeps that look through a site.',
  contradiction: 'Two passages in your team\'s record that are in tension: see both as written, then settle it by saying how they differ or that one is wrong, take it up as a question, conclude it, or dismiss it as a lead.',
  question: 'One question: what supports it and what cuts against it, its strength against the bar, and what would change the answer.',
  answers: 'Ask in plain words, with the assistant, or find and count without it. Answers come only from what your team holds, and show where they looked.',
  assistant: 'A question with the assistant beside it. It answers only from what your team holds and never concludes, signs or sends.',
  person: 'A person the record follows: positions over time, what they decided and signed, each fact dated and cited.',
  timeline: 'What happened, in order: the city\'s acts and your team\'s acts in two lanes, never mixed. Undated items are listed apart.',
  money: 'A money trail: figures from budgets and reports, each with its stage and period, included or left out with a reason.',
  help: 'A help page: one of Civicsmith\'s methods explained in plain words, opened from the screens where it is used.',
  calculation: 'A calculation shown with its method and inputs, each tied to the record and recomputed when an input changes.',
  explore: 'Chains of connections between people, votes, contracts and payments, each step cited and graded. A chain is a lead until a member cites its documents.',
  proceeding: 'A court case or legal proceeding: its parties, its register of filings, and orders with their reply dates.',
  'due-date': 'One due date and how it was worked out: the law or commitment it comes from and how the days were counted.',
  standard: 'A standard the city set itself, held from its document, that questions can test the city against.',
  plan: 'An action plan: the options for what to do about a problem, the order to try them, and what each waits on.',
  'start-send': 'Start an option from a plan: prepare what is sent, check who it goes to today, and send it after the warning.',
  request: 'Ask an office for records under the law that requires it to answer. The due date is worked out for you.',
  action: 'One action your team took: what was sent, to whom, when a reply is due, and what came back.',
  matter: 'A matter: what the team is pursuing about one problem, from the first letter to the outcome.',
  'case-editor': 'Prepare a case for publishing: its scope, statement, findings, the people it names and why, its timeline and what it leaves out.',
  'review-copy': 'A draft case shared with named outside readers before publishing. Their comments come back here.',
  ceremony: 'The publication ceremony: the last checks, then signing. Publishing is permanent; corrections come as a new edition.',
  published: 'A case your team published, as anyone reads it: findings, their strength, the evidence, and how to check it without the team.',
  imported: 'Another team\'s published case, recreated here. Nothing in it counts for your team until a member accepts it with a reason.',
  docket: 'The public record of every edition, correction and withdrawal of your team\'s cases.',
  hold: 'Where a legal threat reached the team and what it keeps because of it: any member who can see the action or the case places a hold, with a reason.',
  holdnotice: 'The notice that tells members what to keep outside Civicsmith. You send it yourself; Civicsmith records that you did and nothing about anyone else.',
  counsel: 'A packet for the team\'s lawyer: what the record holds on one action, as it stands, for a claim or for a defense. It is never published or filed.',
  grouprules: 'A deadline or a legal fact your jurisdiction\'s profile lacks, drafted by one member and applied only after another member confirms it.',
  'docket-public': 'Lets anyone check what happened to a published case after it was published, without an account. Your team files and posts its entries on its own Docket.',
  inbox: 'Material handed to your team through its doorbell. Move it into the record, or discard it with a reason.',
  doorbell: 'Hand material to the team. You need no account; the page says what will happen to what you send.',
};
const RAIL_HELP = {
  home: 'Home: what needs you, what needs the team, and every area at a glance.',
  queue: 'Queue: everything waiting on you, in one list.',
  find: 'Find: search what your team holds, or look outside for something new.',
  add: 'Add: capture a document, a file, or what you saw yourself.',
  projects: 'Projects: your team\'s investigations, their questions, plans and cases.',
  people: 'People: the people and organizations the record follows. Your own team\'s members are under Settings.',
  settings: 'Settings: your own account, assistant, ties, notes and recovery codes; for administrators, the team\'s settings as well.',
};

// What each table column shows, by screen and heading: the heading's explanation, at the level of names (always on).
const COL_HELP = {
  'finder|Item': 'The item\'s own title, as your team holds it. Open it to read it.',
  'finder|Kind': 'What sort of item it is: a document, a question, an action or a case.',
  'finder|State': 'Where the item stands in your team\'s work. Rest on a state to see what it means and what it allows.',
  'finder|Updated': 'The day the item last changed in your team\'s record, not the day it was written.',
  'members|Member': 'Each member by the handle the record shows, and whether they are an administrator.',
  'members|May do': 'What each member may do here, as the administrators set it: add and revise work, start projects, sign and publish cases. An administrator may do all of it, and also looks after the team\'s Civicsmith.',
  'members|Expertise': 'What a member says they know, such as accounting or engineering, so others can ask them to check work in that field. Each member declares it in their account; an administrator can confirm it.',
  'money|Figure': 'What the amount is, in the words of its source: a transfer, a charge, a payment, a grant.',
  'money|From': 'Who or which fund paid, as the source writes it. The payer is part of the figure itself, never guessed from somewhere else.',
  'money|To, where it went': 'Who or which fund received the money, as the source writes it. "Not stated in this source" means this source does not say; record it from another source that does, citing the passage.',
  'money|When it moved': 'The day the money actually moved, taken from the event the figure is tied to and the passage that dates it. A budget figure did not move, so it shows when it was adopted instead. <b>Undetermined</b> means no source the team holds gives the day; it is never guessed from the accounting period.',
  'money|Stage': 'How far along the money was when the source counted it: <b>adopted</b> (budgeted), <b>committed</b> (promised by contract), or <b>actual</b> (spent; "paid" when the source shows the payment). Figures at different stages are compared, never added.',
  'money|Period': 'The accounting period the source counts the amount in, such as a fiscal year, which need not match the calendar year. It is not the date the money moved: that is in <b>When it moved</b>.',
  'money|Amount': 'The amount exactly as the source states it. A rounded amount ("about $2 million") keeps its rounding.',
  'money|Source': 'The document the figure was read from, with how well it could be captured: how easily someone else could check the copy against what the office published. Click the mark for the document.',
  'money|In this trail?': 'Whether this figure counts in the trail\'s comparison, and the member\'s reason for including it or leaving it out. A figure left out stays listed, with why.',
  'security|Kind': 'The kind of attempt that was turned away. Each counts attempts, not people.',
  'security|This period': 'How many of this kind in the period you are looking at.',
  'security|Usual': 'Your team\'s own median for the same length of time over the four weeks before. Far above it is what makes a period Raised or High.',
  'security|Busiest hour': 'The hour with the most of this kind, and its count.',
  'translations|English': 'The words as Civicsmith ships them. <b>Protected</b> marks words that carry a ruling and need a second member\'s check before a translation is used; <b>Local name</b> marks a name kept as it is, with its explanation translated.',
  'translations|Español': 'The translation members see. A shaded cell is a draft, not yet shown to anyone.',
  'translations|Where it came from': 'Whether the translation came with a Civicsmith release, was typed by a member, or started as the assistant\'s draft, and whether it still needs its second check.',
};
