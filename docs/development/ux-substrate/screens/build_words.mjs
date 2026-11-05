import { readdirSync } from 'node:fs';
// The interface's word list for translation (DEC-157, DEC-179; BOB's B90 for N669 and N670): every fixed word and phrase
// the member screens use, each with the stable key a translation is known by and whether it is protected (DEC-157 (4)).
// Read from the same sources the mockups are drawn from, so the list cannot drift from the screens:
// mock-acts.js (ACT_HELP), mock-kit.js (WNAME, WEIGHT, OUTWARD, the draft labels), mock-shell.js (RAIL, TABS, the guide),
// mock-refs.js (SCREEN_HELP, RAIL_HELP, COL_HELP), page.src.html (the marks' explanations), registry.json (screen and act
// names), library.json (Civicsmith's wizard scripts). Sentences on a screen that carry its data (names, counts, dates) are
// not here: they become keyed strings with placeholders when each screen is built, under the same key scheme and rules.
// Run: node docs/development/ux-substrate/screens/build_words.mjs   (writes words.json beside it; fails on any drift)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = f => fs.readFileSync(path.join(HERE, f), 'utf8');
const fail = m => { console.error('build_words: ' + m); process.exit(1); };

// the mockup scripts, evaluated as the page evaluates them (functions that touch the DOM are never called here)
const ctx = vm.createContext({ console, CSS: { escape: s => s } });
const js = ['mock-acts.js', 'mock-kit.js', 'mock-screens.js', 'mock-shell.js', 'mock-refs.js'].map(R).join('\n')
  + '\n;globalThis.__W = { ACT_HELP, WNAME, WSHOW, WEIGHT, OUTWARD: [...OUTWARD], RAIL, TABS, SCREEN_HELP, RAIL_HELP, COL_HELP, WRITE_ACT, KINDS, GRAPH_WORDS, NODE_KIND, USAGE_WORDS };';
vm.runInContext(js, ctx);
const W = ctx.__W;
const page = R('page.src.html');
const shell = R('mock-shell.js');
const kit = R('mock-kit.js');
const g0 = page.indexOf('var G = {'), g1 = page.indexOf('window.CS_LEVEL', g0);
if (g0 < 0 || g1 < 0) fail('the marks table (var G) was not found in page.src.html');
const G = vm.runInNewContext('(' + page.slice(g0 + 'var G = '.length, g1).trim().replace(/;\s*$/, '') + ')');
const reg = JSON.parse(R('registry.json')).screens;
const lib = JSON.parse(R('library.json')).scripts;

const plain = s => String(s).replace(/<span class=["']?more["']?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const words = [];
const seen = new Set();
const T49 = JSON.parse(R('words-t49.json'));
const retiredSeen = new Set(), rewriteSeen = new Set();
// DEC-259: the remaining screens' drawn words, written by words-drawn.src.py; its rewrites apply like T49's, to any row
const DRAWN = JSON.parse(R('words-drawn.json'));
const drawnSeen = new Set();
// DEC-281 (K3472): "team", never "group", names the people of one Civicsmith in every word people read; identifiers ({group},
// group-identity) keep "group". These rows keep the word in another sense: a grouping of reasons, legs or cases, or a kind of
// organization in the world (a community group, neighborhood groups).
const TEAM_WORD = /(^|[^{\w.-])[Gg]roups?\b(?![}\w-])/;
const GROUP_SENSE = /^(refusal\.PARTITION_INDEPENDENCE_\w+|citation\.index\.repair_add_to_group|inquiry\.next\.group_strength_weakest|calculations\.(says\.group_two_like|why\.act_undetermined_falls|why\.groups_act_like)|basis-versions\.(claimed|unclaimed|unstated)|entity\.relation\.kind\.help|screen\.group-identity\.kind\.(community|issue|professional)|screen\.site\.line2|public-read\.neighborhood_issue_groups|refusal\.ADDRESSEE_REFUSED|refusal\.(BAD_TERMS|NO_PARTITION|BAD_PARTITION|BAD_STATEMENT)|action-grammar\.checks\.copied_i_is_not_a|ai-use\.index\.a_limit_s_owner_is|ai-use\.index\.an_estimate_is_for|ai-use\.index\.exploring_is_approved_for|ai-use\.index\.limits_are_read_for|ai-use\.index\.the_use_names_no_paying|ai-use\.index\.use_is_read_for|ai-use\.index\.use_over_time_is_read_for|calc-grammar\.recipe\.why_its_groups_sum_is|calculations\.application\.the_share_of_each|case-authoring\.document\.axis_group_ground_state|court-citations\.translate\.back_reference_to_v1_before|inquiry\.index\.basis_raw_is_claimed_by|inquiry\.index\.grounds_i_legs_must_be|inquiry\.index\.grounds_i_legs_names_ord|inquiry\.index\.pass_grounds_an_array|inquiry\.index\.the_structure_this_would_author|link-sweep\.sweep-match\.a_closes_no_group|link-sweep\.sweep-match\.a_named_group_s|link-sweep\.sweep-match\.an_unclosed_group|link-sweep\.sweep-match\.an_unclosed_group_name|link-sweep\.sweep-match\.an_unopened_group|link-sweep\.sweep-match\.escape_refers_back_to_a|link-sweep\.sweep-match\.the_group_k|link-sweep\.sweep-match\.v1_is_not_a_group|promotion\.index\.this_store_records_no_producing|query-language\.query\.select_name_as_field_fieldref|skills\.skilldoctrine\.an_action_is_addressed_to|skills\.skilldoctrine\.the_count_a_run_publishes|strength\.index\.a_standard_of_evidence_is_a_property_of_a_project|strength\.index\.group_carries_no_name|strength\.index\.group_lists_no_reasons|strength\.index\.group_names_something_other_than_a_position|strength\.index\.groups_name_is_longer_than_200_characters|strength\.index\.groups_were_proposed_and_a_written_reading_holds|strength\.index\.is_not_a_question_so_it_has_no_reasons|strength\.index\.no_question_by_that_id_is_readable_no_reasons|strength\.index\.pass_partition_a_non_empty_list_of_groups|strength\.index\.reason_positions_are_in_no_group|strength\.index\.two_groups_are_both_named)$/;
const add = (key, en, prot, source, note) => {
  if (T49.retired.includes(key)) { retiredSeen.add(key); return; }   // DEC-256: withdrawn by the requirements
  if (key in T49.rewrite) { rewriteSeen.add(key); en = T49.rewrite[key]; note = (note ? note + '; ' : '') + ((T49.rewrite_dec || {})[key] || 'DEC-256') + ': reworded'; }
  if (key in DRAWN.rewrite) { drawnSeen.add(key); en = DRAWN.rewrite[key]; note = (note ? note + '; ' : '') + 'DEC-259: reworded'; }
  if (seen.has(key)) fail('duplicate key ' + key);
  if (!en || !String(en).trim()) fail('empty text for ' + key);
  seen.add(key);
  if (/\b(DEC|K)-?\d{2,4}\b|\bN\d{3}\b/.test(plain(en))) fail(`an internal code in member words: ${key}`);
  if (TEAM_WORD.test(plain(en)) && !GROUP_SENSE.test(key)) fail(`"group" where a member reads "team" (DEC-281, K3472): ${key} (team_words.py rewrites it; a grouping or a kind of organization goes in GROUP_SENSE)`);
  words.push({ key, en: plain(en), protected: !!prot, source, ...(note ? { note } : {}) });
};
// a phrase written here by hand must appear, word for word, in the source it names (a drift guard)
const must = (src, name, s) => { if (!src.includes(s)) fail(`"${s}" is no longer in ${name}`); return s; };
const opkey = op => op.startsWith('owed:') ? 'owed_' + op.slice(5).split(' ')[0] : op;
const weightOf = op => W.WEIGHT[opkey(op)] || 2;

// 1. Weights: the five names and what each means (protected: the weights, DEC-157 (4))
W.WNAME.forEach((n, i) => { if (!i) return; add(`weight.${n.toLowerCase()}.name`, W.WSHOW[n] || n, true, 'mock-kit.js WNAME, WSHOW'); });
for (const [n, t] of Object.entries(G.weight)) add(`weight.${n.toLowerCase()}.means`, t, true, 'page.src.html marks');
add('weight.dots.means', must(page, 'page.src.html', 'The dots show how much an act weighs, from two to five. A button without dots does something you can undo.'), true, 'page.src.html marks; S26 (DEC-295): said once, the first time a member opens a marked button\'s explanation');

// 2. The marks: fixed terms (protected)
for (const [k, [name, means]] of Object.entries(G.scale)) {
  add(`mark.scale.${k}.name`, name, true, 'page.src.html marks');
  add(`mark.scale.${k}.means`, means, true, 'page.src.html marks');
}
add('mark.grade.reading', must(page, 'page.src.html', 'A is easiest to check; D rests on a person\\\'s word. A grade never says whether something is true.').replace(/\\'/g, "'"), true, 'page.src.html marks');
for (const [k, t] of Object.entries(G.gap)) { add(`mark.gap.${k}.name`, (t.match(/<b>([^<]+)<\/b>/) || [])[1], true, 'page.src.html marks'); add(`mark.gap.${k}.means`, t, true, 'page.src.html marks'); }
for (const [k, t] of Object.entries(G.origin)) { add(`mark.origin.${k}.name`, (t.match(/<b>([^<]+)<\/b>/) || [])[1], true, 'page.src.html marks'); add(`mark.origin.${k}.means`, t, true, 'page.src.html marks'); }
for (const [k, t] of Object.entries(G.kind)) { add(`mark.kind.${k}.name`, (t.match(/<b>([^<]+)<\/b>/) || [])[1], true, 'page.src.html marks'); add(`mark.kind.${k}.means`, t, true, 'page.src.html marks'); }
for (const [k, t] of Object.entries(G.path)) add(`mark.path.${k.toLowerCase().replace(/\s+/g, '-')}.means`, t, true, 'page.src.html marks');
const fixed = [
  ['mark.strength.means', 'An answer is only as strong as the weakest thing it depends on'],
  ['mark.due.means', 'counted on your team\\\'s local day.'],
  ['mark.hint.means', 'something the machine marked worth a look, with how it was found and out of how many. A lead, never a finding.'],
  ['mark.hunch.means', 'a member\\\'s suspicion, labeled as one. Never evidence, and it never moves a finding.'],
  ['mark.outward.means', 'this leaves your team\\\'s Civicsmith. Someone outside will see it.'],
  ['mark.band.means', 'this band says who can see what you are working on.'],
];
const tipLine = (key, frag) => {
  must(page, 'page.src.html', frag);
  const i = page.indexOf(frag), a = page.lastIndexOf("'", i - 1), b = page.indexOf("'", i + frag.length);
  // the whole quoted string the fragment sits in, as tipFor returns it
  let s = page.slice(a + 1, b);
  while (s.endsWith('\\')) { const c = page.indexOf("'", b + 1); s = page.slice(a + 1, c); }
  return s.replace(/\\'/g, "'");
};
for (const [key, frag] of fixed) add(key, tipLine(key, frag), true, 'page.src.html marks');
add('mark.tag.protected.means', tipLine('', 'it protects members, so a change to it needs a second check before it shows'), true, 'page.src.html marks');
add('mark.tag.local-name.means', tipLine('', 'the official name stays as it is, with an explanation in the member'), true, 'page.src.html marks');
add('mark.hint.label', must(kit, 'mock-kit.js', 'Hint · machine work'), true, 'mock-kit.js hint');
add('mark.kind.todo.label', 'To do', true, 'mock-kit.js kindm');
add('mark.kind.noticed.label', 'Noticed', true, 'mock-kit.js kindm');
add('mark.kind.status.label', 'Status', true, 'mock-kit.js kindm');
for (const p of ['Working', 'Shared for review', 'Published']) add(`mark.path.${p.toLowerCase().replace(/\s+/g, '-')}.name`, must(kit, 'mock-kit.js', `'${p}'`).slice(1, -1), true, 'mock-kit.js pathm');

// 3. The ordinary states (DEC-98): one vocabulary everywhere ("Undetermined, because…" is a fixed term, protected)
add('state.empty', 'Nothing here', false, 'DEC-98');
add('state.loading', 'Still loading', false, 'DEC-98');
add('state.failed', 'Could not read this, because {reason}', false, 'DEC-98', 'the reason always follows');
add('state.undetermined', 'Undetermined, because {reason}', true, 'DEC-98', 'the reason always follows');

// 4. Labeled drafts (DEC-120 G5, DEC-153): who wrote what is in a field
for (const [k, s] of [['machine', 'Draft by the assistant, at your request · edit it until it is yours'], ['template', 'Draft from your team\\\'s template · edit it until it is yours'], ['wizard', 'Draft from the wizard · edit it until it is yours']])
  add(`draft.${k}.label`, must(kit, 'mock-kit.js', s).replace(/\\'/g, "'"), false, 'mock-kit.js field');
add('draft.writing-help.act', 'Help me write this', false, 'mock-kit.js writeHelp');

// 4a. Photos in a published case (DEC-180, DEC-183): the reminder, the copy's label and the Photos step's words (protected: they say
//     who can see something)
const scr = R('mock-screens.js');
add('photo.reminder', must(scr, 'mock-screens.js', 'Frame what you are checking, and leave out people\\\'s faces and number plates where you can. If a published case carries this photo, anyone in it who is not part of a finding, and any number plate, is obscured in the public copy; the original stays inside your team.').replace(/\\'/g, "'"), true, 'mock-screens.js PHOTO_REMINDER');
add('photo.obscured.label', must(scr, 'mock-screens.js', 'Faces, plates and camera details removed for publication; the team holds the original'), true, 'mock-screens.js ceremony', 'the label a published copy with marked areas carries');
add('photo.published.label', must(scr, 'mock-screens.js', 'Camera details removed for publication; the team holds the original'), true, 'mock-screens.js ceremony', 'the label every other published photo carries (K2248)');
add('photo.step.gate', must(scr, 'mock-screens.js', 'Every photo the case carries must be checked before signing, including one that only supports a finding: marked, or “nothing to obscure”. A mark that covers the wrong thing is withdrawn with a reason, never erased. Text read from a photo, such as a number plate, is never published with it; a passage you quote in the case still is.'), true, 'mock-screens.js ceremony');
add('photo.state.nothing', must(scr, 'mock-screens.js', 'nothing to obscure'), true, 'mock-screens.js ceremony');
add('photo.refused.format', 'This photo\'s format can\'t be obscured: {photo}. Capture it again as an ordinary photo, or stop relying on it.', true, 'DEC-183', 'PHOTO_NOT_COVERABLE');
add('photo.refused.changed', 'A mark changed after this case was prepared. Prepare it again before signing.', true, 'DEC-183', 'PHOTO_MARKS_CHANGED_SINCE');
add('photo.refused.unchecked', 'Signing waits until every photo in the case is checked, including one that only supports a finding: {photo}.', true, 'DEC-183', 'the Photos step as a gate');
add('photo.refused.changed.signed', 'This case wasn\'t published: a mark on {photo} changed after it was prepared. Prepare it again, and sign it again.', true, 'DEC-187', 'PHOTO_MARKS_CHANGED_SINCE at the commit or a scheduled stop, after signing');
add('photo.withdraw.refused.machine', 'Only a member can withdraw a mark; the machine never can.', true, 'DEC-187', 'obscuremarkwithdraw by a machine');
add('photo.withdraw.refused.nomark', 'There is no such mark on {photo}. Open the photo again to see the marks that stand.', true, 'DEC-187', 'obscuremarkwithdraw: no such mark');
add('photo.withdraw.refused.already', '{member} already withdrew this mark on {date}.', true, 'DEC-187', 'obscuremarkwithdraw: already withdrawn');
add('photo.withdraw.refused.noreason', 'Say why you are withdrawing this mark. Your reason is kept beside it.', true, 'DEC-187', 'obscuremarkwithdraw: no reason');

// 4b. Choosing a handle (DEC-184): what the field says as a member types
add('handle.free', '{handle} is free in {group}', false, 'mock-screens.js join');
must(scr, 'mock-screens.js', 'mai-k is free in Lakeshore Tenants');
add('handle.taken', '{handle} is already taken in {group}. Try another, such as {suggestion}.', false, 'mock-screens.js join');
must(scr, 'mock-screens.js', 'is already taken in Lakeshore Tenants. Try another, such as');
add('handle.changeable', 'You can still change it: none of your work is in a published case yet.', false, 'DEC-186; kept until handlechange is retired (DEC-197)');
add('handle.fixed', 'Your handle can\'t be changed: it names your work for good, and no one else can ever take it.', false, 'DEC-197 (was DEC-186); kept while membership reads it');
add('handle.formerly', 'formerly {handle}', false, 'DEC-186; kept until handlechange is retired (DEC-197)');
add('handle.characters', 'A handle uses only lowercase letters, digits and hyphens.', false, 'mock-screens.js join');
must(scr, 'mock-screens.js', 'A handle uses only lowercase letters, digits and hyphens');

add('handle.refused.paused', 'Too many handles checked in a short time. Try again in {minutes} minutes.', false, 'DEC-188', 'HANDLE_CHECK_PAUSED');

// 4c. AI accounts and limits (DEC-188; N812): who pays, what for, up to what; protected where they say who sees what
add('ai.whopays', must(scr, 'mock-screens.js', 'For a member\\\'s act in a project that has its own AI account, that project\\\'s account pays. Otherwise the member\\\'s own account, if they connected one; otherwise the team\\\'s key. The account chosen is the one used: if it has reached a limit, or that use is switched off on it, the assistant stops for that act and says whose setting stopped it.').replace(/\\'/g, "'"), true, 'mock-screens.js AI_WHO_PAYS');
for (const [k, name] of [['ask', 'Asking'], ['draft', 'Drafting'], ['run', 'Working through checks and plans'], ['standing', 'Standing questions'], ['enquire', 'Interviews and planning'], ['read', 'Reading inside documents'], ['transcribe', 'Reading unclear pages'], ['account', 'Drafting a case\'s account'], ['explore', 'Exploring'], ['suggestions', 'Suggestions']]) add(`ai.use.${k}.name`, name, false, 'mock-screens.js AI_USES');
for (const [k, t] of [['no', 'No'], ['ask', 'Ask every day'], ['yes', 'Yes']]) add(`ai.explore.${k}`, t, false, 'mock-screens.js aiExplore');
add('ai.whose.group', 'your team\'s', false, 'DEC-188', 'whose, in the refusals');
add('ai.whose.project', 'this project\'s', false, 'DEC-188', 'whose, in the refusals');
add('ai.whose.own', 'your own', false, 'DEC-188', 'whose, in the refusals');
add('ai.refused.limit', 'The assistant stopped here: {whose} {period} limit for {use} is reached. It works again {when}. Everything else works as usual.', true, 'DEC-188', 'AI_LIMIT_REACHED, scope a use; {period} daily or monthly; never a cost');
add('ai.refused.limit.overall', 'The assistant stopped here: {whose} {period} limit is reached. It works again {when}. Everything else works as usual.', true, 'DEC-188', 'AI_LIMIT_REACHED, scope overall');
add('ai.refused.limit.member', 'The assistant stopped here: you have used the {period} amount each member may use of {whose} account. It works again {when}. Everything else works as usual.', true, 'DEC-188', 'AI_LIMIT_REACHED, scope per_member');
add('ai.refused.off', '{Use} is switched off on {whose} account, so the assistant can\'t do this here. {who} can switch it on.', true, 'DEC-188', 'AI_USE_SWITCHED_OFF; {who}: An administrator, An owner of this project, You');
add('ai.refused.projectkeptaway', 'This project keeps its material away from AI{for_uses}. {member} set this on {date}: “{reason}”. Everything else in the project works as usual.', true, 'DEC-188', 'PROJECT_AI_KEPT_AWAY; {for_uses} empty, or " for exploring"');
add('ai.refused.notsole', 'Your own sign-in can be a project\'s account only while you are its only member, and {project} has other members. Add an Anthropic API key for the project instead.', true, 'DEC-188', 'PROJECT_NOT_SOLE_MEMBER');
add('ai.disclosure.projectkey', must(scr, 'mock-screens.js', 'Your questions in Pothole repairs, and the material read to answer them, go to Anthropic under the project\'s API account. Its owners see how much is used in total, never what you ask or who asked.').replace(/\\'/g, "'").replace('Pothole repairs', '{project}'), true, 'mock-screens.js projectai', 'PROJECT_KEY_NOTICE_DUE shows it before the first act the key pays for');
add('ai.refused.noticedue', 'Before the assistant works on {project}\'s account, read what that means.', true, 'DEC-188', 'PROJECT_KEY_NOTICE_DUE');
add('ai.refused.switchvalue', 'That isn\'t a setting this switch takes: a use is on or off, and exploring is No, Ask every day or Yes.', false, 'DEC-188', 'SWITCH_VALUE_INVALID');
add('ai.refused.signinnotconnected', 'Connect your own Claude sign-in first, in Settings › The assistant; then it can serve this project.', false, 'DEC-188', 'SIGNIN_NOT_CONNECTED');
add('ai.refused.limitinvalid', 'That limit can\'t be set: {field}. A limit is a positive amount in dollars, tokens or calls, for a day or a month.', false, 'DEC-188', 'AI_LIMIT_INVALID');
add('ai.refused.unitunavailable', 'A limit in dollars needs an API key: a subscription doesn\'t report what a use costs. Set it in tokens or calls instead.', false, 'DEC-188', 'LIMIT_UNIT_UNAVAILABLE');
add('ai.refused.explorenotenabled', 'Exploring is off on {whose} account. Its owners can switch it on.', false, 'DEC-189', 'EXPLORE_NOT_ENABLED; an exploring limit is never required (ai-use R3): the overall limit judges exploring when no exploring limit is set');
add('ai.queue.limitreached', '{account} reached its {period} limit for {use} on {date}. It pauses {use} until {when}; its other uses go on.', true, 'DEC-189', 'the told-once Noticed item, scope a use; names no member; {when} from ai.until.*');
must(scr, 'mock-screens.js', 'reached its monthly limit for runs on October 12. It pauses runs until November 1; its other uses go on.');
add('ai.queue.suspended', must(scr, 'mock-screens.js', 'a second member joined, and a sign-in serves a project only while it has one member. Members\\\' acts there now use their own accounts, or the team\\\'s key.').replace(/\\'/g, "'").replace(/^/, 'Your sign-in no longer serves {project}: '), true, 'mock-screens.js queue', 'the project account suspended; names no member');
add('ai.queue.exploreask', 'The assistant found something worth exploring in {scope} today: {what}. Explore it today on {account}? If nobody says yes today, it doesn\'t.', false, 'DEC-188', 'the daily Ask, shown as Noticed with Explore today');
must(scr, 'mock-screens.js', 'If nobody says yes today, it doesn\\\'t.');
add('ai.label.explored', 'Machine work · found while exploring · enabled by {owner}', true, 'DEC-189', 'shown only to the paying account\'s owners (question-explorer R5); {owner}: the team, the project\'s name, or the member\'s handle');
add('ai.label.explored.member', must(scr, 'mock-screens.js', 'Machine work · found while exploring'), true, 'DEC-189', 'what every other member sees: which account paid, and who enabled it, are answered only to its owners');
add('ai.owner.group', 'the team', false, 'DEC-188', 'enabled_by for the team');

// 4c'. The fills of the AI sentences (DEC-189; BOB's B124 and B126): each placeholder above that names a fixed word has a key
for (const [k, t] of [['day', 'daily'], ['month', 'monthly']]) add(`ai.period.${k}`, t, false, 'DEC-189', '{period}');
add('ai.when.day', 'tomorrow', false, 'DEC-189', '{when} for a daily limit');
add('ai.when.month', 'on {month} 1', false, 'DEC-192', '{when} for a monthly limit, as in "It works again on November 1"; {month} from date.month.*; month before day, as date.daymonth (DEC-333)');
add('ai.until.day', 'tomorrow', false, 'DEC-192', '{when} after "until" in ai.queue.limitreached*, for a daily limit');
add('ai.until.month', '{month} 1', false, 'DEC-192', '{when} after "until" in ai.queue.limitreached*, for a monthly limit: "pause until November 1" (DEC-333)');
['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  .forEach(m => add(`date.month.${m}`, m[0].toUpperCase() + m.slice(1), false, 'DEC-189', 'a month\'s name in a sentence'));
add('ai.refused.limit.unjudged', 'The assistant stopped here: your team\'s Civicsmith couldn\'t check the use of {whose} account just now, and it spends nothing it can\'t count. Try again in a moment. Everything else works as usual.', true, 'DEC-189', 'AI_LIMIT_REACHED when the limit can\'t be judged (ai-use R3 failing closed); in place of a {period} and {when}');
for (const [k, t] of [
  ['owner', 'it doesn\'t say which account it is for'],
  ['scope', 'that isn\'t something a limit can cover'],
  ['unit', 'that isn\'t a unit a limit takes'],
  ['period', 'that isn\'t a period a limit takes'],
  ['amount', 'that isn\'t an amount a limit takes'],
  ['inclusive', 'only a limit on one use can be on top of the overall limit'],
  ['use', 'that isn\'t one of the assistant\'s uses'],
  ['count', 'the count is a whole number, one or more'],
]) add(`ai.limitfield.${k}`, t, false, 'DEC-189', '{field} in ai.refused.limitinvalid');
for (const [k, t] of [['ask', 'asking'], ['draft', 'drafting'], ['run', 'working through checks and plans'], ['standing', 'standing questions'], ['enquire', 'interviews and planning'], ['read', 'reading inside documents'], ['transcribe', 'reading unclear pages'], ['account', 'drafting a case\'s account'], ['explore', 'exploring'], ['suggestions', 'suggestions']])
  add(`ai.use.${k}.inline`, t, false, 'DEC-189', '{use} inside a sentence; {Use} at a sentence\'s start is ai.use.*.name');
add('ai.account.group', 'Your team\'s key', false, 'DEC-189', '{account} at a sentence\'s start');
add('ai.account.project', '{project}\'s account', false, 'DEC-189', '{account} at a sentence\'s start');
add('ai.account.own', 'Your own account', false, 'DEC-189', '{account} at a sentence\'s start');
add('ai.account.group.inline', 'your team\'s key', false, 'DEC-189', '{account} inside a sentence');
add('ai.account.project.inline', 'the project\'s account', false, 'DEC-189', '{account} inside a sentence');
add('ai.account.own.inline', 'your own account', false, 'DEC-189', '{account} inside a sentence');
add('ai.queue.limitreached.overall', '{account} reached its {period} limit on {date}. Uses counted in its overall limit pause until {when}; uses with their own limit on top of it go on.', true, 'DEC-189', 'the told-once Noticed item, scope overall; names no member; {when} from ai.until.*');
add('ai.queue.limitreached.member', '{account}: a member reached the {period} amount each member may use, on {date}. Their uses on it pause until {when}; other members\' go on.', true, 'DEC-189', 'the told-once Noticed item, scope per_member; names no member; {when} from ai.until.*');
add('ai.refused.exploreoutofscope', 'The assistant can\'t explore this question on {whose} account: it lies outside what the account\'s owners chose to explore.', false, 'DEC-191', 'EXPLORE_OUT_OF_SCOPE (C-143.5)');
add('ai.refused.exploreaskinvalid', 'Nothing was recorded: an ask to explore names the day and what is worth exploring that day.', false, 'DEC-191', 'EXPLORE_ASK_INVALID (C-143.6); ai-use\'s sentence kept');
add('date.daymonthyear', '{month} {day}, {year}', false, 'DEC-192', 'a local day not in the current year, such as March 3, 2027');
add('date.daymonth', '{month} {day}', false, 'DEC-191', 'a local day in a sentence, such as October 14; {month} from date.month.*; {date} in ai.queue.limitreached* and every queue item');
add('ai.scope.group', 'your team\'s work', false, 'DEC-189', '{scope} in ai.queue.exploreask for the team\'s key');
add('ai.scope.own', 'your own questions', false, 'DEC-189', '{scope} in ai.queue.exploreask for a member\'s own account; a project\'s is its name');

// 4c''. Queue items from steps, milestones, projects and reviews (DEC-189; BOB's B126 (2), notice-producers R17): each kind's
//     one-line summary and its detail, told once
for (const [k, sum, det, note] of [
  ['question-find', 'Found while looking into {question}: {what}', 'The assistant found this while looking into a question you can see. It is a lead, not evidence: it becomes evidence only if a member opens it, checks it and cites the source.', 'FINDING, Hint · machine work; labeled with ai.label.explored or ai.label.explored.member'],
  ['step-later-found', 'Found later: {what}', 'You looked for this on {date} and didn\'t find it; it has since arrived. Your earlier look stays as it was, dated. Open the step to say whether this changes what it shows for each question.', 'FINDING'],
  ['step-date-due', 'Past its date: {step}', 'You set {date} for this step, and it isn\'t done. Only you are told. Finish it, move the date, or end it with a reason.', 'OBLIGATION, to the member who set the date'],
  ['step-reminder', 'Your reminder: {step}', 'You asked to be reminded about this step today. Only you are told.', 'OBLIGATION, to the member who asked'],
  ['step-cost-shared', 'Shared work: {step}', 'This step\'s costs ({totals}) serve questions that {projects} each draw on. Its owners are told, so they can talk about sharing the cost; Civicsmith records no split and no payment.', 'FINDING, to the owners of each project'],
  ['step-cost-message', 'A message about the cost of {step}', '{member}, an owner of another project that draws on this step, wrote: “{text}”', 'FINDING, to the owners of each other project'],
  ['milestone-overdue', 'Overdue: {milestone}', 'This milestone was due on {date}. Everyone who joined the project is told once.', 'FINDING'],
  ['milestone-reminder', 'Your reminder: {milestone}', 'You asked to be reminded about this milestone today. Only you are told.', 'OBLIGATION, to the member who asked'],
  ['project-quiet', 'Quiet: {project}', 'Nothing has moved in this project for a while. Where it stands: {progress}. You can write it up and act, keep watching its sources, close it with what remains unknown, or revise what it set out to show. Nobody is asked again until it moves.', 'FINDING, to the project\'s joined members'],
  ['review-comment-left-out', 'Your comments were not included: {case}', 'The case was published without your review comments. You may file a response in its docket, as anyone may.', 'FINDING, to each reviewer who is a member'],
]) { add(`queue.${k}.summary`, sum, false, 'DEC-189', note); add(`queue.${k}.detail`, det, false, 'DEC-189', note); }
// 4c''''. The request left unsent (DEC-212; action-producers R25; BOB's B174 (1)): the reminder to whoever approved it, the line
//     others see, and its detail; {what} names the request as the wizard named it
add('queue.request-unsent.summary', 'You left a request unsent: {what}', false, 'DEC-212', 'to the member who approved it');
add('queue.request-unsent.summary.others', 'A request was left unsent: {what}', false, 'DEC-212', 'to every other member who can see the project');
add('queue.request-unsent.detail', 'Approved on {date}, not yet sent: nothing has gone to the office.', false, 'DEC-212');

// 4c'''. The assistant's reading of page pictures (DEC-190; BOB's B128, B129; extraction R71, C-51.7)
add('transcribe.refused.notdeployed', 'Nothing was read or sent: the assistant\'s reading of page pictures isn\'t switched on in your team\'s Civicsmith yet. Each part of the assistant is switched on only after it passes Civicsmith\'s test investigations. You can type a page\'s words yourself meanwhile.', false, 'DEC-190', 'TRANSCRIBE_NOT_DEPLOYED (C-51.7); names no account');
add('transcribe.label', 'The assistant\'s reading of the page image · undetermined until a member checks a passage against the page', true, 'DEC-190', 'the label on words from pagetranscribe (reading-pipeline R29\'s "the AI\'s reading")');
add('transcribe.none', 'The assistant read pages {pages} but found no words it could give: {why}', false, 'DEC-190', 'only when the assistant was asked and read nothing (DEC-191); {why} the reason as answered');
add('transcribe.notsent', 'Nothing was sent to the assistant: {why}. The pages are as they were.', false, 'DEC-191', 'agent-worker never asked: {why} from transcribe.why.*');
add('transcribe.why.unbound', 'the assistant can\'t be reached from your team\'s Civicsmith just now', false, 'DEC-191', 'AGENT_WORKER_UNBOUND');
add('transcribe.why.evidenceabsent', 'the document\'s stored copy can\'t be read just now', false, 'DEC-191', 'EVIDENCE_ABSENT');
add('transcribe.why.norender', 'none of these pages could be turned into an image the assistant can read', false, 'DEC-191', 'NO_PAGE_RENDERED');
add('transcribe.refused', 'The assistant didn\'t read these pages. {reason}', false, 'DEC-192', 'a refusal came back; {reason} the refusal\'s own sentence as relayed, a sentence of its own, its own placeholders filled by the screen from the fields beside it');
add('transcribe.failed', 'The pages were sent to the assistant, but no reading came back: {why}. Nothing was written; you can try again.', false, 'DEC-192', 'after the post: the worker silent or the provider ending; {why} from transcribe.why.silent or .ended');
add('transcribe.why.silent', 'it didn\'t answer in time', false, 'DEC-192', 'AGENT_WORKER_SILENT');
add('transcribe.why.ended', 'the AI service stopped before it finished', false, 'DEC-192', 'a provider ending');
add('transcribe.reason.requestfault', 'Your team\'s Civicsmith sent the assistant a request it couldn\'t use. That is a fault in your team\'s Civicsmith, not anything you did: try again, and if it happens again, tell an administrator.', false, 'DEC-193', '{reason} in transcribe.refused for BAD_BODY, BAD_SHA, BAD_PAGES (agent-worker R72)');
add('transcribe.reason.noaccount', 'No AI account pays for this here. Connect your own in Settings › The assistant, or ask an administrator about the team\'s key.', false, 'DEC-193', '{reason} for NO_ACCOUNT');
add('transcribe.reason.badaccount', 'The AI account that pays for this here can\'t be used as it is set up. Its owners can check it in its settings.', false, 'DEC-193', '{reason} for BAD_ACCOUNT');
add('transcribe.reason.needsapikey', 'Reading page pictures needs an Anthropic API key, and the account that pays here is a Claude sign-in. Its owners can add an API key; meanwhile you can type a page\'s words yourself.', false, 'DEC-193', '{reason} for TRANSCRIBE_NEEDS_API_KEY');
add('transcribe.picture.unprepared', 'This photo can\'t be prepared for the assistant: {why}. Take it again as an ordinary photo, or type its words yourself.', false, 'DEC-191', '{why} from transcribe.picture.why.*');
add('transcribe.picture.why.progressive', 'it is saved in a form the assistant can\'t open (a progressive JPEG)', false, 'DEC-191');
add('transcribe.picture.why.toolarge', 'it is too large', false, 'DEC-191');
add('capture.picture.unread', 'A photographed page, not read yet: its words can\'t be found or cited until the assistant reads it or a member types them.', false, 'DEC-191', 'a JPEG or PNG capture read as one picture page (N853b); the reading\'s fact, so said by the reading (extraction), never by capture\'s upload answer (DEC-192)');
add('transcribe.done', 'The assistant read pages {pages}. Their words can now be found; each passage stays undetermined until a member checks it against the page.', false, 'DEC-190', 'performed and written');
add('document.unread.pages', must(scr, 'mock-screens.js', 'are pictures of text that Civicsmith\\\'s own reading couldn\\\'t make out, so their words can\\\'t be found or cited yet. The page images are kept as they are.').replace(/\\'/g, "'").replace(/^/, 'Pages {pages} '), false, 'DEC-190', 'the Document screen\'s section, shown only when such pages exist');

// 4d. Supplied documents in a published case (BOB's drafts from T39, adopted as written; DEC-188)
add('document.cleaned.label', 'Details of who made this file, and of its pictures, removed for publication; the team holds the original', true, 'DEC-188', 'COPY_CLEANED_LABEL');
add('document.refused.changed', 'A document a member supplied now needs a different publication copy from the one this case was prepared with. Prepare the case again. Nothing was published.', true, 'DEC-188', 'DOCUMENT_COPY_CHANGED_SINCE');
add('document.refused.clean', 'A document a member supplied can\'t be cleaned of the details that could show who made it: {document}. Capture it from where it was published, supply a plainer copy, or stop relying on it.', true, 'DEC-188', 'DOCUMENT_NOT_CLEANABLE');
add('document.refused.pending', 'The publication copy of a document a member supplied is still being made: {document}. Try again in a few minutes.', false, 'DEC-188', 'DOCUMENT_COPY_PENDING');

// 4e. A question a project draws on (DEC-188; Bob's ruling that setting aside is each project's own)
add('question.refused.drawnon', 'This question can\'t be set aside for the whole team, because a project draws on it. Set it aside in your project instead; that leaves it as it is everywhere else.', false, 'DEC-188', 'DRAWN_ON_BY_A_PROJECT; names no project');

// 4i. Use over time and the connection graph (DEC-215): the kinds of connection and what each means (protected: they say what is
//     evidence and what is a lead, K1487), the graph's own words, and the usage bars' and meter's words (protected where they say
//     who sees what, K1450)
for (const [k, v] of Object.entries(W.KINDS)) { add(`connection.kind.${k}.name`, v.word, true, 'mock-screens.js KINDS'); add(`connection.kind.${k}.means`, v.means, true, 'mock-screens.js KINDS'); }
for (const [k, v] of Object.entries(W.NODE_KIND)) add(`connection.thing.${k}`, v, false, 'mock-screens.js NODE_KIND');
add('connection.graph.limit', W.GRAPH_WORDS.limit, true, 'mock-screens.js GRAPH_WORDS');
add('connection.graph.limit.means', W.GRAPH_WORDS.limitMeans, true, 'mock-screens.js GRAPH_WORDS');
add('connection.graph.trail.means', W.GRAPH_WORDS.trail, false, 'mock-screens.js GRAPH_WORDS');
add('connection.graph.grade.means', W.GRAPH_WORDS.grade, true, 'mock-screens.js GRAPH_WORDS');
add('connection.graph.center.means', W.GRAPH_WORDS.center, false, 'mock-screens.js GRAPH_WORDS');
add('connection.graph.click', W.GRAPH_WORDS.click, false, 'mock-screens.js GRAPH_WORDS');
add('connection.graph.trail.label', 'Trail', false, 'mock-screens.js graphInner');
add('connection.graph.legend.grade', 'the step\'s grade', false, 'mock-screens.js graphInner');
add('ai.usage.bars', W.USAGE_WORDS.bars, false, 'mock-screens.js USAGE_WORDS');
add('ai.usage.bars.means', W.USAGE_WORDS.barsMeans, true, 'mock-screens.js USAGE_WORDS');
add('ai.usage.meter.means', W.USAGE_WORDS.meterMeans, true, 'mock-screens.js USAGE_WORDS');
add('ai.usage.nolimit', W.USAGE_WORDS.noLimit, false, 'mock-screens.js USAGE_WORDS');
add('ai.usage.day', '{day} · {calls} calls · {dollars}', false, 'mock-screens.js usageBars', 'a bar\'s tooltip; "today, so far" is appended on the newest day');
add('ai.usage.today', 'today, so far', false, 'mock-screens.js usageBars');
add('ai.usage.summary', 'Last 30 days: {dollars}, {calls} calls · busiest {day}, {daydollars}', false, 'mock-screens.js usageBars');
add('ai.usage.meter', '{label}: {used} of the {limit} limit', false, 'mock-screens.js meter');
add('ai.usage.meter.near', 'near the limit', true, 'mock-screens.js meter');

// 4f. The Action layer's words for T45 (DEC-194; BOB's B140): written in words-actions.src.py, which writes words-actions.json
for (const x of JSON.parse(R('words-actions.json'))) add(x.key, x.en, x.protected, 'DEC-194', x.note || undefined);
// 4g. T46's words (DEC-198; BOB's B149): written in words-t46.src.py, which writes words-t46.json
for (const x of JSON.parse(R('words-t46.json'))) add(x.key, x.en, x.protected, 'DEC-198', x.note || undefined);
// 4h. T47's words (DEC-200; BOB's B156, B157): written in words-t47.src.py, which writes words-t47.json
for (const x of JSON.parse(R('words-t47.json'))) add(x.key, x.en, x.protected, 'DEC-200', x.note || undefined);
// 4j. T48's words (DEC-226, DEC-227, DEC-229 onward; BOB's B179, B185; the census's drawings): written in words-t48.src.py, which writes words-t48.json; each entry's DEC is its note's prefix
for (const x of JSON.parse(R('words-t48.json'))) add(x.key, x.en, x.protected, (x.note && (x.note.match(/^DEC-\d+/) || [])[0]) || 'DEC-227', x.note || undefined);
// 4k. The modules' own keyed rows, adopted under their own keys (DEC-252; BOB's N1075): written by words-modules.src.py
for (const x of JSON.parse(R('words-modules.json')).adopted) add(x.key, x.en, x.protected, 'DEC-252', 'adopted from ' + x.module + "'s own rows");
// 4l. T49's owed words (DEC-253): affordances' vocabularies and standards' sentences, written in words-t49.src.py
for (const x of T49.rows) { const d = x.note.match(/^DEC-\d+/)[0]; add(x.key, x.en, x.protected, d, x.note.replace(/^DEC-\d+(: )?/, '') || undefined); }
for (const k of [...T49.retired, ...Object.keys(T49.rewrite)]) if (!retiredSeen.has(k) && !rewriteSeen.has(k)) fail('DEC-256: no row ' + k + ' to retire or reword');
// 4m. The remaining screens' drawn words (DEC-259): written in words-drawn.src.py
for (const x of DRAWN.rows) add(x.key, x.en, x.protected, 'DEC-259', x.note.replace(/^DEC-259(: )?/, '') || undefined);
// 4n. The other modules' inline English (DEC-260): written in words-mod-<n>.src.py, one file per batch, rows only
for (const f of readdirSync(new URL('.', import.meta.url)).filter(f => /^words-mod-\d+\.json$/.test(f)).sort())
  for (const x of JSON.parse(R(f)).rows) add(x.key, x.en, x.protected, 'DEC-260', x.note.replace(/^DEC-260(: )?/, '') || undefined);

// 5. The frame: rail, phone tabs, explanation levels
for (const [k, name] of W.RAIL) { add(`rail.${k}.name`, name, false, 'mock-shell.js RAIL'); if (W.RAIL_HELP[k]) add(`rail.${k}.holds`, W.RAIL_HELP[k], false, 'mock-refs.js RAIL_HELP'); }
// DEC-241: the line beneath a place's name on the phone's More page: its rail.<k>.holds after the name, capitalized.
for (const [k] of W.RAIL) if (W.RAIL_HELP[k] && !W.TABS.some(([t]) => t === k)) { const s = W.RAIL_HELP[k].replace(/^[^:]+:\s*/, ''); add(`rail.${k}.line`, s[0].toUpperCase() + s.slice(1), false, 'DEC-241: the More page, derived from rail.<k>.holds'); }
for (const [k, name] of W.TABS) if (!W.RAIL.some(r => r[0] === k)) add(`tab.${k}.name`, name, false, 'mock-shell.js TABS');
add('tab.more.holds', must(shell, 'mock-shell.js', 'projects, people and settings.'), false, 'mock-shell.js decorate');
add('level.prompt.name', 'Explain promptly', false, 'DEC-175');
add('level.pause.name', 'On a longer pause', false, 'DEC-175');

// 6. The wizard guide (DEC-120, DEC-121): the guide's own words, around each script's step
add('guide.stopping', must(shell, 'mock-shell.js', 'Stopping is fine: nothing is lost, and nobody is told.'), false, 'mock-shell.js wizardGuide');
add('guide.showwhere', must(shell, 'mock-shell.js', 'Show me where'), false, 'mock-shell.js wizardGuide');
add('guide.sidetrip', 'Side trip: {wizard}. When it finishes or you stop it, you come back to this step.', false, 'mock-shell.js wizardGuide', 'the wizard\'s name in place of {wizard}');
must(shell, 'mock-shell.js', 'When it finishes or you stop it, you come back to this step.');
add('guide.draft', must(shell, 'mock-shell.js', 'This step places a labeled draft in the field. It becomes yours only when you keep or edit it.'), false, 'mock-shell.js wizardGuide');
add('guide.press', must(shell, 'mock-shell.js', 'Press here when you\\\'re ready').replace(/\\'/g, "'"), false, 'mock-shell.js ring');
add('guide.step', 'step {i} of {n}', false, 'mock-shell.js wizardGuide');

// 7. Screens: each one's name and what it is for
for (const s of reg) {
  add(`screen.${s.id}.name`, s.name, false, 'registry.json');
  if (W.SCREEN_HELP[s.id]) add(`screen.${s.id}.purpose`, W.SCREEN_HELP[s.id], false, 'mock-refs.js SCREEN_HELP');
}

// 8. Acts: each act's name as each screen labels it (a fixed term: protected), and what it does (protected where the act is
//    signed, terminal, irreversible or outward: its explanation is the warning before it, DEC-157 (4))
for (const s of reg) for (const a of s.acts) {
  const k = `act.${opkey(a.op)}.label.${s.id}`;
  if (!seen.has(k)) add(k, a.label, true, 'registry.json');
}
for (const [op, t] of Object.entries(W.ACT_HELP)) add(`act.${op}.does`, t, weightOf(op.startsWith('owed_') ? 'owed:' + op.slice(5) : op) >= 3 || W.OUTWARD.includes(op), 'mock-acts.js ACT_HELP');
for (const s of reg) for (const a of s.acts) if (!W.ACT_HELP[opkey(a.op)]) fail(`no ACT_HELP for ${a.op} (screen ${s.id})`);

// 9. Table columns: the heading and what it shows
for (const [k, t] of Object.entries(W.COL_HELP)) {
  const [scr, head] = k.split('|');
  const slug = head.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  add(`column.${scr}.${slug}.name`, head, false, 'mock-refs.js COL_HELP');
  add(`column.${scr}.${slug}.shows`, t, false, 'mock-refs.js COL_HELP');
}
add('column.sort.how', must(shell, 'mock-shell.js', 'Click to sort the rows by this column; click again to reverse. Sorting changes only your view, never the record.'), false, 'mock-shell.js decorate');

// 10. Civicsmith's wizard library (DEC-148): each script's name and each step's what and why
for (const w of lib) {
  add(`wizard.${w.id}.name`, w.name, false, 'library.json');
  w.versions[0].steps.forEach((st, i) => {
    add(`wizard.${w.id}.step${i + 1}.what`, st.what, false, 'library.json');
    add(`wizard.${w.id}.step${i + 1}.why`, st.why, false, 'library.json');
  });
}

for (const k of Object.keys(DRAWN.rewrite)) if (!drawnSeen.has(k)) fail('DEC-259: no row ' + k + ' to reword');

const out = {
  _note: 'The interface word list (DEC-179). Built by build_words.mjs from the mockups\' sources; never edit by hand. Keys are stable: a word keeps its key when its English changes, and a new word takes a new key. {name} marks a placeholder the screen fills.',
  protected_rule: 'DEC-157 (4): the fixed terms (grades and scales, the five gaps, origins, the queue\'s kinds, the path, the acts\' names), the weights, every warning and dialog before an outward, signed or irreversible act, the court notice, and every "who can see this" notice. A protected word changed from the assistant\'s draft, or typed without one, shows only after a second check.',
  for_builders: 'A sentence on a screen that carries its data (a name, a count, a date) is keyed when the screen is built: screen.<id>.<part>, with {placeholders}; it is protected when it is a warning or dialog before an outward, signed or irreversible act, the court notice ("What a court can reach"), or says who can see something.',
  counts: {},
  words,
};
for (const w of words) { const f = w.key.split('.')[0]; out.counts[f] = (out.counts[f] || 0) + 1; }
out.counts.total = words.length;
out.counts.protected = words.filter(w => w.protected).length;
fs.writeFileSync(path.join(HERE, 'words.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`words.json: ${words.length} words and phrases, ${out.counts.protected} protected · ` + Object.entries(out.counts).filter(([k]) => !['total', 'protected'].includes(k)).map(([k, v]) => `${k} ${v}`).join(', '));
