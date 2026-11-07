# T49's words owed by the design (DEC-253; DEC-252's owed: line, BOB's N1075): affordances' ten vocabularies and standards'
# sentences, keyed so each module reads them from words.json instead of carrying its own English.
# Key rules (DEC-253): a vocabulary value is label.<set>.<value>, the set its name without underscores, the value as the
# module holds it with spaces made underscores; a role is label.lineroles.<kind>.<role>. connection_kinds keys only its own
# kinds: line:<kind> reads label.linekinds.<kind>, line:holds:<capacity> reads label.connectionkinds.holds with
# label.linecapacities.<capacity>, and same_as, not_same_as, unsure read label.identityclaimkinds.<value>.
# Words sit inside a line ("Mayor's Office · part of · City of Oakland"), so they are lower case. An owner's registered word
# (affordances R39) is kept as written unless a note says the design's governs (DEC-252 (2)).
# Run: python3 words-t49.src.py, then node build_words.mjs.
import json, os
W = []
NC = ' Nothing was changed.'
NW = ' Nothing was written.'
def w(key, en, prot=False, note=''):
    W.append(dict(key=key, en=en, protected=prot, note=('DEC-253: ' + note) if note else 'DEC-253'))
def vocab(setname, pairs, note=''):
    for v, t in pairs:
        w(f'label.{setname}.{v.replace(" ", "_")}', t, False, note)

# --- affordances: the ten vocabularies (R39)
vocab('linekinds', [('part_of','part of'),('post_in','a post in'),('holds','holds'),('reports_to','reports to'),('oversees','oversees'),
  ('appoints','appoints'),('seat_on','a seat on'),('funds','funds'),('contracts_with','has a contract with'),('acts_for','acts for'),
  ('responsible_for','responsible for'),('custodian_of','keeps the records of'),('successor_of','successor of'),('belongs_to','a member of'),
  ('educated_at','studied at'),('credentialed_by','holds a credential from'),('owns_interest_in','has an interest in'),('related_to','related to'),
  ('associate_of','an associate of'),('party_to','a party to'),('appeal_of','an appeal of'),('consolidated_with','consolidated with'),
  ('remanded_to','remanded to'),('arises_from','arises from')], 'a line between two entities, read between their names')
vocab('linecapacities', [('employee','employee'),('elected','elected'),('appointed','appointed'),('acting','acting'),('interim','interim'),
  ('ex officio','ex officio'),('board member','board member'),('officer or director','officer or director'),('partner','partner'),
  ('military service','military service'),('volunteer','volunteer'),('contractor','contractor'),('other','other')], 'the capacity in which a post is held')
vocab('lineroles', [('reports_to.administrative','administrative'),('reports_to.functional','functional'),('reports_to.budgetary','budgetary'),
  ('contracts_with.buyer','buyer'),('contracts_with.procuringEntity','purchasing agency'),('contracts_with.supplier','supplier'),
  ('contracts_with.tenderer','bidder'),('contracts_with.funder','funder'),('contracts_with.enquirer','inquirer'),('contracts_with.payer','payer'),
  ('contracts_with.payee','payee'),('contracts_with.reviewBody','bid protest reviewer'),('contracts_with.interestedParty','interested party'),
  ('party_to.plaintiff','plaintiff'),('party_to.defendant','defendant'),('party_to.petitioner','petitioner'),('party_to.respondent','respondent'),
  ('party_to.appellant','appellant'),('party_to.appellee','appellee'),('party_to.cross_complainant','cross-complainant'),
  ('party_to.cross_defendant','cross-defendant'),('party_to.intervenor','intervenor'),('party_to.real_party_in_interest','real party in interest'),
  ('party_to.amicus','friend of the court (amicus)'),('party_to.applicant','applicant'),('party_to.protestant','protestant'),
  ('party_to.complainant','complainant'),('party_to.interested_party','interested party'),('party_to.other','other')],
  "an entity's role on a line, by the line's kind; American usage (bidder, inquirer), a court's and a commission's own terms kept")
vocab('moneykinds', [('revenue','revenue'),('expenditure','expenditure'),('transfer','transfer'),('allocation','allocation'),('payment','payment'),
  ('contribution','contribution'),('gift','gift'),('income','income'),('behested','behested payment'),('settlement','settlement'),('debt','debt'),
  ('balance','balance'),('fee charged','fee'),('other','other')], "what a sum of money is; a behested payment is California's term")
vocab('moneyphases', [('proposed','proposed'),('adopted','adopted'),('adjusted','amended'),('actual','actual')], "a budget figure's phase")
vocab('moneystages', [('encumbered','committed'),('incurred','spent'),('paid','paid'),('assessed','billed'),('collected','collected')], "where a sum stands")
vocab('moneybases', [('budgetary','budgetary basis'),('cash','cash basis'),('modified accrual','modified accrual basis'),('accrual','accrual basis'),
  ('undetermined','basis not stated')], 'the accounting basis a figure is reported on')
vocab('moneyprecisions', [('exact','exact'),('rounded','rounded'),('approximate','approximate'),('range','a range')], 'how precise a figure is')
vocab('identityclaimkinds', [('same_as','claimed the same person'),('not_same_as','claimed not the same person'),('unsure','unsure whether the same person')],
  "a member's claim about two records of people; the design's words govern the owner's \"same person?\" (a claim, not a question)")
vocab('connectionkinds', [('proxy_for','proxy for'),('member_of','a member of'),('overlaps','overlaps'),('money_flow','money'),
  ('law_amends','amends'),('law_repeals','repeals'),('law_renumbers','renumbers'),('law_recodifies','recodifies'),('law_refers_to','refers to'),
  ('law_defines','defines a term of'),('law_excepts','makes an exception to'),('law_implements','implements'),('law_incorporates','incorporates'),
  ('court_interprets','interprets'),('court_applies','applies'),('court_holds_invalid','holds invalid'),('court_requires','requires'),
  ('in_force_at_event','was in force on the date of')], "a connection's own kinds; member_of reads \"a member of\" as the line's belongs_to does")
w('label.connectionkinds.holds', 'held the post ({capacity})', False, '{capacity} is label.linecapacities.<capacity>')

# --- standards (R45; DEC-145)
vocab('standardforce', [('requires','Requires'),('recommends','Recommends'),('allows','Allows'),('mandatory','Required')], "a provision's force, beside its own words")
w('label.standardforce.discretionary', 'At the discretion of {holder}', False, "a policy's discretionary provision")
w('standard.discretion.holder.none', 'an office not named', False, '{holder} when the record names none')
w('label.standardcriteria.stated', 'criteria stated', False, 'beside a discretionary force')
w('label.standardcriteria.none', 'no criteria stated', False, 'beside a discretionary force')
vocab('standardaccess', [('free','Free to read'),('reading_room','Reading room only'),('paywalled','Behind a paywall')], "how a standard's text can be read; none when not stated")
vocab('standardheld', [('cited','Cited, not seen'),('absent','Looked for, not found')], 'a standard held without its text')
w('standard.held.cited.by', 'Cited by {source}', False, 'beside "Cited, not seen"')
w('standard.held.absent.searched', 'Looked for in {where}', False, 'beside "Looked for, not found"')
vocab('standardcopy', [('official','Official copy'),('codifier','A code publisher\'s copy'),('in_force','The copy in force'),('draft','Draft'),
  ('superseded','Superseded'),('production','Produced in response to a request'),('vendor_model','A vendor\'s model policy'),
  ('undetermined','Kind of copy not known')], 'the copy a member declares a capture to be')
w('standard.binding.binds', 'Standard · binds {body}')
w('standard.binding.benchmark', 'Benchmark · not binding on {body}')
w('standard.binding.unknown', 'Whether this binds {body} is not recorded')
w('standard.binding.body.none', 'the body', False, '{body} when the record names none')
w('standard.policy.owner', '{issuer} policy', False, 'a policy always with its owner')
w('standard.notpublic', 'Not public', True, 'never "confidential"')
w('standard.notpublic.releaseby', 'Only {who} can release it', False, 'beside "Not public"')
w('standard.text.withheld', "This standard's words can be read only by the team's members, inside the team.", False, 'in place of a reading-room or paywalled text, for a reader outside the team')
w('standard.note', 'A standard as the record holds it: what it is and where it comes from, never whether it is a good one. Each passage says whether a newer capture of its document still holds it; nothing is moved.')
w('standard.inforce.known', 'Known to be in force through {through}, from {source}, recorded by {author}', False, "standards' T36 owed words")
w('standard.source.capture', 'capture {capture}, {extent}', False, '{capture} is the first twelve characters of its fingerprint')
w('standard.source.capture.whole', 'capture {capture}', False, 'when no extent is named')


# --- DEC-254 (Bob's S24: A): a member may write a reading herself, marked as hers, accepted by concluding on it
def w4(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-254' + (': ' + note if note else '')))
w4('question.conclude.own.choice', 'Write the reading yourself', False, 'beside the readings to conclude on; offered with or without the assistant')
w4('question.conclude.own.field', 'Your reading')
w4('question.conclude.own.help', "Say in your own words what the cited passages show. It is marked as yours, not the assistant's, and concluding on it accepts it in the same act.")
w4('question.reading.by.member', 'Written by {member}', True, "a member's own reading; never marked machine work")

# --- DEC-255 (Bob's S25: B): the stewards may decline or remove a listing on civicsmith.org, only under a published rule
def w5(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-255' + (': ' + note if note else '')))
w5('site.groups.rule', "The people who make Civicsmith decline or remove a listing only under a published listing rule, never for a team's views or for whom it holds to account. A team is always told why.", True, "under Teams at work")

# --- DEC-256: T49's requirements against the screens: the refusals drawn by their words (DEC-83: what happened, then what to do)
def w6(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-256' + (': ' + note if note else '')))
for code, t in [
  ('PROJECT_VISIBILITY_NOT_THE_OWNER', "Only the project's owners can change whether it can be found; administrators and the team's founder cannot. Ask an owner." + NC),
  ('PROJECT_VISIBILITY_NO_OWNER', 'A project can be findable only when it has an owner, and this one has none. Leave it hidden, or give it an owner first.' + NW),
  ('NAME_TAKEN', 'A project in this team already has that name. Choose another.' + NW),
  ('CONSENSUS_REQUIRED', 'Your endorsement is recorded. While the team has two or more administrators, a new one is invited only once every administrator endorses. Still to endorse: {awaiting}.'),
  ('OWNERS_ARE_ACTIVE', 'This project still has active owners: {owners}. An administrator adds an owner only when every owner is inactive. Ask one of them.' + NC),
  ('NO_REASON', 'This needs a reason, and none was given. Write one.' + NW),
  ('NO_CLAIM', 'There is nothing to conclude on yet: the project must first stand on a reading of this question. Accept a reading, or write your own, then conclude.' + NW),
  ('ANSWER_MALFORMED', "The assistant's answer came back incomplete ({field} missing), so none of it is shown. Ask again." + NW),
  ('RISK_TIER_UNCHANGED', 'This action already has that risk tier.' + NC),
  ('CRUCIAL_IN_BATCH', 'Crucial material is never vouched for in a batch, and {count} of these are crucial. Vouch for each of them on its own. Nothing in the batch was vouched for.'),
  ('ENTRY_REQUIREMENTS', 'Some of these are not complete enough to vouch for: {offenders}, each missing what it names. Complete them or leave them out. Nothing in the batch was vouched for.'),
  ('STATEMENT_ACK_NO_REASON', 'An acknowledgement of a statement is recorded with your own words on it, and none were given, or they are longer than 2,000 characters. Write them.' + NW),
  ('DOOR_RATE_LIMITED', 'Too many requests came from your connection in the last ten minutes. Try again in {minutes} minutes.' + NW),
]: w6(f'refusal.{code}', t, False, "T49's requirement draws it by its words")
w6('question.empty.conclude.own', 'Nothing to conclude on yet: a conclusion adopts a reading, the assistant\'s accepted or one you write yourself, and a reading stands on cited passages.', False, "replaces question.empty.conclude's sentence after S24")

# --- DEC-256: T49's requirements drawn on the screens (each note names its requirement)
w6('question.adddoc', 'Add a document', False, "screens-inquiry R38: on the question, opening Add with the question as its subject")
w6('question.adddoc.tip', 'Opens Add, set to this question: what you capture is held for you to vouch for, then ready to cite here.', False, 'screens-inquiry R38')
w6('project.adddoc', 'Add a document', False, "screens-inquiry R38: on the project, opening Add with the project as its subject")
w6('project.adddoc.tip', 'Opens Add, set to {project}: what you capture is held for you to vouch for, then filed in it.', False, 'screens-inquiry R38')
w6('question.plan.link', 'Its plan: {plan}', False, "screens-inquiry R36: after planopen, the plan's name, a reference opening it")
w6('question.plan.link.tip', 'The action plan opened from this question: what the team means to do about it, and what each option became.', False, 'screens-inquiry R36')
w6('projectai.notjoined', "You haven't joined {project}. Its members see here who pays for the assistant's work in it, for which uses and up to what limits. Join the project to see it.", False, 'screens-inquiry R37: beside "Join" (projectjoin) where she may join')
w6('screen.findin.cite.supports', 'Supports', False, 'screens-daily R24: beside each "Cite in the question", under screen.document.cite.role; none preselected')
w6('screen.findin.cite.against', 'Cuts against', False, 'screens-daily R24: as above')
w6('screen.findin.cite.norole', 'Choose first whether this passage supports the question or cuts against it. Nothing was cited.', False, 'screens-daily R24: refused in place until a role is chosen')
w6('screen.findin.cite.norole.summary', 'Citing before choosing', False, 'screens-daily R24: where the refusal is shown')
w6('setup.member.heading', 'Your team is set up', False, 'screens-entry R19: setup opened by a member, or an administrator who is not the founder')
w6('setup.member.sub', "Your team's Civicsmith is already set up, so there is nothing to do here. Your team's work is on Home.", False, 'screens-entry R19')
w6('setup.member.home', 'Go to Home', False, 'screens-entry R19')
w6('setup.member.home.tip', "Your team's home: what needs you, and what changed since you last looked.", False, 'screens-entry R19')
w6('screen.explore.nocentre', 'Choose where to start: a person, an organization, a document or a payment. Its connections are then drawn here, each step cited and graded.', False, 'screens-investigate R29: explore opened with no centre')

# --- DEC-257: the drawn screens reconciled with the words (K3268): every sentence a member reads on a screen is a keyed word,
# word for word (check_words_drawn.mjs). Where an adopted row (DEC-252) and the drawing differed, the drawing governs and the
# row is reworded (REWRITE7); where a design row differed, the row governs and the drawing was changed. A sentence that
# carries sample data is keyed as a template, the drawing an instance of it.
def w7(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-257' + (': ' + note if note else '')))
REWRITE7 = {
  'screen.capture.file.wherehelp': "Required. Write the place, then the date and time, such as “6012 Seminary Ave, October 4, 2026, 9:12 AM”; the time can't be later than now. Where the photo records them they are filled in; correct them if wrong.",
  'screen.connect.group.allowance': 'The team pays, up to {limit} for each member, a limit your administrators set.',   # DEC-262
  'screen.connect.group.allowance.reached': 'At the limit, the assistant pauses for you until the next {period}; everything else works as usual.',
  'screen.connect.own.apikey': 'The assistant serves you on your own Claude account, with your own API key. Only you use it; you pay for it.',   # DEC-262: no part of a key is shown
  'screen.connect.own.subscription': "The assistant serves you on your own Claude subscription, signed in on Anthropic's page on {date}. Only you use it; your plan's own allowance applies.",   # DEC-262
  'screen.connect.none': "The assistant isn't serving you yet. Your team doesn't pay for the assistant; if you want it, connect your own account below, or skip it.",
  'screen.connect.keptaway.ask': "Everything else works: searching, counting and your team's templates take the assistant's place. If you think this should change, ask an administrator.",
  'screen.connect.signin.help': "Your team's Civicsmith never sees your Claude password, and the code is used once and never kept. Your subscription then serves only your own questions, and you can disconnect at any time. Needs a Pro or Max plan, and your team's Civicsmith on Workers Paid.",
  'screen.connect.grouplimits': "On the team's key, your administrators set what it pays for and its limits. Today: at most {limit} for each member. If they change either, this shows the new setting.",   # DEC-262
  'screen.setup.otp.help': "Filled in for you when you continued from the installer's last page, where it was shown once. Opening this page another way? Type the password you saved there. Lost it? Whoever can sign in to the Cloudflare account can set a new one.",
  'screen.setup.security.scanner': 'Civicsmith scans every file it captures with its own scanner and opens risky ones in a safe view.',
  'screen.setup.assistant.own': "Any member may connect their own Claude subscription or API key, which then serves only them, unless you keep your team's material away from AI.",
  'screen.setup.places.now': 'The places whose rules apply',
  'screen.ties.either': 'Either way the tie is disclosed to readers of the case. Inside the team, only you and the administrators see this list.',
  'screen.money.tension': "Each column is read from the figure's own source, as it writes it, never guessed; when it moved comes from the event the figure is tied to, never its accounting period. Adding evidence never changes a figure: it is a new fact or event beside it, with its own source. New evidence may agree or disagree; where two sources disagree, both stay, shown in tension, and the table never picks one.",
  'screen.help.random.p': 'Civicsmith draws the sample from a recorded seed. Anyone, including the city or a reporter, can repeat the draw and get exactly the same items, so no one could have picked the easy or the damning ones.',
  'screen.imported.none': 'No case imported yet. Choose a case file to import the first.',
  'screen.projectai.keepaway.head': "Keeping this project's material away from AI",
  'screen.proceeding.register': 'Register the proceeding',
  'screen.connect.apikey.help': "In your web browser: go to console.anthropic.com, sign in, add a payment method, then API keys › Create key, and paste it here. Anthropic bills you for each use. Your team's Civicsmith keeps it sealed, never shows or exports it, and uses it only for your questions.",
  'screen.capture.file.choosehelp': 'on a phone, the camera opens',
  'screen.home.strip.group': 'Needs the team',
  'screen.find-in.scope.project': 'Everything in {project} ({count} documents)',
  'screen.home.line.languages': 'languages: {languages}',
  'screen.home.line.ailimit': "This month on the team's key: {used} of the {limit} limit",
  'screen.members.recovery.one': 'With one administrator, the team depends on that one person and the hosting account.',   # DEC-262
  'screen.members.invite.noemail': "Your team's Civicsmith sends no email. Copy the link and send it yourself. It works once and expires after seven days.",
  'screen.project.questions.empty': 'Start with one question the record could answer, such as “{example}”. Documents, notes and plans gather under it.',
  'screen.project.account.project': "Paid for by the project's own API key",
  'screen.question.opened': 'Opened by {name}, {date} · {project}',
  'screen.question.opened.noproject': 'Opened by {name}, {date}',
  'screen.question.strength.raise': 'What raises it: {raise}',
  'screen.queue.hint.rate': "Of this check's past hints that members looked into, {rate}% were false alarms ({false} of {looked}), most often {reason}.",
  'screen.setup.lede': 'You are not a member of anything yet. Claim what you just installed with the one-time password and it becomes yours to run; then name your team and choose its places. Seven short parts; you can leave and come back.',
  'screen.setup.own.help': 'At least 12 characters. From now on you sign in with your handle and this, never the one-time password.',
  'screen.entry.codes.what': 'Once you have claimed, you get ten one-time codes. If you ever lose your password, one of them lets you set a new one; Civicsmith sends no email, so they are your way back in. They are shown once: save them with your password, somewhere only you can reach.',
  'screen.setup.domain.help': 'Only if your team has a website you can put a file on. Verifying it lets readers confirm a published case really comes from you: Civicsmith gives you one small file to place on the site, then checks it. Your public page will name the site, so a team that wants to stay unnamed leaves this empty. You can add it later.',
  'screen.setup.places.help': "The places Civicsmith holds the rules for: their deadlines, holidays, offices and records laws, each with its source. Your place not listed? Choose “Other”: everything else works, and you enter due dates and offices yourself. New places arrive with Civicsmith's releases.",
  'screen.setup.assistant.what': "The assistant is an optional helper, built on Anthropic's Claude. A member can ask it in plain words to find, read, answer or check things in what your team holds; it can suggest questions and documents, and draft translations. It answers only from what your team holds, gives legal information but never legal advice, and never concludes, signs or sends anything. What it does is labeled as the assistant's. Everything in Civicsmith also works without it.",
  'screen.setup.assistant.paid': "The team's API key. One Anthropic API key, held by your team, serves every member who has no account of their own. Anthropic bills the key's owner for each use, so your team pays. It is off until an administrator switches it on. Each member is told once, before their first question under it, that their questions and the material read to answer them go to Anthropic under the team's account. Administrators see the key's use summed over members, never who used it or what was asked, and set the daily limit and whether the assistant may make suggestions unprompted.",
  'screen.setup.limit': "Each member's daily use of the team's key (optional)",
  'screen.setup.limit.help': "The most one member's acts may use of the team's key in a day. It binds only the team's key, never a member's own account or a project's. More limits, by use or by month, are in Settings › Members.",
  'screen.setup.court.what': "Your team's Civicsmith keeps unpublished work from the public and from the people you look into, but a court order your team cannot defeat can still require anything not public to be shown: members' notes, sources, hidden projects. Some work is unlikely ever to draw such an order; journalists, lawyers and auditors may have protections others lack, such as shield laws or privilege. A team doing work that could draw one should make sure its members understand the risk.",
}
# projects
w7('screen.projects.progress.spotcheck', 'a spot-check under way', False, "a project's progress, after its questions")
w7('screen.projects.invited.hidden', 'hidden: only the members invited know it exists', False, 'beside a hidden project you were invited to')
w7('screen.projects.columns.note', 'Stage: how far the project has come. Members: who works on it. Activity: acts on it each week over the last eight, with the word the bars say; the newest week is darker.', False, "under the projects' table")
# capture
w7('screen.capture.title', 'Add to the record')
w7('screen.capture.address.later', 'Ask for this later', False, "capturerequest's button")
w7('screen.capture.address.watchhead', 'Once it is captured: watching the address')
w7('screen.capture.address.from', "from {office}'s own site", False, "a capture fetched from the office's own site")
w7('screen.capture.address.watchbutton', 'Watch this address for changes', False, "monitorset's button")
w7('screen.capture.file.taken', 'taken {date}, {time}, by the phone that took it', False, "a photo's own record of when it was taken")
w7('screen.capture.file.location', 'location in the photo: {place}')
w7('screen.capture.file.zip', "A ZIP archive is opened as it is captured: its files are held for review beside it, each with the archive's grade.")
w7('screen.capture.saw.photo', 'Add a photo or recording you made then')
w7('screen.capture.saw.photo.optional', 'optional; it is kept beside your account')
w7('screen.capture.saw.record', 'Record what you saw', False, "testify's button")
# connect
w7('screen.connect.project.serves', "In {project}, the project's own account serves you instead.")
w7('screen.connect.own.none', 'You have no account of your own connected.')
w7('screen.connect.own.more', 'Need more? Connect your own account: it then serves you instead, on your own limit.')
w7('screen.connect.outward', "Outward · leaves your team's Civicsmith", True, 'the mark on what leaves the team (protected: says who can see something)')
w7('screen.connect.read.button', 'I have read this', False, "groupkeynoticeseen's and disclosureshown's button")
w7('screen.connect.own.instead', "If you connect your own account, it serves you instead of the team's key, and only you.")
w7('screen.connect.signin.withcode', 'Connect with this code', False, "subscriptionsignin's second button")
w7('screen.connect.reauth.summary', 'If you signed in a while ago, it asks for your password first')
w7('screen.connect.refusal.reference', 'Each refusal carries a reference, such as “{example}”, to give an administrator; nothing you typed is lost.')
w7('screen.connect.apikey.connect', 'Connect with this key', False, "accountreferenceset's button")
w7('screen.connect.uses.head', 'What your account pays for')
w7('screen.connect.limits.head', 'Limits on your account')
w7('screen.connect.limits.none', "Your limits bind only your own account; the team's and a project's limits never bind it. With no limit, nothing is capped here except Anthropic's own spending limit on your key. The first time a limit is reached in a period, you are told once in your queue.")
w7('screen.connect.use.project', 'On {whose} account', False, "a row of your use: {whose} is the project's name, possessive")
w7('screen.connect.meter.groupshare', "Today on the team's key, your share of it")
w7('screen.connect.meter.own', 'Today on your own account')
w7('screen.connect.use.note', 'Only you see this: your own use across every account that paid for it. Never a cost per answer.')
w7('screen.connect.disconnect.button', 'Disconnect your API key', False, "accountreferenceremove's button")
# find-in
w7('screen.find-in.scope.this', 'This document: {document}', False, 'a choice of where to look')
w7('screen.find-in.office.heldby', '{office}, held today by {name}')
w7('screen.find-in.date.period', 'a period, counted from each {item}', False, 'what kind of date a match is')
w7('screen.find-in.date.own', "the document's own date", False, 'what kind of date a match is')
w7('screen.find-in.date.table', 'a table: its dates are counted through a calculation, never read in one by one')
w7('screen.find-in.standard.held', 'Held as a standard by {name} on {date}')
w7('screen.find-in.money.none.one', 'This document has no money figures.')
w7('screen.find-in.money.none.all', 'Neither document has money figures.', False, 'when it looked in two documents')
w7('screen.find-in.person.named', 'named in {count} of the {total} documents')
w7('screen.find-in.person.first', 'first in {document}')
w7('screen.find-in.seeall', 'See all {count} in Find')
w7('screen.find-in.proposed.head', 'Proposed by the assistant')
w7('screen.find-in.proposed.notyet', 'Not in the first release.')
w7('screen.find-in.proposed.later', 'Switched on once it has been measured: at your request, and for a question you name, the assistant will also propose people, events and money figures that search can\'t match, such as "{example}" in {document}, a person your team doesn\'t follow yet.')
w7('screen.find-in.proposed.labeled', 'Each is labeled machine work, graded no higher than its method earns, and becomes a fact only by the same acts, by a member.')
# home
w7('screen.home.strip.hint.one', '1 hint to look at')
w7('screen.home.strip.hint.other', '{n} hints to look at')
w7('screen.home.welcome.what', 'The guided start you began when you joined shows you around in about ten minutes more: how the team judges evidence, your settings, and a first step. Stop it at any point and pick it up later here.')
w7('screen.home.welcome.continue', 'Continue the guided welcome')
w7('screen.home.todo.vouch', 'Vouch for {count} photos you captured on {place}')
w7('screen.home.todo.newer', 'Decide on a newer version of {document} you cited')
w7('screen.home.todo.approve', 'Approve the {kind} to {office}, drafted by {name}')
w7('screen.home.todo.approve.button', 'Read and approve it', False, "filingapprove's button")
w7('screen.home.todo.check', '{name} asked you to check a calculation: {calculation}')
w7('screen.home.group.noreply', "{office}'s reply to “{action}” was due {date}; no reply recorded")
w7('screen.home.group.tension', 'Two documents give different dates for {what}')
w7('screen.home.group.unjudged', 'nobody has judged it')
w7('screen.home.group.requestdue', "{office}'s reply to your records request is due {date}")
w7('screen.home.area.meetbar', '{count} questions meet the bar')
w7('screen.home.area.edition', 'Edition {n} of {case} published {date}; a draft is shared for review until {until}, no comment to answer')
w7('screen.home.area.camein', '{count} things came in since you last looked: {latest}')
w7('screen.home.area.ourmove', 'Our move: {n}, the earliest due {date}')
w7('screen.home.area.theirmove', 'Their move: {n}, the earliest due {date}')
w7('screen.home.area.nothing', 'nothing needs you here')
w7('screen.home.area.expertise', 'Expertise on hand: {people}')
w7('screen.home.area.invitation', "{name}'s invitation link is out, unused")
w7('screen.home.since.captured', '{name} captured {document}')
w7('screen.home.since.events', '{name} added {count} events to {timeline}')
w7('screen.home.since.trail', '{name} started the money trail “{trail}”')
# ai
w7('ai.use.ask.means', 'questions a member asks it, in everyday words', False, 'after ai.use.ask.name, in the list of uses an account pays for')
w7('ai.use.draft.means', "a letter, a summary or a wizard's step a member asks for, kept as a labeled draft until they keep it", False, 'after ai.use.draft.name, in the list of uses an account pays for')
w7('ai.use.run.means', 'longer work a member starts, such as a check, an extraction or a plan, done step by step', False, 'after ai.use.run.name, in the list of uses an account pays for')
w7('ai.use.standing.means', 'questions a member leaves for it to answer again whenever new material arrives; each new answer is a use', False, 'after ai.use.standing.name, in the list of uses an account pays for')
w7('ai.use.enquire.means', 'its questions to a member starting a project, and the plan it proposes when asked', False, 'after ai.use.enquire.name, in the list of uses an account pays for')
w7('ai.use.read.means', 'a document a member points it to, such as with Find in this', False, 'after ai.use.read.name, in the list of uses an account pays for')
w7('ai.use.transcribe.means', "a scanned or photographed page that Civicsmith's own reading couldn't make out, when a member asks", False, 'after ai.use.transcribe.name, in the list of uses an account pays for')
w7('ai.use.account.means', 'the account a case gives of what was found, drafted and checked', False, 'after ai.use.account.name, in the list of uses an account pays for')
w7('ai.use.suggestions.means', 'questions and checks it suggests beside its answers, labeled as suggestions, that nobody asked for', False, 'after ai.use.suggestions.name, in the list of uses an account pays for')
w7('ai.explore.help', 'The assistant looking, unasked, for what is worth a look in {scope}.')
w7('ai.explore.no.means', 'No: never paid for by this account.')
w7('ai.explore.ask.means', "Ask every day: on a day it finds something, it asks this account's owners once in their queue; if nobody says yes that day, it doesn't explore.")
w7('ai.explore.yes.means', "Yes: it explores within this account's overall limit, and within an exploring limit if its owners set one.")
w7('ai.explore.labeled', 'What it finds is labeled machine work, and members decide what becomes evidence.')
w7('ai.limit.permember.help', "Each member's use: the most any one member's acts may use of this account in the period.")
w7('ai.limit.unit.help', "Dollars are Civicsmith's estimate from the tokens used, at Anthropic's published prices; Anthropic's own bill is what counts. Tokens are the text sent and received; calls, each turn of the assistant.")
w7('ai.limit.unit.signin.help', "A subscription doesn't report what a use costs, so its limits are in tokens (the text sent and received) or calls.")
w7('ai.limit.period.help', "By your team's calendar. A month starts again on the 1st.")
w7('ai.limit.within.means', 'Part of the overall limit: the use counts toward both, and stops at whichever is reached first')
w7('ai.limit.ontop.means', "On top of the overall limit: an allowance of its own that doesn't count toward the overall one, so this account may spend up to the overall limit plus each allowance on top")
w7('ai.limit.none.note', "With no limit, nothing is capped here except Anthropic's own spending limit on the key.")
w7('ai.keepaway.group.help', "Binds every account, the team's, any project's and members' own: for the uses you choose, no assistant reads your team's material, whoever pays.")
w7('ai.keepaway.project.help', "Binds every account, whoever pays: in this project the assistant can't be used for the uses you choose, and elsewhere it never reads this project's material for them.")
# members
w7('screen.members.reset.button', 'Make a reset link', False, "owed:passwordresetlink's button on a member's row")
w7('screen.members.invite.create', 'Create the invitation link', False, "memberadd's button")
w7('screen.members.key.uses.head', "What the team's key pays for")
w7('screen.members.key.limits.head', "Limits on the team's key")
w7('screen.members.key.use.head', "Use of the team's key")
w7('screen.members.ai.changes.head', "Changes to the team's AI settings")
w7('screen.members.ai.change.limit', "{name} set each member's use of the team's key to at most {amount} a day")
w7('screen.members.ai.change.held', "{name} held the team's API key and switched it on")
# project
w7('screen.project.account.exploring', 'exploring: {frequency}.', False, "after the uses the project's account pays for")
w7('screen.project.account.open', 'Open AI for this project')
w7('screen.project.question.unrated', 'rests on nothing yet', False, 'beside an unrated question')
w7('screen.project.visibility.made', 'Made findable by {name}, {date}: “{reason}”')
w7('screen.project.opened', 'Opened by {name} on {date}.')
w7('screen.project.rescue.opened', 'Hidden project · opened by {name}, {date}', False, 'what an administrator sees of a hidden project whose owners are all gone')
w7('screen.project.rescue.why.help', 'Its members see this beside your name.', False, 'under the reason for projectownerrescue')
# question
w7('screen.question.strength.raise.connection', 'a link the source itself makes, or a shared identifier.', False, 'what raises a short connection grade, after screen.question.strength.raise')
w7('screen.question.gap.undetermined', 'Undetermined, because {reason}', False, "beside the strength; {reason} is the record's own")
w7('screen.question.waits.restore', 'Restore it, with a reason', False, "heldrestore's button where the question waits on a set-aside document")
w7('screen.question.reading.standfor', 'Stand on this one for {project}…', False, "versioncurrent's button on a reading")
w7('screen.question.affirm.head', 'Accepting a reading that rests on parts each enough on its own')
w7('screen.question.theme.passages', "{count} of this question's passages", False, 'beside a theme its passages are in')
w7('screen.question.relies.cites', 'cites this one as a passage', False, 'beside a question that relies on this one')
w7('screen.question.conclude.adopts', "A conclusion adopts one reading as the team's answer, in that reading's own words; it rests on the passages the reading stands on.", False, 'under question.conclude.reading')
w7('screen.question.airun.reading', 'Reading the {count} documents the team holds on {subject} for passages that bear on this question', False, "the assistant's run, while it works")
w7('screen.question.proposal.rests', 'It rests on {count} passages: {passages}.', False, "under the assistant's proposed reading")
w7('screen.question.proposal.testinstance', 'On a test instance, its work also reads: “{label}”', False, '{label} is ai.label.untested')
# ai
w7('ai.machine.request', "Machine work · the assistant, at {who}'s request", False, "machine work run at another member's request; at your own, screen.answers.machine")
# queue
w7('screen.queue.sort.bydue', 'sort by time due')
w7('screen.queue.remind.button', 'Remind me again on…', False, "reminderanswer's button")
w7('screen.queue.hint.disclosed', 'A council member disclosed income from a firm whose contract they voted on', False, 'the hint\'s own words, for the check "disclosed income against votes"')
w7('screen.queue.hint.summary.votes', 'matched disclosures to votes', False, 'how the check "disclosed income against votes" found it')
w7('screen.queue.hint.matched.income', "{person}'s {filing} lists income from {firm}.")
w7('screen.queue.hint.matched.vote', 'On {date} {person} voted for {item}, whose payments go to {firm}.')
w7('screen.queue.hint.method.text', 'The check “{check}” compared {inputs} in the documents your team holds, matching {by}.')
w7('screen.queue.hint.shown', 'It is shown only because that rate is under {threshold}%.')
w7('screen.queue.hint.stop', 'Stop this kind of hint for the project', False, "queuemute's button on a hint")
w7('screen.queue.standing.found', 'Your standing question found {count} new documents: {what}')
w7('screen.queue.standing.read', 'Read by the assistant')
w7('screen.queue.ai.toldowners', "told once to the project's owners")
w7('screen.queue.ai.nobodynamed', 'nobody is named')
w7('screen.queue.ai.addkey', 'Add an API key for the project', False, "projectkeyset's button")
w7('screen.queue.explore.asked', "asked at most once a day, of the project's owners")
w7('screen.queue.muted.explore', 'Hints worth exploring, in {project}')
w7('screen.queue.empty', 'Nothing is waiting on you.')
# setup
w7('screen.setup.claim.button', 'Claim it and become its administrator', False, "claim's button")
w7('screen.setup.logo.add', 'Add your logo (optional)')
w7('screen.setup.places.chosen', "You chose {place} when you created your team's Civicsmith. Change it here if you need to.")
w7('screen.setup.place.example', 'For example “{place}”.', False, 'before screen.setup.place.wanted.help')
w7('screen.setup.languages', 'Languages your members use')
w7('screen.setup.places.save', 'Save places and languages', False, "profilesset's button")
w7('screen.setup.office.heldby', 'held by {name}')
w7('screen.setup.office.heldsince', 'held by {name} since {year}')
w7('screen.setup.office.roster', "From {office}'s roster", False, 'where an office filled in for you came from')
w7('screen.setup.offices.none', "Nothing is filled in here: Civicsmith does not hold the offices and seats for {place} yet. Add the offices your team deals with yourself, now or at any time; each is marked as added by your team. When an update brings {place}'s rules, your administrators are told once in their queue and can choose it under Places; the offices you added stay.")
w7('screen.setup.people.head', 'Who sees what about people')
w7('screen.setup.people.what', "Facts that come from public documents follow those documents. A project's own notes about a person stay inside that project.")
w7('screen.setup.choice.head', 'What each choice means')
w7('screen.setup.choice.own', "Members' own accounts. Each member who wants the assistant connects their own Claude subscription or their own API key, and it serves only them, at their own cost. Civicsmith uses a subscription only for its own member, and the subscription path needs the Workers Paid plan.")
w7('screen.setup.choice.both', "Both. A member's own account comes first; the team's key serves the rest.")
w7('screen.setup.choice.none', "No assistant. Every journey still works. Members lose asking in plain words, suggestions, translation drafts, and the assistant reading new results for their standing questions; searching, counting and the team's own templates take its place.")
w7('screen.setup.setting.head', 'Setting one up')
w7('screen.setup.setting.groupkey', "The team's key: an administrator creates an API key in Anthropic's Console (console.anthropic.com), under an account that belongs to the team and has a payment method, and pastes it below. Civicsmith seals it and never shows it again. Setting a monthly spending limit in the Console as well is wise.")
w7('screen.setup.setting.own', "A member's own account: each member connects it themselves, from the assistant panel, with a step-by-step guide.")
w7('screen.setup.leaves.head', "What leaves your team's Civicsmith")
w7('screen.setup.leaves.what', "When a member asks, their question and the material read to answer it go to Anthropic, under whichever account serves them. Nothing goes unless a member asks. You can change this choice at any time in your team's settings.")
w7('screen.setup.keepaway.head', 'Keeping your material away from AI')
w7('screen.setup.keepaway.example', 'For example: “{example}”', False, "after the reason field's first sentence")
w7('screen.setup.key.told', "Each member is told once, before their first question under it, that their questions go to Anthropic under the team's account.")
w7('screen.setup.court.matters', 'Work done in Civicsmith can matter. Checking whether officials and agencies keep their own rules can show money misspent, deadlines ignored or promises broken, and a published case can lead to a correction, an audit or a lawsuit. People and organizations a team looks into sometimes go to court to see the work behind it.', True, 'the court notice (protected)')
w7('screen.setup.court.choice', 'The explanation is always one tap away for every member. You choose whether members are also told when they join and the first time they record something not public.', True, 'the court notice (protected)')
w7('screen.setup.security.add', 'Add a tool now', False, "securitytooladd's button")
w7('screen.setup.finished.title', "Your team's Civicsmith is set up.")
w7('screen.setup.handle.after', 'Once chosen, the step says: “{done}” Then it opens Home.', False, '{done} is founder.handle.done')
# site
w7('screen.site.hold', 'Hold your government to its own word')
w7('screen.site.line1', 'Civicsmith is free software for a team of people who want to know whether their government is doing what it must: obeying the laws that bind it and the court decisions it is subject to, keeping the rules it set for itself and the promises it made.')
w7('screen.site.line2', 'The team gathers the records, works out what they show, and publishes what it finds in a form anyone can check. Neighborhood groups, newsrooms, professional associations and offices checking their own work all use it the same way.')
w7('screen.site.start', "Start a team's Civicsmith")
w7('screen.site.seegroups', 'See what teams have published')
w7('screen.site.uses.head', 'How a team uses it')
w7('screen.site.uses.gather', "Gather the records. Members collect the records that bear on the question, from wherever they were published: the city's minutes, budgets, contracts and letters; state and federal regulations and reports; court decisions; the press releases and filings of private firms. Civicsmith keeps each one exactly as its source published it, with where and when it came from. Together these are the team's record.")
w7('screen.site.uses.ask', 'Ask a question. In the team’s own words: “{example}”')
w7('screen.site.uses.weigh', "Weigh the evidence. Members mark the passages of the record that bear on the question. Civicsmith grades each passage by how easily a stranger could check it, from a copy fetched straight from the office down to one person's word.")
w7('screen.site.uses.finding', "Reach a finding. The team's answer to its question, resting on named evidence, with how strong that evidence is. A hunch is kept as a hunch; it never becomes a finding.")
w7('screen.site.uses.publish', 'Publish a case. The findings, their evidence and their strength, published together and signed by a member of the team. Anyone can read it and check it without asking the team.')
w7('screen.site.gets.head', 'What a team gets')
w7('screen.site.gets.copy', "Its own copy of Civicsmith. Each team runs its own copy, in a Cloudflare account the team controls. Nobody else holds the team's work, the people who make Civicsmith included.")
w7('screen.site.gets.check', "Findings anyone can check. Every finding points to the passages it rests on and says how strong that evidence is, so a reader never has to take the team's word for it.")
w7('screen.site.gets.help', 'Help for people who have never done this. A guide walks each common job step by step, from asking an office for a record to publishing a case. An AI assistant is optional: it answers only from what the team holds, says where it looked, and never concludes, signs or sends. Everything works without it.')
w7('screen.site.gets.free', 'Free software. Civicsmith costs nothing. The team pays Cloudflare $5 a month for the account its copy runs in.')
w7('screen.site.not.head', 'What Civicsmith does not do')
w7('screen.site.not.side', 'It takes no side on what policy should be. It asks only whether the government kept its word.')
w7('screen.site.not.legal', 'It gives legal information, never legal advice.')
w7('screen.site.not.unsigned', 'It publishes nothing a member has not signed, and it sends no email.')
w7('screen.site.onecase.open', 'Open it as any reader does: each finding, its evidence and how strong it is, and a way to check the signature without asking the team.')
w7('screen.site.member.head', 'Already a member of a team?')
w7('screen.site.member.where', "Your team's Civicsmith has its own address, and you sign in there, not here: civicsmith.org holds no accounts. Ask your team for its address, or find it on your team's own website.")
w7('screen.site.questions.write', 'Write to the people who make Civicsmith: {address}.', False, "{address} is the stewards' address, a marked placeholder until it is set up")
w7('screen.site.start.lede', 'For a team that has decided to create its own copy. This page says what you need, who should hold what, what happens step by step, and what it costs. Reading it takes five minutes; the installer takes about twenty.')
w7('screen.site.fit.head', 'Is it right for your team?')
w7('screen.site.fit.what', "It fits if your team wants to find out whether a government, agency or public body is keeping the laws, rules and promises that bind it, and to show what the records say in a way others can check. It does not fit a team that wants a place to post opinions, or one that needs a lawyer's advice: Civicsmith gives neither.")
w7('screen.site.need.cloudflare', "A Cloudflare account on the Workers Paid plan, $5 a month, with a payment method. Cloudflare is the company whose computers will run your team's copy. Open the account in your team's name, not a person's.")
w7('screen.site.need.time', 'About twenty minutes at a computer.')
w7('screen.site.need.nothing', 'Nothing else. No server, no company, no technical knowledge, and no Claude account: the assistant is optional, and members connect their own accounts later if they want it. The installer asks you two things and does the rest.')
w7('screen.site.hold.head', 'Decide first: who holds the Cloudflare account')
w7('screen.site.hold.what', "Whoever can sign in to that account controls your team's Civicsmith. They can read everything in it, and they are the way back in if every administrator is ever locked out. Agree as a team on who that is, and add a second trusted person to the account, so it never depends on one person. The installer says this again at the moment it matters.")
w7('screen.site.steps.head', 'What happens, step by step')
w7('screen.site.steps.name', "You choose a short name and your places. The short name is a fixed label in your team's addresses and beside every signature; it never changes. The places are the city, county and state whose rules apply to you. Places ready now: {places}. For each, Civicsmith already holds the local facts it works from: its offices, where its records are published, its deadlines and its holidays.")
w7('screen.site.steps.permission', "Cloudflare asks your permission, on its own page, to let the installer create your team's copy in your account.")
w7('screen.site.steps.install', "The installer puts your team's Civicsmith in place and checks it. About ten minutes. If a step stops, the installer says why and what to do; a stop before setup has begun creates nothing.")
w7('screen.site.steps.claim', "You claim it. The installer shows you a one-time password; you use it once, choose your own password, and become the team's first administrator. More administrators can be added later.")
w7('screen.site.steps.setup', "You set it up. Your team's name, the languages its members use, and whether members may use the assistant. All of it can be changed later.")
w7('screen.site.steps.invite', 'You invite members. Each gets a link you send yourself, by whatever means you trust; Civicsmith sends no email. Each member chooses the name their work will carry.')
w7('screen.site.costs.what', '$5 a month to Cloudflare for the account. If members use the assistant, its use is paid to Anthropic by whoever connected the account that serves it, and the team can set limits. Nothing is paid to the people who make Civicsmith.')
w7('screen.site.back', 'Back to the front page')
w7('screen.site.groups.lede', 'The teams that chose to be listed here, each with what it has published. A team may keep itself to its members; then it is not listed, and nothing on this page is asked of it.')
w7('screen.site.groups.listing', 'A team chooses in its settings whether it is listed, and what it says about itself here. Being listed changes nothing about what its members see or do.')
w7('screen.site.groups.none', "No team is listed yet. A team appears here once its administrators choose, in their own team's Civicsmith, to list it and what it has published.")
w7('screen.site.groups.cases.one', '1 published case, in {editions} editions, the latest {date}')
w7('screen.site.groups.case.one', '1 published case')
# --- end DEC-257

# --- DEC-258: the member-facing English still written inline in T49's L11 modules, keyed (K3366: words.json is generated into the
# plane at build, setup-words exports word(key, vars), a module holds keys only). Each module's keys are listed in
# words-reads.json (words-reads.src.mjs). Refusals say what happened, then what to do (DEC-83); a consequence statement keeps
# op-grades' sentence word for word, since each says only what its owner enforces (op-grades R4, R8, R21, R24).
def w8(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-258' + (': ' + note if note else '')))
for code, t in [
  ('NOT_AUTHENTICATED', "This request didn't say who you are. Sign in, or send a credential this team's Civicsmith issued, and try again." + NC),
  ('CLASS_FORBIDDEN', "This doesn't accept the credential you sent: each credential here is issued for one purpose. Use the credential meant for this work." + NC),
  ('MACHINE_CREDENTIAL_REQUIRED', "This is done by an automated writer, not by a person signed in, and your team's Civicsmith records the decision that says so. It needs a machine credential an administrator has issued." + NC),
  ('SESSION_ROLE_CANNOT_REACH_OP', "A person does this, but from another kind of sign-in than yours: the founder's, or a member's own. Being an administrator doesn't reach the founder's. Ask the person who holds that sign-in." + NC),
  ('SESSION_ROUTE_NOT_RECORDED', "No one signed in can do this, and your team's Civicsmith records no decision that it isn't meant for a person. That is a gap, not a rule: report it to whoever installed your team's Civicsmith." + NC),
  ('ROOT_OF_TRUST_REQUIRED', "This needs the administrator token kept in the hosting account, not a signed-in session, even the founder's own. Use that token, or ask whoever holds the hosting account." + NC),
  ('NOT_CAPABLE', "Your account can't do this: an administrator grants what each member may do. Ask an administrator." + NC),
  ('SCOPE_REFUSED', "That credential may act only on its own part of the record, and this request reached outside it. Use a credential meant for that part." + NC),
  ('CREDENTIAL_IN_ADDRESS', "A password, credential or secret was sent in the web address, where logs and browser history keep it, so it wasn't read. Send it in the request's Authorization header or its body instead. If it was in a link, treat it as seen by others: sign out everywhere, or ask for a new link." + NC),
  ('MEMBER_TOKEN_RETIRED', "The shared member key is retired and no longer signs anyone in. Sign in with your own handle and password. Nothing was read or changed."),
  ('AI_BEYOND_TASK_SCOPE', "This agent's credential was made for one piece of work, and this isn't part of it. Widening it is for a member to record, not for the agent to ask." + NC),
  ('AI_CREDENTIAL_REVOKED', "A member withdrew this agent's credential, so it no longer reaches anything here. What it did while it worked stays readable. A member can create a new one if it is needed." + NC),
  ('AI_CREDENTIAL_EXPIRED', "This agent's credential reached the end of its time, so it no longer reaches anything here. Credentials aren't renewed: a member creates a new one." + NC),
  ('AI_SCOPE_UNKNOWN_OP', "The list of what this credential may do names something your team's Civicsmith doesn't do. Take it out of the list, or name what you meant." + NW),
  ('AI_SCOPE_BEYOND_MEMBER_REACH', "An agent can be given only what a member could do, and this isn't one of those: it is the background worker's own job, or something a member does only when signed in. Leave it out of the credential." + NW),
  ('AI_CONFINEMENT_NOT_SCRATCH', "A credential can be confined only to the test area, named exactly. Leave the confinement out for one that reaches the record itself." + NW),
  ('GROUP_IDENTITY_NEEDS_SESSION', "Your team's public name and web address are set by an administrator, signed in, and the record names who set each. This came from an operator's access token, not a person. Sign in as an administrator and set it there." + NC),
  ('NAMESPACE_UNKNOWN', "This request named a part of the record your team's Civicsmith doesn't have. It has two: the record itself, and a test area kept apart. Name one of them exactly. Nothing was read or changed."),
  ('NAMESPACE_PINNED', "This always answers from the record itself and has no test version. Leave the test area out of the request, knowing it then reaches the real record. Nothing was read or changed."),
  ('NAMESPACE_CONFINED', "This credential reaches only the test area kept apart for testing, and this request asked for another part of the record. Leave the part out, and it reaches the test area. Nothing was read or changed."),
  ('OPERATOR_TOKEN_CANNOT_GOVERN', "Endorsing an administrator, voting to remove one and setting what a member may do are done by a named administrator, and the record names who did them. This came from an operator's access token, not a person. Sign in as that administrator and do it there." + NC),
]: w8(f'refusal.{code}', t, False, "admission's translation (R14), keyed")
for code, t in [
  ('ASK_NOT_A_MEMBER', "Only a member asks the assistant, from their own sign-in. Sign in and ask again. Nothing was asked."),
  ('AGENT_WORKER_SILENT', "The assistant didn't answer, so nothing was kept. Try again in a moment."),
  ('PASSAGE_TOO_LONG', "This passage is longer than {max} characters, too long to translate here. Choose a shorter passage. Nothing was translated."),
  ('NO_SUCH_NOTE', "None of your notes has that number. Choose the note again." + NC),
]: w8(f'refusal.{code}', t, False, "plane's ask (R33, R50): its detail, keyed by its code")
w8('ai.keepaway.unread', "Your team's Civicsmith couldn't check just now whether this project keeps its material away from AI, so the assistant did nothing. Try again in a moment.", False, "plane's ask: UNDETERMINED keep-away, for a translation or a draft")
w8('ai.draft.planunread', "The plan couldn't be read just now, so nothing was drafted. Try again in a moment.", False, "plane's ask: a status report's draft")
w8('ai.draft.recordsunread', "The records this draft is about couldn't be read just now, so nothing was drafted. Try again in a moment.", False, "plane's ask: a bearing or infraction draft")
w8('translate.undetermined.language', "Your team's Civicsmith couldn't tell what language this is written in, so nothing was translated. Try again in a moment.", False, "plane's ask: readtranslate; DEC-273: readtranslate translates a note, question, finding or notice, never a passage (plane R50)")

# op-grades' consequence statements (R4, R8, R21 (K2049)): word for word; personexpunge's is screen.person.expunge.statement and
# openwithwarning's screen.open-file.warn.ends, the design's words governing
for op, t in [
  ('attribute', "The level you choose is what this case edition publishes about who said your observation. Once the edition is signed and published, it says so permanently: a later edition may choose differently, but this one never stops saying it. Your reason is kept with the choice."),
  ('leadshare', "Sharing puts what you were told in front of every joined participant of that project. A disclosure cannot be un-read: the share stays in the record with your reason, and what they have read stays read."),
  ('entitycreate', "This names a person or a body in the team's registry, in your name and with your note. Documents that mention them can then be resolved to the entry, and the entry is corrected by aliases and relations, never erased."),
  ('strengthbar', "This sets the strength the whole team's work is held to by default: every new project starts from it. It stands as the team's bar, in your name and with your reason, until it is set again."),
  ('filingapprove', "Approving makes this text yours, recorded with your name, the time and its digest. A filing is approved once, and the approval is not walked back: what is sent is the text you approved."),
  ('workobjective', "An assistant will work this project's objective within the run's budget and scope, shown beside this field. Your reason is recorded on the run's opening; the run proposes and never concludes."),
  ('actionholdrelease', "Releasing this hold restarts deletion for the projects shown beside this: their material may be purged again, and assistant transcripts for them past the time limit will be deleted on each member's device when it is next opened. This cannot be undone."),
  ('standardrelease', "Releasing this policy lets every member of your team see it, and every read of it, from now on. It cannot be undone: once released, it is never held back at its source's sight again. The release is recorded with your name, the time and your reason."),
]: w8(f'consequence.{op}', t, True, "op-grades' consequence statement, read by the act's id")

# values shown once (control-plane R-credentials): the review copy's is screen.review-copy.link.once
w8('credential.token.once', "This is the only time your team's Civicsmith shows this value. It is not stored and cannot be recovered: the record keeps the credential's name and who created it, never the value. If it is lost, withdraw this credential and create another.", True, "control-plane: an agent credential minted")
w8('template.review.secret.once', "This is the only time your team's Civicsmith shows this value. It is kept only as a fingerprint and cannot be recovered. Give it to the reviewer: it lets them read this one template version, comment on it and review it while it is a draft or in review, and nothing else. If it is lost, withdraw this grant and open another.", True, "control-plane: a template review grant")

# the words a module writes into a project file a member opens; the file's own grammar (front matter, record-grammar's headings,
# the session log's fields) stays as it is
w8('file.archive.title', 'Archive captured from {source}', False, "control-plane's unpack: the archive's own file")
w8('file.archive.entry.title', '{path}, from the archive {archive}', False, "control-plane's unpack: a file cut out of an archive")
w8('file.archive.summary', 'An archive captured by the record, held beside the files cut out of it. Its bytes are filed exactly as captured; nothing here summarizes them.', False, "control-plane's unpack")
w8('file.archive.entry.summary', 'A file cut out of the archive {archive} the record holds, as it sat in the archive. Its bytes are filed exactly as cut; nothing here summarizes them.', False, "control-plane's unpack")
w8('file.archive.provenance', "Filed as collected and never higher: releasing it is a named member's decision.", False, "control-plane's unpack")
w8('file.log.unpacked', 'created by unpacking the archive.', False, "control-plane's unpack: the session log's Changes")
w8('file.trigger.home', "started from the team's home", False, "screens-daily: the session log's Trigger")
w8('file.trigger.projects', 'started from the projects list', False, "screens-daily: the session log's Trigger")
w8('file.trigger.queue', 'opened from a hint in the queue ({item})', False, "screens-daily: the session log's Trigger")
w8('file.recheck.revisit', 'Revisit this', False, "screens-inquiry: a new question's recheck trigger")
w8('file.recheck.none', 'A member set no specific trigger at creation; replace this with a real one.', False, 'screens-inquiry')
w8('file.recheck.chain', 'Revisit this chain', False, "screens-investigate: a question opened from a chain")
w8('file.recheck.chain.why', 'Opened from a chain found by exploring connections; explore again when its steps change.', False, 'screens-investigate')
w8('file.chain.title', 'What does this chain show: {steps}', False, 'screens-investigate')
w8('file.chain.question', 'What does this chain of connections show, and does each step hold? {steps}', False, 'screens-investigate')
w8('file.chain.rests', 'Explored as of {at}, each step as the record cites it: {steps}', False, 'screens-investigate')
w8('screen.timeline.method.member', "a member's reading of the passage", False, "screens-investigate: a dated fact's method")
# --- end DEC-258

# Rows the requirements withdraw (DEC-256): build_words.mjs drops them, failing if one is no longer there to drop
# --- DEC-261: civicsmith.org's own words for SITE #1 (BOB's B221, K3372): its generator writes no inline English
def w9(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-261' + (': ' + note if note else '')))
for k, t in [('nav.home', 'What Civicsmith is'), ('nav.start', 'Start a team'), ('nav.groups', 'Teams at work'),
             ('onecase.head', "One team's work"), ('questions.head', 'Questions'), ('need.head', 'What you need'), ('costs.head', 'What it costs'),
             ('create', 'Create your team'), ('groups.visit', 'Visit'),
             ('uses.ask.example', 'Did the city collect the rent its lease requires?'),
             ('questions.unset', 'The address to write to is published here before the site opens.'),
             ('onecase.title', '{case}, Edition {edition}'), ('onecase.meta', '{group}, {place} · signed by {signer} · {date}'),
             ('groups.cases.many', '{cases} published cases, in {editions} editions, the latest {date}'), ('groups.case.many', '{cases} published cases'),
             ('notfound', 'There is no such page on civicsmith.org.')]:
    w9('screen.site.' + k, t, False, 'nav.groups is also the teams page heading' if k == 'nav.groups' else ('fills screen.site.uses.ask {example}' if k == 'uses.ask.example' else ("site R6's marked placeholder until the stewards' address is set" if k == 'questions.unset' else '')))

# --- DEC-262 (BOB's B220): a sentence is drawn only when every {placeholder} is answered; the parts whose fills cannot always
# be answered are their own sentences, each drawn only when answered (the rows above that lost them are reworded, DEC262_REWORDED)
def w10(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-262' + (': ' + note if note else '')))
w10('screen.connect.group.allowance.used', 'You have used {used} of it {when}.', False, "after screen.connect.group.allowance; drawn only to an account's owners, when answered")
w10('screen.connect.grouplimits.used', 'You have used {used} of it today.', False, 'after screen.connect.grouplimits; drawn only when answered')
w10('screen.connect.grouplimits.suggestions', 'Suggestions: {suggestions}.', False, 'after screen.connect.grouplimits; drawn only when answered')
w10('refusal.DOOR_RATE_LIMITED.session', 'You have made too many requests in the last ten minutes. Try again in {minutes} minutes.' + NW, False, "a session's own limit, beside the connection's refusal.DOOR_RATE_LIMITED")
DEC262_REWORDED = ['screen.connect.own.subscription', 'screen.connect.own.apikey', 'screen.connect.group.allowance', 'screen.connect.grouplimits', 'screen.members.recovery.one']
# --- end DEC-262

# --- DEC-263 (BOB's B222, B223, B224 (1)): L11's further words. A count drawn at one reads its own .one row (setup-words
# has no plural rule: the screen picks the key); the base key stays the many case.
def w11(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-263' + (': ' + note if note else '')))
w11('screen.queue.more.one', 'One more item is not shown here; act on these first.', False, 'screen.queue.more when {n} is 1')
w11('screen.find-in.notread.one', 'One document could not be read for this, so “nothing” is not said for it.', False, 'screen.find-in.notread when {n} is 1')
w11('screen.finder.nobody.one', 'Nobody has looked yet at one place your team holds.', False, 'screen.finder.nobody when {n} is 1')
w11('screen.answers.withheld.one', 'One sentence was held back because it could not be checked against what your team holds.', False, 'screen.answers.withheld when {n} is 1')
w11('published.check.elsewhere', 'The team published a file with this fingerprint, but no finding in this edition rests on it: it belongs to another edition or case of theirs, or was published beside the findings.', False, "screens-publish R22: verify answers published, with no evidence row of this edition's findings")
DEC263_REWORDED = {'screen.setup.claimed.nosignin': "Claimed. Sign in on your team's page with your handle, {handle}, and the password you just chose."}
REWRITE7.update(DEC263_REWORDED)   # the founder chooses their handle (DEC-230); no longer 'admin'
# --- end DEC-263

# --- DEC-264 (BOB's B224 (2), N1125): affordances.mjs, the module's main file beside its folder, was never inventoried. Each
# act it publishes is named by act.<op>.name, its name wherever it is named outside a screen (the screens keep their own
# act.<op>.label.<screen>); a per-item act over a selection is act.<op>.name.selected. The names speak the design's words
# (Vouch, Set aside, readings, Remove a citation) and none uses "ground", "branch", "disjunction", "AND" or "OR" (affordances
# R5). AFFORDANCES_NAMES maps each key to the module's present text, which words-reads.src.mjs keys to it.
def w12(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-264' + (': ' + note if note else '')))
AFFORDANCES_NAMES = {}
for op, was, name in [
  ('attest', 'Co-attest this capture', 'Certify when this copy existed'),
  ('monitor', 'Check this source against what was captured', 'Check this address for a new version now'),
  ('attesttext', 'Attest that this text matches the page image', 'Vouch that this text matches the page image'),
  ('release', 'Release (verify)', 'Vouch for this copy'),
  ('dispose', 'Dispose (defer or dismiss)', 'Set this question aside, or dismiss it'),
  ('contradictionresolve', 'Resolve this contradiction (conclude with what it turned out to be)', 'Settle this contradiction: say what it turned out to be'),
  ('publish', 'Publish (author the case)', 'Publish the signed edition'),
  ('inquirydivide', 'Divide (split this question)', 'Split this question into narrower ones'),
  ('inquiryground', 'Group what this rests on', 'Say what each passage carries'),
  ('actionmove', 'Move this action', 'Move the action to its next stage'),
  ('actioncorrespond', 'Record correspondence', 'Record a reply or letter received'),
  ('actionlaws', 'State governing laws', 'Choose the laws it goes under'),
  ('actionrisktier', 'Revise risk tier', 'Revise the risk tier, with a reason'),
  ('actionhold', 'Place a litigation hold (with a reason)', 'Record a litigation hold, with a reason'),
  ('actionholdrelease', 'Release a litigation hold (with a reason)', 'End a litigation hold, with a reason'),
  ('actionpressure', 'Mark a reply as pressure on the group', 'Mark a reply as pressure on the team'),
  ('holdnoticeprepare', 'Prepare the hold notice for members', 'Prepare the hold notice for members'),
  ('holdnoticesent', 'Record that the hold notice was sent', 'Record that the hold notice was sent'),
  ('actionreceipt', 'Record that a sending was received', 'Record that what you sent was received'),
  ('actionscope', 'Keep this action confidential, or no longer (with a reason)', 'Make the action confidential, or not, with a reason'),
  ('actionpromise', 'Note a promise the group made', 'Record a promise the team made'),
  ('actionreplybearing', 'Record what a reply says to each claim', 'Lay out the reply claim by claim'),
  ('actionbearingpropose', 'Propose what a reply says to each claim', 'Propose a claim-by-claim layout of the reply'),
  ('actionreplyquoting', 'Record that a reply asks not to be quoted', 'Record that a reply asks not to be quoted'),
  ('arosefrom', 'Link a matter that arose from this reply', 'Record a matter that arose from this reply'),
  ('escalationopen', 'Open an escalation of the determination this rests on (with a reason)', 'Open an escalation, with a reason'),
  ('escalationattach', 'Attach this action to its escalation (with a reason)', 'Attach this action to its escalation, with a reason'),
  ('escalationstoppursuing', 'Stop pursuing this escalation (with a reason)', 'Stop pursuing this escalation, with a reason'),
  ('escalationreopen', 'Reopen an escalation the group stopped pursuing (with a reason)', 'Reopen the escalation where it stopped, with a reason'),
  ('filingprepare', 'Prepare a filing', 'Prepare the filing'),
  ('communicationprepare', 'Prepare a communication', 'Prepare what is sent'),
  ('clockadopt', "Put a proposed deadline on this action's clock", 'Confirm the due date'),
  ('filingapprove', 'Approve a prepared draft', 'Approve the text for sending'),
  ('filingsent', 'Record that an approved draft was sent', 'Record that the approved text was sent'),
  ('counselpacket', 'Brief counsel (with a reason)', 'Prepare the packet for counsel, with a reason'),
  ('clockstate', 'State a deadline and its basis', 'Give a due date and where it comes from'),
  ('reminderset', 'Set a reminder for a date', 'Remind me on a date'),
  ('itemtakeup', 'Take this up myself', 'Take this item up yourself'),
  ('versionaccept', 'Accept a reading of the evidence', 'Accept this reading'),
  ('versionreject', 'Turn down a reading (with a reason)', 'Reject this reading, with a reason'),
  ('versionconsider', 'Set a reading aside for now (with a reason)', 'Weigh this reading, with a reason'),
  ('versionrevert', 'Put a reading back to where nobody had acted on it', 'Undo the decision on this reading, with a reason'),
  ('versioncurrent', 'Stand this project on a reading', 'Stand the project on this reading, with a reason'),
  ('withdrawconclusion', "Withdraw this project's conclusion (it stays in the record)", 'Withdraw the conclusion; it stays on the record'),
  ('versionhide', 'Hide a reading from the display (it stays in the record)', 'Hide this reading; it stays on the record'),
  ('cite', 'Cite material into a case or a question', 'Cite in a question or a case'),
  ('sever', 'Sever a citation', 'Remove a citation, with a reason'),
  ('reinstate', 'Reinstate a severed citation', 'Reinstate a removed citation'),
  ('projectinvite', 'Invite a member to this project', 'Invite a member to the project'),
  ('projectjoin', 'Join this project', 'Join this project'),
  ('projectremove', 'Remove a participant', 'Remove a member from the project, with a reason'),
  ('projectowneradd', 'Add an owner', 'Make an owner, or agree to it'),
  ('projectownerremove', 'Remove an owner (with a reason)', 'Remove an owner, with a reason'),
  ('projectownerrescue', 'Add an owner to a project whose owners are all inactive (with a reason)', 'Become the owner of a project whose owners are gone, with a reason'),
  ('projectvisibilityset', 'Choose whether this project can be found', 'Change who can find the project'),
  ('sourceconsent', "Record a source's consent to publish (with its evidence)", "Record a source's consent to publish, with its evidence"),
  ('proposedispose.selected', 'Defer or dismiss the selected findings', 'Set aside or dismiss the selected findings'),
  ('taskresolve.selected', 'Resolve the selected obligations', 'Act on the selected items'),
  ('taskforward.selected', 'Forward the selected obligations', 'Forward the selected items to a member'),
  ('resolve.selected', "Resolve the selected documents' references", "Match the selected documents' mentions"),
]:
    op0, _, sel = op.partition('.')
    key = f'act.{op0}.name' + ('.selected' if sel else '')
    w12(key, name, False, "affordances' name for the act" + (' over a selection (per-item)' if sel else ''))
    AFFORDANCES_NAMES[key] = was
w12('prompt.inquirydivide', 'Dividing does not remove anything. Every leg this question rests on gets a home on one of the children, including any leg that cuts against you, and this question stays on the record as the divided parent, recording where each leg went. Each child names this parent and every sibling, and when a child is published it names them to its readers. If you mean to drop material rather than re-home it, remove the citation, with a reason, instead.', False, "affordances' DIVIDE_PROMPT (R5), shown before a question is divided")
AFFORDANCES_NAMES['prompt.inquirydivide'] = 'Dividing does not remove anything.'
w12('prompt.inquiryground', "Grouping says these reasons are enough on their own to carry your answer. Your answer's strength is then taken from the strongest team rather than from its weakest single reason, so your name and the time go on each team you make and stay there until that team's reasons change. Nothing is hidden: every reason stays visible under the team you put it in, and a published case carries each team and what it reached inside the signed bytes, so a reader can check whether they really were enough on their own. Leaving the reasons ungrouped is always available, and is read as no stronger than the weakest one.", False, "affordances' GROUND_PROMPT (R5; DEC-32 clause 1), shown before reasons are grouped")
AFFORDANCES_NAMES['prompt.inquiryground'] = 'Grouping says these reasons are enough on their own'
w12('prompt.attest.fence', "What co-attestation answers: when did these bytes exist? It asks an independent timestamp authority to record that this capture's exact bytes existed no later than a fixed instant. What it does not answer: whether the document is TRUE, whether its source is authoritative, or how close it stands to the fact you are citing it for. A secondhand report that is co-attested is still a secondhand report. What it is worth: it strengthens a Grade {ceiling} capture toward evidentiary weight. It never reaches Grade {unreachable} — that needs a chain-of-custody web archive this surface cannot produce.", True, "affordances' attestFence (R5): DEC-39's wording verbatim, its two grade letters filled from the capture ceiling and the grade above it")
AFFORDANCES_NAMES['prompt.attest.fence'] = 'What co-attestation answers: when did these bytes exist?'
w12('refusal.uncatalogued', "Civicsmith has no explanation of this refusal in its words yet, so its code is shown as the act gave it.", False, "affordances' NOT_CATALOGUED: a refusal code with no refusal.<CODE> word")
AFFORDANCES_NAMES['refusal.uncatalogued'] = 'This refusal is not in the catalogue of refusals'
# --- end DEC-264

# --- DEC-265 (BOB's B226, K3379): L11's further words; the rewordings are words-drawn.src.py's (screen.ceremony.photo.facts,
# screen.money.didnotmove, screen.plan.opened, screen.timeline.order.evidence)
def w13(key, en, prot=False, note=''): W.append(dict(key=key, en=en, protected=prot, note='DEC-265' + (': ' + note if note else '')))
w13('screen.ceremony.photo.facts.dated', 'taken by {by}, {date} · relied on by {findings}', False, "screen.ceremony.photo.facts when the photo's date is answered (a provider's, T50)")
# --- end DEC-265

# --- DEC-266 (DEC-259's owed: line): a signing key is made in the browser and never sent to Civicsmith; it stays on the
# device only when the member keeps it there, otherwise it is saved as a key file (interface-shell R40, R42). "Never leaves
# this device" was true of one path only, so every sentence says what is true of both.
DEC266_REWORDED = {
  'signing.ceremony.nokey': 'You have no signing key in this browser. Register one here: it is made in this browser and never sent to Civicsmith, and every use asks you to confirm. Then you come back to this step, with nothing lost.',
  'signing.ceremony.device': 'Your device is asking you to confirm with your signing key: its own window asks for your passphrase, fingerprint or device PIN. The key stays in your browser, and Civicsmith never sees it.',
  'screen.account.key.help': 'Your signing key is made in your browser and never sent to Civicsmith; only its public line is registered. Kept on this device if you tick it; otherwise your browser saves it as a key file, protected by a passphrase you choose.',
}
REWRITE7.update(DEC266_REWORDED)
# --- end DEC-266

# --- DEC-267 (DEC-258's owed: line): refusal.AGENT_WORKER_UNBOUND said "signing in" wherever it was raised; it now says what is
# true at every act that raises it. An assistant's draft of the team's own words (its description) has its own label.
w14 = lambda key, en, prot=False, note='': W.append(dict(key=key, en=en, protected=prot, note='DEC-267' + (': ' + note if note else '')))
w14('draft.machine.label.group', "Draft by the assistant, at your request · edit it until it is your team's", False, "draft.machine.label for a field that holds the team's words (control-plane's team draft)")
DEC267_REWORDED = {'refusal.AGENT_WORKER_UNBOUND': "The assistant isn't installed in your team's Civicsmith yet, so it can't do this here. Everything else works without it; whoever installed your team's Civicsmith can add it."}
REWRITE7.update(DEC267_REWORDED)
# --- end DEC-267

# --- DEC-268 (screens-intake R22, T49; Bob's D12): a capture opened with a project or a question as its subject says where it
# is filed, and from a question offers "Cite a passage", opening find-in over the document with the question chosen
w15 = lambda key, en, prot=False, note='': W.append(dict(key=key, en=en, protected=prot, note='DEC-268' + (': ' + note if note else '')))
w15('capture.filed.project', 'Filed under {project}', False, 'after capture.captured, for a capture opened from a project')
w15('capture.filed.question', 'Filed under {project}, for the question “{question}”', False, 'after capture.captured, for a capture opened from a question')
w15('capture.cite', 'Cite a passage', False, "the captured result's link to find-in, offered for a capture opened from a question (R22)")
w15('capture.cite.tip', 'Opens Find in this over the document, with your question chosen.', False, 'what capture.cite opens')
DEC268_REWORDED = {'screen.capture.address.watchhead': 'Once it is captured: where it is filed, and watching the address'}
REWRITE7.update(DEC268_REWORDED)
# --- end DEC-268

# --- DEC-269 (the standing tail: the words' consistency): never "overdue" in the queue (DEC-256; screens-daily R31), and
# American spelling (DEC-221)
DEC269_REWORDED = {
  'queue.temporal-expectation-due.undetermined.detail': 'It may be past its date; that is undetermined, because {reason}. {office} was due to {what} between {from} and {to} ({basis}).',
  'screen.people.today.kind.program': 'A program',
}
REWRITE7.update(DEC269_REWORDED)
# --- end DEC-269

# --- DEC-270 (Bob, 2026-10-15: "rule: approved"): the listing rule's text (DEC-255; Publication §5E), as he approved it, drawn on
# civicsmith.org's teams page beside site.groups.rule
w16 = lambda key, en, prot=False, note='': W.append(dict(key=key, en=en, protected=prot, note='DEC-270' + (': ' + note if note else '')))
w16('site.groups.rule.head', 'The listing rule', False, "the details' heading beside site.groups.rule")
w16('site.groups.rule.text', "civicsmith.org lists every team whose administrators choose to list it. We decline or remove a listing only when it (1) is not a team using Civicsmith, or is advertising or spam; (2) pretends to be another team, person or office; (3) publishes something a court has ordered removed, or that is unlawful to publish; or (4) aims at a private person rather than at a government's work: their home, family or private life. We never decline or remove a listing for a team's views, its conclusions, or whom it holds to account, public officials and companies included. We tell the team which part of this rule applies and why; once it is fixed, the team can ask again.", True, 'Bob approved this text (DEC-270); a change is his')
# --- end DEC-270

# --- DEC-272 (K3402, K3403, N1138): the queue item a capture finished without the member who started it. Its summary and
# detail name the member by handle, never a raw id; a credential that is no member reads queue.capture-completed-unattended.who.
w17 = lambda key, en, prot=False, note='': W.append(dict(key=key, en=en, protected=prot, note='DEC-272' + (': ' + note if note else '')))
w17('queue.capture-completed-unattended.summary', 'A capture finished after {member} left it: {title}', False, "machinery-producers' capture-completed-unattended; {title} the document's title, never its record id")
w17('queue.capture-completed-unattended.detail', "{member} started capturing this document and left before it finished; your team's Civicsmith finished it. Nothing here says whether what it captured is right: open it and check it before anyone vouches for it.", False, "machinery-producers' capture-completed-unattended")
w17('queue.capture-completed-unattended.who', "your team's Civicsmith", False, '{member} when the capture was started by a credential that is no member')
# --- end DEC-272

# --- DEC-274 (B232, N1140, K3408): the queue item for a capture made at a request (machinery-producers'
# #conditionsCaptureRequested): a member's own request, or the assistant's while it works for a member (DEC-27(b): both
# named, the act the machine's). {member} the requester's handle (or queue.capture-completed-unattended.who); {title} the
# document's title. Never the run's id, the credential, the account that paid, or a capture's fingerprint.
w18 = lambda key, en, prot=False, note='': W.append(dict(key=key, en=en, protected=prot, note='DEC-274' + (': ' + note if note else '')))
w18('queue.capture-completed-unattended.request.summary', "Captured at {member}'s request: {title}", False, "a capture a member asked for, or the assistant asked for while working for that member")
w18('queue.capture-completed-unattended.request.summary.unnamed', 'Captured at a request: {title}', False, "the summary when the request names no member (a credential that is no member asked)")
w18('queue.capture-completed-unattended.request.detail', "{member} asked for this document, and your team's Civicsmith captured it. Capturing adds it to what your team holds; nothing any question or finding rests on has changed. Open it and check it before anyone vouches for it.", False, "a member's own request (capture-requests R56)")
w18('queue.capture-completed-unattended.request.detail.assistant', "The assistant asked for this document while working for {member}, and your team's Civicsmith captured it. Capturing adds it to what your team holds; nothing any question or finding rests on has changed. Open it and check it before anyone vouches for it.", False, "a run's request; the account that paid and the run are on the run's own record, never in this sentence")
w18('queue.capture-completed-unattended.request.detail.unnamed', "This document was asked for, and your team's Civicsmith captured it. Capturing adds it to what your team holds; nothing any question or finding rests on has changed. Open it and check it before anyone vouches for it.", False, "the detail when the request names no member")
w18('queue.capture-completed-unattended.gradenote', 'When it was captured, a member there would have read this note on it: {note}', False, "appended to either producer's detail once per distinct grade note; {note} the note's own words; never a fingerprint")
# --- end DEC-274

RETIRED_DEC328 = ['queue.muted.case']  # DEC-328 (B300 (2)): queue answers no whole-project mute
RETIRED = ['screen.forgot.handle.help', 'screen.home.strip.overdue', 'screen.queue.due.overdue', 'screen.setup.taken', 'screen.updates.skip.noreason', 'question.empty.conclude']
# DEC-279: setup's long assistant panel and its headings, no longer drawn (the parts say it in their own words)
RETIRED += ['screen.setup.choice.head', 'screen.setup.choice.own', 'screen.setup.choice.both', 'screen.setup.choice.none', 'screen.setup.setting.head', 'screen.setup.setting.groupkey', 'screen.setup.setting.own', 'screen.setup.leaves.head', 'screen.setup.keepaway.head', 'screen.setup.people.head']
# Rows whose words change (DEC-256): never "overdue" on Home or in the queue (screens-daily R31)
REWRITE = {'queue.milestone-overdue.summary': 'Past its date: {milestone}',
           'queue.temporal-expectation-due.undetermined.summary': 'Its date may have passed: {duty}'}

REWRITE.update(REWRITE7)   # DEC-257: rows reworded to the words the screens draw
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'words-t49.json')
RETIRED += RETIRED_DEC328
open(out, 'w').write(json.dumps(dict(rows=W, retired=RETIRED, affordances_names=AFFORDANCES_NAMES, rewrite=REWRITE, rewrite_dec={k: 'DEC-269' if k in DEC269_REWORDED else 'DEC-268' if k in DEC268_REWORDED else 'DEC-267' if k in DEC267_REWORDED else 'DEC-266' if k in DEC266_REWORDED else 'DEC-263' if k in DEC263_REWORDED else 'DEC-262' if k in DEC262_REWORDED else 'DEC-257' for k in REWRITE7}), indent=1, ensure_ascii=False) + '\n')
print(len(W), 'rows to', out)
