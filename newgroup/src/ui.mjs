/* The installer's first page (`GET /`), its update page (`GET /update`), and the head and few layout rules every page it
 * serves shares, the progress page and the plain pages included (index.mjs).
 *
 * R53 (DEC-122 (3); K3100): every page uses `interface-assets`' stylesheet and faces, carried in this bundle and served by
 * the installer itself at `/app/assets/<name>` (index.mjs, `assetResponse`), the same path the team's Civicsmith serves
 * them at, so the stylesheet is used byte for byte; PAGE_CSS adds only the installer's own layout, in the stylesheet's
 * tokens. R35: nothing is named on another origin; the page's icon is an empty `data:` one, so a browser asks no
 * `/favicon.ico` (R1's 404).
 *
 * R50 (N1003; DEC-201 (4), DEC-206 (4)): the first page asks only the permanent short name (R41's dialog) and the places
 * (R21), with what is needed in one block (R23; doubt 7: civicsmith.org does not serve yet, so the block stays here);
 * then "Before Cloudflare" says in plain words what Cloudflare will be asked to allow, and R34's words (instance-setup's
 * HOSTING_CONTROL); "Continue to Cloudflare" sends `POST /begin`. R37's assistant paragraph and R45's optional Workers VPC
 * field sit there folded, closed by default: on the page, never one of its asks. R52 (DEC-201 (8)): the update page draws
 * the release your team's Civicsmith runs and the one this update installs, and says a stop leaves it running as it was.
 *
 * R22 (N5, K262; DEC-124): every page names the product, Civicsmith (PRODUCT), speaks to "your team", and says the
 * installer is run by the publisher of Civicsmith releases (PUBLISHER). R23: the first page's one block states the
 * prerequisites the install enforces, the Containers permission and what it installs, and (T46) the container parts the
 * carried release cannot install (LEFT_OUT). R41 (DEC-143): the act that chooses the short name carries the Irreversible
 * weight and opens a full dialog saying it is permanent. R42 (DEC-146): the one line saying what Civicsmith is, and its
 * second line, held here once. The words are the design stream's (`mock-screens.js` SCR.install, SCR.update) where it
 * gives them.
 */

import { layers as heldLayers } from "../../jurisdictions/index.mjs";
/* R72: every sentence a key holds is read by key (words.mjs); a sentence no key holds stays here, in "team" words, and is reported. */
import { word, hasWord, localize } from "./words.mjs";
/* R96: the hints and the jurisdictions a placement may name, `installer-steps`' own lists (its R46), through its barrel (R80). */
import { LOCATION_HINTS, JURISDICTIONS } from "./steps/index.mjs";
import { guideReady, guideStage, GUIDE_SCRIPT } from "./guide.mjs";
/* R92: every Cloudflare page a reader follows is held in the installer's two link tables, never here. */
import { GET_READY_LINKS } from "./ready.mjs";
/* R23 (T46): the container images the release this installer carries names (recorded by the embed from its signed fleet
   statement), and the one statement of what cannot install yet. */
import { RELEASE_VERSION, RELEASE_CONTAINERS } from "./release.mjs";
import { leftOutNotice } from "./images.mjs";
/* R34, R50 (instance-setup R47, R83): who really controls your team's Civicsmith, in instance-setup's words, held there once. */
import { HOSTING_CONTROL } from "../../bio-plane/src/setup-fleet.mjs";

export const PRODUCT = "Civicsmith";
export const PUBLISHER = word("installer.publisher");
/* The example name is not a place (R22): a group names itself for what it does. */
export const EXAMPLE_SLUG = "clean-water-coalition";
export const publisherFooter = () => `<p class="muted ng-small publisher">${PUBLISHER}</p>`;

/* R53: where the stylesheet is linked from (index.mjs serves it from `interface-assets`' ASSET_FILES), and the head every
   page carries: the stylesheet, the installer's layout, and an icon that loads nothing. */
export const ASSET_PREFIX = "/app/assets/";
export const STYLESHEET = `${ASSET_PREFIX}civicsmith.css`;
const escText = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* A key's sentence as a script's string literal (R19: `<` never closes the element it rides in). */
const js = (s) => JSON.stringify(s).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
/* A key whose sentence holds one drawn element (a link, the name typed into the page): the sentence is written with a mark
   where the element goes, escaped as text, and the element put in its place. */
export const SLOT = "\u0001";
export const around = (sentence, html) => escText(sentence).replace(SLOT, html);
export const pageHead = (title, { description = null, noindex = false } = {}) => `<!doctype html>
<html lang="en" class="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${noindex ? `<meta name="robots" content="noindex">\n` : ""}<title>${escText(title)}</title>
${description ? `<meta name="description" content="${escText(description)}">\n` : ""}<link rel="icon" href="data:,">
<link rel="stylesheet" href="${STYLESHEET}">
<style>${PAGE_CSS}</style>
</head>`;
/* The wordmark every page opens with, as the setup frame's head draws it. */
export const pageMark = (what = "installer") => `<p class="ng-mark"><span class="ng-word">${PRODUCT}</span> <span class="eyebrow">${what}</span></p>`;

/* R42 (DEC-146 (1)-(3)): what Civicsmith is, in one line, and the second line for where there is room; the same two lines
   as public-read R30's credit page, held here once rather than imported (an import would add the plane's code to this
   bundle). The invitation page (bio-plane/public/newgroup/index.html) carries the same two lines as static text. */
export const DESCRIPTION = word("public-read.free_software_groups");
export const WHO = word("public-read.neighborhood_issue_groups");
const whatBlock = () => `<p class="what">${escText(DESCRIPTION)}</p>
<p class="small who">${escText(WHO)}</p>`;

/* R41 (DEC-143, DEC-87, DEC-88): an act that can never be undone shows the Irreversible weight on its button: the five
   pips of the visual language's acts (`cs-pips`), the weight's word always beside them. */
export const IRREVERSIBLE = `<span class="w"><span class="cs-pips" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></span>${escText(word("weight.irreversible.name"))}</span>`;
/* R41: the full dialog the short name's act opens. Its heading names the short name typed (filled in as text by the
   page's script); its words are the design stream's, with the worker's name added as R41 states it. Its confirming act
   draws "Before Cloudflare" (R50), whose "Continue to Cloudflare" alone sends /begin; "Choose another name", or closing
   the dialog, sends nothing. */
export const PERMANENCE = word("screen.install.permanent");
const confirmDialog = () => `<dialog id="confirm" class="cs-dialog" aria-labelledby="confirm-h">
<h2 id="confirm-h">${around(word("installer.permanent.heading", { name: SLOT }), `<span class="id" id="confirm-name"></span>`)}</h2>
<p class="ends">${escText(PERMANENCE)}</p>
<div class="ng-acts"><button type="button" class="cs-btn" data-tone="primary" id="confirm-yes">${escText(word("installer.permanent.continue"))}${IRREVERSIBLE}</button>
<button type="button" class="cs-btn" data-tone="quiet" id="confirm-no">${escText(word("installer.permanent.cancel"))}</button></div>
</dialog>`;

/* R21 (N10), as R94 (T53; N1257; DEC-404; K5452, K5497) amends it: the install asks where the team's work is focused, a set
   of places, and offers the held places of every level (`jurisdictions.layers`, Civicsmith's own; a test profile and the team
   layer are no place offered), each by name and the place it covers, as one list grouped by state. The federal layer is the
   only one preselected and may be removed; nothing below it is. The places are `jurisdictions`' data, shown as data
   (layers.md, "No jurisdiction in the product", rules 1-2): the installer's own words name no place (R31). */
const LAYERS = heldLayers().filter((l) => l.origin === "civicsmith");
export const PROFILE_CHOICES = Object.freeze(LAYERS.map(({ id, name, level, place, within }) =>
  Object.freeze({ id, name, level, place, within, covers: Object.freeze([place]) })));
const PLACE_OF = new Map(PROFILE_CHOICES.map((p) => [p.id, p]));
/* The one layer preselected: the federal one, which sits within no other. */
export const FEDERAL = PROFILE_CHOICES.find((p) => p.level === "federal" && !p.within)?.id ?? null;
/* R94 (`instance-setup` R107): the ids bound for a set chosen, with the layers each sits within added, in `jurisdictions`' order
   (federal, then each layer after the one it sits within). `ids` are held places (index.mjs refuses any other first). Pure. */
export function placesBound(ids) {
  const keep = new Set();
  for (const id of ids) for (let p = PLACE_OF.get(id); p && !keep.has(p.id); p = PLACE_OF.get(p.within)) keep.add(p.id);
  return PROFILE_CHOICES.filter((p) => keep.has(p.id)).map((p) => p.id);
}
/* The state a place sits in (itself for a state), or null for the federal layer. */
const stateOf = (p) => { for (let q = p; q; q = PLACE_OF.get(q.within)) if (q.level === "state") return q.id; return null; };
export const PROFILES_NONE = word("screen.install.places.none");
/* The places in the order the page draws them (the federal layer, then each state's places, then any in no state), and, for each,
   the position of the place it sits within (-1 for none): the page's script adds a place's parents by position, so it names no
   place of its own (R31). */
const DRAWN = [...PROFILE_CHOICES.filter((p) => p.id === FEDERAL),
  ...PROFILE_CHOICES.filter((p) => p.level === "state").flatMap((s) => PROFILE_CHOICES.filter((p) => stateOf(p) === s.id)),
  ...PROFILE_CHOICES.filter((p) => p.id !== FEDERAL && !stateOf(p))];
const AT = new Map(DRAWN.map((p, i) => [p.id, i]));
const WITHIN_AT = DRAWN.map((p) => (p.within && AT.has(p.within) ? AT.get(p.within) : -1));
const placeChoice = (p) => `<label class="choice"><input type="checkbox" id="place-${AT.get(p.id)}" name="profile" value="${escText(p.id)}"${p.id === FEDERAL ? " checked" : ""}>`
  + `<span class="pname">${escText(p.name)}</span> <span class="small pcovers">${escText(word("installer.places.covers", { covers: p.covers.join(", ") }))}</span>`
  + ` <span class="small added" id="added-${AT.get(p.id)}"></span></label>`;
const placesBlock = () => {
  const states = PROFILE_CHOICES.filter((p) => p.level === "state");
  const loose = PROFILE_CHOICES.filter((p) => p.id !== FEDERAL && !stateOf(p));
  return `<section class="cs-section ng-sec" id="places">
<h2>${escText(localize("installer.places.focus", "Where does your work focus?"))}</h2>
<p>${escText(word("screen.install.places.help"))}</p>
<p id="places-us">${escText(localize("installer.places.usonly", "Civicsmith ships places in the United States only. If your work is somewhere else, name that place when you set up your team's Civicsmith, and add its offices and rules yourself, each with its source."))}</p>
<fieldset class="profiles" id="profiles">
<legend class="muted ng-small">${escText(word("installer.places.legend"))}</legend>
${FEDERAL ? `${placeChoice(PLACE_OF.get(FEDERAL))}
<p class="small" id="places-federal">${escText(localize("installer.places.federal.what", "The federal layer is chosen for you. Remove it only if your team's work is outside the United States: then no place is chosen, and your team enters its own deadlines and offices."))}</p>` : ""}
${states.map((s) => `<fieldset class="profiles ng-state"><legend class="ng-small pstate">${escText(s.place)}</legend>
${PROFILE_CHOICES.filter((p) => stateOf(p) === s.id).map(placeChoice).join("\n")}
</fieldset>`).join("\n")}
${loose.map(placeChoice).join("\n")}
<label class="choice"><input type="checkbox" id="profile-none" name="profile-none" value="none"><span class="pname">${escText(PROFILES_NONE)}</span></label>
</fieldset>
<p class="small" id="places-team">${escText(localize("installer.places.teamlayer", "After the install, your team can add facts about its own counties and cities, each with its source, to its team layer."))}</p>
</section>`;
};

/* R96 (T53; N1273; K5440, K5441, K5443): the region your team's record will use, and two honest choices: near me (the hint
   `installer-steps` answers from the founder's request by default, a list to pick another) and keep my data in this region (a
   jurisdiction). Before the choice the page says it is made once and moving later is an export and an import (K5441), and what
   each choice is. The hints offered are those the word table names a region for. */
export const REGION_HINTS = Object.freeze(LOCATION_HINTS.filter((h) => hasWord(`screen.install.region.${h}`)));
export const REGION_JURISDICTIONS = Object.freeze([...JURISDICTIONS]);
const regionBlock = (hint) => `<section class="cs-section ng-sec" id="region">
<h2>${escText(word("screen.install.region.head"))}</h2>
<p id="region-final">${escText(word("screen.install.region.final"))}</p>
${hint ? `<p id="region-default" data-hint="${escText(hint)}">${escText(word("screen.install.region.near", { region: word(`screen.install.region.${hint}`) }))}</p>` : ""}
<fieldset class="profiles" id="region-choice">
<label class="choice"><input type="radio" id="region-mode-near" name="region" value="near" checked><span class="pname">${escText(localize("installer.region.near.label", "Near me"))}</span></label>
<p class="small">${escText(word("screen.install.region.near.what"))}</p>
<div class="cs-field"><label for="region-near">${escText(word("screen.install.region.near.other"))}</label>
<select id="region-near" class="cs-input">${hint ? "" : `<option value=""></option>`}${REGION_HINTS.map((h) => `<option value="${h}"${h === hint ? " selected" : ""}>${escText(word(`screen.install.region.${h}`))}</option>`).join("")}</select></div>
<label class="choice"><input type="radio" id="region-mode-keep" name="region" value="keep"><span class="pname">${escText(word("screen.install.region.keep"))}</span></label>
<p class="small">${escText(word("screen.install.region.keep.what"))} ${escText(word("screen.install.region.help"))}</p>
<div class="cs-field"><label for="region-keep">${escText(word("screen.install.region.field"))}</label>
<select id="region-keep" class="cs-input"><option value=""></option>${REGION_JURISDICTIONS.map((j) => `<option value="${j}">${escText(word(`screen.install.region.${j}`))}</option>`).join("")}</select></div>
</fieldset>
</section>`;

/* R37 (T36; N721, DEC-172; K1957, K2063 (5)): the assistant is optional, and its two settings are made in the team's
   Civicsmith at its setup, separately, nothing preselected (`screens-entry`'s setup): whether the group pays for it (its
   own Anthropic API key, set by an administrator there), and whether the group keeps its material away from AI (off
   unless an administrator turns it on, with a reason). A member may always connect their own account, serving only them,
   unless the group keeps its material away from AI; each member is told what goes to Anthropic before their first use
   (instance-setup R54; credentials R36). The installer takes no choice and binds no Claude credential (R36). */
export const ASSISTANT_OFFER = word("installer.assistant.offer");
/* R57 (amends R23, R37, R38): the assistant's prerequisite, stated plainly; no page ties it to a container. */
export const ASSISTANT_NEEDS = word("installer.assistant.needs");
const assistantBlock = () => `<details class="ng-fold" id="about-assistant"><summary>${escText(word("installer.assistant.summary"))}</summary>
<p>${escText(ASSISTANT_OFFER)}</p></details>`;

/* R45 (T36; N710; K1946 T4): where the organization's own security tools are added, and that this installer takes none.
   Said on the install page, the final panel and the update's last screen. */
export const SECURITY_TOOLS = word("installer.security.tools");
/* R45: the optional Workers VPC service a tool reached through a tunnel needs, on the install and the update pages
   alike, folded and closed by default (R50: never one of the first page's asks). Nothing is filled in for the operator. */
const securityBlock = () => `<details class="ng-fold" id="security-fold"><summary>${escText(word("installer.security.summary"))}</summary>
<p>${escText(SECURITY_TOOLS)}</p>
<div class="cs-field"><label for="vpc">${escText(word("installer.security.vpc.label"))}</label>
<input id="vpc" class="cs-input id" type="text" autocomplete="off" spellcheck="false" placeholder="${escText(word("installer.security.vpc.placeholder"))}">
<p class="help">${escText(word("installer.security.vpc.help"))}</p></div></details>`;

/* R50 (and R2's six scopes): what Cloudflare will ask you to allow, in plain words, one line per scope, in R2's order. */
export const ALLOWED = Object.freeze([
  word("screen.install.cf.programs"),
  word("screen.install.cf.plan"),
  word("screen.install.cf.containers"),
  word("screen.install.cf.join"),
  word("screen.install.cf.logs"),
]);
const allowedBlock = () => `<section class="cs-section ng-sec" id="allowed">
<h2>${escText(word("screen.install.cf.asks"))}</h2>
<ul class="ng-list">${ALLOWED.map((l) => `<li>${escText(l)}</li>`).join("")}</ul>
<p>${escText(word("installer.allowed.note"))}</p>
</section>`;

/* R50 with R34 (DEC-109): who really controls your team's Civicsmith, in instance-setup's words (HOSTING_CONTROL), under
   the design stream's heading for this moment; the guide's sentence is the claim's and the final panel's. Nothing asks
   for or records an acknowledgement of it. */
export const BEFORE_CLOUDFLARE_CONTROL = word("screen.install.hold.head");
const controlBlock = () => `<section class="cs-sheet ng-block" id="control-before">
<h2>${escText(BEFORE_CLOUDFLARE_CONTROL)}</h2>
${HOSTING_CONTROL.sentences.map((s) => `<p>${escText(s)}</p>`).join("\n")}
</section>`;

/* R53: the installer's own layout, in the stylesheet's tokens (its colours, type and space); everything else is the
   stylesheet's own components (`cs-btn`, `cs-field`, `cs-input`, `cs-dialog`, `cs-sheet`, `cs-row`, `cs-gap`, `cs-pips`). */
export const PAGE_CSS = `
body{margin:0;min-height:100vh}
.ng{max-width:680px;margin:0 auto;padding:var(--s-6) var(--s-4) var(--s-8);display:grid;gap:var(--s-5)}
.ng[hidden],.ng [hidden]{display:none}
.ng h1{font:600 var(--t-2xl)/var(--lh-tight) var(--f-sans)}
.ng h2{font:600 var(--t-lg)/1.3 var(--f-sans)}
.ng p{margin:0;max-width:var(--measure);line-height:var(--lh-read)}
.ng-mark{display:flex;align-items:baseline;gap:var(--s-2);margin:0}
.ng-word{font:600 var(--t-xl)/1 var(--f-serif);color:var(--c-accent)}
.ng-stage{display:grid;gap:var(--s-5)}
.ng-sec{gap:var(--s-2)}
.ng-small,.small{font-size:var(--t-sm);color:var(--c-muted)}
.what{font-size:var(--t-lg)}
.lede{font-size:var(--t-lg);color:var(--c-ink-2)}
.ng-list{margin:0;padding-left:var(--s-5);display:grid;gap:var(--s-2);max-width:var(--measure)}
.ng-block{padding:var(--s-4);display:grid;gap:var(--s-2)}
.ng-acts{display:flex;flex-wrap:wrap;gap:var(--s-2);align-items:center}
.help{font-size:var(--t-sm);color:var(--c-muted)}
fieldset.profiles{border:0;padding:0;margin:0;display:grid;gap:var(--s-2)}
fieldset.profiles legend{padding:0;margin:0 0 var(--s-2)}
.choice{display:block;border:var(--hair);background:var(--c-surface);padding:var(--s-3) var(--s-4);cursor:pointer}
.choice:hover{border-color:var(--c-accent)}
.choice input{margin-right:var(--s-2)}
.ng-fold{border-top:var(--hair);padding-top:var(--s-3);display:grid;gap:var(--s-3)}
.ng-fold>summary{cursor:pointer;font-weight:600;color:var(--c-accent)}
.ng-fold[open]>*:not(summary){margin-top:var(--s-3)}
.err{color:var(--c-signal);font-size:var(--t-sm);min-height:1.4em}
.ng-log .cs-row .mk{font-size:var(--t-xs);font-weight:700;letter-spacing:var(--track-caps);text-transform:uppercase;min-width:4.5em}
.ng-log .cs-row[data-r="go"] .mk{color:var(--c-muted)}
.ng-log .cs-row[data-r="ok"] .mk{color:var(--c-ready)}
.ng-log .cs-row[data-r="no"] .mk{color:var(--c-signal)}
.ng-stop{display:grid;gap:var(--s-2);padding:var(--s-4);background:var(--c-signal-tint);border-left:3px solid var(--c-signal)}
.ng-stop[hidden]{display:none}
.notice{display:grid;gap:var(--s-2);padding:var(--s-4);background:var(--c-signal-tint);border-left:3px solid var(--c-signal)}
.okbox{display:grid;gap:var(--s-2);padding:var(--s-4);background:var(--c-accent-tint);border-left:3px solid var(--c-accent)}
.card{display:grid;gap:var(--s-2);padding:var(--s-4);background:var(--c-surface);border:var(--hair)}
.kv{display:flex;flex-wrap:wrap;gap:var(--s-2) var(--s-3);align-items:baseline;padding:var(--s-2) 0;border-top:var(--hair)}
.kv:first-child{border-top:0}
.kv .k{color:var(--c-muted);min-width:150px}
.kv .v{font-family:var(--f-mono);font-size:var(--t-sm);word-break:break-all;flex:1}
button.copy{font:600 var(--t-xs)/1.2 var(--f-sans);padding:4px 10px;background:transparent;color:var(--c-accent);
  border:var(--hair);border-radius:var(--r-1);cursor:pointer}
button.copy:hover{background:var(--c-accent-tint)}
.mono{font-family:var(--f-mono);font-size:.9em;word-break:break-all}
.publisher{border-top:var(--hair);padding-top:var(--s-4)}
dialog.cs-dialog{color:var(--c-ink)}
dialog.cs-dialog:not([open]){display:none}
dialog.cs-dialog::backdrop{background:rgb(10 20 25 / .45)}
`;

/* R23 (T46; N897 (4)): before the install begins, the install and update pages say, per member, which container part
   the release this installer carries cannot install (its image is not where your Cloudflare account can pull it), and
   what your team's Civicsmith then lacks. Nothing when every image installs. */
export const LEFT_OUT = leftOutNotice(RELEASE_CONTAINERS, RELEASE_VERSION);

/* R23 (and doubt 7): what is needed, in the first page's one block. R57: the assistant's prerequisite is a Claude plan with cloud
   sessions; nothing here ties it to a container, and the Containers permission is named for what it installs (the file scanner
   and the safe view, `screen.install.cf.containers`). */
const needBlock = () => `<section class="cs-section ng-sec" id="need">
<h2>${escText(word("installer.need.heading"))}</h2>
<ul class="ng-list">
<li>${escText(word("screen.install.need.cloudflare"))} ${escText(word("installer.need.cloudflare.check"))} ${around(word("installer.need.create", { link: SLOT }), `<a href="${GET_READY_LINKS.account.url}" rel="noopener">${escText(word("installer.need.create.link"))}</a>`)}</li>
<li>${escText(word("screen.install.cf.containers"))}</li>
<li id="need-claude">${escText(word("screen.install.need.claude"))} ${escText(ASSISTANT_NEEDS)}</li>
<li>${escText(word("installer.need.time"))}</li>
</ul>
${LEFT_OUT}
</section>`;

/* The pages' one script (R41, R50, R52). It touches only elements by id, and the profiles by name. On the first page the
   short name's act opens the permanence dialog; its confirming act draws "Before Cloudflare" and sends nothing; there,
   "Continue to Cloudflare" sends /begin with the name the dialog showed; "Back" returns. On the update page the one act
   sends /begin. */
const pageScript = (mode, version = null) => `<script>
const $=s=>document.querySelector(s);
const slugify=v=>v.toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);
const WITHIN=${js(WITHIN_AT)};
const ADDED=${js(localize("installer.places.added", "Added, because a place you chose is within it."))};
const boxes=()=>[...document.querySelectorAll('input[name="profile"]')];
const mark=(i,t)=>{const a=$("#added-"+i);if(a)a.textContent=t;};
const inside=(c,i)=>{for(let p=WITHIN[c];p>=0;p=WITHIN[p])if(p===i)return true;return false;};
boxes().forEach((b,i)=>b.addEventListener("change",()=>{const all=boxes();
  if(b.checked){if($("#profile-none"))$("#profile-none").checked=false;
    for(let p=WITHIN[i];p>=0;p=WITHIN[p])if(all[p]&&!all[p].checked){all[p].checked=true;mark(p,ADDED);}}
  else{mark(i,"");all.forEach((c,k)=>{if(c.checked&&inside(k,i)){c.checked=false;mark(k,"");}});}}));
if($("#profile-none"))$("#profile-none").addEventListener("change",e=>{if(e.target.checked)boxes().forEach((b,i)=>{b.checked=false;mark(i,"");});});
const region=()=>{if(!$("#region-choice"))return {};const r=document.querySelector('input[name="region"]:checked');
  if(r&&r.value==="keep"){const j=$("#region-keep").value;return j?{region:{jurisdiction:j}}:null;}
  const h=$("#region-near")?$("#region-near").value:"";return h?{region:{hint:h}}:{};};
$("#slug").addEventListener("input",e=>{const p=e.target.selectionStart;e.target.value=slugify(e.target.value);
  try{e.target.setSelectionRange(p,p)}catch{}});
async function begin(slug,btn,err){
  const rg=region();
  if(!rg){err.textContent=${js(localize("installer.region.keep.none", "Choose the region your team's record must be kept in."))};return;}
  btn.disabled=true;
  try{
    const r=await fetch("/begin",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({slug,mode:"${mode}",${version ? `version:"${version}",` : ""}...($("#profiles")?{profiles:boxes().filter(b=>b.checked).map(b=>b.value)}:{}),...rg,...($("#vpc")&&$("#vpc").value.trim()?{securityVpc:$("#vpc").value.trim()}:{}),...($("#ai")&&$("#ai").value.trim()?{instanceAi:$("#ai").value.trim()}:{})})});
    const j=await r.json();
    if(!j.ok){err.textContent=j.error||${js(word("installer.shortname.refused"))};return;}
    location.href=j.authorize;
  }catch(e){err.textContent=${js(word("installer.begin.failed", { message: SLOT }))}.replace(${js(SLOT)},e.message);}
  finally{btn.disabled=false;}
}
const dlg=$("#confirm");
$("#go").addEventListener("click",()=>{
  const err=$("#err");err.textContent="";
  const slug=slugify($("#slug").value);
  if(slug.length<3){err.textContent=${js(word("installer.shortname.toofew"))};$("#slug").focus();return;}
  if(!dlg){begin(slug,$("#go"),err);return;}
  $("#confirm-name").textContent=slug;dlg.dataset.slug=slug;dlg.showModal();
});
if(dlg){
  $("#confirm-yes").addEventListener("click",()=>{const slug=dlg.dataset.slug;dlg.close();
    $("#chosen-name").textContent=slug;$("#stage-before").dataset.slug=slug;$("#stage-choose").hidden=true;$("#stage-before").hidden=false;});
  $("#confirm-no").addEventListener("click",()=>dlg.close());
  $("#back").addEventListener("click",()=>{$("#err2").textContent="";delete $("#stage-before").dataset.slug;$("#stage-before").hidden=true;$("#stage-choose").hidden=false;});
  $("#cloudflare").addEventListener("click",()=>{const err=$("#err2");err.textContent="";const slug=$("#stage-before").dataset.slug;
    if(!slug)return;begin(slug,$("#cloudflare"),err);});
}
</script>`;

/* `GET /`: R50's two stages in one page (the second hidden until the dialog's confirming act), then the publisher's line. */
export const INSTALL_TITLE = word("screen.install.name");
/* R96: the page is drawn for the founder's own request: `hint` is the region `installer-steps`' `locationHintFor` answers from its
   `cf` (null when it answers none: the list then preselects nothing, and an install with no pick has no hint, R83). */
export const wizardHtml = (hint = null) => `${pageHead(INSTALL_TITLE, { description: DESCRIPTION })}
<body class="cs">
<main class="cs-frame ng">
${pageMark()}
${guideReady() ? guideStage() : ""}
<div class="ng-stage" id="stage-choose">
<h1>${escText(INSTALL_TITLE)}</h1>
${whatBlock()}
<p class="lede">${escText(word("screen.install.sub"))}</p>
${needBlock()}
<section class="cs-section ng-sec" id="short-name">
<h2>${escText(word("screen.install.short.heading"))}</h2>
<p>${escText(word("screen.install.names", { example: "Lakeshore Tenants" }))}</p>
<div class="cs-field"><label for="slug" id="slug-label">${escText(word("installer.shortname.label"))}</label>
<input id="slug" class="cs-input id" type="text" autocomplete="off" spellcheck="false" placeholder="${EXAMPLE_SLUG}">
<p class="help" id="slug-hint">${escText(word("installer.shortname.hint"))}</p></div>
</section>
${placesBlock()}
${regionBlock(REGION_HINTS.includes(hint) ? hint : null)}
<div class="ng-acts"><button id="go" class="cs-btn" data-tone="primary">${escText(word("installer.action.continue"))}${IRREVERSIBLE}</button></div>
<p class="err" id="err" role="alert"></p>
</div>
${confirmDialog()}
<div class="ng-stage" id="stage-before" hidden>
<h1>${escText(word("screen.install.cf.title"))}</h1>
<p class="lede">${escText(word("screen.install.cf.sub"))} ${around(word("installer.page.chosen", { name: SLOT }), `<b class="id" id="chosen-name"></b>`)}</p>
${allowedBlock()}
${controlBlock()}
${assistantBlock()}
${securityBlock()}
<p id="check-sub">${escText(word("screen.install.check.sub"))} ${escText(word("screen.install.check.creates"))}</p>
<div class="ng-acts"><button id="cloudflare" class="cs-btn" data-tone="primary">${escText(word("act.owed_installcheck.label.install"))}</button>
<button type="button" id="back" class="cs-btn" data-tone="quiet">${escText(word("installer.action.back"))}</button></div>
<p class="err" id="err2" role="alert"></p>
<p class="muted ng-small">${escText(word("installer.manual.note"))}</p>
</div>
<p class="muted ng-small">${around(word("installer.page.updatelink", { link: SLOT }), `<a href="/update">${escText(word("installer.page.updatelink.link"))}</a>`)}</p>
${publisherFooter()}
</main>
${/* R91: the first page's act begins "Check my account" (R86); the install begins only from the list's "Install now" (R90). */ pageScript("check")}
${guideReady() ? GUIDE_SCRIPT : ""}
</body>
</html>`;
export const WIZARD_HTML = wizardHtml(null);

/* R55 (T48; N1047; DEC-226 (4)): the release this page installs is the one chosen in Settings › Updates and no other. Its
   address is `<installer>/update?version=<V>` (`instance-setup` R90); V is of `signatures`' R47 form, digits only, no
   leading zero. Nothing else is read from the address. */
export const VERSION_RE = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
export const versionOk = (v) => typeof v === "string" && v.length <= 32 && VERSION_RE.test(v);

/* R55: the update's words, the design stream's (keys `installer.update.*`), read here once; `{x}` is the key's own
   placeholder. The date of `chosen` is drawn only when the caller has a signed one (the address carries none,
   and the manifest none, so the page draws the line without it; J1). */
export const UPDATE_WORDS = Object.freeze({
  running: (version) => word("installer.update.running", { version }),
  chosen: (version, date = null) => (date ? word("installer.update.chosen", { version, date }) : word("installer.update.chosen.nodate", { version })),
  only: word("installer.update.only"),
  checked: word("installer.update.checked"),
  progressTitle: word("installer.update.progress.title"),
  progressSays: (from, to, account) => word("installer.update.progress.says", { from, to, account }),
  progressVerified: (to) => word("installer.update.progress.verified", { to }),
  progressRead: (from) => word("installer.update.progress.read", { from }),
  progressPlacing: (to) => word("installer.update.progress.placing", { to }),
  progressAnswers: word("installer.update.progress.answers"),
  tryAgain: word("installer.update.tryagain"),
  doneTitle: word("installer.update.done.title"),
  doneSays: (to, from) => word("installer.update.done.says", { to, from }),
  doneAnswers: (to) => word("installer.update.done.answers", { to }),
  doneKept: word("installer.update.done.kept"),
  doneNote: (to) => word("installer.update.done.note", { to }),
  back: word("installer.update.back"),
});

/* `GET /update` (R52): the release your team's Civicsmith runs is not known here (its address is the account's, which
   only Cloudflare's permission lets the installer read), so this page draws it as the line it becomes; the progress page
   and the last screen draw the version before and after once it is read (index.mjs, runUpdate). */
export const UPDATE_TITLE = word("installer.update.page.title");
export const UPDATE_KEEPS = word("installer.update.keeps");
/* R55: `version` is the release chosen, or anything else for the page that says none was. */
export const NO_RELEASE_CHOSEN = word("installer.update.norelease");
/* R55, R75: what an update says when it is begun with no release chosen, drawn after NO_RELEASE_CHOSEN. */
export const NO_RELEASE_BEGIN = word("installer.update.norelease.begin");
/* Cloudflare's own name for the permission the update asks one more of (R2; a name, not a sentence). */
const CONTAINERS_SCOPE = "Workers Containers";
const noReleaseHtml = () => `${pageHead(UPDATE_TITLE, { description: word("installer.update.page.description.none") })}
<body class="cs">
<main class="cs-frame ng">
${pageMark("update")}
<div class="ng-stage" id="no-release">
<h1>${escText(UPDATE_TITLE)}</h1>
<p class="lede">${escText(NO_RELEASE_CHOSEN)} ${escText(word("installer.update.norelease.lede"))}</p>
<p>${around(word("installer.update.norelease.how", { update: SLOT }), `<b>${escText(word("act.owed_updatestart.label.updates"))}</b>`)}</p>
<div class="ng-acts"><a id="back-settings" class="cs-btn" data-tone="primary" href="/" hidden>${escText(word("installer.update.norelease.back"))}</a></div>
</div>
<p class="muted ng-small">${around(word("installer.page.installlink", { link: SLOT }), `<a href="/">${escText(word("installer.page.installlink.link"))}</a>`)}</p>
${publisherFooter()}
</main>
<script>try{const r=new URL(document.referrer);if(r.protocol==="https:"){const a=document.getElementById("back-settings");a.href=r.origin+"/";a.hidden=false;}}catch(e){}</script>
</body>
</html>`;
/* `GET /update?version=<V>` (R52, R55): the release your team's Civicsmith runs is not known here (its address is the
   account's, which only Cloudflare's permission lets the installer read), so this page draws it as the line it becomes; the
   progress page and the last screen draw the version before and after once it is read (index.mjs, runUpdate). */
export const updateHtml = (version) => !versionOk(version) ? noReleaseHtml() : `${pageHead(UPDATE_TITLE, { description: word("installer.update.page.description", { version }) })}
<body class="cs">
<main class="cs-frame ng">
${pageMark("update")}
<div class="ng-stage">
<h1>${escText(UPDATE_TITLE)}</h1>
<p class="lede">${escText(word("installer.update.lede"))}</p>
<div class="cs-sheet ng-log" id="versions">
<div class="cs-row" id="version-before"><span class="mk">${escText(word("installer.update.label.now"))}</span><span>${escText(word("installer.update.row.now"))}</span><span></span></div>
<div class="cs-row" id="version-after"><span class="mk">${escText(word("installer.update.label.next"))}</span><span>${escText(UPDATE_WORDS.chosen(version))}; ${escText(UPDATE_WORDS.only)}.</span><span></span></div>
</div>
<p id="update-checked">${escText(UPDATE_WORDS.checked)}.</p>
<p>${escText(UPDATE_KEEPS)}</p>
<section class="cs-section ng-sec">
<h2>${escText(word("screen.install.cf.asks"))}</h2>
<p>${around(word("installer.update.allowed", { containers: SLOT }), `<b>${CONTAINERS_SCOPE}</b>`)}</p>
${LEFT_OUT}
</section>
<section class="cs-section ng-sec">
<h2>${escText(word("installer.update.which.heading"))}</h2>
<div class="cs-field"><label for="slug" id="slug-label">${escText(word("installer.update.which.label"))}</label>
<input id="slug" class="cs-input id" type="text" autocomplete="off" spellcheck="false" placeholder="${EXAMPLE_SLUG}">
<p class="help" id="slug-hint">${escText(word("installer.update.which.hint"))}</p></div>
</section>
<details class="ng-fold" id="ai-fold"><summary>${escText(word("installer.update.ai.summary"))}</summary>
<div class="cs-field"><label for="ai">${escText(word("installer.update.ai.label"))}</label>
<input id="ai" type="password" class="cs-input" autocomplete="off" spellcheck="false" placeholder="${escText(word("installer.update.ai.placeholder"))}">
<p class="help">${escText(word("installer.update.ai.help"))}</p></div></details>
${securityBlock()}
<div class="ng-acts"><button id="go" class="cs-btn" data-tone="primary">${escText(word("act.bootstrap.label.update"))}</button></div>
<p class="err" id="err" role="alert"></p>
</div>
<p class="muted ng-small">${around(word("installer.page.installlink", { link: SLOT }), `<a href="/">${escText(word("installer.page.installlink.link"))}</a>`)}</p>
${publisherFooter()}
</main>
${pageScript("update", version)}
</body>
</html>`;
/* The page `GET /update` draws with no release chosen. */
export const UPDATE_HTML = updateHtml(null);

/* ------------------------------------------------------------------ R62, R65: an account that already holds a Civicsmith */

const attr = (o) => escText(JSON.stringify(o));
const copyCard = (c) => `<div class="card" data-slug="${escText(c.slug)}"><p class="exists-whose">${escText(c.whose)}</p>
<p class="exists-release">${escText(c.release)}</p><p class="exists-holds">${escText(c.holds)}</p>
${c.unknown.map((u) => `<p class="small exists-unknown">${escText(u)}</p>`).join("")}</div>`;

/* R62 (DEC-282): the page drawn when `fresh` finds a copy, after nothing was created or changed: what is already here
   (R63), then the three ways on. Each is a new `POST /begin` carrying the choice, after a new consent on Cloudflare's own page
   (the installer keeps no token). `copies` are describeCopy's answers (account.mjs); `version` the release an update installs. */
export const existsPanel = ({ copies, version, account = null }) => `<section id="exists"><h2>${escText(word("screen.install.exists.title"))}</h2>
<p>${escText(word("screen.install.exists.sub"))}</p>
<h2>${escText(word("screen.install.exists.here.heading"))}</h2>
${copies.map(copyCard).join("\n")}
<p>${escText(word("screen.install.exists.ask"))}</p>
<h2>${escText(word("screen.install.exists.choose.heading"))}</h2>
${copies.filter((c) => c.plane && c.finished).map((c) => `<div class="cs-sheet ng-block exists-update" data-slug="${escText(c.slug)}"><h3>${escText(word("screen.install.exists.update.name"))}</h3>
<p>${escText(word("screen.install.exists.update.what"))}</p>
<div class="ng-acts"><button type="button" class="cs-btn" data-tone="primary" data-begin="${attr({ mode: "update", slug: c.slug, version, ...(account ? { account } : {}) })}">${escText(word("act.owed_installupdate.label.install"))}</button></div></div>`).join("\n")}
<div class="cs-sheet ng-block" id="exists-alongside"><h3>${escText(word("screen.install.exists.alongside.name"))}</h3>
<p>${escText(word("screen.install.exists.alongside.what"))}</p>
<div class="cs-field"><label for="alongside-slug">${escText(word("installer.shortname.label"))}</label>
<input id="alongside-slug" class="cs-input id" type="text" autocomplete="off" spellcheck="false" placeholder="${EXAMPLE_SLUG}"></div>
<div class="ng-acts"><button type="button" class="cs-btn" data-tone="primary" data-slug-from="alongside-slug" data-begin="${attr({ mode: "install", alongside: true, ...(account ? { account } : {}) })}">${escText(word("act.owed_installalongside.label.install"))}${IRREVERSIBLE}</button></div></div>
${copies.map((c) => `<div class="cs-sheet ng-block exists-remove" data-slug="${escText(c.slug)}"><h3>${escText(word("screen.install.exists.remove.name"))}</h3>
<p>${escText(word("screen.install.exists.remove.what"))}</p>
<div class="ng-acts"><button type="button" class="cs-btn" data-tone="quiet" data-begin="${attr({ mode: "remove", slug: c.slug, ...(account ? { account } : {}) })}">${escText(word("act.owed_installremove.label.install"))}</button></div></div>`).join("\n")}
<p class="err" id="begin-err" role="alert"></p>
<dialog id="alongside-dialog" class="cs-dialog" aria-labelledby="alongside-h"><h2 id="alongside-h">${around(word("installer.permanent.heading", { name: SLOT }), `<span class="id" id="alongside-name"></span>`)}</h2>
<p class="ends">${escText(PERMANENCE)}</p>
<div class="ng-acts"><button type="button" class="cs-btn" data-tone="primary" id="alongside-yes">${escText(word("installer.permanent.continue"))}${IRREVERSIBLE}</button>
<button type="button" class="cs-btn" data-tone="quiet" id="alongside-no">${escText(word("installer.permanent.cancel"))}</button></div></dialog>
</section>`;

/* R65 (DEC-282): what removing the copy would delete, drawn and not done; only the short name typed exactly enables the one act
   that deletes (`installremoveconfirm`), which is a new consent on Cloudflare's page. */
export const removePanel = ({ copy, slug, account = null }) => `<section id="remove"><h2>${escText(word("screen.install.remove.title"))}</h2>
<p>${escText(word("screen.install.remove.sub"))}</p>
<h2>${escText(word("screen.install.remove.lost.heading"))}</h2>
<ul class="ng-list">
<li id="lost-records">${escText(word("screen.install.remove.lost.records", { team: copy.team ?? slug, holdings: copy.holdings }))}</li>
<li id="lost-members">${escText(word("screen.install.remove.lost.members"))}</li>
<li id="lost-published">${escText(word("screen.install.remove.lost.published"))}</li>
<li id="lost-address">${escText(word("screen.install.remove.lost.address"))}</li>
</ul>
${copy.unknown.map((u) => `<p class="small">${escText(u)}</p>`).join("")}
<p id="remove-keep">${escText(word("screen.install.remove.keep"))}</p>
<div class="cs-field"><label for="typed">${escText(word("screen.install.remove.type.label"))}</label>
<input id="typed" class="cs-input id" type="text" autocomplete="off" spellcheck="false">
<p class="help">${escText(word("screen.install.remove.type.help", { slug }))}</p></div>
<div class="ng-acts"><button type="button" id="confirm-remove" class="cs-btn" data-tone="primary" data-slug="${escText(slug)}" data-typed-from="typed" data-begin="${attr({ mode: "removeconfirm", slug, ...(account ? { account } : {}) })}" disabled>${escText(word("act.owed_installremoveconfirm.label.install"))}</button></div>
<p class="err" id="begin-err" role="alert"></p>
</section>`;

/* R65: when the account is clear, the way to a new install (a new consent, R62). */
export const removedPanel = ({ team }) => `<section id="removed"><h2>${escText(word("installer.removed.title"))}</h2>
<p>${escText(word("installer.removed.what", { team }))}</p>
<p>${escText(word("installer.removed.next"))}</p>
<div class="ng-acts"><a class="cs-btn" data-tone="primary" id="after-remove" href="/">${escText(word("act.bootstrap.label.install"))}</a></div></section>`;
