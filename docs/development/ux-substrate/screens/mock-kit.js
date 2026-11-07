/* Civicsmith mockups (design phase step 5, DEC-139): the kit every screen is drawn with.
   Drawn in civicsmith.css (DEC-138). Every control a wizard can point at carries data-act="<op>", the op the screen
   registry lists, so a wizard step rings the real control (check_walk.mjs proves each one exists). */
'use strict';
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const I = (n, cls='i') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const WNAME = ['', 'Reversible', 'Reasoned', 'Terminal', 'Signed', 'Irreversible'];
/* B411 T-07: what the mark says under a button (WNAME stays the key's name: weight.<name>.name) */
const WSHOW = { Reasoned: 'Asks for a reason', Terminal: 'Ends something', Signed: 'You sign this' };
const pips = w => `<span class="cs-pips">${[1,2,3,4,5].map(i => `<i${i <= w ? ' class="on"' : ''}></i>`).join('')}</span>`;
/* weights follow DEC-87 and DEC-88; an act whose weight is not yet set is treated as reasoned */
const WEIGHT = {
  owed_followfrom:1, owed_exploreall:1, owed_explorepath:1, owed_exploreshorter:1,
  owed_aiplanconnect:1, owed_aitestopen:1, owed_airesultsopen:1, owed_aiorderset:1, owed_aiaccountswitch:2, owed_aiaccountremove:3, owed_aibudgetset:2, owed_aicheckset:2, owed_aimemberallow:2, owed_aikeyenter:2, owed_aikeycloudflare:2, owed_aisignin:2, owed_aikeyreference:2, owed_aitermsaccept:2, owed_aiconnecttest:1, owed_aiaccountadd:2, owed_aipersonalchoose:2, owed_aimineuse:1, owed_aiownadd:1, owed_aimycheckset:1, owed_aiprojectuse:2, owed_aiprojectbudget:2, owed_aiprojectorder:1, owed_aiprojectcheckset:2, owed_aicontinue:1, owed_aistop:1, owed_aisend:2, owed_aisendrefuse:1, owed_aiwait:1, owed_aiwithout:1, owed_aiswitchaccount:1, owed_aimodelchoose:1, owed_aichooseother:1, owed_aiaskadmin:1, owed_airunstart:1, owed_aiaccountpick:1, owed_aitestsetup:2, owed_aitestrun:1, owed_airesultsend:3, owed_airesultsdecline:1, owed_airesultsread:1,
  owed_registerfileimport:1, owed_registerlist:1, owed_registersearch:1, owed_registerrowcite:1, owed_registerwatch:1, owed_registerwatchstop:1, owed_alertconnect:2, owed_registerask:1, owed_registermatch:1, owed_registerwatchpropose:1, owed_registerfilter:1, owed_registerdelta:1, owed_registerpreread:1, owed_registerpropose:1, owed_explorecontinue:1,
  contradictionflag:2, owed_citeimported:1, owed_withdrawimported:2, owed_namedrequestset:1, owed_sweepset:1, owed_sweepratify:1,
  owed_casedetailsset:1, owed_casedetails:1, owed_casedetailspublic:1, templatesave:1, reattest:1, captureaccount:2,
  owed_importregrade:1, owed_rerunstart:1, owed_rerunpair:1, owed_rerunread:1,
  templatesave:1, reattest:1, captureaccount:2,
  cite:1, sever:1, reinstate:1, select:1, search:1, queuesnooze:1, queuemute:1, owed_updatestart:1, owed_installupdate:1, owed_installcheck:1, owed_installaddress:1, owed_installregion:1, owed_installalongside:2, owed_installremove:1, owed_installremoveconfirm:5, owed_founderhandleset:2, owed_projectstakeset:1, owed_capturecredentialsupply:1, owed_capturecredentiallist:1, owed_capturecredentialwithdraw:1, owed_declareorigin:1, owed_projectclose:1, owed_taskdecide:2, owed_actionstake:1, planask:1, entityalias:2, relationdeclare:2, resolve:1, resolvetestify:2, connect:1, stepsource:2, stepsourcewithdraw:2, actionreplyquoting:2, readtranslate:1, owed_updatelater:1, owed_updateskip:2, taskforward:1, addparticipant:1, relate:1, followregister:1,
  pdfstructure:2, transcriptionattest:2, provenanceroute:1, connectionassert:2, resolutiondefect:2,
  importwatch:1, standingquestionset:1, standingquestionend:1, keepversion:1, explore:1, explorepreset:1, connectionchoose:1,
  calculationdraw:1, clockpropose:1, obscuremark:2, owed_adminproposalcancel:1, owed_mailnameshow:2, owed_mailnamewithhold:1, handlecheck:1, handlechange:2, accountusesset:2, pagetranscribe:2, escalationstoppursuing:3, escalationreopen:2, monitorset:1, recoverycodesissue:1, login:1, unlock:1, recover:2, signout:1, signouteverywhere:2, joinlinkinvite:1, owed_passwordresetlink:2, projectbarset:2, drawquestion:2, spotcheckvisit:2, projectquestions:1, projectlist:1, statusreportassist:1, airundispatch:2, actionscope:3, outcomecarry:3, filingsecondapprove:3, jointsignatory:3, holdnoticesent:2, casecheck:1, dutiesarising:1, procedureguides:1, openitemswith:1, textcheck:1, infractiondraft:1, bearingdraft:1, ruleoffer:1, advocacycheck:1, actionbearingpropose:1, transcribe:2, ailimitset:2, projectkeyset:2, projectsigninset:2, projectaccountswitch:2, projectaccountremove:3, projectkeynoticeseen:1, projectaikeepaway:2, exploreapprove:2, obscuremarkwithdraw:2, selectionrelease:1, frontier:1, countask:1, bind:1, createset:1, monitor:1, reminderset:1, ruleanswer:1, suggest:1,
  airunopen:2, airunclose:1, wizards:1, person:1, heldcaptures:1, gradenote:1, invitelook:1, publishedcase:1, verify:1, disclosureshown:1,
  projectjoin:1, projectrequest:1, projectrequestwithdraw:1, projectrequestanswer:2, startfrom:1, deadlinecompute:1, optionstartpreview:1, publishpreflight:1, publishtensions:1, exploreverify:1,
  addresseesuggest:1, tabledeclare:1, addworkbook:1, recordline:2, registerproceeding:2, declare:2, courtlink:2,
  conclude:2, narrow:2, promote:2, optiondispose:2, optionadd:2, optionadopt:2, optionpropose:1, scenarioset:2, checkpointrecord:2, plansubjectadd:2,
  proposedispose:2, heldsetaside:2, heldrestore:2, clockadopt:2, recordpersonfact:2, claimidentity:2, withdrawidentityclaim:2, linewithdraw:2, createevent:2, recordfact:2,
  recorddatedfact:2, include:2, exclude:2, reconcile:2, committedagainstpaid:1, authoritychain:1, importaccept:2, importflag:2, owed_inboxview:1, inboxpull:2, inboxresolve:2,
  declaretie:2, withdrawtie:2, memberadd:2, membercaps:2, memberset:2, adminendorse:2, expertiseconfirm:2, owed_expertisewithdraw:2, expertisedeclare:1, strengthbarset:2,
  calculationcreate:2, calculationaccept:2, recordcheck:2, actioncreate:2, actionlaws:2, communicationprepare:2, filingprepare:2, optionstart:2,
  actionmove:2, actioncorrespond:2, actionpressure:2, actionhold:2, escalationopen:2, escalationadvance:2, declinetoescalate:2, standarddeclare:2,
  standardadopt:2, lawrelate:2, casedraft:2, reopen:2, whatchangedpropose:1, statementack:2, attribute:2, reviewgrant:2, reviewcomment:1, caseimport:2,
  testify:2, acquire:1, captureupload:2, capturerequest:1, capturerequests:1, hypothesishold:1, themeread:1, instance:1, progression:1, captureprogressions:1, thread:1, progressiondefine:2, discharge:2, themedeclare:1, themeplace:1, themepropose:1, themewithdraw:2, connectionassert:2, projectinvite:2, adoptversion:2, reminderanswer:2,
  standardadopt:2, lawrelate:2, casedraft:2, whatchangedpropose:1, statementack:2, attribute:2, reviewgrant:2, reviewcomment:1, caseimport:2,
  testify:2, acquire:1, captureupload:2, capturerequest:1, capturerequests:1, hypothesishold:1, hypothesisrevise:2, hypothesiswithdraw:3, inquirydivide:3, reevaluationrecord:2, reevaluations:1, standardinforce:1, themeread:1, instance:1, progression:1, captureprogressions:1, thread:1, progressiondefine:2, discharge:2, themedeclare:1, themeplace:1, themepropose:1, themewithdraw:2, connectionassert:2, projectinvite:2, adoptversion:2, reminderanswer:2,
  taskresolve:2, groupnameset:2, groupdomainset:2, profilesset:2, officesseed:2, assistantset:2, hostingaccessset:2, grouplanguagesset:2, grouplogoset:2, passwordreset:2, signrequest:1, publishatmove:2, publishatcancel:2, enroll:2,
  bootstrap:5, selftest:1, setpassword:2, accountreferenceset:2, projectcreated:2, wizarddraft:2, wizardrevise:1, wizardsubmit:2, wizardapprove:2,
  filingrecordsent:2, owed_groupprofileset:2, owed_groupprofilevisibility:2, memberlanguageset:1, owed_websitekeymint:2, owed_joinlinkset:2,
  owed_noteadd:1, owed_noteconvert:2, translationdraft:1, translationadopt:2, owed_checkrequest:2, knock:2, sourcelink:2,
  goallink:1, goalclose:3, aspirationretire:3,
  biasmanifest:1, biasinhale:1, biasdebt:1, biasadopt:2, biasdebtresolve:3,
  retire:3, planclose:3, filingapprove:3, personexpunge:5, adminremove:3, accountreferenceremove:3, subscriptiondisconnect:3, reviewrevoke:3, casedrafts:1, escalationend:3, wizardretire:3,
  signerrevokeown:3, importacceptwithdraw:3, contradictiondismiss:3, contradictionoptin:3, contradictionrespond:3, contradictionclarify:2, contradictiontakeup:2, contradictionresolve:2,
  retire:3, planclose:3, filingapprove:3, personexpunge:5, adminremove:3, accountreferenceremove:3, subscriptiondisconnect:3, reviewrevoke:3, escalationend:3, escalationresume:1, wizardretire:3,
  signerrevokeown:3, importacceptwithdraw:3,
  knocksof:1, knockerconsent:3, sourcedisclose:2, sourceconsent:3, sourceconsentwithdraw:2, sourcepersonlink:2, lead:1, leadread:1, leadlook:2, leadshare:3, monitoring:1, monitorpause:1, monitorslate:1, sweeps:1,
  release:4, attest:4, caseratify:4, docketpost:4, signerregisterown:4, claim:4, docketfile:2,
  publish:5, publishat:5, findin:1, securitymap:1, archivelist:1, openoriginal:1, safeview:1, deepercheck:1, releasescanhold:2, securitytooladd:2, securitytooltest:1, securitytoolremove:2, aikeepaway:2, openwithwarning:2,
};
const OUTWARD = new Set(['owed_aisend', 'owed_airesultsend', 'filingrecordsent', 'reviewgrant', 'knock', 'owed_groupprofilevisibility', 'disclosureshown', 'accountreferenceset', 'docketpost', 'publish', 'publishat', 'owed_websitekeymint', 'owed_joinlinkset']);
const key = op => op.startsWith('owed:') ? 'owed_' + op.slice(5).split(' ')[0] : op;
/* a button carrying its act and weight. o: {tone, icon, out, quiet, id, help}. S26, Bob's A (DEC-295): only an act heavier than
   Reversible shows its mark; a button without one does something you can undo. */
function btn(op, label, o = {}) {
  const w = o.w || WEIGHT[key(op)] || 2;
  const out = o.out ?? OUTWARD.has(key(op));
  const help = typeof ACT_HELP !== 'undefined' && ACT_HELP[key(op)];
  const say = o.help || help;  // o.help: what this button does here, when the act's general explanation would be vague in context
  return `<button type="button" class="cs-btn"${o.tone ? ` data-tone="${o.tone}"` : ''} data-act="${esc(op)}"${say ? ` data-level="2" data-tip="<b>${esc(label)}</b>: ${esc(say)}"` : ''}>${o.icon ? I(o.icon) : ''}${out ? I('outward') : ''}${esc(label)}${w >= 2 ? `<span class="w" data-w="${WNAME[w]}">${pips(w)}${WSHOW[WNAME[w]] || WNAME[w]}</span>` : ''}</button>`;  // S26 (DEC-295): no mark on a reversible act
}
/* a plain control with no act (navigation, a link) */
const link = (label, icon, help) => `<a href="#" onclick="return false" class="cs-btn" data-tone="quiet"${help ? ` data-level="2" data-tip="<b>${esc(label)}</b>: ${esc(help)}"` : ''}>${icon ? I(icon) : ''}${esc(label)}</a>`;
const grade = (scale, l, full, gloss) => `<span class="cs-grade" data-scale="${scale}" tabindex="0" aria-label="${scale} ${l}">${I(scale === 'ceiling' ? 'capture' : scale)}${full ? `<span class="sc">${full}</span> ` : ''}${l}</span>${gloss ? `<span class="cs-gloss">${gloss}</span>` : ''}`;
// DEC-160: anything the record holds that a screen names is a link: click opens it (here, the screen that shows it), hover
// or focus shows its card. `go` is the screen it opens.
const ref = (text, go, tip, cls = '') => `<a href="#" class="cs-ref${cls ? ' ' + cls : ''}" data-goto="${go}" data-tip="${esc(tip)}">${text}</a>`;
// a name or object that opens a card on hover, focus or tap (DEC-159)
const card = (text, tip) => `<span class="cs-card" tabindex="0" data-tip="${esc(tip)}">${text}</span>`;
const strength = (c, n, phrase, t, weak) => `<span class="cs-strength"${weak ? ` data-weak="${esc(weak)}"` : ''}>${grade('capture', c)}${grade('connection', n)}${t ? grade('testimony', t) : ''}<span class="phrase">${phrase}</span></span>`;
const gapm = (k, html) => `<span class="cs-gap" data-gap="${k}">${I({undetermined:'undetermined', withheld:'withheld', unrated:'unrated', nobody:'nobody', refused:'refused'}[k])}<span>${html}</span></span>`;
const origin = (k, t, tip) => `<span class="cs-origin" data-origin="${k}"${tip ? ` data-tip="${esc(tip)}"` : ''}>${I({machine:'machine', elsewhere:'elsewhere', unevaluated:'unevaluated', accepted:'accepted', flagged:'flagged', search:'search'}[k])}${esc(t)}</span>`;
const kindm = k => `<span class="cs-kind" data-kind="${k}">${I(k === 'todo' ? 'todo' : k)}${{todo:'To do', noticed:'Noticed', status:'Status'}[k]}</span>`;
const due = (s, t) => `<span class="cs-due"${s ? ` data-due="${s}"` : ''}>${I(s === 'met' ? 'accepted' : 'clock')}${esc(t)}</span>`;
const hint = t => `<span class="cs-hint">${I('hint')}${esc(t || 'Hint · machine work')}</span>`;
const pathm = cur => `<span class="cs-path">${['Working', 'Shared for review', 'Published'].map((s, i) => `<span${i === cur ? ' aria-current="step"' : ''}>${s}</span>`).join('<i>→</i>')}</span>`;
const ladder = (k, steps, on, pend = []) => `<div class="cs-ladder" data-ladder="${k}">${steps.map((s, i) => `<span class="${i < on ? 'on' : ''}${pend.includes(i) ? ' pend' : ''}">${esc(s)}</span>`).join('')}</div>`;
// DEC-153: wherever a member writes in their own words (a `rec` field), the assistant can help when it is reachable;
// never in a field stating a member's reason for an act (`reason`, K1841), never on an act the assistant is refused
// (affordances R7) or a signed or irreversible one (weight 4 or 5: publishing, at once or at a set time, signing, attesting),
// never where a labeled draft already fills the field, and not on the team's own description, which has its own guided
// draft (DEC-152). With the member's suggestions switch off it works only from what they typed (K1841 (2)).
const WRITE_ACT = 'writinghelp';
const WRITE_REFUSED = new Set(['release', 'conclude', 'withdrawconclusion', 'reopen', 'publish', 'inquirydivide', 'inquiryground',
  'actionmove', 'actioncorrespond', 'actionlaws', 'actionrisktier', 'versionaccept', 'versionreject', 'versionconsider', 'versionrevert',
  'versionhide', 'versioncurrent', 'contradictionresolve', 'caseratify', 'personexpunge', 'bootstrap', 'groupdescriptionset']);
let WRITE_ON = false;
const writeHelp = o => WRITE_ON && o.rec && !o.reason && !o.draft && !WRITE_REFUSED.has(o.act || '') && !((WEIGHT[key(o.act || '')] || 0) >= 4) ? `<div class="mk-acts">${btn(WRITE_ACT, 'Help me write this', { w: 1 })}</div>` : '';
function field(id, label, value = '', o = {}) {
  const tag = o.area ? 'textarea' : 'input';
  const cls = `cs-input${o.rec ? ' rec' : ''}${o.draft ? ' cs-draft' : ''}`;
  const v = o.area ? `>${esc(value)}</textarea>` : ` value="${esc(value)}">`;
  return writeHelp(o) ? fieldHtml(id, label, value, o, tag, cls, v) + writeHelp(o) : fieldHtml(id, label, value, o, tag, cls, v);
}
function fieldHtml(id, label, value, o, tag, cls, v) {
  return `<div class="cs-field"${o.act ? ` data-act="${esc(o.act)}"` : ''}><label for="${id}">${esc(label)}</label>${o.help ? `<span class="help">${o.help}</span>` : ''}<${tag} id="${id}" class="${cls}"${o.area ? '' : ' type="text"'}${o.area && o.rows ? ` rows="${o.rows}"` : ''}${v}${o.draft ? `<span class="cs-draftlabel">${I(o.draft === 'machine' ? 'machine' : 'wizard')}${o.draft === 'machine' ? 'Draft by the assistant, at your request · edit it until it is yours' : o.draft === 'template' ? 'Draft from your team\'s template · edit it until it is yours' : 'Draft from the wizard · edit it until it is yours'}</span>` : ''}</div>`;
}
const choice = (id, label, opts, sel, o = {}) => `<div class="cs-field"${o.act ? ` data-act="${esc(o.act)}"` : ''}><label for="${id}">${esc(label)}</label>${o.help ? `<span class="help">${o.help}</span>` : ''}<select id="${id}" class="cs-input"${o.onchange ? ` onchange="${o.onchange}"` : ''}>${opts.map((x, i) => `<option${o.data === true || i >= o.data ? ' class="mk-data"' : ''}${x === sel ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;
const checks = (name, opts, o = {}) => `<fieldset class="mk-checks"${o.act ? ` data-act="${esc(o.act)}"` : ''}${o.onchange ? ` onchange="${o.onchange}"` : ''}><legend>${esc(name)}</legend>${opts.map(([t, on], i) => `<label><input type="${o.radio ? 'radio' : 'checkbox'}" name="${esc(o.group || name)}"${on ? ' checked' : ''}> <span>${t}</span></label>`).join('')}</fieldset>`;
const h1 = (t, sub) => `<div class="mk-h"><h1 class="t-title">${t}</h1>${sub ? `<p class="mk-sub">${sub}</p>` : ''}</div>`;
// o.help: a heading that names a method or idea explains it for this screen's case (Bob, October 7, on "Spot-check")
const sec = (t, inner, o = {}) => `<section class="cs-section mk-sec"${o.act ? ` data-act="${esc(o.act)}"` : ''}><h2${o.help ? ` data-tip="${esc(o.help)}"` : ''}>${t}</h2>${inner}</section>`;
const sheet = inner => `<div class="cs-sheet">${inner}</div>`;
const row = (a, b, c = '', meta = '') => `<div class="cs-row">${a}<span>${b}</span>${c}${meta ? `<span class="meta">${meta}</span>` : ''}</div>`;
const note = t => `<p class="mk-note">${t}</p>`;
const acts = (...b) => `<div class="mk-acts">${b.join('')}</div>`;
/* DEC-410: "Follow from here" (DEC-409): one control, the same on every person, organization, payment, donation, event and
   document. It opens a small menu of the other dimensions; each is one act that opens that dimension's screen already
   scoped to the item, in place. Ops reuse the target screen's own act where it exists (search, explore, registersearch). */
const FOLLOW_OP = 'owed:followfrom DEC-409', FOLLOW_ROWS = 'owed:registersearch DEC-406';
const FOLLOW = {
  who: [['Payments made or received', FOLLOW_OP], ['Donations given or received', FOLLOW_OP], ['Organizations and offices held', FOLLOW_OP], ['Laws and standards that bind them', FOLLOW_OP], ['Events taken part in', FOLLOW_OP], ['Documents that name them', 'search'], ['Register rows that name them', FOLLOW_ROWS], ['Connections to…', 'explore']],
  money: [['Who paid and who received it', FOLLOW_OP], ['Other payments from the same source', FOLLOW_OP], ['Events it is tied to', FOLLOW_OP], ['Documents that state it', 'search'], ['Register rows that match it', FOLLOW_ROWS], ['Connections to…', 'explore']],
  event: [['Who took part', FOLLOW_OP], ['Money that moved around it', FOLLOW_OP], ['Documents that date it', 'search'], ['Register rows from that time', FOLLOW_ROWS], ['Connections to…', 'explore']],
  document: [['People and organizations it names', FOLLOW_OP], ['Money it states', FOLLOW_OP], ['Events it dates', FOLLOW_OP], ['Laws and standards it cites', FOLLOW_OP], ['Register rows that match it', FOLLOW_ROWS], ['Connections to…', 'explore']]
};
/* DEC-447 (B543 (4)): a fund is followed from as an organization is, without offices held or laws that bind it */
FOLLOW.fund = FOLLOW.who.filter(([l]) => l !== 'Organizations and offices held' && l !== 'Laws and standards that bind them' && l !== 'Donations given or received');
const follow = kind => `<details class="mk-details mk-follow" data-follow="${kind}"><summary data-tip="${esc('Opens another view of this item in place: the screen for that dimension, already narrowed to it. Nothing starts over.')}">Follow from here</summary><div class="mk-acts">${FOLLOW[kind].map(([l, op]) => btn(op, l, { tone: 'quiet' })).join('')}</div></details>`;
const machine = (who, inner) => `<div class="cs-machinework">${inner}<span class="by">${I('machine')}Machine work · the assistant, at ${who === 'you' ? 'your request' : esc(who) + '\'s request'}</span></div>`;
const wizmark = (n, names) => `<button type="button" class="cs-wizmark" title="${esc(names)}">${I('wizard')}Show me how${n > 1 ? ` (${n})` : ''}</button>`;
const crumbs = list => `<nav class="mk-crumbs" aria-label="Where you are">${list.map(esc).join(' <i>›</i> ')}</nav>`;
