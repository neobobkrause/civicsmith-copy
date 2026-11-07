# The words T47 owes the design stream (DEC-200; BOB's B156, B157; DEC-201, B158, B159).
# Each entry: (key, English, protected, note). Refusals say what happened, then what to do (DEC-83). Placeholders in {braces}
# are filled by the screen. Run build_words.mjs after editing: it reads words-t47.json, which this file writes.
# Run: python3 docs/development/ux-substrate/screens/words-t47.src.py
import json, os
W = []
def w(key, en, prot=False, note=''):
    W.append(dict(key=key, en=en, protected=prot, note=note))
NS = ' Nothing was sent.'
NC = ' Nothing was changed.'

# --- Watching an address (monitoring R74: monitorset turns watching on or off; monitor checks once)
w('refusal.MACHINE_CANNOT_SET_MONITORING', 'Only a member turns watching on or off, and this came from an automated credential.' + NC, False, 'C-18.20')
w('refusal.MONITOR_SET_REFUSED', 'Say whether this document is watched, yes or no, and, if you give one, how often, as one of the listed frequencies ({field} isn\'t).' + NC, False, 'C-18.21, naming the field')

# --- A project's own bar (strength R40)
w('refusal.PROJECT_BAR_NO_REASON', 'Setting this project\'s bar needs your reason, kept on the record with the change.' + NC, False, 'C-107.4')

# --- The safe view's queue (file-safety R43)
w('refusal.RENDER_QUEUE_UNREADABLE', 'Your team\'s Civicsmith couldn\'t read its list of files waiting for a safe view, so none was made just now. Try again in a moment; if it keeps happening, tell an administrator.', False, 'C-140.43; a safe view is installed but its queue could not be read')

# --- Settings (record-core R25, R26)
w('refusal.SIGNINTRACE_NOT_TEST', 'This team\'s Civicsmith keeps a trace of sign-ins only while it runs as a test instance, and this one does not. Nothing was read or changed.', False, 'C-69.7; BOB\'s B174 (3)')
w('refusal.SETTING_INVALID', 'That isn\'t a value this setting takes. Choose one of the setting\'s own values.' + NC, False, 'C-102.32')
w('refusal.SETTING_NOT_JSON', 'That value can\'t be kept as a setting: a setting holds words, numbers, yes or no, or a list of those.' + NC, False, 'C-102.33')

# --- A run on a member's own sign-in (credentials R63)
w('refusal.AI_RUN_CREDENTIAL_MALFORMED', 'The run couldn\'t start: the pass it needs to work for you was malformed.' + NS + ' Try again; if it happens again, tell an administrator.', False, 'C-29.41')

# --- Writing help on a test instance (screens-settings R6, N984)
w('ai.label.untested.writinghelp', 'Not yet tested: this help with writing has not yet passed Civicsmith\'s tests on real matters. Read it through before you use any of it.', True, 'on writinghelp\'s marked answer on a test instance')

# --- The way in (DEC-201; B158, B159): signing in and out, recovery, claiming, joining
w('refusal.SIGN_IN_REFUSED', 'That handle and password don\'t match. Check both and try again; after several tries, sign-in pauses for a while to keep others from guessing.', False, 'credentials R4; never says which handles exist')
w('refusal.SIGN_IN_PAUSED', 'Sign-in is paused for a while after too many tries. This keeps others from guessing passwords; it isn\'t a judgment on you. Wait a while, then try again. The limit: {stated}.', False, "credentials R38; DEC-436 (B525): {stated} the plane's bound as credentials R38 states it; no time, since neither tells which count was full")
w('refusal.RECOVERY_REFUSED', 'That didn\'t work: the handle, the code or both aren\'t right, or the code was already used. Check them and try again.' + NC, False, 'credentials R47; one answer for every arm')
w('refusal.NOT_SIGNED_IN', 'You aren\'t signed in here any more: your sign-in ended, or you signed out on another device. Sign in again to go back to where you were.', False, 'credentials R39')
w('refusal.PASSWORD_TOO_SHORT', 'A password needs at least 12 characters. A short sentence you can remember works well.' + NC, False)
w('refusal.CURRENT_PASSWORD_WRONG', 'Your current password isn\'t right, so it wasn\'t changed. Check it and try again.', False, 'credentials R3')
w('refusal.ALREADY_CLAIMED', 'Your team\'s Civicsmith already has its first administrator, so this one-time password no longer works. If that was you, sign in instead.', False, 'credentials R1')
w('refusal.NO_SUCH_INVITATION', 'This invitation link doesn\'t work: it may have been used, passed its seven days, or been withdrawn. Ask whoever sent it for a new one.', False, 'one answer for each arm')
w('refusal.NO_SUCH_JOIN_LINK', 'This join link doesn\'t work: it may have been replaced or turned off. Ask the team for its current link.', False, 'membership R104; one answer for each arm')
w('refusal.JOIN_LINK_DAILY_CAP', 'The team\'s join link has let in as many people as it allows today. Try again tomorrow.', False)
w('refusal.NO_COVER', 'Say the name the team will know you by. Only its administrators see it.' + NC, False)
w('session.signedout', 'You are signed out on this device. Your work is saved in your team\'s Civicsmith, not here.', False, 'the front door after signing out')
w('session.ended', 'You were signed out after a while away, so nobody else at this device can use your sign-in. Sign in again to go back to the page you were on.', False, 'D3 (K3061): 15 minutes idle on a shared device; 12 hours on one kept signed in')
w('session.locked', 'Locked after 30 minutes away. Enter your password to go on where you were; nothing was lost.', False, 'D3 (K3061): a device kept signed in')
w('session.reauth', 'For this, enter your password again: signing or publishing a case, changing administrators and connecting Claude always ask.', True, 'D3 (K3061)')
w('session.keep', 'My own: keep me signed in (it locks after 30 minutes away; you sign in again after 12 hours)', False, 'D3 (K3061)')
w('session.shared', 'Shared or public: sign me out after 15 minutes away', False, 'D3 (K3061)')
# signin.founderhint withdrawn (DEC-230; K3265, screens-entry R12): no word tells anyone a handle.

# --- Signing inside the ceremony (DEC-207; Bob's D9, K3060; Q4). Protected: words before and around a signed, outward act.
w('signing.ceremony.who', 'You sign as {signer}, an owner of {project}. The public page will read “Published by {group} · signed by {signer}”. Once public, anyone can read it and check your signature without asking the team; it can be corrected by a new edition, never removed.', True, 'the sign step')
w('signing.ceremony.device', 'Your device is asking you to confirm with your signing key: its own window asks for your passphrase, fingerprint or device PIN. The key never leaves this device, and Civicsmith never sees it.', True, 'while the device confirms')
w('signing.ceremony.declined', 'Your device did not confirm, so nothing was signed or published. Everything is as it was; sign again when you are ready.', True, 'device canceled or failed')
w('signing.ceremony.signedat', 'Signed. Edition {edition} becomes public on {date} at {time} ({zone}). Until then it waits, not public. At that time Civicsmith checks again and publishes only if nothing changed since you signed.', True, 'publishat done')
w('signing.ceremony.signednow', 'Signed and published. Edition {edition} is public now: anyone can read it and check your signature without the team.', True, 'caseratify done')
w('signing.ceremony.nokey', 'You have no signing key in this browser. Register one here: it is made on this device and never leaves it, and every use asks you to confirm. Then you come back to this step, with nothing lost.', True, 'NO_ATTESTING_KEY before signing')
w('signing.ceremony.keepkey', 'Keep this key on this device, so you can sign here again without loading it. Leave this unticked on a computer others use: you then load your key file each time you sign.', True, 'K3079: kept only when the member chooses')
w('signing.ceremony.notowner', 'Only an owner of {project} signs its cases: {owners}. Everything you prepared stays as it is. Ask one of them to sign.', True, 'CASE_SIGNER_NOT_AN_OWNER before signing')
w('signing.ceremony.phone', 'Signing and publishing finish on a larger screen. Everything here can be read on a phone. Open {project} on a computer to sign: the ceremony is where you left it.', True, 'principle 8.6')


HERE = os.path.dirname(os.path.abspath(__file__))
keys = [x['key'] for x in W]
assert len(keys) == len(set(keys)), 'duplicate key'
json.dump(W, open(os.path.join(HERE, 'words-t47.json'), 'w'), indent=1, ensure_ascii=False)
print(f'words-t47.json: {len(W)} entries, {sum(x["protected"] for x in W)} protected')
