/* R85 (fix round 9, K4951; amends R23, R84) — A FOUNDER WITH NO CLOUDFLARE ACCOUNT IS WALKED THROUGH FROM THE START.
 *
 * Before the sign-in the first page asks whether the founder already has a Cloudflare account. "Yes" goes on to the short name
 * and the sign-in as before. "No" (or "not ready") shows four steps, one a screen, in order: creating the account and confirming its
 * email; Workers Paid and a payment method; R2 storage; the sign-in and Cloudflare's "Allow" page. Each step says why it is needed
 * and what it costs, and has beside it the founder's likely questions answered (the same six on every step). A step can be left
 * and resumed: the step is the page's address fragment (`#guide-2`), so the installer keeps nothing (R27). The checks that confirm
 * a step are R84's: the run stops with "Check again" when the account is not ready. No field asks for an API token or an account id
 * (the sign-in grants the permission, R2).
 *
 * Every sentence is the design's, read by key (`word`, K4947 (3)). The guide is drawn only when the word list holds all of its
 * keys, so a list that does not yet hold the design's rows leaves the first page as it was (the keys are listed in the job record).
 *
 * R91 (T53; N1265; DEC-430) — "GET READY" IS THIS GUIDE. Each of the first three steps opens its Cloudflare page in a new tab, the page
 * and its words read from the installer's one table (`GET_READY_LINKS`, ready.mjs, R92), with what the founder will see there; the
 * last step ends "When these are done, check your account", and its act leads to the short name, whose act begins a check (R86). */
import { word, hasWord } from "./words.mjs";
/* R91, R92: each of the first three steps opens its Cloudflare page, read from the installer's one table by the step's id. */
import { GET_READY_LINKS } from "./ready.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const GUIDE_STEPS = Object.freeze(["account", "plan", "storage", "signin"]);
export const GUIDE_QUESTIONS = Object.freeze(["own", "cost", "access", "card", "existing", "stuck"]);
const STEP_PARTS = ["title", "why", "do", "cost"];

/* The keys the guide reads, for the key list and the check that every one is held. */
export const GUIDE_KEYS = Object.freeze([
  "installer.guide.ask.title", "installer.guide.ask.sub", "installer.guide.ask.yes", "installer.guide.ask.no",
  "installer.guide.step", "installer.guide.back", "installer.guide.next", "installer.guide.resume", "installer.guide.faq",
  "installer.guide.allow.asks", "installer.guide.allow.never", "installer.guide.checknote",
  ...GUIDE_STEPS.flatMap((s) => STEP_PARTS.map((p) => `installer.guide.${s}.${p}`)),
  ...GUIDE_QUESTIONS.flatMap((q) => [`installer.guide.q.${q}.q`, `installer.guide.q.${q}.a`]),
  /* R91: the Get-ready buttons, what the founder will see there, and the last step's end, which begins a check. */
  ...Object.keys(GET_READY_LINKS).flatMap((s) => [GET_READY_LINKS[s].key, `screen.install.getready.${s}.see`]),
  "screen.install.getready.done", "act.owed_installcheck.label.install",
]);
export const guideReady = () => GUIDE_KEYS.every(hasWord);

const faq = () => `<details class="ng-faq"><summary>${esc(word("installer.guide.faq"))}</summary>
${GUIDE_QUESTIONS.map((q) => `<details class="ng-q" data-q="${q}"><summary>${esc(word(`installer.guide.q.${q}.q`))}</summary><p>${esc(word(`installer.guide.q.${q}.a`))}</p></details>`).join("\n")}
</details>`;

const step = (id, i) => `<section class="guide-step" id="guide-${i + 1}" data-step="${id}" hidden>
<p class="eyebrow">${esc(word("installer.guide.step", { n: i + 1, total: GUIDE_STEPS.length }))}</p>
<h2>${esc(word(`installer.guide.${id}.title`))}</h2>
<p>${esc(word(`installer.guide.${id}.why`))}</p>
<p>${esc(word(`installer.guide.${id}.do`))}</p>
<p class="small guide-cost">${esc(word(`installer.guide.${id}.cost`))}</p>
${GET_READY_LINKS[id] ? `<p class="small guide-see">${esc(word(`screen.install.getready.${id}.see`))}</p>
<div class="ng-acts"><a class="cs-btn" data-tone="quiet" data-getready="${id}" href="${esc(GET_READY_LINKS[id].url)}" target="_blank" rel="noopener noreferrer">${esc(word(GET_READY_LINKS[id].key))}</a></div>` : ""}
${id === "signin" ? `<p>${esc(word("installer.guide.allow.asks"))}</p><p>${esc(word("installer.guide.allow.never"))}</p><p id="guide-done">${esc(word("screen.install.getready.done"))}</p>` : `<p class="small">${esc(word("installer.guide.checknote"))}</p>`}
${faq()}
<p class="small">${esc(word("installer.guide.resume"))}</p>
<div class="ng-acts"><button type="button" class="cs-btn" data-tone="primary" data-guide="next">${esc(word(id === "signin" ? "act.owed_installcheck.label.install" : "installer.guide.next"))}</button>
<button type="button" class="cs-btn" data-tone="quiet" data-guide="back">${esc(word("installer.guide.back"))}</button></div>
</section>`;

/* The stage, drawn first on the first page. Its script shows the asking, a step by its fragment, or leaves for the short name. */
export const guideStage = () => `<div class="ng-stage" id="stage-guide" hidden>
<div id="guide-ask">
<h1>${esc(word("installer.guide.ask.title"))}</h1>
<p class="lede">${esc(word("installer.guide.ask.sub"))}</p>
<div class="ng-acts"><button type="button" class="cs-btn" data-tone="primary" data-guide="yes">${esc(word("installer.guide.ask.yes"))}</button>
<button type="button" class="cs-btn" data-tone="quiet" data-guide="no">${esc(word("installer.guide.ask.no"))}</button></div>
</div>
${GUIDE_STEPS.map(step).join("\n")}
</div>`;

export const GUIDE_SCRIPT = `<script>
(function(){const g=document.getElementById("stage-guide"),c=document.getElementById("stage-choose");if(!g||!c)return;
const steps=[...g.querySelectorAll(".guide-step")],ask=document.getElementById("guide-ask");g.hidden=false;c.hidden=true;
function show(i){ask.hidden=i!==-1;steps.forEach((s,k)=>{s.hidden=k!==i;});
 try{history.replaceState(null,"",i<0?location.pathname+location.search:"#guide-"+(i+1));}catch(e){}}
function leave(){g.hidden=true;c.hidden=false;try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}}
let at=-1;const m=/^#guide-([1-9])$/.exec(location.hash||"");if(m&&steps[+m[1]-1])at=+m[1]-1;show(at);
g.addEventListener("click",e=>{const a=e.target&&e.target.dataset&&e.target.dataset.guide;if(!a)return;
 if(a==="yes")return leave();if(a==="no"){at=0;return show(at);}
 if(a==="next"){if(at>=steps.length-1)return leave();at++;return show(at);}
 if(a==="back"){at--;return show(at);}});
})();
</script>`;
