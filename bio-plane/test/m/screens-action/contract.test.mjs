/* screens-action against interface-shell R21's screen contract and R7's common rules, at the module's interface
   (`SCREENS`, `SCREEN_WORDS`) and on the real served page (interface-shell's harness). The registry is the design
   stream's `registry.json` as merged into `tranche/T47` at PR #33's head (wizard-scripts R35). */
import test from "node:test";
import { actionWorld, openIn } from "./world-B.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SCREENS, SCREEN_WORDS } from "../../../src/screens-action/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { WORD_ROWS, hasWord, word } from "../../../src/setup-words/index.mjs";
import { checkScreens, interfacePage, interfaceScript, interfaceScriptHash, scriptPath, HOOK_CLASSES } from "../../../src/interface-shell/index.mjs";
import { nestedTips, accessibleName, controls } from "../interface-shell/harness.mjs";
import { open, main, crumbs, text, ops, ok, refused, textNodes, wordChecker, servedClasses, MEMBER, DATA_PLANE, ROUTES, PLAN_ID, ACTION_ID, DET, ESC, PROJECT, PLAN, ACTION, DETERMINATION,
  CONSEQUENCES, FILINGS, PROFILES, STATUS_NONE, FILING, W, QUESTION_TITLE, PAGE, ADMIN, STAKE, FUTURE_ACTION, PROFILES_WITH_HELP, draft, COMPLIANCE_SAYS } from "./page.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const REGISTRY = JSON.parse(readFileSync(join(ROOT, "docs/development/ux-substrate/screens/registry.json"), "utf8")).screens;
const WORD_KEYS = new Set(WORD_ROWS.map((r) => r[0]));
const EN = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
const IDS = ["plan", "start-send", "request", "action", "matter", "help-records", "actionnew", "hold", "holdnotice", "counsel", "dash-action"];

test("R1–R6, R9 (interface-shell R21): SCREENS is the registry screens plan, start-send, request, action, matter, help-records, each {id, reads, render, acts, words}", () => {
  assert.deepEqual(SCREENS.map((s) => s.id), IDS);
  for (const s of SCREENS) {
    assert.ok(REGISTRY.some((r) => r.id === s.id), `${s.id} is a registry screen`);
    assert.equal(typeof s.reads, "function");
    assert.equal(typeof s.render, "function");
    assert.ok(Array.isArray(s.acts) && Array.isArray(s.words));
    assert.ok(Object.isFrozen(s));
  }
});

test("R1–R6 (interface-shell R21, R38): each screen's acts are exactly its registry acts, every op in OPS, each with its send", () => {
  // An owed act (`owed:<op> K…`) is that op once declared (wizard-scripts R13): one whose op OPS does not hold is not yet an act
  // (`actionstake`, `actioninquiry`, T50). T51 (FR-31): `writinghelp` is drawn on every screen the registry lists it on, `start-send`,
  // `plan` and `matter` included (the registry test names it, entry 17).
  const NOT_YET = (a) => a.status === "owed" && !Object.hasOwn(OPS, String(a.op).replace(/^owed:/, "").split(" ")[0]);
  // BOB ruling (4 Nov): the counsel screen's counselpacketread and counselpacketexport (DEC-444) have no requirement in this
  // module yet; excepted here until BOB writes the counsel requirement. Every other act is held exactly.
  const EXCEPTED = { counsel: new Set(["counselpacketread", "counselpacketexport"]) };
  for (const s of SCREENS) {
    const reg = REGISTRY.find((r) => r.id === s.id).acts.filter((a) => !NOT_YET(a)).map((a) => String(a.op).replace(/^owed:/, "").split(" ")[0])
      .filter((op) => !EXCEPTED[s.id]?.has(op));
    const mine = s.acts.map((a) => a.op);
    assert.deepEqual([...mine].sort(), [...reg].sort(), s.id);
    for (const a of s.acts) {
      assert.ok(OPS[a.op], `${s.id}: ${a.op} is in OPS`);
      assert.equal(typeof a.send, "function", `${s.id}.${a.op} send`);
    }
  }
  assert.equal(checkScreens(SCREENS), true);
  // R16, R17: the action screen draws the registry's three acts for the law and the risk
  for (const op of ["actionrisktier", "actionlaws", "actionlawspropose"]) assert.ok(SCREENS.find((s) => s.id === "action").acts.some((a) => a.op === op), op);
});

test("R20 to R23, R19: the keys each new requirement names are the module's, each one setup-words holds, on the screen that draws it", () => {
  const words = (id) => new Set(SCREENS.find((s) => s.id === id).words);
  const NEED = {
    request: ["screen.request.nooffice", "screen.request.nooffice.admin", "screen.places.name", "screen.places.purpose", "stake.sentwith", "stake.inmatter", "stake.source.project",
      "stake.source.action", "stake.none", "stake.unreadable"],
    "start-send": ["stake.sentwith", "stake.inmatter", "stake.source.project", "stake.source.action", "stake.none", "stake.unreadable", "stake.ask.title", "stake.ask.says", "stake.ask.help",
      "stake.ask.undetermined", "stake.action.label", "stake.action.help", "stake.action.save", "refusal.MACHINE_CANNOT_SET_STAKE", "refusal.STAKE_MALFORMED.action"],
    "help-records": ["screen.help-records.must.2", "screen.help-records.must.3", "screen.help-records.must.4", "screen.help-records.must.5", "screen.help-records.must.6", "screen.help-records.must.7",
      "screen.help-records.faster.what", "screen.help-records.sub", "screen.help-records.portal.where", "screen.help-records.notheld"],
    action: ["action.noreply.title", "action.noreply.says", "action.noreply.question", "action.noreply.question.help", "refusal.ACTION_INQUIRY_NO_QUESTION", "refusal.ACTION_NO_PROJECT",
      "refusal.MACHINE_CANNOT_OPEN_FROM_ACTION"],
  };
  for (const [id, keys] of Object.entries(NEED)) for (const k of keys) {
    assert.ok(hasWord(k), `${k} is a word of setup-words`);
    assert.ok(words(id).has(k), `${id} reads ${k}`);
    assert.ok(SCREEN_WORDS.includes(k), `${k} is in SCREEN_WORDS`);
  }
});

test("R19 (setup-words R12, R13): the module holds keys only: SCREEN_WORDS is a list of keys, each one setup-words holds, and each screen's words are keys of it or of the acts' and the shell's", () => {
  assert.ok(Object.isFrozen(SCREEN_WORDS));
  assert.ok(SCREEN_WORDS.length > 300);
  for (const k of SCREEN_WORDS) {
    assert.equal(typeof k, "string", "a key, never a row of English");
    assert.ok(hasWord(k), `${k} is a word of setup-words`);
  }
  assert.equal(new Set(SCREEN_WORDS).size, SCREEN_WORDS.length, "keys distinct");
  // the design's rename: the ask's label is act.planask.label.plan, read by key, and the old key is read nowhere
  assert.ok(SCREEN_WORDS.includes("act.planask.label.plan") && !SCREEN_WORDS.includes("act.optionpropose.label.plan"));
  for (const s of SCREENS) for (const w of s.words) {
    assert.equal(typeof w, "string", `${s.id}: a key`);
    if (/^act\.[a-z]+\.label\./.test(w) && !hasWord(w)) continue; // an act's default label the registry's design may not key for this screen
    assert.ok(hasWord(w) || WORD_KEYS.has(w), `${s.id}: ${w}`);
  }
  // the law and the risk (R16, R17) and the design's words for them
  for (const k of ["law.title", "law.help", "law.stated", "law.undetermined", "law.change", "law.proposed", "law.proposal.not", "law.propose",
    "risk.title", "risk.help", "risk.tier", "risk.tier.1", "risk.tier.2", "risk.tier.3", "risk.tier.undetermined", "risk.set", "risk.revise", "risk.proposed",
    "risk.proposal", "risk.proposal.not"]) assert.ok(SCREENS.find((s) => s.id === "action").words.includes(k), k);
});

test("R19: over fixtures, what a screen draws for a sample of its keys equals word(key, vars): the plan's, the action's and the matter's", async () => {
  const plan = await open(ROUTES.plan, DATA_PLANE);
  for (const [k, v] of [["screen.plan.options"], ["screen.plan.col.category"], ["screen.plan.matter.n", { n: "2" }], ["screen.plan.category.awareness"]])
    assert.ok(text(plan).includes(W(k, v)), k);
  const act = await open(ROUTES.action, DATA_PLANE);
  for (const [k, v] of [["law.title"], ["risk.title"], ["screen.action.dates"], ["screen.action.replies"], ["screen.action.to", { office: "City Clerk, Office of the City Clerk" }]])
    assert.ok(text(act).includes(W(k, v)), k);
  const matter = await open(ROUTES.matter, DATA_PLANE);
  for (const [k, v] of [["screen.matter.determination"], ["screen.matter.escalation"], ["screen.matter.stage.4"]]) assert.ok(text(matter).includes(W(k, v)), k);
  // and a key setup-words does not hold is no word: word() throws, and so no screen can draw it
  assert.throws(() => word("screen.action.noSuchSentence"), /UNKNOWN_WORD/);
});

test("R7 (action-producers R19): every member-facing sentence calls a plan's subject a matter: no word a screen draws says 'subject' of a plan", () => {
  for (const s of SCREENS) for (const w of s.words) {
    const en = EN.get(w);
    if (en === undefined) continue;
    // R39: the design's words for naming what a records request concerns (an entity the record follows), never a plan's subject
    if (/^screen\.person\.keeper\.subject\./.test(w)) continue;
    assert.ok(!/\bsubjects?\b/i.test(en), `${s.id}: ${w} says "${en}"`);
  }
});

test("R7 (interface-shell R23): no place is named in the words this module reads", () => {
  for (const k of SCREEN_WORDS) assert.ok(!/California|Oakland|Alameda|NextRequest|Sunshine Ordinance|Government Code/.test(EN.get(k) || ""), k);
});

const DATA = ["River Town", "Inspection logs, 2025", "a letter from the city's counsel", "Pothole repairs", "Repairs: closed is not repaired", "INQ-2026-ffffffffffffffff", DET, "STD-1", "STD-2", "Lease §7.2", "Lease §9.1", ESC, ACTION_ID, PLAN_ID, PROJECT,
  "a suspected matter", "determined", "Records request: inspection logs", "Story with a reporter", "Complaint to the auditor",
  "first, to see what closed means", "Records first", "Phase 1", "opt-1", "Scenario 1: no branch answers a hostile response to the records request.",
  "Ask the committee to agendize repair performance", "the committee oversees repairs", "machine work", `inquiry:INQ-2026-ffffffffffffffff`, `outcome:${DET}#STD-1`,
  "City Clerk, Office of the City Clerk", "Asha Rao", "mai", "M", "web form", "email", "Office of the City Clerk", "Response due", "Extension ends", "ten days from receipt",
  "fourteen more days", "Gov. Code § 7922.535", "Gov. Code § 7922.535(b)", "Mun. Code § 2.20.230", "Gov. Code § 7922.535(b); Gov. Code § 7922.535(c); Mun. Code § 2.20.230",
  "The 2024 rent adjustment", "City Administrator, City", "a council vote", "adjusted without a vote", "notice within 30 days", "noticed on day 21",
  "Tenants of the district", "class", "38000 USD", "from the rent schedules", "The repair program", "program", "its trigger was met 5 days ago",
  COMPLIANCE_SAYS, W("filings.why.record_holds_value"), "not every part addressed", "the records law's ten days", "1", "2", "3", "10", "14", "notification", "Open",
  "12 October 2026", "26 October 2099", "2 October 2026", "3 October 2026", "4 October 2026", "20 October 2026", "30 November 2026", "20 December 2026", "24 October 2026", "1 March 2024",
  QUESTION_TITLE, "Who signed the closure memo?", "Gov. Code § 7922.535(b)", "Open meetings law", "agent:claude", "claude", "asha", "the office has fought requests before",
  "Some members rent from landlords the city licenses.", "Two members live in buildings on the city's list of slow repairs.", "dev", "9 October 2026", "Testville", "Director of Public Works, Public Works", "Hearing statement", "Ask in writing, naming the records", "the office says within 10 days whether it will release them", "Call the clerk's desk first", "a name for the file",
  "Records request, with our follow-up questions", "@records-request", "A special motion to strike generally must be filed within 60 days of being served with the complaint.",
  "Code Civ. Proc. § 425.16", "a notice of claim", "a letter from the owner's lawyer", "The rent dispute", "Closed means repaired", "ana", "30 September 2026", "1 October 2026", "9 October 2026"];

test("R1–R6, R9 (interface-shell R8, R21): the shell serves the six screens: each route draws its screen under its path, from its own source", async () => {
  // interface-shell R1, R2: the page loads the shell as one external versioned script with its hash; no inline script and no nonce
  const page = interfacePage(SCREENS, { version: "0.0.1" });
  assert.ok(page.includes(`<script src="${scriptPath("0.0.1")}" integrity="${interfaceScriptHash(SCREENS)}"></script>`));
  assert.ok(!/<script(?![^>]*\ssrc=)/.test(page) && !page.includes("nonce"), "no inline script and no nonce");
  assert.ok(interfaceScript(SCREENS).length > 1000, "the screens are the script's");
  for (const [id, path] of Object.entries(ROUTES)) {
    const p = await open(path, DATA_PLANE);
    assert.ok(main(p).querySelector("nav.cs-crumbs [aria-current]"), `${id} under its path`);
    assert.ok(main(p).querySelector("h1"), `${id} has its heading`);
    assert.ok(text(p).length > 40, `${id} drew from its own source`);
  }
});

test("R7 (interface-shell R5, R10): every text node each screen draws, with data, empty and failed, is a word (filled) or the record's own data", async () => {
  const isWord = wordChecker(DATA);
  const fail = refused("STORE_DID_NOT_ANSWER", null, 502);
  const planes = {
    data: DATA_PLANE,
    failed: Object.fromEntries(Object.keys(DATA_PLANE).map((k) => [k, fail])),
  };
  for (const [state, plane] of Object.entries(planes)) for (const [id, path] of Object.entries(ROUTES)) {
    const p = await open(path, plane);
    for (const t of textNodes(main(p)).map((n) => n.textContent.trim()).filter((t) => t && !/^[·:,.()›→\s]+$/.test(t)))
      assert.ok(isWord(t), `${id} (${state}) draws "${t}", which is no word`);
  }
});

test("R19: no screen draws a placeholder: every {name} of a word it reads is filled, in every state the fixtures reach", async () => {
  const fail = refused("STORE_DID_NOT_ANSWER", null, 502);
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  const planes = [DATA_PLANE, { ...DATA_PLANE, ...reach }, Object.fromEntries(Object.keys(DATA_PLANE).map((k) => [k, fail]))];
  for (const plane of planes) for (const path of [...Object.values(ROUTES), `/app/start-send/${ACTION_ID}`, `/app/request/${PROJECT}`, `/app/matter/${DET}`]) {
    const p = await open(path, plane);
    assert.doesNotMatch(text(p), /\{\w+\}/, `${path} draws a placeholder`);
  }
});

test("R7 (interface-shell R10): a failed read is drawn as failed, never as empty, on every screen", async () => {
  const fail = refused("STORE_DID_NOT_ANSWER", null, 502);
  for (const [id, path] of Object.entries(ROUTES)) {
    const p = await open(path, Object.fromEntries(Object.keys(DATA_PLANE).map((k) => [k, fail])));
    const states = main(p).querySelectorAll("[data-state]").map((e) => e.getAttribute("data-state"));
    assert.ok(states.includes("failed"), `${id} draws its failed read as failed`);
  }
});

test("R7 (interface-shell R12, R15, R22): an act the gate refuses is absent, never greyed; no explanation inside another; every control named, every field labelled", async () => {
  for (const [id, path] of Object.entries(ROUTES)) {
    const p = await open(path, DATA_PLANE);
    assert.equal(main(p).querySelectorAll("button[disabled]").length, 0, id);
    assert.deepEqual(nestedTips(main(p)).map((e) => e.outerHTML.slice(0, 80)), [], `${id}: no explanation inside another`);
    for (const c of controls(main(p))) assert.ok(accessibleName(c, p.doc), `${id}: ${c.outerHTML.slice(0, 80)} has a name`);
    const shut = await open(path, { ...DATA_PLANE, whoami: ok({ ...MEMBER, capabilities: [] }) });
    for (const op of ops(shut)) assert.ok(["itemtakeup", "reminderset", "optionstartpreview", "addresseesuggest"].includes(op), `${id}: ${op} needs contribute`);
  }
});

test("R7 (interface-shell R13): each refusal word an act names is a listed word", () => {
  for (const s of SCREENS) {
    const listed = new Set(s.words.map((w) => (typeof w === "string" ? w : w[0])));
    for (const a of s.acts) for (const [code, key] of Object.entries(a.refusals || {})) assert.ok(typeof key === "function" || listed.has(key), `${s.id}.${a.op}: ${code} → ${key}`);
  }
});

test("R7: after an act the screen re-reads what it changed: an act names only its own screen's reads", () => {
  for (const s of SCREENS) {
    const names = new Set([...Object.keys(s.reads({ subject: `${PLAN_ID}~opt-1`, ui: {}, reachable: true, data: {} })),
      ...Object.keys(s.reads({ subject: ACTION_ID, ui: {}, reachable: true, data: {} })), ...Object.keys(s.reads({ subject: `${DET}~${ESC}`, ui: {}, reachable: true, data: {} }))]);
    for (const a of s.acts) for (const r of a.rereads || []) assert.ok(names.has(r), `${s.id}.${a.op} rereads ${r}`);
  }
});

test("R1–R6 (interface-shell R8): every working screen is drawn under its path, its project's step named by the project's title as read", async () => {
  const want = { plan: "Projects › Pothole repairs › Action plan", "start-send": "Projects › Pothole repairs › Action plan › Start and send",
    request: "Projects › Pothole repairs › Request records", action: "Projects › Pothole repairs › Action", matter: "Projects › Pothole repairs › Matter" };
  for (const [id, path] of Object.entries(want)) {
    const p = await open(ROUTES[id], DATA_PLANE);
    const steps = crumbs(p);
    assert.equal(steps.join(" › "), path, id);
  }
});

/* ---------- R14 (T48; K3250, K3254; walk C1): the common line ---------- */

const CLASS_PLANES = () => {
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  const ending = { ...reach, planask: ok({ ok: true, plan: PLAN_ID, run: "RUN-1", started: true }), airun: ok({ found: true, session: { id: "RUN-1", status: "completed" } }) };
  return [
    [DATA_PLANE, [ROUTES.plan, ROUTES["start-send"], ROUTES.request, ROUTES.action, ROUTES.matter, ROUTES["help-records"]]],
    [{ ...DATA_PLANE, ...reach }, [ROUTES.plan]],
    [{ ...DATA_PLANE, ...ending }, [ROUTES.plan]],
    [{ ...DATA_PLANE, filingsfor: ok(FILINGS([{ filing: FILING, form: "communication", at: "2026-10-09T10:00:00Z", approval: null, second_approval: null, second_needed: false, sending: null }])) },
      [ROUTES.request, `/app/start-send/${ACTION_ID}`]],
    [{ ...DATA_PLANE, filingsfor: ok(FILINGS([{ filing: FILING, form: "communication", at: "2026-10-09T10:00:00Z", approval: { approved_by: "member:mai", at: "x", sha: "s" }, second_approval: null, second_needed: false, sending: null }])) },
      [ROUTES.request, `/app/start-send/${ACTION_ID}`]],
    [DATA_PLANE, [`/app/request/${PROJECT}`, `/app/start-send/${ACTION_ID}`]],
    // T50 (R20 to R23): the states the new requirements draw
    [{ ...DATA_PLANE, addresseesuggest: ok({ subject: PROJECT, offices: [], suggestion: true }), whoami: ok(ADMIN) }, [`/app/request/${PROJECT}`]],
    [{ ...DATA_PLANE, addresseesuggest: ok({ subject: PROJECT, offices: [{ addressee: { state: "named", kind: "office", role: "City Clerk", body: "Office of the City Clerk" } }] }) }, [`/app/request/${PROJECT}`]],
    [{ ...DATA_PLANE, filingsfor: ok(FILINGS([draft()])), stakeatpreparation: ok(STAKE({ higher_stakes: true, governing_tier: "undetermined", matter_stake: { stake: "undetermined", set_by: null, set_at: null, source: "action" } })) },
      [ROUTES.request, `/app/start-send/${ACTION_ID}`]],
    [{ ...DATA_PLANE, profiles: ok(PROFILES_WITH_HELP()) }, [ROUTES["help-records"]]],
    [{ ...DATA_PLANE, action: ok(FUTURE_ACTION) }, [ROUTES.action]],
  ];
};

// the script-hook classes interface-shell R56 lists need no style
const KIT_OWN = Object.keys(HOOK_CLASSES);

test("R14: every element these screens draw uses a class a served stylesheet defines (civicsmith.css, the design page's product rules, the shell's own style); none of mk-form, mk-done, mk-grid, cs-form", async () => {
  const served = servedClasses();
  const unstyled = new Map();
  for (const [plane, routes] of CLASS_PLANES()) for (const path of routes) {
    const p = await open(path, plane);
    for (const el of main(p).querySelectorAll("[class]")) for (const c of String(el.getAttribute("class")).split(/\s+/).filter(Boolean))
      if (!served.has(c) && !KIT_OWN.includes(c)) unstyled.set(c, path);
  }
  assert.deepEqual([...unstyled], []);
  const p = await open(ROUTES.plan, DATA_PLANE);
  for (const c of ["mk-form", "mk-done", "mk-grid", "cs-form"]) assert.equal(main(p).querySelectorAll("." + c).length, 0, c);
});

test("R14: every labelled field is the kit's cs.field (or cs.choice): a label sits only in a .cs-field, and no help sits outside one", async () => {
  for (const [plane, routes] of CLASS_PLANES()) for (const path of routes) {
    const p = await open(path, plane);
    for (const l of main(p).querySelectorAll("label")) {
      let up = l.parentNode, inField = false;
      while (up && up !== main(p)) { if (String(up.getAttribute && up.getAttribute("class") || "").split(/\s+/).includes("cs-field")) inField = true; up = up.parentNode; }
      assert.ok(inField, `${path}: a label outside a field: ${l.outerHTML.slice(0, 90)}`);
    }
    for (const h of main(p).querySelectorAll(".help")) {
      let up = h.parentNode, inField = false;
      while (up && up !== main(p)) { if (String(up.getAttribute && up.getAttribute("class") || "").split(/\s+/).includes("cs-field")) inField = true; up = up.parentNode; }
      assert.ok(inField, `${path}: a help outside a field`);
    }
  }
});

test("R14: a section, list or reading that holds nothing is not drawn, and no count is drawn at zero: each screen over an empty fixture", async () => {
  const empty = {
    plan: ok({ ...PLAN, subjects: [], options: [], scenarios: [], offers: [], checks: [] }),
    action: ok({ ...ACTION, clock: [], correspondence: [], entries: [], reply_owed: { owed: false }, governing_laws: { state: "undetermined", laws: [], by: null, at: null, stated: "x" }, governing_laws_proposals: { proposals: [] }, risk_tier: "undetermined", risk_tier_history: { revisions: [] }, risk_tier_proposals: { proposals: [] } }),
    determination: ok({ ...DETERMINATION, standards: [], outcomes: [] }), consequencesof: ok({ ...CONSEQUENCES, parts: [] }),
    escalationstatus: ok(STATUS_NONE), escalation: ok({}),
    profiles: ok({ ...PROFILES, view: { deadlines: [] } }),
  };
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }), planproposals: ok({ plan: PLAN_ID, run: "RUN-1", proposals: [], says: "x" }) };
  const { world, me, action } = await actionWorld();
  for (const [path, extra] of [[ROUTES.plan, reach], [ROUTES.plan, {}], [ROUTES.action, {}], [ROUTES.matter, {}], [ROUTES["help-records"], {}], [ROUTES.request, {}], [`/app/start-send/${ACTION_ID}`, {}],
    [`/app/request/${PROJECT}`, { addresseesuggest: ok({ subject: PROJECT, offices: [], suggestion: true }), whoami: ok(ADMIN) }]]) {
    /* the action's marks are the store's: `pressurefor` is read from the world's real action, which no act has marked (the action's page is opened at its real id) */
    const p = path === ROUTES.action ? await openIn(world, me, `/app/action/${action}`, { ...DATA_PLANE, ...empty, ...extra, action: ok({ ...empty.action.json.result, id: action }) })
      : await open(path, { ...DATA_PLANE, ...empty, ...extra });
    if (path === ROUTES.action) assert.deepEqual(p.byOp("pressurefor").map((r) => r.query.action), [action], "the marks were read from the store");
    for (const sec of main(p).querySelectorAll("section.cs-section")) {
      const head = (sec.querySelector("h2") || { textContent: "" }).textContent;
      assert.ok(sec.textContent.replace(head, "").trim() || sec.querySelector("button, input, select, textarea"), `${path}: an empty section "${sec.textContent.trim().slice(0, 40)}"`);
      assert.equal(sec.querySelectorAll('[data-state="empty"]').length, 0, `${path}: an empty sentence inside a section`);
    }
    assert.doesNotMatch(text(p), /(^|[\s·(])0($|[\s·).,])/, `${path}: a zero is drawn`);
  }
  const closed = await open(ROUTES.plan, { ...DATA_PLANE, plan: ok({ ...PLAN, state: "closed", closed: { reason: "done", by: "member:dev", at: "x" }, subjects: [], options: [], scenarios: [], offers: [], checks: [] }) });
  assert.equal(main(closed).querySelectorAll("section.cs-section").length, 0, "a closed, empty plan draws no section");
  assert.equal(main(closed).querySelectorAll('[data-state="empty"]').length, 1, "its one empty state");
});

test("R14 (control; interface-shell R10): a read that failed is still drawn as failed, on every screen", async () => {
  const fail = refused("STORE_DID_NOT_ANSWER", null, 502);
  for (const [id, path] of Object.entries(ROUTES)) {
    const p = await open(path, Object.fromEntries(Object.keys(DATA_PLANE).map((k) => [k, fail])));
    assert.ok(main(p).querySelectorAll('[data-state="failed"]').length > 0, id);
  }
});
