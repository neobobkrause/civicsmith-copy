/* Civicsmith mockups: the frames (working, setup, public, published), the dock (the assistant panel and the wizard
   guide), and the ring a wizard draws on the control its step names. */
'use strict';
const RAIL = [['home', 'Home', 'home'], ['queue', 'Queue', 'queue', 13], ['find', 'Find', 'search'], ['add', 'Add', 'add'], ['projects', 'Projects', 'project'], ['people', 'People', 'subject'], ['settings', 'Settings', 'settings']];
const TABS = [['home', 'Home', 'home'], ['queue', 'Queue', 'queue'], ['add', 'Add', 'add'], ['find', 'Find', 'search'], ['more', 'More', 'settings']];
const BANDS = {
  working: `<b>Working</b> · not public · seen by your team's members`,
  review: `${I('outward')}<b>Shared for review</b> · 2 people outside the team can read this until October 20`,
  imported: `${I('elsewhere')}<b>Another team's case:</b> West Oakland Neighbors · Edition 2 · read-only · 1 of 3 findings recreated`,
};
/* what the assistant says beside each screen, when the member has connected their own account */
const ASSIST = {
  question: ['Is there anything that links the work orders to the policy directly?', 'The work orders cite "AI 4.12" in their category field, row by row. Citing that column would make the link one the source itself makes, which would raise connection from C to A. I looked in the 14 documents this project holds.'],
  document: ['What does this instruction say "closed" means?', 'Passage 5: a report is closed "when the crew reports the work complete". It does not mention an inspection. This is legal information, not legal advice.'],
  plan: ['What options does a team usually have here?', 'For a fixing project with a hypothetical subject, teams often start with a records request, then ask the responsible committee to agendize the issue. I put two suggestions in the tray; they are not in the plan until you adopt one.'],
  'start-send': ['Draft the request for me.', 'I drafted it in the field, labeled as my draft. Edit it until it is yours; nothing is sent until you approve it and send it yourself.'],
  request: ['Draft the request for me.', 'I drafted it in the field, labeled as my draft. The law and the office come from your team\'s profile.'],
  person: ['Has L. Chen held any other post?', 'Deputy Director, Transportation, 2018–2022, from the council minutes the team holds. I found nothing earlier; I looked in 31 documents.'],
  timeline: ['Can you propose events from the rent schedules?', 'This is switched on after its measurement at the release. For now, record events from cited passages yourself.'],
  _: ['What is waiting on me here?', 'Two things on this screen need you. I can explain any mark: tap it, or ask me.'],
};
function assistantPanel(screen, c) {
  const [q, a] = ASSIST[screen] || ASSIST._;
  return `<aside class="cs-dock" aria-label="The assistant">
   <header>${I('machine')}The assistant<span class="spacer"></span><span class="muted mk-small">$0.42 of your $2.00 today</span><button type="button" class="cs-btn" data-tone="quiet" aria-label="Widen">${I('expand')}</button></header>
   <div class="body"><p class="mk-small muted"><b data-tip="<b>On your own account</b>: your own Claude subscription serves you here, so its use is yours. Where the team's key or a project's account serves you instead, this says so.">On your own account</b> · It works for you alone. It finds, reads and checks; it never concludes, signs or sends.</p>
    <div class="mk-msg me mk-data">${esc(q)}</div>${machine('Mai', `<p class="mk-data">${esc(a)}</p><p class="mk-small">${I('accepted')} ${card('Checked by Civicsmith before it was shown', 'Every passage this answer cites was found, word for word, in the document it names, by Civicsmith itself and not by the assistant.')}</p>`)}${screen === 'assistant' ? dockMore() : ''}</div>
   <footer>${field('mk-ask-' + screen, 'Ask about this screen', '', {})}<div class="mk-acts">${btn('ask', 'Ask', { tone: 'primary' })}${btn('airunopen', 'Work on this')}${btn('suggest', 'Suggest')}${btn('airunclose', 'Stop')}</div></footer></aside>`;
}
/* DEC-296 (BOB's B251, N1167; ai-runs R76): a run's cost, "so far" while it works and in full when it ends, shown only to the
   paying account's owners; money where the account reports it, else tokens and calls.
   DEC-248 (BOB's B209 (1); screens-inquiry R13, R17, R33): on the assistant panel, a run working, what a run that can't
   start says in the panel (each withheld or refused dispatch by its words, never blank), and the serving account's thirty
   days of bars, drawn only for that account's owner. */
function dockMore() {
  return `<p class="mk-small">${I('machine')} A run of yours is working on this. ${card('So far: $0.62 in 31 calls, on your Claude subscription.', "What this run has cost the account that pays for it. Only that account's owners see it, never another member.")}</p>
   <details class="mk-details"><summary>If a run can't start, the panel says why, here</summary><div style="display:grid;gap:6px">${gapm('refused', '“Work on this” runs only on your own Claude subscription, and here another account serves you. Nothing was sent. To use your own, connect it under Settings, The assistant.')}${gapm('refused', 'The assistant isn\'t installed in your team\'s Civicsmith yet, so this run can\'t start. Nothing was sent. Whoever installed your team\'s Civicsmith can add it; everything else works without it.')}${gapm('refused', 'The run can\'t start: your team\'s Civicsmith didn\'t answer in time while preparing it. Nothing was sent. Try again in a moment.')}${gapm('refused', 'This run has already ended, so it can\'t be set working again. Nothing was sent. Start a new one with Work on this.')}${gapm('refused', 'The run can\'t start, for a reason this panel has no words for yet. Nothing was sent. Tell an administrator, with the reference below.')}<p class="mk-small muted">Reference: 7Q2K-91XD</p></div></details>
   <details class="mk-details"><summary>Your account's use, last 30 days</summary>${usageBars(4.10, 61, 4)}</details>`;
}
const DOOR_WIZ = new Set(['Your first question', 'Get a record', 'Check a claim', 'Follow the money', 'Build a timeline', 'Follow a proceeding', 'Use another team\'s case']);  // the scripts a front door offers (library DOORS): their guide names the way out (DEC-227)
function wizardGuide(w) {
  return `<aside class="cs-dock" aria-label="Wizard">
   <header>${I('wizard')}Wizard<span class="spacer"></span><button type="button" class="cs-btn" data-tone="quiet">Stop</button></header>
   <div class="body"><div class="cs-wizard">
    <span class="step">${I('wizard')}${esc(w.name)} · step ${w.i} of ${w.n}</span>
    <span class="what">${esc(w.what)}</span><span class="why">${esc(w.why)}</span>
    ${w.via ? `<p class="mk-small">${I('wizard')} Side trip: <b>${esc(w.via)}</b>. When it finishes or you stop it, you come back to this step.</p>` : ''}
    ${w.ask === 'project' ? `<div class="cs-field"><label for="mk-wsubj">This step works in a project. Which one?</label><select id="mk-wsubj" class="cs-input"><option class="mk-data" selected>Pothole repairs</option><option class="mk-data">The Coliseum lease</option></select></div><details class="mk-details"><summary>With no project to choose</summary><p class="mk-small">This step works in a project, and you aren't in one yet. Start one, or ask to join one, then come back to this step.</p></details>` : ''}
    ${w.draft ? `<p class="mk-small">${I('machine')} This step places a labeled draft in the field. It becomes yours only when you keep or edit it.</p>` : ''}
    <span class="nav"><button type="button" class="cs-btn" data-tone="quiet">${I('back')}Back</button><button type="button" class="cs-btn">Next${I('next')}</button></span>
    ${w.act ? `<span class="nav"><button type="button" class="cs-btn" data-replay>${I('wizard')}Show me where</button><span class="cs-kbd">Alt+Shift+W</span></span>` : ''}
    ${DOOR_WIZ.has(w.name) ? `<p class="mk-small muted">For your own situation rather than the government's word: <a href="#" class="cs-ref" data-goto="elsewhere" data-tip="<b>Where else to go</b> · the places your team's place lists for needs Civicsmith doesn't serve, each with where that came from. Opening it records nothing.">where else to go</a>.</p>` : ''}
    <p class="mk-small muted">Stopping is fine: nothing is lost, and nobody is told.</p></div></div></aside>`;
}
function mast(c, s) {
  return `<header class="cs-mast"><span class="cs-mark" role="img" aria-label="Civicsmith"><svg viewBox="0 0 60 90"><use href="#i-mark"/></svg></span><span class="grp">${G.name}</span><span class="spacer"></span>
    <span class="mk-mastsearch">${I('search')}<span>Search</span></span>
    <button type="button" class="cs-btn mk-lvlbtn" data-tone="quiet" data-lvltoggle aria-label="Explanations: Alt+Shift+I switches" data-tip="<b>Explanations</b>: How quickly explanations open. Promptly, everything opens when you rest on it for half a second; on a longer pause, what screens, sections and acts are waits a second and a half. Keyboard focus and a tap always show everything at once; nothing is ever hidden. Click, or press Alt+Shift+I, to switch.">${I('question')}<span class="mk-hide-phone">${typeof window !== 'undefined' && window.CS_LEVEL === 1 ? 'Explanations: on a pause' : 'Explanations: prompt'}</span></button>
    ${c.ai ? `<button type="button" class="cs-btn" data-tone="quiet" aria-label="The assistant">${I('machine')}<span class="mk-hide-phone">Assistant</span></button>` : ''}
    <span class="cs-kind mk-hide-phone" data-kind="todo">${I('queue')}13</span><details class="mk-usermenu"><summary class="mk-avatar" aria-label="Mai: your menu" data-tip="<b>Your menu</b>: your account, and signing out of this device.">M</summary><div class="mk-menu" role="menu"><span class="mk-small muted">Mai · signed in as mai-k</span><a href="#" role="menuitem" onclick="return false">Your account</a><a href="#" role="menuitem" onclick="return false" data-tip="<b>Sign out</b>: ends your session on this device and goes to the sign-in page. Nothing you wrote is lost; drafts stay where they were.">Sign out</a></div></details></header>`;
}
// DEC-154 (Bob, October 6): every screen shows where it is, in the same place: its path, from the section of the rail
// (or, outside the workspace, the team or Civicsmith) to the screen's own name, which is always last. The heading below
// names the thing shown (a question's words, a person's name); the path names the screen.
const PATH = {
  site: ['civicsmith.org'], install: ['Civicsmith', 'Create your team'], update: ['Civicsmith', 'Update'], front: ['Lakeshore Tenants'], forgot: ['Lakeshore Tenants', 'Forgot your password'], tour: ['Lakeshore Tenants', 'How we work'], 'help-records': ['Help', 'How a records request works'], reset: ['Lakeshore Tenants', 'Choose a new password'], 'review-outside': ['Lakeshore Tenants', 'Review copy'],
  group: ['Settings', 'Your team'], settings: ['Settings'], more: ['More'], theme: ['Projects', 'Themes'], projects: ['Projects'], people: ['People'], 'dash-action': ['Action'], 'dash-project': ['The Coliseum lease'], unavailable: ['Can\'t open this'], setup: ['Set up', 'Places and languages'], join: ['Lakeshore Tenants', 'Your invitation'],
  doorbell: ['Lakeshore Tenants', 'Hand material over'], published: ['Lakeshore Tenants', 'Published cases', 'The Coliseum lease'],
  home: ['Home'], elsewhere: ['Home', 'Where else to go'], queue: ['Queue'], 'due-date': ['Queue', 'Due date'], inbox: ['Queue', 'Inbox'],
  finder: ['Find'], capture: ['Add'], held: ['Add', 'Held captures'], archive: ['Add', 'Held captures', 'Archive'], 'open-file': ['Projects', 'The Coliseum lease', 'Opening a file'],
  'find-in': ['Projects', 'Pothole repairs', 'Find in this'],
  'group-identity': ['Settings', 'Who your team is'], members: ['Settings', 'Members'], security: ['Settings', 'Security'], places: ['Settings', 'Places and offices'], recovery: ['Settings', 'Recovery codes'], account: ['Settings', 'Your account'],
  connect: ['Settings', 'The assistant'], teamai: ['Settings', 'The team\'s assistant'], ties: ['Settings', 'Your ties'], notes: ['Settings', 'Your notes'],
  translations: ['Settings', 'Translations'], wizards: ['Settings', 'Wizards'], updates: ['Settings', 'Updates'],
  person: ['People', 'Person'], explore: ['People', 'Person', 'Explore connections'],
  project: ['Projects', 'Pothole repairs'], document: ['Projects', 'Pothole repairs', 'Document'],
  question: ['Projects', 'Pothole repairs', 'Question'], assistant: ['Projects', 'Pothole repairs', 'Question'],
  calculation: ['Projects', 'Pothole repairs', 'Calculation'], standard: ['Projects', 'Pothole repairs', 'Standard'],
  plan: ['Projects', 'Pothole repairs', 'Action plan'], 'start-send': ['Projects', 'Pothole repairs', 'Action plan', 'Start and send'],
  request: ['Projects', 'Pothole repairs', 'Request records'], action: ['Projects', 'Pothole repairs', 'Action'],
  timeline: ['Projects', 'The Coliseum lease', 'Timeline'], money: ['Projects', 'Sewer fund transfers', 'Money trail'],
  proceeding: ['Projects', 'The Coliseum lease', 'Proceeding'], matter: ['Projects', 'The Coliseum lease', 'Matter'],
  'case-editor': ['Projects', 'The Coliseum lease', 'Case'], 'review-copy': ['Projects', 'The Coliseum lease', 'Review copy'],
  ceremony: ['Projects', 'The Coliseum lease', 'Publish'], docket: ['Projects', 'The Coliseum lease', 'Docket'],
  imported: ['Projects', 'Imported cases', "Another team's case"],
  hold: ['Projects', 'Pothole repairs', 'Action', 'Litigation hold'], holdnotice: ['Projects', 'Pothole repairs', 'Action', 'Litigation hold', 'Hold notice'],
  counsel: ['Projects', 'Pothole repairs', 'Action', 'Brief counsel'], grouprules: ['Settings', 'Places and offices', "Your team's own rules"],
};
const pathOf = (id, s) => PATH[id] && !(id === 'answers') ? PATH[id] : id === 'answers' ? ['Find', s.title] : [(RAIL.find(r => r[0] === s.rail) || ['', 'Settings'])[1], s.title];
const pathNav = list => `<nav class="mk-crumbs" aria-label="Where you are">${list.map((x, i) => i === list.length - 1 ? `<b aria-current="page">${esc(x)}</b>` : `<a href="#" onclick="return false">${esc(x)}</a>`).join(' <i>›</i> ')}</nav>`;

// DEC-160, widened on Bob's direction (October 6): the references on each screen, each with what it is and why it matters
// on that screen. Hover or focus shows the card; a click opens it (null: a card only). Attached as the screen draws.
const tipOf = (what, why, go) => `${what}${why ? `<span class=why><b>Here:</b> ${why}</span>` : ''}${go ? '<span class=more>Press or tap to open it.</span>' : ''}`;
const AQ = 'Is the city repairing reported potholes within seven days?';
const REFS = {
  home: [['The Coliseum lease', 'project', '<b>The Coliseum lease</b> · project · 3 questions · Edition 2 published September 18', '2 items in it wait on you this week.'],
         ['Pothole repairs', 'project', '<b>Pothole repairs</b> · project · 2 questions · its main question is short on connection', 'A better link between reports and work orders would bring it to the bar.'],
         ['Sewer fund transfers', 'money', '<b>Sewer fund transfers</b> · project · a money trail across FY2022 to FY2024', 'Ana\'s question there waits for the FY2024–25 budget.']],
  members: [['Rosa', null, '<b>Rosa</b> · administrator · cover name R. Medina', 'The team\'s only administrator: the team depends on her and the hosting account.'],
            ['Dev', null, '<b>Dev</b> · member · owner of The Coliseum lease', 'Signs the team\'s cases for that project.'],
            ['Ana', null, '<b>Ana</b> · member · works on Sewer fund transfers', 'Has a question waiting on a held document.'],
            ['Teo', null, '<b>Teo</b> · member · <span class=mk-data>reporter at the Bay Courier</span> · declared expertise: journalism', 'Runs the story that cites Edition 2.']],
  queue: [['812 of 903 reports closed within 7 days', 'calculation', '<b>Reports closed within seven days, FY2025</b> · a calculation · 812 of 903 · computed from the city\'s work orders', 'One of its inputs changed: check whether the count still holds.'],
          ['pothole work orders', 'document', '<b>Public Works work orders, FY2025</b> · CSV, 903 rows · captured by Dev from the city\'s open-data portal, capture B', 'The input that changed.']],
  finder: [['Public Works work orders, FY2025 (CSV)', 'document', '<b>Public Works work orders, FY2025</b> · CSV, 903 rows · capture B', 'The city\'s own record of every pothole report: what your search matched most.'],
           ['Pothole repair policy, Administrative Instruction 4.12', 'document', '<b>Administrative Instruction 4.12</b> · Public Works · capture B · current version', 'Sets the seven-day standard your question tests the city against.'],
           ['Report to council: street maintenance performance', 'document', '<b>Report to council: street maintenance performance</b> · 2026 · capture B', 'Where the city claims 90% of potholes were filled.']],
  held: [['City budget FY2024–25, adopted (PDF)', 'document', '<b>City budget FY2024–25, adopted</b> · 412 pages · captured October 2 · not yet released', 'Held until a member vouches for it; Ana\'s question is waiting for it.'],
         ['Council minutes, May 14, 2024', 'document', '<b>Council minutes, May 14, 2024</b> · captured September 28 · not yet released', 'Records the vote on the FY2024 transfers.'],
         ['Lease amendment, March 2024', 'document', '<b>Lease amendment, March 2024</b> · the city posted a newer version on October 3', 'Can\'t be released here: part of it is withheld by its source.']],
  project: [[AQ, 'question', `<b>${AQ}</b> · question · capture B, connection C · short on connection`, 'The project\'s main question, and the one closest to the bar.'],
            ['Does "closed" in the city\'s records mean "repaired"?', 'question', '<b>Does “closed” mean “repaired”?</b> · question · unrated · opened by Mai', 'If the answer is no, the main question\'s count overstates repairs.']],
  question: [['812 of 903 reports closed within 7 days', 'calculation', '<b>Reports closed within seven days, FY2025</b> · a calculation from the city\'s work orders', 'Supports the question, using the city\'s own count of “closed”.']],
  answers: [['Public Works work orders, FY2025', 'document', '<b>Public Works work orders, FY2025</b> · CSV, 903 rows · capture B', 'The answer counts its rows.']],
  timeline: [['City Clerk releases schedules', 'action', '<b>The City Clerk released the rent schedules</b> · September 18 · answering the team\'s request', 'The team\'s own act and the office\'s reply, in the second lane.']],
  explore: [['J. Ortega', 'person', '<b>J. Ortega</b> · Council District 3 since 2023, from Legistar', 'Where this chain starts.'],
            ['Bayline Properties', 'money', '<b>Bayline Properties</b> · paid $1.2M in FY2024 under the Coliseum lease', 'Where the money in this chain ends up.']],
  plan: [['Records request: inspection logs', 'action', '<b>Records request: inspection logs</b> · sent to the City Clerk October 2 · reply due October 14', 'The plan\'s first step; the next one waits on its reply.'],
         ['Complaint to the city auditor', 'action', '<b>Complaint to the city auditor</b> · an option, not started', 'Becomes ready if the inspection logs show reports closed without repair.']],
  'start-send': [['Asha Rao', 'person', '<b>Asha Rao</b> · City Clerk since March 2021, from the city\'s roster', 'Holds the office this request goes to, today.']],
  'review-copy': [['Prof. N. Iyer', null, '<b>Prof. N. Iyer</b> · housing-law professor · an outside reader named by Dev · can read until October 20', 'Reviewing Edition 2 before it is published.']],
  imported: [['Port lease revenue fell short of the adopted budget in three years', 'question', '<b>Port lease revenue fell short of the adopted budget in three years</b> · West Oakland Neighbors\' finding · recreated here', 'Recreated from their case; it counts for your team only once a member accepts it.']],
};

// Things named on many screens: one card wherever they appear (DEC-160, widened October 6). [text, opens, what it is, why here
// (usually none: a screen's own REFS add that), screens where it is not attached].
const GLOBAL_REFS = [
  ['The Coliseum lease', 'project', '<b>The Coliseum lease</b> · a project · <span class=mk-data>whether the city kept the terms of its lease of the Coliseum land, including rent raised in 2024 without a council vote</span> · owner: Dev · Edition 2 published September 18', null, ['project']],
  ['Pothole repairs', 'project', '<b>Pothole repairs</b> · a project · <span class=mk-data>whether the city repairs reported potholes within the seven days its own policy sets</span> · 2 questions', null, ['project']],
  ['Sewer fund transfers', 'money', '<b>Sewer fund transfers</b> · a project · <span class=mk-data>where sewer-fee money moved between funds, FY2022 to FY2024, and whether each transfer was authorized</span> · owner: Ana', null, []],
  ['Lakeshore Tenants', null, '<b>Lakeshore Tenants</b> · your team · <span class=mk-data>tenants near the Coliseum, meeting since 2025</span> · 6 members, 1 administrator', null, ['install', 'setup', 'join', 'doorbell', 'published']],
  ['Rosa', 'members', '<b>Rosa</b> · member of your team · administrator', null, ['members']],
  ['Dev', 'members', '<b>Dev</b> · member of your team · owns The Coliseum lease and signs its cases', null, ['members']],
  ['Mai', 'members', '<b>Mai</b> · member of your team · works on Pothole repairs · translates Español', null, ['members']],
  ['Ana', 'members', '<b>Ana</b> · member of your team · works on Sewer fund transfers', null, ['members']],
  ['Teo', 'members', '<b>Teo</b> · member of your team · <span class=mk-data>a reporter at the Bay Courier</span> · declared expertise: journalism', null, ['members']],
  ['Asha Rao', 'person', '<b>Asha Rao</b> · a person the record follows · City Clerk since March 2021, from the city\'s roster', null, []],
  ['L. Chen', 'person', '<b>L. Chen</b> · a person the record follows · Director of Public Works since 2022, from the city\'s roster', null, ['person']],
  ['J. Ortega', 'person', '<b>J. Ortega</b> · a person the record follows · Council District 3 since 2023, from Legistar', null, []],
  ['Office of the City Clerk', null, '<b>Office of the City Clerk</b> · an office · <span class=mk-data>keeps the city\'s records and answers records requests</span> · held today by Asha Rao', null, []],
  ['City Clerk', null, '<b>City Clerk</b> · an office · <span class=mk-data>keeps the city\'s records and answers records requests</span> · held today by Asha Rao', null, []],
  ['City Administrator', null, '<b>City Administrator</b> · an office · <span class=mk-data>runs the city\'s departments and answers to the council</span>', null, []],
  ['Director of Public Works', null, '<b>Director of Public Works</b> · an office · <span class=mk-data>runs the department that repairs streets</span> · held today by L. Chen', null, []],
  ['Administrative Instruction 4.12', 'document', '<b>Administrative Instruction 4.12</b> · a document · the city\'s pothole repair policy · Public Works · capture B · sets seven calendar days', null, ['document']],
  ['Lease amendment 1', 'document', '<b>Lease amendment 1</b> · a document · the Coliseum lease change approved January 12, 2024', null, []],
  ['Bayline Properties', 'money', '<b>Bayline Properties</b> · a firm · paid $1.2M in FY2024 under the Coliseum lease', null, []],
  ['Edition 2', 'published', '<b>Edition 2</b> of The Coliseum lease · a published case · published September 18, 2026 at the time Dev set when signing', null, ['published']],
  ['Edition 1', 'published', '<b>Edition 1</b> of The Coliseum lease · a published case, since corrected by Edition 2', null, []],
  ['West Oakland Neighbors', 'imported', '<b>West Oakland Neighbors</b> · another team · its published cases can be imported and recreated here', null, ['imported']],
  ['Bay Courier', null, '<b>Bay Courier</b> · a newsroom · <span class=mk-data>Teo reports for it; its story cites Edition 2</span>', null, []],
];
// Attach references by text: every occurrence on the screen, inside running text too, never inside a link, button, field,
// heading or an element that already explains itself. Per-screen entries win over GLOBAL ones (things named on many screens).
const NO_REF = '.mk-osprompt,a,button,select,option,textarea,input,label,h1,legend,summary,[data-tip],.cs-grade,.cs-btn,.mk-crumbs,.mk-mockctl,.id,script,style';
function attachRefs(id, html) {
  if (typeof document === 'undefined') return html;
  const own = (REFS[id] || []).map(r => [...r, true]);
  const seen = new Set(own.map(r => r[0]));
  const list = own.concat((typeof GLOBAL_REFS !== 'undefined' ? GLOBAL_REFS : []).filter(r => !seen.has(r[0]) && !(r[4] || []).includes(id)));
  if (!list.length) return html;
  const t = document.createElement('template'); t.innerHTML = html;
  const esc_ = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [text, go, what, why] of list.sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp('(^|[^\\w])(' + esc_(text) + ')(?![\\w])');
    const walker = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT);
    const hits = []; let n;
    while ((n = walker.nextNode())) { if (n.parentElement && n.parentElement.closest(NO_REF)) continue; if (re.test(n.nodeValue)) hits.push(n); }
    for (const node of hits) {
      let cur = node;
      for (let m; cur && (m = re.exec(cur.nodeValue));) {
        const start = m.index + m[1].length;
        const after = cur.splitText(start); const rest = after.splitText(text.length);
        const el = document.createElement(go ? 'a' : 'span');
        if (go) { el.href = '#'; el.className = 'cs-ref'; el.dataset.goto = go; } else { el.className = 'cs-card'; el.tabIndex = 0; }
        el.dataset.tip = tipOf(what, why, go); el.textContent = text; after.replaceWith(el); cur = rest;
      }
    }
  }
  return t.innerHTML;
}
// DEC-155: the rail's width, the member's own (184px by default; 64px is icons only); kept per member and device.
const railW = () => window.CS_RAILW || 184;

// DEC-163: every element type, decided once (the table on the layouts page): explanations and links added to the whole frame
// (masthead, path, rail and tabs, wizard marks, step lists, row icons, the published page's head and foot), not only the
// screen's main area. Level 1 (marks and names) always; level 2 (guidance) when the member has guidance on (DEC-162).
const GROUP_CARD = '<b>Lakeshore Tenants</b> · your team · <span class=mk-data>tenants near the Coliseum, meeting since 2025</span> · <span class=mk-data>checks whether the city keeps its own rules and promises</span> · 6 members<span class=more>Press or tap to see who your team is.</span>';
const GROUP_PUBLIC = '<b>Lakeshore Tenants</b> · <span class=mk-data>a tenants\' team near the Oakland Coliseum</span> · <span class=mk-data>checks whether the city keeps its own rules and promises</span> · its published cases are signed by its project owners';
const ICON_KIND = { capture: 'A document or a capture', subject: 'A person or organization your team\'s record follows', group: 'An office, a member or a team', question: 'A question', finding: 'A finding', case: 'A case', plan: 'An action plan', timeline: 'An event', money: 'A money item', clock: 'Something with a time limit', camera: 'A photo', changed: 'Something that changed', tension: 'Two things that disagree', hold: 'Held, not yet in the record', signed: 'Signed', wizard: 'A wizard' };
const CRUMB_GO = { Home: 'home', Queue: 'queue', Find: 'finder', Add: 'capture', Projects: 'project', People: 'people', Settings: 'account' };
function decorate(html, id, c) {
  if (typeof document === 'undefined') return html;
  const t = document.createElement('template'); t.innerHTML = html; const R = t.content;
  const set = (el, tip, lvl, go) => { if (!el || el.dataset.tip) return; el.dataset.tip = tip; if (lvl) el.dataset.level = lvl; if (go) el.dataset.goto = go; };
  set(R.querySelector('.cs-mast .cs-mark'), '<b>Civicsmith</b>: the plumb bob is Civicsmith\'s mark. Wherever you see it, you are in your team\'s own Civicsmith, and the name beside it says whose.', 2);
  set(R.querySelector('.cs-mast .grp'), GROUP_CARD, 1, 'group-identity');
  set(R.querySelector('.mk-mastsearch'), '<b>Search</b>: everything your team holds, documents, questions, people and more.', 2);
  set(R.querySelector('.cs-mast [aria-label="The assistant"]'), '<b>The assistant</b>: opens beside your work. It answers only from what your team holds, on the account that serves you, and never concludes, signs or sends.', 2);
  set(R.querySelector('.cs-mast .cs-kind'), '<b>13 items wait on you</b> in your queue: 5 to do, 5 noticed, 3 status.<span class=more>Press or tap to open your queue.</span>', 1, 'queue');
  set(R.querySelector('.mk-avatar'), '<b>You: Mai</b> · member of Lakeshore Tenants · works on Pothole repairs<span class=more>Click for your account and settings.</span>', 1, 'account');
  R.querySelectorAll('.mk-crumbs a').forEach(a => { const x = a.textContent.trim(); const g = (typeof GLOBAL_REFS !== 'undefined' ? GLOBAL_REFS : []).find(r => r[0] === x);
    if (g) set(a, tipOf(g[2], null, g[1]), 1, g[1]); else set(a, `Back to <b>${x}</b>.`, 2, CRUMB_GO[x]); });
  R.querySelectorAll('.cs-tabs a').forEach(a => { const k = Object.keys(RAIL_HELP).find(k => a.textContent.trim().toLowerCase().startsWith(k === 'find' ? 'find' : k)); if (k) set(a, RAIL_HELP[k], 2); else if (/more/i.test(a.textContent)) set(a, '<b>More</b>: projects, people and settings.', 2); });
  R.querySelectorAll('.cs-wizmark').forEach(w => { set(w, `<b>${w.textContent.trim()}</b><br>${w.getAttribute('title')}. A wizard walks you through this screen step by step; it points at the real control and never presses it.`, 2); w.removeAttribute('title'); });
  R.querySelectorAll('.mk-steps li').forEach(li => set(li, li.classList.contains('done') ? `<b>${li.textContent}</b>: done.` : li.getAttribute('aria-current') ? `<b>${li.textContent}</b>: you are here.` : `<b>${li.textContent}</b>: still to do. You can leave and come back; nothing is lost.`, 2));
  R.querySelectorAll('.cs-row > svg:first-child, .cs-row > .ic:first-child').forEach(sv => { const u = sv.querySelector('use'); const n = u && (u.getAttribute('href') || '').replace('#i-', ''); if (ICON_KIND[n]) set(sv, ICON_KIND[n] + '.', 2); });
  R.querySelectorAll('.mk-table').forEach(tb => { if (!tb.tHead || !tb.tBodies[0] || tb.tBodies[0].rows.length < 2) return;
    [...tb.tHead.rows[0].cells].forEach(th => { const x = th.textContent.trim(); if (!x || th.classList.contains('mk-pickc')) return; th.setAttribute('aria-sort', 'none');
      const what = (typeof COL_HELP !== 'undefined' && COL_HELP[id + '|' + x]) || (typeof console !== 'undefined' && console.warn('no COL_HELP for ' + id + '|' + x), '');
      th.innerHTML = `<button type="button" class="mk-sort" data-level="1" data-tip="<b>${x}</b>: ${esc(what)}<span class=more>Click to sort the rows by this column; click again to reverse. Sorting changes only your view, never the record.</span>">${th.innerHTML}</button>`; }); });
  // DEC-176: on a phone a row reads as a card, each value labeled with its column's name
  R.querySelectorAll('table.mk-rows').forEach(tb => { const hs = [...tb.tHead.rows[0].cells].map(h => h.textContent.trim());
    tb.querySelectorAll('tbody tr.mk-r').forEach(r => [...r.cells].forEach((td, i) => { if (i > 1 && hs[i]) { td.dataset.label = hs[i]; td.innerHTML = `<span class="mk-cv">${td.innerHTML}</span>`; } })); });
  set(R.querySelector('.cs-pubhead .grp'), GROUP_PUBLIC, 1);
  set(R.querySelector('.cs-pubfoot .id'), '<b>The signature</b>: an owner of the project signed this edition with their key. Anyone can check it, and recreate the case, with the open checker, without the team\'s help.', 1);
  set(R.querySelector('.cs-credit'), '<b>Made with Civicsmith</b>: free software for teams that check whether a government keeps its own word: the laws it must obey, the court decisions that bind it, its own rules and its promises. Civicsmith is software; it neither wrote nor checked this case.', 1);
  set(R.querySelector('.mk-setuphead .mk-wordmark'), '<b>Civicsmith</b>: free software for teams that check whether a government keeps its own word: the laws it must obey, the court decisions that bind it, its own rules and its promises.', 2);
  return t.innerHTML;
}
function render(screenId, c) { return decorate(renderFrame(screenId, c), screenId, c); }
/* DEC-249: the test-copy band (interface-shell R36, R53, R58), its words instance.test.band and instance.test.notice. */
const testBand = c => c.test ? `<div class="cs-testband" role="note"><b>Test Civicsmith</b><span>This is a test Civicsmith. Parts of its assistant haven't yet passed Civicsmith's tests, and each answer they give says so.</span></div>` : '';
/* DEC-330 (B306, census A9): the "newer version" band. It sits across the top of every page when the program in the browser is older than the live one; shown here on Your account, state "a newer version is live". */
const updBand = `<div class="cs-updband" role="status" style="display:none"><b>A newer version is ready</b><span>Your team's Civicsmith has been updated since this page opened. Reload when you are ready: nothing reloads by itself.</span><button type="button" class="cs-btn" data-tone="quiet" data-tip="<b>Reload</b>: brings in the newest version of Civicsmith. Anything you have typed and not saved is lost, so save it first.">Reload</button></div>`;
function renderFrame(screenId, c) {
  WRITE_ON = !!c.ai;
  const s = SCR[screenId](c);
  WRITE_ON = false;
  s.main = attachRefs(screenId, s.main);
  if (typeof SCREEN_HELP !== 'undefined' && SCREEN_HELP[screenId]) {
    const th = typeof TITLE_HELP !== 'undefined' && TITLE_HELP[screenId];  // a title naming a particular thing explains that thing first, as a name does
    s.main = s.main.replace(/<h1([ >])/, th ? `<h1 data-level="1" data-tip="${esc(th + '<span class=more>This screen: ' + SCREEN_HELP[screenId] + '</span>')}"$1` : `<h1 data-level="2" data-tip="${esc(SCREEN_HELP[screenId])}"$1`);
  }
  const frame = s.frame || 'working';
  if (frame === 'public' || frame === 'published') s.main = s.main.replace(/<span class="w"><span class="cs-pips">(?:<i[^>]*><\/i>)+<\/span>[A-Za-z]+<\/span>/g, '');   // R84: a public page (R30) carries no weight mark
  const dock = c.wizard ? wizardGuide(c.wizard) : (s.dock === 'assistant' && c.ai) || (c.dockAssist && c.ai) ? assistantPanel(screenId, c) : '';
  if (frame === 'published') return `<div class="cs-frame mk-page" data-frame="published">${testBand(c)}<header class="cs-pubhead"><span class="grp">${G.name}</span></header><main class="mk-pubmain"${s.st ? ` data-st="${s.st}"` : ''}>${pathNav(pathOf(screenId, s))}${s.main}</main>
    <footer class="cs-pubfoot"><span class="id">${G.slug} · signed by an owner of the project · 7c1e…a90b</span><span class="cs-credit">Made with <svg viewBox="0 0 60 90" aria-hidden="true"><use href="#i-mark"/></svg><b>Civicsmith</b></span></footer></div>`;
  if (frame === 'setup' || frame === 'public') return `<div class="cs-frame mk-page mk-plain${dock ? ' with-dock' : ''}" data-frame="${frame}">${testBand(c)}<main class="mk-plainmain"${s.st ? ` data-st="${s.st}"` : ''}>${pathNav(pathOf(screenId, s))}${s.main}</main>${dock}</div>`;
  const band = s.band || 'working';
  return `<div class="cs-frame cs-shell mk-page${dock ? ' with-dock' : ''}${railW() < 120 ? ' rail-icons' : ''}" data-frame="working" style="--rail:${railW()}px">${testBand(c)}${s.updband ? updBand : ''}${mast(c, s)}<div class="cs-band" data-band="${band}">${BANDS[band]}</div>
   <nav class="cs-rail" aria-label="Sections">${RAIL.map(([k, l, ic, n]) => `<a href="#" onclick="return false" data-level="${railW() < 120 ? 1 : 2}" data-tip="${typeof RAIL_HELP !== 'undefined' ? esc(RAIL_HELP[k] || l) : l}"${s.rail === k ? ' aria-current="page"' : ''}>${I(ic)}${l}${n ? `<span class="count">${n}</span>` : ''}</a>`).join('')}<button type="button" class="cs-grip" role="separator" aria-orientation="vertical" aria-label="Width of the sections list" aria-valuemin="64" aria-valuemax="320" aria-valuenow="${railW()}" title="Drag to resize; arrow keys too; double-click to reset"></button></nav>
   <main class="cs-main"${s.st ? ` data-st="${s.st}"` : ''}>${pathNav(pathOf(screenId, s))}${s.main}</main>${dock}
   <nav class="cs-tabs" aria-label="Sections">${TABS.map(([k, l, ic]) => `<a href="#" onclick="return false"${(s.rail === k || (k === 'more' && ['projects', 'people', 'settings'].includes(s.rail))) ? ' aria-current="page"' : ''}>${I(ic)}${l}</a>`).join('')}</nav></div>`;
}
/* "Show me where": draw the ring again on the step's control, scroll it into view, and move the keyboard to it */
function replay(root) {
  const el = root.querySelector('.cs-target'); if (!el) return false;
  el.classList.remove('again'); void el.offsetWidth; el.classList.add('again');
  const main = el.closest('.cs-main, .mk-plainmain, .mk-pubmain');
  if (main) { const r = el.getBoundingClientRect(), m = main.getBoundingClientRect(); main.scrollTop += (r.top - m.top) - 120; }
  el.focus({ preventScroll: true });
  return true;
}
/* draw the wizard's ring on the control its step names; return whether it was found */
function ring(root, act, label) {
  if (!act) return true;
  const sel = `[data-act="${CSS.escape(act)}"]`;
  const el = root.querySelector(`button${sel}`) || root.querySelector(sel);
  if (!el) return false;
  for (let a = el.parentElement; a && a !== root; a = a.parentElement) { // DEC-279: a wizard opens the part, and the choice's block, it points into
    if (a.tagName === 'DETAILS') a.open = true;
    if (a.dataset && a.dataset.opens) { const [cls, r] = a.dataset.opens.split('|'); const m = a.closest('main'); if (m) m.classList.add(cls); const ri = r && root.querySelector('#' + r); if (ri) ri.checked = true; } }
  const det = el.closest('tr.mk-detail[hidden]'); if (det) { det.hidden = false; const ob = det.previousElementSibling.querySelector('.mk-open'); if (ob) ob.setAttribute('aria-expanded', 'true'); } // DEC-176: a wizard opens the row it points into
  el.classList.add('cs-target');
  const tag = document.createElement('span');
  tag.className = 'cs-target-label mk-ringlabel';
  tag.innerHTML = `${I('wizard')}${label || (el.tagName === 'BUTTON' ? 'Press here when you\'re ready' : 'Here')}`;
  el.insertAdjacentElement(el.tagName === 'BUTTON' ? 'afterend' : 'beforeend', tag);
  const main = el.closest('.cs-main, .mk-plainmain, .mk-pubmain');
  if (main) { const r = el.getBoundingClientRect(), m = main.getBoundingClientRect(); main.scrollTop += (r.top - m.top) - 120; }
  return true;
}
