/* journey-check R9, R10 (K3320, K3324 (2); K3347): the journey from a claimed group to a first conclusion, as the
   administrator (R9) and as a member (R10), each step through the screens' own controls (journeys.mjs `act`, `control`,
   `type`; a link a person follows), with ops called only to observe. Each step asserts what the design (journey 29,
   DEC-245; the question's states, DEC-256) says the screen then shows, by the word's key (R14, words.mjs), and the walk
   fails on any refused or missing step (R8, walker.mjs). The assistant is connected by the person's own Claude
   subscription on `connect` (K3347): in the local arm through the runner's stand-in and its sign-in page (R11), in the
   live arm through the real sign-in, whose code the person types (R12). */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { settle, StepFailed } from "./walker.mjs";
import { act, control, type, open, requireDrawn, reveal } from "./journeys.mjs";
import { requireWord, requireAnyWord, byWord, wordPattern, word, drawsWord } from "./words.mjs";
import { developerWords } from "./design.mjs";
import { CITY_ORIGIN, NOTICE_PATH, NOTICE_PASSAGE, HEAT_ADDRESS, HEAT_PASSAGE } from "./city.mjs";
import { localize } from "../setup-words/index.mjs";

export const PLAN_TITLE = "Get the roof repaired";
/* F4: the project R9 step 2 starts is titled for this run, so the walk runs again and again on one instance (a fixed title is
   refused NAME_TAKEN on the second walk). `RUN_MARK` is the run's own, a number a person reads as one. */
export const PROJECT_BASE = "Roof repairs at 14 Lakeshore Row";
export const RUN_MARK = String(Date.now() % 1e9).padStart(9, "0").replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
export const projectTitle = (mark = RUN_MARK) => `${PROJECT_BASE}, walk ${mark}`;
export const PROJECT_TITLE = projectTitle();
export const QUESTION = "Has the landlord been ordered to repair the roof of 14 Lakeshore Row?";
/* The file the walk uploads into the question (R9 step 5): a tenant's own note, written by the walk into its output. */
export const UPLOAD_NAME = "flat-4-ceiling-note.txt";
export const UPLOAD_TEXT = "Flat 4, 14 Lakeshore Row. Water came through the ceiling on 29 September and again on 1 October 2026.\n";
/* The words the walk Finds in the held notice (step 7): a phrase of its passage. */
export const FIND_PHRASE = "repair the roof";
/* How long the walk waits for a run to end and its proposal to be drawn (steps 9, 10). */
export const RUN_WAIT_MS = 180000;
/* The co-attestations a capture asks for that the local arm does not stand in for (local.mjs `OUTSIDE`): their failed
   attempts, and an empty generic reading (no entities found, a measured outcome, not a refusal), are expected where
   they sit in the capture's answer, and the empty reading where the document's page reads it, and nowhere else. */
export const READING_EXPECTS = Object.freeze([{ at: /(?:^|\.)reading$/, code: "found: false" }]);
export const CAPTURE_EXPECTS = Object.freeze([{ at: /\.attestation_attempts\[\d+\]$/, code: "ok: false" }, ...READING_EXPECTS]);

const where = (page) => new URL(page.url()).pathname;

/* The record id at the end of the page's address (a project's, a question's, a document's). */
const idOf = (page) => decodeURIComponent(where(page).split("/").filter(Boolean).pop() || "");

/* Follows the link or control whose text is the word `key`, as a person does. */
async function follow(page, key, vars) {
  const l = byWord(page, key, vars, "#cs-main");
  try { await l.waitFor({ state: "visible", timeout: 10000 }); }
  catch { throw new Error(`no link or control "${key}" on ${where(page)}`); }
  await l.click();
  await settle(page);
}

/* Reads the sign-in's code where the person reads it: the page the screen's link opens in a new tab (the stand-in in
   the local arm), or, in the live arm, `codeOf()`, which asks the person and answers what she typed. The code is kept
   secret by the walk and masked in every screenshot. */
async function signinCode(walk, page, codeOf) {
  const link = page.locator('#cs-main a[href^="https://"][target="_blank"]').first();
  try { await link.waitFor({ state: "visible", timeout: 10000 }); }
  catch { throw new Error(`the screen shows no link to Anthropic's sign-in page on ${where(page)}`); }
  if (codeOf) {
    const code = await codeOf(await link.getAttribute("href"));
    if (typeof code !== "string" || !code) throw new Error("the sign-in was not completed: no code from Anthropic's page was typed");
    return walk.keepSecret(code);
  }
  const tab = page.context().waitForEvent("page", { timeout: 15000 });
  await link.click();
  const t = await tab;
  try {
    await t.waitForLoadState();
    return walk.keepSecret((await t.locator("#signin-code").textContent()).trim());
  } finally { await t.close().catch(() => {}); }
}

/* Step 4 (and R10's connection): the person's own Claude subscription, on `connect`, through its own controls: show what
   connecting means, open Anthropic's sign-in page, copy its code, connect. */
export async function connectSubscription(walk, page, base, { password, codeOf = null, label = "4 · connect an assistant by her own Claude subscription" }) {
  await walk.step(page, label, async (p) => {
    await open(walk, p, base, "/app/connect", "connect");
    if (await p.locator('[data-act="disclosureshown"]').count()) await act(p, "disclosureshown");
    await act(p, "subscriptionsignin", { password });
    const code = await signinCode(walk, p, codeOf);
    await act(p, "subscriptionsignin", { fields: { "mc-code0": code }, nth: 1, password });
    await requireWord(p, "screen.connect.own.subscription", { within: "#cs-main" });
  }, { expect: ["REAUTH_DUE"] });
}

/* "Start a project" asks who can find the project and chooses neither (`screens-daily` `start-project.mjs`); the walk chooses hidden. */
export const START_PROJECT_VISIBILITY = "#projects-visibility-hidden";

/* Steps 2 and 3: a project with a title, opened; a question in it, opened. Answers the project's and question's
   addresses. */
async function projectAndQuestion(walk, page, base, { title, question }) {
  let project = null, q = null;
  await walk.step(page, "2 · start a project with a title, and open it", async (p) => {
    await open(walk, p, base, "/app/projects", "projects");
    const visibility = p.locator(START_PROJECT_VISIBILITY);
    await reveal(visibility);
    await visibility.check();
    await act(p, "promote", { fields: { "projects-title": title }, reason: "Tenants of 14 Lakeshore Row report water coming in." });
    if (!/^\/app\/project\//.test(where(p))) await p.locator("#cs-main a").filter({ hasText: title }).first().click();
    await settle(p);
    await requireDrawn(walk, p, "project");
    await requireTitle(p, title);
    project = p.url();
  });
  await walk.step(page, "3 · open a question in it", async (p) => {
    await act(p, "promote", { fields: { "project-question": question }, reason: "This is what the tenants need answered." });
    await requireDrawn(walk, p, "question");
    await requireTitle(p, question);
    await requireWord(p, "question.empty.heading", { within: "#cs-main" });
    q = p.url();
  });
  return { project, question: q };
}

/* The page's title is `text`, the record's own words. */
async function requireTitle(page, text) {
  const h = (await page.locator("#cs-main h1").first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  if (h !== text) throw new Error(`the title drawn is "${h}", not "${text}"`);
}

/* F5: what the walk says when it was given no page of ours to capture by address (the live arm with no test page), and the steps
   that rest on the document that capture holds, each noted, never passed. */
export const NO_TESTPAGE = "R9 step 5, capture by address: not walked, the walk was given no test page of ours to capture (JOURNEY_CITY_ORIGIN)";
export const RESTS_ON_CAPTURE = Object.freeze(["R9 step 6, see both held, and vouch for one", "R9 step 7, open the document, see its words, and Find-in a passage",
  "R9 step 8, cite it with a role", "R9 step 12, accept a reading, stand on it for the project, and conclude"]);
const restsOn = (label) => `${label}: not walked, it rests on the capture by address, which was not walked`;

/* Steps 5 and 6: from the question's "Add a document", a capture by address (of the notice at `city`, a site the walk
   controls: the local arm's stub, or the live arm's test page, F5) and one by upload, each into the question; both held; one
   vouched for. Answers the vouched document's address. */
async function captureAndVouch(walk, page, base, { question, password, city = CITY_ORIGIN }) {
  const NOTICE_ADDRESS = city.replace(/\/+$/, "") + NOTICE_PATH;
  await walk.step(page, "5 · capture by address into the question, from its \"Add a document\"", async (p) => {
    await p.goto(question); await settle(p);
    await follow(p, "question.adddoc");
    await requireDrawn(walk, p, "capture");
    await act(p, "acquire", { fields: { "ci-address": NOTICE_ADDRESS }, password });
    await requireWord(p, "screen.capture.address.done", { within: "#cs-main" });
  }, { expect: CAPTURE_EXPECTS });
  await walk.step(page, "5 · capture by upload into the question", async (p) => {
    await p.goto(question); await settle(p);
    await follow(p, "question.adddoc");
    await p.locator('#cs-main a[href^="/app/capture/file"]').first().click();
    await settle(p);
    const dir = join(walk.out, "upload");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, UPLOAD_NAME), UPLOAD_TEXT);
    await p.locator("#ci-how-made").first().check();
    await type(p, "ci-where", "Flat 4, 14 Lakeshore Row, 1 October 2026");
    await type(p, "ci-what", "My note of when the water came through the ceiling.");
    /* chosen last, as the screen redraws while she types and a redraw empties a file field */
    await p.locator("#ci-file").setInputFiles(join(dir, UPLOAD_NAME));
    await act(p, "captureupload", { password });
    await requireWord(p, "screen.capture.file.done", { within: "#cs-main" });
  }, { expect: CAPTURE_EXPECTS });
  let document = null;
  await walk.step(page, "6 · see both held, and vouch for one", async (p) => {
    await open(walk, p, base, "/app/held", "held");
    const picks = p.locator('#cs-main input[type="checkbox"][data-table="held"]');
    if ((await picks.count()) < 2) throw new Error(`${await picks.count()} captures are held, not both`);
    const row = p.locator("#cs-main tr").filter({ has: p.locator(`a[href^="/app/document/"]`) }).filter({ hasText: NOTICE_ADDRESS }).first();
    document = new URL(await row.locator('a[href^="/app/document/"]').first().getAttribute("href"), base).href;
    await row.locator('input[type="checkbox"][data-table="held"]').check();
    await act(p, "release", { fields: { "ch-ack": "The copy is the notice the city published at that address", "ch-mitigation": "None remains" } });
    await requireWord(p, "screen.held.released", { vars: { count: 1 }, within: "#cs-main" });
  });
  return document;
}

/* R23 (K3815; usability review B-11, B-30, B-31): the first page of the document the walk captured reads "Page 1", in the page
   bar's words (`document.read.page`), in the passage's place (`screen.document.passage.where`) and in the picker of the pages
   its reading could not make out where the screen draws one (`#document-unread-page`, whose choices are the record's pages
   numbered from 1), each by its key (R14); a capture that states no page draws no page number, and the step notes that it had
   none. Every screen's text is also scanned for a page numbered 0 (walker.mjs, `PAGE_ZERO`). */
export const NO_PAGE_NOTE = "document: the capture states no page, so none is drawn";
export async function pageNumbersOf(page) {
  /* where the real screen draws them: the page bar (`[data-pagebar]`, "Page n of count") and the span beside each passage
     (`.mk-passage .mk-small`, "Page n"); the bar's words would match the passage's pattern too, so each is read in its own place */
  const bar = (await page.locator("#cs-main [data-pagebar]").first().textContent().catch(() => "")) || "";
  const places = await page.locator("#cs-main .mk-passage .mk-small").allTextContents();
  const number = (key, texts) => {
    const re = new RegExp(wordPattern(key, {}).source);
    for (const t of texts) { const m = re.exec(t.replace(/\s+/g, " ")); if (m) return Number(/\d+/.exec(m[0])[0]); }
    return null;
  };
  const picker = await page.locator("#cs-main #document-unread-page option").evaluateAll((os) => os.map((o) => o.value)).catch(() => []);
  return { bar: number("document.read.page", [bar]), place: number("screen.document.passage.where", places), picker };
}
/* What is wrong with the page numbers a document draws, or null: the first page reads 1 in the bar and in the passage's place,
   and the picker offers pages numbered from 1. */
export function pageNumbersProblem({ bar, place, picker }) {
  if (bar !== null && bar !== 1) return localize("journey-check.investigation.the_page_bar_reads_page_first", "the page bar reads page {bar} first, not Page 1 (document.read.page)", { bar: String(bar) });
  if (place !== null && place !== 1) return localize("journey-check.investigation.the_first_passage_s_place_reads", "the first passage's place reads page {place}, not Page 1 (screen.document.passage.where)", { place: String(place) });
  const low = picker.filter((v) => !(Number.isInteger(Number(v)) && Number(v) >= 1));
  if (low.length) return localize("journey-check.investigation.the_picker_of_unread_pages_offers", "the picker of unread pages offers page {pages}, pages are numbered from 1 (screen.document.unread.page)", { pages: low.join(", ") });
  return null;
}
export async function firstPage(walk, page, document) {
  await walk.step(page, "document: its first page reads Page 1", async (p) => {
    await p.goto(document); await settle(p);
    await requireDrawn(walk, p, "document");
    const seen = await pageNumbersOf(p);
    const problem = pageNumbersProblem(seen);
    if (problem) throw new Error(problem);
    if (seen.bar === null && seen.place === null && !seen.picker.length) walk.notes.push(NO_PAGE_NOTE);
  }, { expect: READING_EXPECTS });
}

/* Steps 7 and 8: the document opened and its words seen in its Passages (extraction R76, K3399); the passage found with
   Find-in (from the document's own "Find in this"), for the question, and cited from the result as supporting it
   (screens-daily R24: the role chosen, none preselected). The question then holds the passage. */
async function readAndCite(walk, page, { document, question, phrase = FIND_PHRASE, passage = NOTICE_PASSAGE, prefix = "" }) {
  await walk.step(page, localize("journey-check.investigation.v1_open_the_document_see", "{v1}open the document, see its words, and Find-in a passage", { v1: String(prefix ? prefix : "7 · ") }), async (p) => {
    await p.goto(document); await settle(p);
    await requireDrawn(walk, p, "document");
    await requireWord(p, "document.read.title", { within: "#cs-main" });
    /* its words (extraction R76's `text_units`, K3399): the notice's passage drawn on its page */
    if (!(await p.locator("#cs-main").textContent()).replace(/\s+/g, " ").includes(passage))
      throw new Error("the document's words are not drawn on its page");
    await act(p, "findin");
    await p.waitForURL((u) => u.pathname.startsWith("/app/find-in/"), { timeout: 15000 });
    await settle(p);
    await requireDrawn(walk, p, "find-in");
    const term = p.locator("#findin-kind-term");
    if (await term.count() && !(await term.isChecked())) await term.check();
    await type(p, "findin-term", phrase);
    const pick = p.locator("#findin-question");
    if (await pick.count()) await pick.selectOption(decodeURIComponent(new URL(question).pathname.split("/").pop()));
    await act(p, "findin");
    if (!(await p.locator("#cs-main").textContent()).includes(phrase)) throw new Error("Find-in found no passage holding the phrase");
  }, { expect: READING_EXPECTS });
  await walk.step(page, localize("journey-check.investigation.v1_cite_it_with_a", "{v1}cite it with a role (supports)", { v1: String(prefix ? prefix : "8 · ") }), async (p) => {
    const cite = p.locator('#cs-main details:has([data-act="cite"])').first();
    try { await cite.waitFor({ state: "attached", timeout: 10000 }); } catch { throw new Error(`no result offers to cite it on ${where(p)}`); }
    if (!(await cite.evaluate((d) => d.open))) await cite.locator("summary").first().click();
    await cite.locator('input[type="radio"][id$="-role-supports"]').check();
    await act(p, "cite", { within: '#cs-main details[open]:has([data-act="cite"])', reason: "The notice orders the repair." });
    await p.goto(question); await settle(p);
    /* the question holds the citation: its Supports list draws it, with the control to remove it (`sever`) */
    if (!(await p.locator('#cs-main [data-act="sever"]').count())) throw new Error("the question does not hold the cited passage");
  });
}

/* Steps 9 and 10: the assistant run on the question from the dock; its answer and its suggested reading read. */
async function runAndRead(walk, page, { question, segments = null }) {
  await walk.step(page, "9 · run the assistant on the question from the dock", async (p) => {
    /* R15: where the world is the walk's own (`segments` is its answer), the agent-worker must hold its `SEGMENTS` Durable
       Object, or a run's segment would stop with the request that started it: said here, by name, not left to a silent stop */
    if (segments === false) throw new Error("the agent-worker of this world has no SEGMENTS binding (R15): a run's segment would not outlive the request that started it");
    await p.goto(question); await settle(p);
    await openDock(p);
    await act(p, "airunopen", { within: DOCK });
    /* her run at work, or, with a fake model that answers at once, already ended (screens-inquiry R33's two states) */
    await requireAnyWord(p, ["dock.run.yours", "screen.assistant.run.ended"], { within: DOCK, timeout: 30000 });
  });
  await walk.step(page, "10 · read its run's answer and its suggested reading", async (p) => {
    const until = Date.now() + RUN_WAIT_MS;
    for (;;) {
      await p.goto(question); await settle(p);
      if (wordPattern("question.proposal.heading").test((await p.locator("body").textContent()).replace(/\s+/g, " "))) break;
      if (Date.now() > until) throw new Error("the run's proposal was not drawn within its wait");
      await p.waitForTimeout(3000);
    }
    await requireWord(p, "question.proposal.heading");
  });
}

/* Step 11: Ask (the `answers` screen), and the answer read: drawn as the machine's work (`screen.answers.machine`). */
async function ask(walk, page, { words }) {
  await walk.step(page, "11 · Ask, and read the answer", async (p) => {
    await p.goto(new URL("/app/answers", p.url()).href); await settle(p);
    await requireDrawn(walk, p, "answers");
    await act(p, "ask", { fields: { "answers-q": words } });
    await requireWord(p, "screen.answers.machine", { within: "#cs-main", timeout: 90000 });
  });
}

/* The assistant's dock (interface-shell's panel, opened from the top bar), the question's run started from it (R9 step 9). */
export const DOCK = '.cs-dock[data-panel="assistant"]';
async function openDock(page) {
  if (await page.locator(`${DOCK}:visible`).count()) return;
  const b = page.locator('[data-shell="dock"][aria-expanded]:visible').first();
  try { await b.waitFor({ state: "visible", timeout: 10000 }); } catch { throw new Error(`no way to open the assistant's dock on ${where(page)}`); }
  await b.click();
  try { await page.locator(DOCK).first().waitFor({ state: "visible", timeout: 10000 }); } catch { throw new Error("the assistant's dock did not open"); }
  await settle(page);
}

/* The conclusion form's fields: a falsifier, the reason (the page refuses to conclude with its box empty, `question.conclude.reason.needed`) and a commentary. */
export const concludeFields = (falsifier, commentary) => ({ "question-conclude-falsifier": falsifier, "question-conclude-reason": "The notice answers the question.", "question-conclude-commentary": commentary });

/* Step 12: the proposed reading accepted, stood on for the project, and concluded. */
async function concludeOn(walk, page, { question, project }) {
  await walk.step(page, "12 · accept a reading, stand on it for the project, and conclude", async (p) => {
    await p.goto(question); await settle(p);
    /* the reading that answers the question: the one the assistant composed, not the table's own "nothing at this
       level" (`level-empty-…`, which states no claim and so cannot be concluded on) */
    await act(p, "versionaccept", { which: ':not([data-version^="level-empty"])', reason: "I read the notice; it says the repair was ordered." });
    await act(p, "versioncurrent", { which: ':not([data-version^="level-empty"])', reason: "The project stands on the city's own order." });
    await act(p, "conclude", { fields: concludeFields("The city withdrawing or amending notice 2026-118",
      "The city's notice orders the landlord to repair the roof within 28 days."),
    reason: "The notice answers the question." });
    await requireWord(p, "question.concluded.by", { within: "#cs-main" });
  });
}

/* R20 (K3717, K3718 (2), K3747): while the assistant does not work, every step that needs it is reported as not walked, never
   as failed, and the screen it would have used is asserted in its declared not-ready state (interface-shell R20): no
   assistant control drawn anywhere (absent, not greyed), and, where the screen says why the assistant cannot work here,
   in the words of `refusal.AGENT_WORKER_UNBOUND` or `refusal.ASSISTANT_REMOTE_NOT_READY`, never a code. A screen that
   draws an assistant control that cannot work fails by name. */
/* the acts that connect or run the assistant, by the names the plane declares: `connect` draws the sign-in (`subscriptionsignin`, after
   `disclosureshown`) and the own key (`aiownadd`, `accountreferenceset` before T53); the question's dock `airunopen`; the plan `planask`; Ask `ask` */
export const ASSISTANT_OPS = Object.freeze(["subscriptionsignin", "disclosureshown", "accountreferenceset", "aiownadd", "airunopen", "planask", "ask"]);
export const CONNECT_OPS = Object.freeze(["subscriptionsignin", "disclosureshown", "accountreferenceset", "aiownadd"]);
export const ASSISTANT_SHELL = Object.freeze(["dock"]);
export const NOT_READY_KEYS = Object.freeze(["refusal.AGENT_WORKER_UNBOUND", "refusal.ASSISTANT_REMOTE_NOT_READY"]);

/* The assistant controls `page` draws (present in the document, shown or not), and what it says where it says why. */
export async function assistantControls(page) {
  return page.evaluate(([ops, shell]) => ({
    acts: ops.filter((op) => document.querySelector(`[data-act="${op}"]`)),
    shell: shell.filter((k) => document.querySelector(`[data-shell="${k}"]`)),
    said: [...document.querySelectorAll('[role="alert"], .mk-msg, [data-refusal], [data-state="withheld"]')]
      .map((e) => e.textContent.replace(/\s+/g, " ").trim()).filter(Boolean),
  }), [ASSISTANT_OPS, ASSISTANT_SHELL]);
}

/* The not-ready assertion on the screen at `path`, as a step of its own labelled `label`; `names` are the walk's steps
   that would have used it, each reported as not walked. */
export async function notReady(walk, page, base, { label, path, screen, names, assistantSignin = false }) {
  for (const n of names) walk.notWalked(n);
  /* a screen that fails its assertion has said so by name; the journey goes on, as the assistant is not part of it */
  await walk.step(page, label, async (p) => {
    await open(walk, p, base, path, screen);
    const drawn = await assistantControls(p);
    const bad = [...drawn.acts.map((op) => `act ${op}`), ...drawn.shell.map((k) => `the ${k} button`)];
    /* B3 (K4086): `connect`'s disclosure and sign-in are the assistant's own sign-in, drawn though not working (K3717): an
       assistant step, reported not walked above, never a failure */
    if (assistantSignin) for (const op of CONNECT_OPS) { const i = bad.indexOf(`act ${op}`); if (i >= 0) bad.splice(i, 1); }
    if (bad.length) throw new Error(`${screen} draws an assistant control that cannot work while the assistant does not: ${bad.join(", ")}`);
    for (const t of drawn.said) {
      const code = developerWords(t).find((w) => w.what === "a refusal code");
      if (code) throw new Error(`${screen} says why the assistant cannot work in a code, ${code.word}, not in the words of ${NOT_READY_KEYS.join(" or ")}`);
    }
  }).catch((e) => { if (!(e instanceof StepFailed)) throw e; });
}

/* The conclusion on the member's own reading (R16, `screens-inquiry` R50): the choice "Write the reading yourself" beside
   the readings, its field and help, the reading written, the question concluded and drawn as hers. */
async function concludeOwn(walk, page, { label, question, reading, falsifier, commentary }) {
  await walk.step(page, label, async (p) => {
    await p.goto(question); await settle(p);
    const form = p.locator('#cs-main [data-conclude="form"]').first();
    try { await form.waitFor({ state: "attached", timeout: 10000 }); } catch { throw new Error(`the question offers no way to conclude after a citation, on ${where(p)}`); }
    if (!(await form.evaluate((d) => d.open))) await form.locator("summary").first().click();
    /* the reading choice: "Write the reading yourself" is offered beside the readings, with or without an assistant */
    const choice = form.locator("select").filter({ has: p.locator("option", { hasText: wordPattern("question.conclude.own.choice") }) }).first();
    try { await choice.waitFor({ state: "visible", timeout: 10000 }); } catch { throw new Error("the reading choice does not offer the member's own reading (question.conclude.own.choice)"); }
    await choice.selectOption({ label: word("question.conclude.own.choice") });
    await requireWord(p, "question.conclude.own.field", { within: "#cs-main" });
    await requireWord(p, "question.conclude.own.help", { within: "#cs-main" });
    await form.getByLabel(wordPattern("question.conclude.own.field")).first().fill(reading);
    await act(p, "conclude", { fields: concludeFields(falsifier, commentary), reason: "The notice answers the question." });
    await requireWord(p, "question.concluded.by", { within: "#cs-main" });
    await requireWord(p, "question.reading.by.member", { within: "#cs-main" });
  });
}

/** R9: the administrator's journey, from her claimed group (journey 28 has claimed it and signed her in by her handle,
 *  step 1) to a first conclusion. `codeOf` (live arm, R12) asks the person for the sign-in's code. Answers the
 *  project's and question's addresses. */
export async function walkAdministrator(walk, page, { base, founder, codeOf = null, made = {}, segments = null, assistant = false, city = CITY_ORIGIN }) {
  walk.journey = "R9 as administrator";
  const { project, question } = await projectAndQuestion(walk, page, base, { title: PROJECT_TITLE, question: QUESTION });
  /* the project exists from here on: R10 invites a member to it even when a later step of this journey stops (`made`) */
  made.project = project; made.question = question;
  if (assistant) await connectSubscription(walk, page, base, { password: founder.password, codeOf });
  else await notReady(walk, page, base, { label: "assistant not ready: the connect screen", path: "/app/connect", screen: "connect", assistantSignin: true, names: [STEP_NAMES.connect] });
  /* F5: with no page of ours to capture by address, that capture and the steps resting on it are noted, never passed */
  if (!city) {
    walk.notes.push(NO_TESTPAGE);
    for (const l of RESTS_ON_CAPTURE) walk.notes.push(restsOn(l));
    if (!assistant && question) {
      await notReady(walk, page, base, { label: "assistant not ready: the question's dock", path: new URL(question).pathname, screen: "question", names: [STEP_NAMES.run, STEP_NAMES.read] });
      await notReady(walk, page, base, { label: "assistant not ready: the Ask screen", path: "/app/answers", screen: "answers", names: [STEP_NAMES.ask] });
    }
    return { project, question };
  }
  const document = await captureAndVouch(walk, page, base, { question, password: founder.password, city });
  await firstPage(walk, page, document);
  await readAndCite(walk, page, { document, question });
  if (assistant) {
    await runAndRead(walk, page, { question, segments });
    await ask(walk, page, { words: "What did the city order the landlord to do, and by when?" });
    await concludeOn(walk, page, { question, project });
  } else {
    await notReady(walk, page, base, { label: "assistant not ready: the question's dock", path: new URL(question).pathname, screen: "question", names: [STEP_NAMES.run, STEP_NAMES.read] });
    await notReady(walk, page, base, { label: "assistant not ready: the Ask screen", path: "/app/answers", screen: "answers", names: [STEP_NAMES.ask] });
    /* step 12 on the member's own reading, which needs no assistant (R16, screens-inquiry R50) */
    await concludeOwn(walk, page, { label: "12 · conclude on her own reading, as the project's", question, reading: NOTICE_PASSAGE,
      falsifier: "The city withdrawing or amending notice 2026-118", commentary: "The city's notice orders the landlord to repair the roof within 28 days." });
  }
  return { project, question };
}

/* The names R20 gives the steps it reports as not walked. */
export const STEP_NAMES = Object.freeze({
  connect: "R9 step 4, connect an assistant by her own Claude subscription", run: "R9 step 9, run the assistant on the question from the dock",
  read: "R9 step 10, read its run's answer and its suggested reading", ask: "R9 step 11, Ask, and read the answer",
  memberConnect: "R10, she connects her own Claude subscription", memberRun: "R10, her own run is dispatched on that sign-in",
  memberProjectai: "R10, the project's assistant page, as hers (projectai)", memberPlan: "R10, plan help, as hers (planask)", memberAsk: "R10, Ask, as hers",
});

/** R10: the same journey as a member, invited to the group (journey 28 joined her) and to the project: her own Claude
 *  subscription connected, her own run dispatched on it, and the project's assistant page (`projectai`), plan help
 *  (`planask`) and Ask walked as hers. `inviter` is the administrator's page, which invites her to the project. */
export async function walkMemberJourney(walk, page, { base, member, inviter, project, codeOf = null, segments = null }) {
  walk.journey = "R10 as member";
  await walk.step(inviter, "the administrator invites her to the project", async (p) => {
    await p.goto(project); await settle(p);
    await act(p, "projectinvite", { fields: { "project-invite": member.handle }, reason: "She lives in flat 4." });
    if (!(await p.locator("#cs-main").textContent()).includes(member.handle)) throw new Error("the project does not list her as a member");
  });
  await connectSubscription(walk, page, base, { password: member.password, codeOf, label: "she connects her own Claude subscription" });
  /* an invited member has view rights only (membership §7.5): the work inside the project is hers once she joins */
  await walk.step(page, "she joins the project she was invited to (projectjoin)", async (p) => {
    await p.goto(project); await settle(p);
    await act(p, "projectjoin", { reason: "I was invited." });
    await p.locator('#cs-main [data-act="projectjoin"]:visible').waitFor({ state: "detached", timeout: 15000 }).catch(() => { throw new Error("the project still offers her to join after she joined it"); });
  });
  let question = null;
  await walk.step(page, "she opens the project and a question of her own", async (p) => {
    await p.goto(project); await settle(p);
    await requireDrawn(walk, p, "project");
    await act(p, "promote", { fields: { "project-question": "When did the tenants first report the leak to the landlord?" },
      reason: "The timeline matters for the order." });
    await requireDrawn(walk, p, "question");
    question = p.url();
  });
  await walk.step(page, "the project's assistant page, as hers (projectai)", async (p) => {
    await p.goto(project); await settle(p);
    await p.locator('#cs-main a[href^="/app/projectai/"]').first().click();
    await settle(p);
    await requireDrawn(walk, p, "projectai");
  });
  await walk.step(page, "plan help, as hers (planask)", async (p) => {
    await p.goto(project); await settle(p);
    await act(p, "planopen", { fields: { "project-plan": PLAN_TITLE }, reason: "The tenants want the repair made." });
    /* screens-inquiry R36: the project then lists the plan by name, a link opening it (the act itself goes nowhere) */
    await p.locator("#cs-main a", { hasText: PLAN_TITLE }).first().click();
    await settle(p);
    await requireDrawn(walk, p, "plan");
    await act(p, "planask", { reason: "Ask the assistant for options." });
    await requireWord(p, "screen.plan.ask.running", { timeout: 20000 });
    const until = Date.now() + RUN_WAIT_MS;
    for (;;) {
      await p.reload(); await settle(p);
      if (wordPattern("screen.plan.ask.ended").test((await p.locator("body").textContent()).replace(/\s+/g, " "))) break;
      if (Date.now() > until) throw new Error("the plan's assistant did not finish within its wait");
      await p.waitForTimeout(3000);
    }
  });
  await runAndRead(walk, page, { question, segments });
  await ask(walk, page, { words: "Who has the tenants' reports of the leak?" });
  return { question };
}


/* R16 (N1109, N1106; DEC-254 (the member's own reading)): journey 29's `search` path, with no assistant (the unassisted
   metric, K3718). A project of its own, a question in it with nothing cited (the page says it has nothing to conclude on,
   `question.empty.conclude.own`), a look for a source the team already holds (`search`, to the finder), a capture by
   address, the copy vouched for, its passage cited, and the conclusion made on her own reading, which the screen offers
   beside the readings to conclude on (`question.conclude.own.choice`, `.field`, `.help`) and draws as hers
   (`question.reading.by.member`). Each is asserted by its key (R14). The steps are labelled "no assistant · …". */
export const OWN_PROJECT = "Heating at 14 Lakeshore Row";
export const OWN_QUESTION = "Has the landlord been ordered to restore the heating of flat 6 at 14 Lakeshore Row?";
export const OWN_READING = "The city's notice 2026-131 orders the landlord to restore the heating of flat 6 within 7 days.";
export const OWN_FIND_PHRASE = "restore heating";
export const NO_ASSISTANT = "no assistant · ";
const own = (label) => NO_ASSISTANT + label;

export async function walkUnassisted(walk, page, { base, founder }) {
  walk.journey = "R16 without the assistant (journey 29's search path)";
  /* a step that fails has said so; the steps after it do not depend on it, so the path is still walked to its conclusion */
  const stays = (e) => { if (!(e instanceof StepFailed)) throw e; };
  const { project, question } = await projectAndQuestion(walk, page, base, { title: OWN_PROJECT, question: OWN_QUESTION });
  await walk.step(page, own("nothing to conclude on yet: no citation"), async (p) => {
    await p.goto(question); await settle(p);
    await requireWord(p, "question.empty.conclude.own", { within: "#cs-main" });
    if (await p.locator('#cs-main [data-conclude="form"]').count()) throw new Error("the question offers to conclude before a passage is cited");
  }).catch(stays);
  await walk.step(page, own("search: look for a source the team already holds"), async (p) => {
    await p.goto(question); await settle(p);
    await act(p, "search");
    await requireDrawn(walk, p, "finder");
  }).catch(stays);
  await walk.step(page, own("capture by address, from the question's \"Add a document\""), async (p) => {
    await p.goto(question); await settle(p);
    await follow(p, "question.adddoc");
    await requireDrawn(walk, p, "capture");
    await act(p, "acquire", { fields: { "ci-address": HEAT_ADDRESS }, password: founder.password });
    await requireWord(p, "screen.capture.address.done", { within: "#cs-main" });
  }, { expect: CAPTURE_EXPECTS });
  let document = null;
  await walk.step(page, own("see it held, and vouch for it"), async (p) => {
    await open(walk, p, base, "/app/held", "held");
    const row = p.locator("#cs-main tr").filter({ has: p.locator('a[href^="/app/document/"]') }).filter({ hasText: HEAT_ADDRESS }).first();
    document = new URL(await row.locator('a[href^="/app/document/"]').first().getAttribute("href"), base).href;
    await row.locator('input[type="checkbox"][data-table="held"]').check();
    await act(p, "release", { fields: { "ch-ack": "The copy is the notice the city published at that address", "ch-mitigation": "None remains" } });
    await requireWord(p, "screen.held.released", { vars: { count: 1 }, within: "#cs-main" });
  });
  await readAndCite(walk, page, { document, question, phrase: OWN_FIND_PHRASE, passage: HEAT_PASSAGE, prefix: NO_ASSISTANT });
  await concludeOwn(walk, page, { label: own("conclude on her own reading"), question, reading: OWN_READING,
    falsifier: "The city withdrawing or amending notice 2026-131", commentary: "The city's notice orders the heating restored within 7 days." });
  return { project, question };
}

/* R13, R18: which of the walk's steps walks each step of design journey 29, by the step's screen, state and act
   (`s:v:act`): the label its LIVE screenshot is paired under. The steps the design marks for the assistant are walked by
   R9's (the group's own API key, `groupkeyset`, by the person's own subscription on `connect` since K3347); the steps it
   marks for none, and those either path shares after the question is made, by the "no assistant" walk (R16), which does
   not wait on the assistant. The question's running and ended states are what step 9 leaves drawn. */
export const JOURNEY_29_STEPS = Object.freeze({
  "install:start:bootstrap": "install: the installer's first page",
  "install:done:null": "install: each step finishes, the checks pass",
  "setup:null:claim": "1 · setup: claim",
  "setup:null:groupkeyset": "4 · connect an assistant",
  "home:newgroup:null": "home: a new team's home",
  "security:ordinary:null": "security: a first look at Security",
  "projects:empty:promote": "2 · start a project",
  "project:empty:promote": "3 · open a question",
  "question:new:airunopen": "9 · run the assistant",
  "question:running:null": "9 · run the assistant",
  "question:ended:airunopen": "9 · run the assistant",
  "question:new:search": own("search"),
  "capture:question:acquire": own("capture by address"),
  "document:held:release": own("see it held"),
  "document:null:cite": own("cite it"),
  "question:proposal:versionaccept": "10 · read its run's answer",
  "question:null:conclude": own("conclude on her own reading"),
  "question:concluded:null": own("conclude on her own reading"),
});
/* The LIVE screenshot (its path) for a step of journey 29: the last screenshot of the walk's step whose label holds what
   the table says. */
export function journey29Live(walk, step) {
  const label = JOURNEY_29_STEPS[`${step.s}:${step.v ?? null}:${step.act ?? null}`];
  if (!label) return null;
  const core = label.replace(/^\d+ · /, "");
  const hit = walk.steps.filter((x) => x.label.includes(core)).pop();
  return hit ? join(walk.out, hit.screenshot) : null;
}
