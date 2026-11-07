# The words T46 owes the design stream (DEC-198; BOB's B149, T46's HANDOFF; build/plan/current.md on tranche/T46, "The channel").
# Each entry: (key, English, protected, note). Refusals say what happened, then what to do (DEC-83). Placeholders in {braces}
# are filled by the screen. Run build_words.mjs after editing: it reads words-t46.json, which this file writes.
# Run: python3 docs/development/ux-substrate/screens/words-t46.src.py
import json, os
W = []
def w(key, en, prot=False, note=''):
    W.append(dict(key=key, en=en, protected=prot, note=note))
NS = ' Nothing was sent.'

# --- Signing in with a Claude subscription (connect; control-plane R65, agent-runner R17-R19, agent-worker R66)
w('refusal.NO_SIGNIN_WAITING', 'No sign-in was waiting for that code: it timed out, or was started on another page. Open Anthropic\'s sign-in page again and paste the new code it gives you.', False, 'subscriptionsignin, step code')
w('refusal.SIGNIN_REFUSED', 'Anthropic\'s page didn\'t accept that code ({detail}). Open the sign-in page again and paste the new code it gives you.', False, '{detail} the runner\'s own words')
w('refusal.SIGNIN_UNAVAILABLE', 'Anthropic\'s sign-in couldn\'t be reached just now. Try again in a few minutes, or connect with an API key instead.', False)
w('refusal.SIGNIN_ADDRESS_UNEXPECTED', 'The sign-in answered with an address that is not Anthropic\'s, so your team\'s Civicsmith did not open it.' + NS + ' Tell whoever installed your team\'s Civicsmith.', True, 'a safety stop: says what was not opened')
w('ai.refused.signinabsent', 'Signing in with Claude is not installed in your team\'s Civicsmith yet. An API key works instead; whoever installed your team\'s Civicsmith can add it.', False, 'the translation control-plane R65 relays with agent-worker\'s runner-not-configured answer')
w('refusal.AGENT_WORKER_UNBOUND', 'The assistant isn\'t installed in your team\'s Civicsmith yet, so signing in can\'t finish here. Everything else works without it; whoever installed your team\'s Civicsmith can add it.', False)
w('refusal.DISCLOSURE_DUE', 'Read what connecting means first: your questions, and what is read to answer them, go to Anthropic under your own account. Then open the sign-in page again.', True, 'says who sees what; the start of a sign-in before the disclosure is shown')
w('ai.refused.keptaway', 'Your team keeps its material away from AI, so no assistant works here, the team\'s or your own. {member} set this on {date}: “{reason}”. Everything else works as usual.', True, 'the team-level keep-away; says who sees what')
w('ai.refused.noaccount', 'No account serves the assistant for you yet: your team doesn\'t offer its key, and you haven\'t connected your own. Connect one in Settings › The assistant, or carry on without it.', False)
w('ai.refused.notdeployed', 'This part of the assistant isn\'t switched on in your team\'s Civicsmith yet.' + NS + ' Everything else works as usual.', False, 'a run mode or an assistant part not deployed')

# --- A test instance (run-rules R29, R30; setup-page R31, R33; instance-setup R80, R81)
w('ai.label.untested', 'Not yet tested: this part of the assistant has not yet passed Civicsmith\'s tests on real matters. Check what it says against the record.', True, 'on every assistant output a part makes on a test instance; never removed')
w('instance.test.notice', 'This is a test Civicsmith. Parts of its assistant have not yet passed Civicsmith\'s tests, and each answer they give says so.', True, 'every visitor, first view and healthy panel; no act changes it')
w('instance.part.signin.present', 'Signing in with Claude: installed', False, 'the healthy panel; parts')
w('instance.part.signin.absent', 'Signing in with Claude: not installed yet. Members can connect with an API key instead.', False)
w('instance.part.scanner.present', 'File scanner: installed', False)
w('instance.part.scanner.absent', 'File scanner: not installed yet. Files are kept and shown, but not scanned.', False)
w('instance.part.safeview.present', 'Safe view: installed', False)
w('instance.part.safeview.absent', 'Safe view: not installed yet. A high-risk file can\'t be opened until it is.', False)
w('instance.part.unknown', '{part}: couldn\'t be checked just now. It is checked again when this page is opened.', False, '{part} one of the part names above')
w('instance.scanner.absent.step', 'Your team\'s Civicsmith has no file scanner installed yet: files are kept and shown but not scanned, and a high-risk file opens only in its safe view once one can be made.', True, 'setup-page R30, in place of the scanning sentences while no scanner is present')
w('refusal.SCANNER_ABSENT', 'Your team\'s Civicsmith has no file scanner installed, so this file wasn\'t scanned. It is kept and shown; whoever installed your team\'s Civicsmith can add a scanner.', False, 'file-safety R42')
w('refusal.RENDERER_ABSENT', 'Your team\'s Civicsmith has no safe view installed, so this file can\'t be shown safely here. The original stays held; whoever installed your team\'s Civicsmith can add a safe view.', False, 'file-safety R42')

# --- Handles (DEC-197): fixed at joining; handlechange kept as an op that refuses every change (K2903)
w('refusal.HANDLE_FIXED', 'Your handle is already chosen, and a handle never changes in Civicsmith: it names your work for good, and no one else can ever take it.' + ' Nothing was changed.', False, 'DEC-197; membership R124 refuses every change')

# --- The status report's assistant (plan-work R8's arm, statusreportassist)
w('refusal.ASSISTANT_DRAFT_UNAVAILABLE', 'The assistant can\'t draft this report for you right now. The plan\'s items are listed below: write the report from them, as you would without the assistant.', False, 'answers carrying R8\'s items')
w('statusreport.assist.label', 'A first draft by the assistant, from the plan\'s items. Each line cites what it rests on; edit it, then save it as yours.', True, 'machine work, labeled until saved (statusReportSave\'s from)')

# --- A run on a member's own sign-in (N919, K2892; the dock's "Work on this", control-plane's door)
w('ai.run.ownsignin', 'This run works on your own Claude sign-in, for you alone. What it produces is labeled machine work and changes nothing until a member acts on it.', True, 'shown before "Work on this" starts on a member\'s own sign-in')
w('refusal.MEMBER_RUN_MODE_NOT_ADMITTED', 'A run on your own Claude sign-in can check or plan, and this one asks for more.' + NS + ' A project\'s or the team\'s account can run it, where one serves you.', False, 'ai-runs R18 (K2920): any mode other than check or plan on a member\'s own sign-in')

# --- Joining through the team's website (members; N654: membership's read of the key's and link's settings and history)
w('members.websitekey.live', 'Website key: live. Lets in up to {cap} people a day, as {capabilities}, until {expires}. Created by {member} on {date}.', True, 'says who may join and see the team\'s shared work')
w('members.websitekey.none', 'No website key. Your website can\'t invite anyone until an administrator creates one.', False)
w('members.joinlink.live', 'Reusable join link: on. Up to {cap} people a day may join with it, as {capabilities}, until {expires}. Turned on by {member} on {date}.', True)
w('members.joinlink.off', 'Reusable join link: off. Only invitation links an administrator makes let people join.', False)
w('members.join.today', '{n} of {cap} joined through it today.', False)
w('members.join.history.entry', '{date} · {member} {change}', False, '{change} one of label.joinchange.*')
for k, t in [('keycreated', 'created the website key'), ('keychanged', 'changed the website key\'s settings'), ('keyrevoked', 'revoked the website key'),
             ('linkon', 'turned the join link on'), ('linkchanged', 'changed the join link\'s settings'), ('linkreplaced', 'replaced the join link'), ('linkoff', 'turned the join link off')]:
    w(f'label.joinchange.{k}', t, False)

# --- The front doors (wizard-scripts R23 doors; canon BIO_Investigation §7, Bob's D52: one door, "What happened?")
w('door.front.head', 'What happened?', False, 'Home; the one door for every first step')
w('door.front.intro', 'Choose what fits, or describe it in your own words. Nothing here is the one right way in.', False)
for k, n, h in [('problem', 'A problem I live with', 'Potholes, dumping, a bill, a service'), ('person', 'A person', 'An official, a name in the news'),
                ('money', 'A payment or contract', 'A budget line, a lease, a change order'), ('read', 'Something I read', 'A code, a court case, a story, minutes'),
                ('tip', 'A tip or documents', 'Something someone handed you')]:
    w(f'door.front.{k}.name', n, False); w(f'door.front.{k}.hint', h, False)
w('door.front.matching', 'Already in your team: {items}', False, 'existing work that matches what the member wrote')
w('door.front.blank', 'None of these: start a project from a blank page.', False)

# --- The cards' "Here:" lines (DEC-160): why a thing matters on this screen, said only from a relation the screen knows;
#     with none, a card says what the thing is and draws no Here: line (never a generic one).
for k, t in [
    ('project.waiting', '{n} items in it wait on you.'),
    ('project.mainquestion', 'The project\'s main question, and the one closest to the bar.'),
    ('held.waits', 'Held until a member vouches for it; {question} waits for it.'),
    ('held.vouch', 'Held until a member vouches for it. Until then it supports nothing.'),
    ('held.crucial', 'It carries a finding in {project}, so it gets its own look.'),
    ('held.withheld', 'Can\'t be released here: part of it is withheld by its source.'),
    ('held.archive', 'Its {n} files wait here beside it; vouching for the archive doesn\'t vouch for them.'),
    ('setaside', '{member} set it aside on {date}; the reason, “{reason}”, stays on the record.'),
    ('cited.support', 'Cited by {member} as support for this question.'),
    ('cited.against', 'Cited by {member} as cutting against this question.'),
    ('standard', 'The standard this question tests {office} against.'),
    ('calculation.rerun', 'Anyone can rerun it from {source} and get the same result.'),
    ('calculation.inputchanged', 'One of its inputs changed: check whether the result still holds.'),
    ('input.changed', 'The input that changed.'),
    ('checked', 'Checked {thing} on {date}.'),
    ('testimony', '{member}\'s own account, recorded {date}: testimony, grade {grade}.'),
    ('search.match', 'What your search matched: {where}.'),
    ('answer.source', 'This answer counts from it.'),
    ('answer.calculation', 'The same count as {calculation}: open it to see the method rather than rely on this answer.'),
    ('action.reply', 'Its reply decides the next step of {plan}.'),
    ('due.reply', 'If no reply is recorded by then, your queue says so once.'),
    ('queue.project', 'Waiting on you here: {items}.'),
    ('machine', 'What the assistant does with it is labeled machine work; only a member\'s act changes the record.'),
    ('inbox.doorbell', 'Everything here came through it, so the sender may be anyone.'),
    ('version.newer', 'A newer version exists: decide whether it changes what {case} says.'),
    ('person.unfollowed', 'Named here, but not a person your team follows yet.')]:
    w(f'ref.here.{k}', t, False, 'a card\'s Here: line')

# --- notice-producers' items still unkeyed (N889: R5, R6, R13-R15); never a violation, never a finding
w('queue.temporal-expectation-due.overdue.summary', 'Nothing recorded by {date}: {duty}', False, 'R5, state overdue (after the latest due date)')
w('queue.temporal-expectation-due.overdue.detail', '{office} was due to {what} by {date} ({basis}). Nothing in the record shows it was done. This is what the record shows, not a finding that a rule was broken.', True)
w('queue.temporal-expectation-due.undetermined.summary', 'Possibly overdue: {duty}', False, 'R5, state undetermined (between candidate dates)')
w('queue.temporal-expectation-due.undetermined.detail', 'Possibly overdue: undetermined, because {reason}. {office} was due to {what} between {from} and {to} ({basis}).', True)
w('queue.inquiry-recheck-due.summary', 'Look again: {question}', False, 'R6; only the member who set the wait')
w('queue.inquiry-recheck-due.detail', 'You set today to look again at what {question} waits on: {what}, from {who}, by {date}. Record a look, set a new date, or remove the wait. Only you are told.', False)
w('queue.policy-changed-noticed.summary', 'Changed without notice: {policy}', False, 'R13')
w('queue.policy-changed-noticed.detail', 'Changed without notice: the text differs from the copy captured on {date}, and no amendment was announced.', True, 'DEC-145 (5), exactly')
w('queue.scan-found.summary', 'A scan found something in {document}', False, 'R14; names no member')
w('queue.scan-found.detail', '{engine} found {names} in this file on {date}: {meanings}. The file is held: its safe view stays open, and the original opens again only when two members each release the hold with a reason, or when a second, different scanner finds it clean. The machine never can.', True)
w('queue.security-tool-off.summary', 'Switched off: {tool}', False, 'R15; administrators only')
w('queue.security-tool-off.detail', '{tool} was switched off because it didn\'t confirm the private mode its handling requires. It stays off until an administrator tests it again.', False)

# --- B154 (DEC-199): escalation's rows (N962) and the new reads' help lives in mock-acts.js
w('refusal.ESCALATION_BY_ACT_ONLY', 'An escalation changes only through its own acts: open, attach, evaluate, advance, decline, suspend, resume, stop pursuing, reopen and end, so its record never disagrees with itself.' + ' Nothing was written.', False, 'C-116.41; DEC-199')
w('refusal.ALREADY_ATTACHED', 'This action is already attached to an escalation. An action is attached to one escalation, at one stage.' + ' Nothing was written.', False, 'C-116.14; DEC-199; names no escalation the viewer may not see')

HERE = os.path.dirname(os.path.abspath(__file__))
keys = [x['key'] for x in W]
assert len(keys) == len(set(keys)), 'duplicate key'
json.dump(W, open(os.path.join(HERE, 'words-t46.json'), 'w'), indent=1, ensure_ascii=False)
print(f'words-t46.json: {len(W)} entries, {sum(x["protected"] for x in W)} protected')
