/* journey-check R29 (K4145, K4146; amends R27): the pseudo-locale walk judges what the REAL screens draw. `setup`, `security`
   (its catalogue fold read open), `places` (its chooser), `elsewhere` and Home are drawn through the interface's own harness
   (`interface-shell/harness.mjs`, as the screen modules' tests boot them), over the real scanner catalogue (file-safety's
   `securityToolCatalogue`, over file-scanner's providers) and the Oakland profile's own pointers and names, under the pseudo
   rows (`pseudoBody` for the page's words, `pseudoValue` for every answer a screen fetches), then read in a real browser with
   the interface's stylesheets: none reported. Each control is a hard-coded sentence beside the data, reported by screen and
   element. No fixture invents a markup: the structure under test is the screens' own. */
/* the owners' declared ops are registered first (op-declarations R80, R81; K4168), as screens-settings' suite does: a screen's import
   reads the op table, and `expertisewithdraw` is member-roster's own declared op, which the screens' acts name (K4295). The
   registration is asynchronous, so the screens are imported after it, as routed.test.mjs does. */
import "../screens-settings/register.mjs";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const { browser } = await import("../../../src/journey-check/run.mjs");
const { escapedOnPage, escapedIn, withoutPseudo, pseudoBody, pseudoValue, pseudoString, pseudoJson, DATA } = await import("../../../src/journey-check/pseudo.mjs");
const { interfaceScript } = await import("../../../src/interface-shell/index.mjs");
const { ASSET_FILES } = await import("../../../src/interface-assets/index.mjs");
const { SCREENS: ENTRY } = await import("../../../src/screens-entry/index.mjs");
const { SCREENS: SETTINGS } = await import("../../../src/screens-settings/index.mjs");
const { SCREENS: DAILY } = await import("../../../src/screens-daily/index.mjs");
const { WORD_ROWS, word } = await import("../../../src/setup-words/index.mjs");
const { boot, ok, ADMIN } = await import("../interface-shell/harness.mjs");
const { assertDeclared } = await import("./tables.mjs");
const { world } = await import("../file-safety/fixture.mjs");
/* since T53 the profile is a package of layers (jurisdictions R114): `get` resolves it to the profile a team holding it is told of */
const OAKLAND = await (await import("../../../../jurisdictions/index.mjs")).get("oakland-alameda");

const SCREENS = [...ENTRY, ...SETTINGS, ...DAILY];
const FOUNDER = { ...ADMIN, member: "admin", handle: "rosa", rootOfTrust: true };
const CSS = ["civicsmith.css", "shell.css"].map((f) => ASSET_FILES[f].body.replace(/url\([^)]*\)/g, "none")).join("\n");

let B;
before(async () => { B = await browser(); });
after(async () => { await B?.close(); });

/* the real catalogue: what file-safety answers an administrator, over file-scanner's providers */
const CATALOGUE = world().fs.securityToolCatalogue({ viewer: "member:boss" });
assert.equal(CATALOGUE.ok, true);

/* the Oakland profile as a team holding it is told of it: the places it covers, the pointers it lists */
const POINTERS = OAKLAND.pointers;
const ROUTE = { ok: true, scripts: [], doors: [{ door: "elsewhere", scripts: [], opens: "elsewhere" }],
  routes: [{ route: "project" }, { route: "elsewhere", pointer: { places: [OAKLAND.name], pointers: POINTERS } }] };

// fixtures-own: harness journey-check walks a served plane and imports no module (K3100, K5062); the ops and codes of this table are held equal to the real ones by tables.mjs
const PLANE = {
  whoami: ok(FOUNDER),
  bootstrap: ok({ ok: true, claimed: true, bootstrapConfigured: true, part_scanner: true, test_instance: false }),
  groupidentity: ok({ ok: true, group: "lakeshore-tenants", display_name: "Lakeshore Tenants" }),
  recoverycodesstate: ok({ shown: true }),
  profiles: ok({ ok: true, profiles: [{ id: OAKLAND.id, name: OAKLAND.name, covers: OAKLAND.covers }],
    choices: [{ id: OAKLAND.id, name: OAKLAND.name, covers: OAKLAND.covers }, { id: "second", name: "Second County", covers: ["Second County"] }], conflicts: [] }),
  placewantedstate: ok({ name: null }),
  aikeepawaystate: ok({ on: false }),
  /* the team's AI accounts, read as `accountsof` (`groupkeystate` retired in T53, ai-accounts R35): none held */
  accountsof: ok({ ok: true, owner: "group", accounts: [] }),
  courtnotice: ok({ choice: null, history: [] }),
  hostingaccess: ok({ recorded: false, current: null }),
  memberlist: ok({ members: [{ member_id: "admin", handle: "rosa", founder: true, role: "admin", status: "active" }] }),
  // fixtures-own: harness journey-check walks a served plane and imports no module (K3100, K5062); the ops and codes of this table are held equal to the real ones by tables.mjs
  entitieskind: ok({ ok: true, kind: "office", entities: [], count: 0, next: null }),
  securitytoolcatalogue: ok(CATALOGUE),
  securitytools: ok({ ok: true, tools: [] }),
  securitytoolevents: ok({ ok: true, events: [], cursor: null, truncated: false }),
  scanstatus: ok({ ok: true, scanner: { bound: true, version: "1" }, renderer: { bound: true, version: "1" }, queued: 0, overdue: 0, held: 0, tools: [] }),
  startfrom: ok(ROUTE),
  grouplanguages: ok({ languages: ["en", "es", "vi"] }),
  queue: ok({ items: [] }),
  projectlist: ok({ projects: [] }),
  lookedsince: ok({ since: "2026-10-01T00:00:00Z" }),
  aiuseovertime: ok({ owner: "group", days: [], periods: [] }),
};

/* the plane's answers as the pseudo walk makes them: every keyed sentence in them pseudo (R29 (a)) */
const pseudoAnswers = (table) => Object.fromEntries(Object.entries(table).map(([op, a]) => [op, typeof a === "function" ? async (req) => { const r = await a(req); return r && r.json ? { ...r, json: pseudoValue(r.json) } : r; }
  : a && a.json ? { ...a, json: pseudoValue(a.json) } : a]));

/* A screen drawn by the interface's own page under the pseudo rows, then read in a browser with the interface's stylesheets.
   `plane` is the table the screen reads; `pseudoed: false` leaves the answers as the plane gave them. */
async function drawn(path, { plane = PLANE, pseudoed = true, beside = "", at = "</main>", entered = [] } = {}) {
  /* interface-shell R1, R2: the page loads the shell's script from an external element, so the words are in that script, which is
     made pseudo here and run by the page (the harness's own run is off) */
  const script = await pseudoBody(interfaceScript(SCREENS));
  const p = await boot({ screens: SCREENS, plane: pseudoed ? pseudoAnswers(plane) : plane, path, run: false });
  const base = Date.now();
  const FakeDate = class extends Date { static now() { return base + p.clock.at(); } };
  new Function("window", "setTimeout", "clearTimeout", "Date", script)(p.win, p.clock.setTimeout, p.clock.clearTimeout, FakeDate);
  await p.settle(120);
  const markup = p.root().innerHTML.replace(at, `${beside}${at}`);
  const ctx = await B.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await ctx.newPage();
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${markup}</body></html>`);
    return { found: await escapedOnPage(page, { entered }), main: p.doc.getElementById("cs-main") };
  } finally { await ctx.close(); }
}

const SENTENCE = "Please sign in again now";
const reported = (found) => found.map((f) => `${f.element}: ${f.text}`);

test("R29 (a): a keyed sentence is made pseudo wherever it arrives from, in a document's word pairs or in an answer a screen fetches; any other string is left alone", async () => {
  const row = WORD_ROWS.find((r) => /^[A-Za-z ,']{12,60}$/.test(r[1]) && /\S\s+\S/.test(r[1]));
  const made = pseudoString(row[1]);
  assert.notEqual(made, row[1]);
  assert.deepEqual(escapedIn(made), []);
  assert.equal(pseudoString("Roof repairs at 14 Lakeshore Row"), "Roof repairs at 14 Lakeshore Row");
  assert.equal(pseudoString("ok"), "ok");
  /* the scanner catalogue's own labels, as the plane answers them: every sentence of the list in them is pseudo */
  const plain = JSON.stringify(CATALOGUE);
  const answered = pseudoJson(plain);
  assert.notEqual(answered, plain);
  const labels = CATALOGUE.offered.flatMap((t) => t.config.map((c) => c.label));
  for (const l of labels) assert.deepEqual(escapedIn(JSON.parse(answered).offered.flatMap((t) => t.config.map((c) => c.label)).join(" | ")), [], l);
  /* a sentence with a value filled in is made pseudo with its value kept */
  const filled = CATALOGUE.offered.flatMap((t) => t.config.map((c) => c.label)).find((l) => /one of/.test(l));
  assert.ok(filled && pseudoString(filled) !== filled, filled);
  /* control: the page's word pairs of a key the list holds are altered, any other key's are left */
  const key = WORD_ROWS[0][0];
  const out = await pseudoBody(`x = [["${key}",${JSON.stringify(WORD_ROWS[0][1])}],["not.a.key","Plain words here"]]`);
  assert.ok(out.includes('["not.a.key","Plain words here"]'));
  assert.ok(!out.includes(JSON.stringify(WORD_ROWS[0][1])) || WORD_ROWS[0][1].length < 2);
});

test("R29 (b): a pseudo sentence and what is filled into it are not escaped; a sentence beside it is", () => {
  const sentence = word("screen.home.line.languages", { languages: "English, español, Tiếng Việt" });
  assert.deepEqual(escapedIn(pseudoString(sentence)), [], "the sentence made pseudo, its fill with it");
  const made = `[Åñ ${"Lakeshore Row Tenants Association"} ƥá]`;
  assert.deepEqual(escapedIn(made), []);
  assert.equal(withoutPseudo(`${made} ${SENTENCE}`).trim(), SENTENCE);
  assert.deepEqual(escapedIn(`${made} ${SENTENCE}`).map((x) => x.text), [SENTENCE]);
  assert.ok(DATA.length >= 6);
});

test("R29 (b), (c): `setup` drawn with the real catalogue reports nothing; control: a hard-coded sentence beside the data is reported by element", async () => {
  const none = await drawn("/app/setup");
  assert.deepEqual(reported(none.found), []);
  const tools = none.main.querySelectorAll("fieldset.mk-checks");
  assert.equal(tools.length, CATALOGUE.offered.length, "every tool of the catalogue is drawn");
  const caught = await drawn("/app/setup", { beside: `<p id="beside-setup">${SENTENCE}</p>` });
  assert.deepEqual(reported(caught.found), [`p#beside-setup: ${SENTENCE}`]);
  /* control: a catalogue answer no one made pseudo escapes (the label is plain English in the page) */
  const plain = await drawn("/app/setup", { pseudoed: false });
  assert.ok(plain.found.length > 0, "labels fetched and left plain are reported");
  assert.ok(plain.found.every((f) => f.element), JSON.stringify(plain.found));
});

test("R29 (b), (c): `security` drawn with its catalogue fold open reports nothing; control: a hard-coded sentence is reported, and the fold is read", async () => {
  const none = await drawn("/app/security");
  assert.deepEqual(reported(none.found), []);
  const fold = none.main.querySelector("details[data-fold]");
  assert.ok(fold, "the catalogue is drawn in its fold");
  assert.equal(fold.querySelectorAll("dl[data-handling]").length, CATALOGUE.offered.length, "every tool's handling is drawn inside the fold");
  /* a sentence hard-coded inside the fold the screen draws closed is read, because the walk opens it (R29 (c)) */
  const closed = await drawn("/app/security", { beside: `<p id="inside-fold">${SENTENCE}</p>`, at: "</details>" });
  assert.deepEqual(reported(closed.found), [`p#inside-fold: ${SENTENCE}`]);
  const outside = await drawn("/app/security", { beside: `<p id="beside-security">${SENTENCE}</p>` });
  assert.deepEqual(reported(outside.found), [`p#beside-security: ${SENTENCE}`]);
});

test("R29 (b): `places` with its chooser and the Oakland profile's name and covers reports nothing; control: a hard-coded sentence is reported", async () => {
  const none = await drawn("/app/places");
  assert.deepEqual(reported(none.found), []);
  const labels = none.main.querySelectorAll('label[for^="pl-p-"]').map((l) => l.textContent);
  assert.ok(labels.some((t) => t.includes(OAKLAND.name) && t.includes(OAKLAND.covers.join(", "))), labels.join(" | "));
  const caught = await drawn("/app/places", { beside: `<p id="beside-places">${SENTENCE}</p>` });
  assert.deepEqual(reported(caught.found), [`p#beside-places: ${SENTENCE}`]);
});

test("R29 (b): `elsewhere` with the Oakland profile's pointers (names, what each does, how to reach it) reports nothing; control: a hard-coded sentence is reported", async () => {
  const none = await drawn("/app/elsewhere");
  assert.deepEqual(reported(none.found), []);
  assert.equal(none.main.querySelectorAll(".cs-row").length, POINTERS.length, "every pointer is a row");
  const caught = await drawn("/app/elsewhere", { beside: `<p id="beside-elsewhere">${SENTENCE}</p>` });
  assert.deepEqual(reported(caught.found), [`p#beside-elsewhere: ${SENTENCE}`]);
});

test("R29 (b): Home of a team holding three languages and three places reports nothing; control: a hard-coded sentence is reported", async () => {
  /* a team at work, so Home draws its areas: projects, each with a question, and what the queue holds */
  // fixtures-own: harness journey-check walks a served plane and imports no module (K3100, K5062); the ops and codes of this table are held equal to the real ones by tables.mjs
  const busy = { ...PLANE,
    projectlist: ok({ ok: true, count: 2, limit: 200, truncated: false, projects: [{ id: "PROJ-1", name: "Roof repairs at 14 Lakeshore Row", stage: "investigating", lastChange: "2026-10-12T15:00:00Z" },
      { id: "PROJ-2", name: "Heating at the Coliseum lots", stage: "forming", lastChange: "2026-09-20T15:00:00Z" }] }),
    projectquestions: ok({ ok: true, project: "PROJ-1", items: [{ inquiry: "INQ-1" }], cursor: null }),
    queue: ok({ items: [{ id: "TSK-1", class: "OBLIGATION", kind: "check", summary: "Vouch for the photos of flat 4", due: "2026-10-12", assignee: "rosa", assignee_role: "admin",
      options: [], disposition: { instead: "taskresolve" }, subject: { kind: "bundle", id: "INF-7" } }], item_count: 1 }) };
  /* the record text the fixture holds, as the walk's own is: typed by the walk, never a sentence of the list */
  const entered = ["Roof repairs at 14 Lakeshore Row", "Heating at the Coliseum lots", "Vouch for the photos of flat 4"];
  const three = { ...busy,
    profiles: ok({ ok: true, profiles: [{ id: "a", name: "City of Oakland and Alameda County", covers: ["City of Oakland", "Alameda County"] }, { id: "b", name: "Second County", covers: ["Second County"] }, { id: "c", name: "Third Valley", covers: ["Third Valley"] }], choices: [], conflicts: [] }),
    grouplanguages: ok({ languages: ["en", "es", "vi"] }) };
  const none = await drawn("/app", { plane: three, entered });
  assert.deepEqual(reported(none.found), []);
  /* Home drew the team's languages and places (the lists are filled into their sentences, plain), and its areas */
  const text = none.main.textContent;
  assert.ok(text.includes("City of Oakland and Alameda County") && text.includes("Second County") && text.includes("Third Valley"), "three places");
  assert.ok(text.includes("español") && text.includes("Tiếng Việt") || /\bes\b.*\bvi\b/.test(text), "three languages");
  assert.ok(none.main.querySelectorAll("[data-area]").length > 0, "the areas");
  const caught = await drawn("/app", { plane: three, entered, beside: `<p id="beside-home">${SENTENCE}</p>` });
  assert.deepEqual(reported(caught.found), [`p#beside-home: ${SENTENCE}`]);
});

test("R29 (K5062): every op the pseudo walk's modelled plane answers is an op the plane declares", () => {
  assertDeclared(PLANE, "the pseudo walk's plane");
  assertDeclared(["projectquestions"], "the pseudo walk's busy team");
});
