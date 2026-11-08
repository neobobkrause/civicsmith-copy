/* journey-check R5, R6: a fake plane over HTTP for the live arm, as a browser meets a test instance. Its front page signs a
   handle in with `login`; every `/app/<id>` draws screen `<id>` in a working frame (the test band across the frame, the
   tabs pinned to the viewport's foot, every class defined by its stylesheet) after `whoami`, which answers each handle's
   `administer` as `admins` says. The administrator is drawn `memberadd` on Members; both roles are drawn `testify`.
   `adminActs: false` draws the administrator nothing more than the member. `flaws` puts one flaw on one screen:
   {screen: "wide" | "tabs" | "band" | "class" | "words" | "title"} ("title": the tab keeps its page's own title, not its screen's word, R28).
   R12: `projects`, `project`, `question` and `connect` draw just enough of R9's steps 2 to 4 to reach the sign-in:
   a project (after the visibility choice screens-daily's "Start a project" asks, which the walk makes) and a question opened by `promote`, and the subscription's sign-in (`subscriptionsignin`: a link to
   Anthropic's page, then the code typed), each drawing the words the walk asserts, through `word`. `codes` records each
   code the plane was sent. R20: `connect` draws that sign-in only with `assistantControls: true` (the assistant works);
   otherwise it draws no assistant control, as the interface does while the assistant is not reachable. R22: Home draws the
   doors to `dash-project` and `dash-action` (`doors: false` draws none; `doors: "project"` draws no Action block, as Home does for a team holding no action, DEC-219 (3); `doors: "blockonly"` draws the Action block without its door). R22: `dashNothing: true` draws "Nothing is here" on `dash-project`. R25: `/sign` answers 404 with the interface's
   nothing-is-here page, or, with `signPage: true`, a page holding a form. R24: `published: true` serves a published case at `PUBLISHED_PATH`, signed out. R20: `askControl: true` draws the Ask act on `answers`, an assistant control that cannot work while the assistant does not. */
import { createServer } from "node:http";
import { word } from "../../../src/setup-words/index.mjs";
import { wordOf, publicPages } from "../../../src/journey-check/checks.mjs";
import { registryScreens } from "../../../src/journey-check/screens.mjs";

/* R24: a published case as the public frame draws it, signed out: the minimum strength, the filtered view's notice and its way back,
   a finding's page, a press on Print the case, and the footer's signing line; `bad` makes setting the minimum send a request */
export const PUBLISHED_PATH = "/app/published/c1";
export function publishedPage({ bad = false } = {}) {
  const whole = `<h1>Case</h1><label for="min">${word("screen.published.show.only.findings.this.strong")}</label><select id="min"><option>Any</option><option>Firm</option></select>
<p id="notice" hidden>${word("screen.published.this.is.part.of.the.many", { n: 1, total: 3, hidden: 2 })} <a id="back" href="${PUBLISHED_PATH}">${word("screen.published.back.to.the.whole.case")}</a></p>
<a href="${PUBLISHED_PATH}/finding/1">${word("screen.published.finding", { n: 1 })}</a>
<button id="print">${word("act.owed_pubprint.label.published")}</button>
<footer>${word("screen.published.signed.for.lakeshore.tenants.by", { team: "Lakeshore Tenants", member: "Rosa", date: "1 October 2026", fingerprint: "ab12" })}</footer>
<script>document.getElementById("min").onchange = () => { ${bad ? 'fetch("/api/?op=minimum", { method: "POST", body: "{}" });' : ""} document.getElementById("notice").hidden = false; };
document.getElementById("print").onclick = () => window.print();</script>`;
  return `<!doctype html><html><head><title>Published</title><link rel="stylesheet" href="/app/assets/civicsmith.css"></head><body><main id="cs-main" data-screen="published">${whole}</main></body></html>`;
}
const FINDING_PAGE = `<!doctype html><html><head><title>Published</title><link rel="stylesheet" href="/app/assets/civicsmith.css"></head><body><main id="cs-main" data-screen="published"><h1>Finding 1</h1></main></body></html>`;

const WORDS = { empty: word("question.empty.heading"), nothing: word("shell.unavailable.nothing.title"), connected: word("screen.connect.own.subscription", { plan: "Pro", date: "14 October 2026" }) };

/* R28: each screen's tab title, the word of its screen (interface-shell R102): the public form on a public page */
const PUBLIC = new Set(publicPages());
const TITLES = Object.fromEntries(registryScreens().map((s) => [s.id, PUBLIC.has(s.id)
  ? wordOf("page.title.public", { page: wordOf(`screen.${s.id}.name`), team: "Lakeshore Tenants" })
  : wordOf("page.title", { screen: wordOf(`screen.${s.id}.name`), team: "Lakeshore Tenants" })]));

const CSS = `body{margin:0;font:16px sans-serif}.cs-frame{display:block;width:100%}.cs-testband{display:block;padding:4px}
.cs-main{display:block;padding:16px 16px 80px}.cs-tabs{position:fixed;left:0;right:0;bottom:0;height:48px;display:flex;background:#eee}
.cs-tab{flex:1}.cs-btn{display:inline-block}.t-title{font-size:24px}.cs-signin{display:block}.cs-narrow{width:120px}
.cs-wide{width:2000px;height:10px}.cs-flow{position:static}`;
const FLAW = {
  wide: '<div class="cs-wide"></div>',
  class: '<p class="cs-unstyled">Read more</p>',
  words: "<p>Could not read this, because NO_CALC.</p>",
};

// fixtures-own: harness journey-check walks a served plane and imports no module (K3100, K5062); the ops and codes of this table are held equal to the real ones by tables.mjs
export async function fakePlane({ admins = {}, flaws = {}, adminActs = true, assistantControls = false, doors = true, signPage = false, dashNothing = false, published = false, askControl = false } = {}) {
  const seen = [], codes = [];
  const sessions = new Map();
  const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Civicsmith</title><link rel="stylesheet" href="/app/assets/civicsmith.css"></head><body>${body}</body></html>`;
  const front = page(`<main id="cs-main" class="cs-main" data-screen="front"><h1 class="t-title">Sign in</h1>
<div class="cs-signin"><label>Handle <input id="fs-handle"></label><label>Password <input id="fs-pw" type="password"></label>
<button class="cs-btn" data-act="login" type="button">Sign in</button></div></main>
<script>document.querySelector('[data-act="login"]').onclick = async () => {
  const r = await (await fetch("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: document.getElementById("fs-handle").value, password: document.getElementById("fs-pw").value }) })).json();
  if (r.ok) { sessionStorage.setItem("t", r.token); location.href = "/app"; }
};</script>`);
  const app = page(`<div id="root"></div><script>(async () => {
  const id = location.pathname === "/app" ? "home" : location.pathname.slice(5).split("/")[0];
  const who = await (await fetch("/api/?op=whoami", { headers: { authorization: "Bearer " + sessionStorage.getItem("t") } })).json();
  const flaws = ${JSON.stringify(flaws)}, FLAW = ${JSON.stringify(FLAW)};
  const f = flaws[id];
  if (f !== "title") document.title = ${JSON.stringify(TITLES)}[id] || document.title;
  const acts = '<button class="cs-btn" data-act="testify" type="button">Testify</button>'
    + (${JSON.stringify(adminActs)} && who.result.administer && id === "members" ? '<button class="cs-btn" data-act="memberadd" type="button">Invite a member</button>' : "");
  document.getElementById("root").innerHTML = '<div class="cs-frame" id="cs-frame">'
    + '<div class="cs-testband' + (f === "band" ? " cs-narrow" : "") + '" role="note">A test instance</div>'
    + '<main class="cs-main" id="cs-main" data-screen="' + id + '">' + (STEPS[id] ? STEPS[id]() : '<h1 class="t-title">A screen</h1>' + acts + (id === "home" && ${JSON.stringify(doors)} ? '<div data-area="investigation"><a href="/app/dash-project">Investigation</a></div>' + (${JSON.stringify(doors)} === "project" ? "" : ${JSON.stringify(doors)} === "blockonly" ? '<div data-area="action"><b>Action</b></div>' : '<div data-area="action"><a href="/app/dash-action">Action</a></div>') : "") + (FLAW[f] || "")) + '</main>'
    + '<nav class="cs-tabs' + (f === "tabs" ? " cs-flow" : "") + '"><a class="cs-tab" href="/app">Home</a><a class="cs-tab" href="/app/queue">Queue</a></nav></div>';
  const on = (op, fn) => { for (const b of document.querySelectorAll('[data-act="' + op + '"]')) b.onclick = fn; };
  on("promote", () => { const t = document.querySelector("#projects-title, #project-question");
    sessionStorage.setItem(t.id, t.value); location.href = t.id === "projects-title" ? "/app/project/P1" : "/app/question/Q1"; });
  on("subscriptionsignin", async (e) => {
    const code = document.getElementById("mc-code0").value;
    if (!code) { document.getElementById("mc-link").hidden = false; return; }
    const r = await (await fetch("/api/?op=subscriptionsignin", { method: "POST", body: JSON.stringify({ step: "code", code }) })).json();
    if (r.ok) document.getElementById("mc-done").hidden = false;
  });
})();
const W = ${JSON.stringify(WORDS)};
var STEPS = {
  answers: () => '<h1 class="t-title">Ask</h1>' + (${JSON.stringify(askControl)} ? '<button class="cs-btn" data-act="ask" type="button">Ask</button>' : ''),
  'dash-project': () => '<h1 class="t-title">Investigation</h1>' + (${JSON.stringify(dashNothing)} ? '<p>' + W.nothing + '</p>' : '<p>Your projects</p>'),
  projects: () => '<h1 class="t-title">Projects</h1><input id="projects-title"><fieldset id="projects-visibility"><legend>Who can find the project</legend>'
    + '<label><input type="radio" name="projects-visibility" id="projects-visibility-hidden" value="hidden"> Hidden</label>'
    + '<label><input type="radio" name="projects-visibility" id="projects-visibility-discoverable" value="discoverable"> Discoverable</label></fieldset>'
    + '<button class="cs-btn" data-act="promote" type="button">Start a project</button>',
  project: () => '<h1 class="t-title">' + sessionStorage.getItem("projects-title") + '</h1><textarea id="project-question"></textarea><button class="cs-btn" data-act="promote" type="button">Open a question</button>',
  question: () => '<h1 class="t-title">' + sessionStorage.getItem("project-question") + '</h1><p>' + W.empty + '</p>',
  connect: () => '<h1 class="t-title">The assistant</h1>' + (${JSON.stringify(assistantControls)} ? '<button class="cs-btn" data-act="subscriptionsignin" type="button">Open the sign-in page</button>'
    + '<p id="mc-link" hidden><a href="https://claude.ai/oauth/authorize?code=true" target="_blank">Open it in a new tab</a></p>'
    + '<input id="mc-code0" type="password"><button class="cs-btn" data-act="subscriptionsignin" type="button">Connect</button><p id="mc-done" hidden>' + W.connected + '</p>' : ''),
};</script>`);
  const bodyOf = async (req) => { let body = ""; for await (const c of req) body += c; return body; };
  /* the ops this plane answers itself, by their names (tables.test.mjs holds them to the plane's declared ops); any other op answers `ok` */
  // fixtures-own: harness journey-check walks a served plane and imports no module (K3100, K5062); the ops and codes of this table are held equal to the real ones by tables.mjs
  const handlers = {
    bootstrap: async (req, json) => json({ ok: true, test_instance: true }),
    login: async (req, json) => {
      const { handle } = JSON.parse(await bodyOf(req));
      const token = "tok" + sessions.size;
      sessions.set(token, handle);
      return json({ ok: true, token });
    },
    // fixtures-own: harness journey-check walks a served plane and imports no module (K3100, K5062); the ops and codes of this table are held equal to the real ones by tables.mjs
    subscriptionsignin: async (req, json) => {
      codes.push(JSON.parse(await bodyOf(req)).code);
      return json({ ok: true, result: { connected: true } });
    },
    whoami: async (req, json) => {
      const handle = sessions.get((req.headers.authorization || "").replace(/^Bearer /, ""));
      return json({ ok: true, result: { session: true, member: "m-" + handle, handle, administer: !!admins[handle] } });
    },
  };
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    seen.push(`${req.method} ${u.pathname}${u.search}${req.headers.authorization ? " AUTH" : ""}`);
    const send = (status, type, body) => { res.writeHead(status, { "content-type": type }); res.end(body); };
    const json = (o) => send(200, "application/json", JSON.stringify(o));
    if (u.pathname === "/api/") {
      const op = u.searchParams.get("op");
      if (Object.hasOwn(handlers, op)) return handlers[op](req, json);
      return json({ ok: true });
    }
    if (published && u.pathname === PUBLISHED_PATH) return send(200, "text/html", publishedPage());
    if (published && u.pathname === `${PUBLISHED_PATH}/finding/1`) return send(200, "text/html", FINDING_PAGE);
    if (u.pathname === "/app/assets/civicsmith.css") return send(200, "text/css", CSS);
    if (u.pathname === "/") return send(200, "text/html", front);
    if (u.pathname === "/sign") return send(404, "text/html", signPage ? page(`<main id="cs-main"><form><input type="file"><button>Sign</button></form></main>`)
      : page(`<main id="cs-main" data-screen="unavailable"><h1 class="t-title">${WORDS.nothing}</h1></main>`));
    if (u.pathname === "/app" || u.pathname.startsWith("/app/")) return send(200, "text/html", app);
    send(404, "text/plain", "not found");
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${server.address().port}`, seen, codes, ops: Object.keys(handlers), close: () => new Promise((ok) => server.close(ok)) };
}
