/* journey-check R21 on the local arm (F10): how the walk puts each carried state's LIVE screen in that state, by its own acts
   or by data the arm made, and how it knows it is there. `localReach(ctx)` answers `{ "<screen>:<option>": entry }`, keyed as
   CARRIED_STATES is (states.mjs `stateKey`); an entry is `{ reach(page, base), page?, rank?, expect?, after?, note? }`:
   - `reach` answers true when the page draws the state's own marker (a word by its key, R14, or the markup the screen draws for
     that state); it is called once per width and so does its setup once (`once`) and finds the state already drawn the second
     time; it throws, naming what is missing, when the state is not drawn;
   - `page()` the person's page the state is drawn to (a member's, or a new member's own device), else the founder's;
   - `rank` orders the states whose setup would change what an earlier state draws (a member removed, the team's places);
   - `after(page)` puts back what the state changed;
   - `note` is written beside the pair where the arm stood in for the world (an answer the walk's own route gave).
   A carried state with no entry here is one the local copy cannot draw (`UNREACHABLE`, with its reason); it still fails by its
   name on the local arm (R21), and is reported to BOB with that reason. */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { settle } from "./walker.mjs";
import { act, type, reveal, requireDrawn, inviteMember, signInBy } from "./journeys.mjs";
import { requireWord, wordPattern, word } from "./words.mjs";
import { readAndCite, UPLOAD_TEXT } from "./investigation.mjs";

/* The carried states the local copy cannot draw, by key, each with why (reported to BOB; never passed). */
export const UNREACHABLE = Object.freeze({
  "project:notice is published": "a notice is signed with the instance's key, and the installer binds none (RECEIPT_SIGNING_KEY): noticeprepare is refused NOTICE_NO_INSTANCE_KEY",
  "home:for the": "the founder of a new team: drawn only before a second member or a project exists, long before the carried states are walked",
  "connect:connected": "connect is retired (T53): /app/connect draws \"Nothing is here\"",
  "connect:signed in": "connect is retired (T53): /app/connect draws \"Nothing is here\"",
  "connect:your own Claude sign-in": "connect is retired (T53): /app/connect draws \"Nothing is here\"",
  "connect:a team that doesn't": "connect is retired (T53): /app/connect draws \"Nothing is here\"",
  "connect:a team that keeps": "connect is retired (T53): /app/connect draws \"Nothing is here\"",
  "teamai:Ask": "teamai is retired (T53): /app/teamai draws \"Nothing is here\"",
  "teamai:Yes": "teamai is retired (T53): /app/teamai draws \"Nothing is here\"",
  "group-identity:an": "the installer records the team's short name at first boot, so no installation of this release lacks it",
  "updates:the same,": "needs a newer release notice signed by Civicsmith's release keys",
  "open-file:a file held": "a hold is placed only on a scanner's finding, and the local world's file scanner finds nothing",
  "places:a state with no": "the United States (federal law) profile stays active whatever the team chooses on Places, so the team always holds a non-test profile and Places never draws its no-profile state",
  "queue:an all-clear": "every feed of the local copy answers, so an empty queue says nothing is waiting (the queue's other state, walked); the two cannot both be drawn",
});

const once = (fn) => { let p = null; return () => (p ||= fn()); };
const idOf = (url) => decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop());
const inMain = (p) => p.locator("#cs-main");

/* Whether `m` ({sel: [...], words: [...], none: [...]}) is drawn now: each selector attached, each word drawn, none of `none`. */
async function drawn(p, m, timeout = 0) {
  try {
    for (const s of m.sel || []) await p.locator(s).first().waitFor({ state: "attached", timeout: timeout || 300 });
    for (const k of m.words || []) await requireWord(p, k, { within: "#cs-main", timeout: timeout || 300 });
  } catch { return false; }
  const text = (await inMain(p).innerText().catch(() => "")).replace(/\s+/g, " ");
  return !(m.none || []).some((k) => wordPattern(k).test(text));
}
/* Requires `m` drawn, naming what is not. */
async function need(p, m) {
  for (const s of m.sel || []) {
    try { await p.locator(s).first().waitFor({ state: "attached", timeout: 15000 }); }
    catch { throw new Error(`${s} is not drawn on ${new URL(p.url()).pathname}`); }
  }
  for (const k of m.words || []) await requireWord(p, k, { within: "#cs-main", timeout: 15000 });
  const text = (await inMain(p).innerText().catch(() => "")).replace(/\s+/g, " ");
  for (const k of m.none || []) if (wordPattern(k).test(text)) throw new Error(`${k} is drawn on ${new URL(p.url()).pathname}, which the state does not draw`);
  return true;
}
/* A reach: already in the state, or `go` puts the page there; either way the marker must be drawn. */
const state = (m, go) => async (p, base) => { if (await drawn(p, m)) return true; await go(p, base); await settle(p); return need(p, m); };

/* A crafted zip whose central directory lists one entry twice, both claiming the same bytes (acquisition's
   ARCHIVE_AMBIGUOUS, entries_overlap): what an archive that could not be opened is. */
export function overlappingZip() {
  const name = Buffer.from("a.txt"), data = Buffer.from("Lakeshore Row\n");
  let crc = 0xffffffff;
  for (const b of data) { crc ^= b; for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(10, 4); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(10, 6);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
  const entry = Buffer.concat([central, name]);
  const head = Buffer.concat([local, name, data]);
  const dir = Buffer.concat([entry, entry]);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(2, 8); end.writeUInt16LE(2, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(head.length, 16);
  return Buffer.concat([head, dir, end]);
}
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/* ctx: { walk, base, who: {founder, member, newcomer}, founder, mai, teo (pages), device() (a new browser context's page),
   made: {project, question, document}, own: {project, question} } */
export function localReach(ctx) {
  const { walk, base, who } = ctx;
  const F = ctx.founder, M = ctx.mai, T = ctx.teo;
  const at = (path) => new URL(path, base).href;
  const go = async (p, url) => { await p.goto(url); await settle(p); };
  const project = ctx.made.project, question = ctx.made.question;
  const projectId = () => idOf(project);

  /* ---- setups, each done once ---- */
  /* Mai on her own computer, signed in (journey 28 signed her out there; R10 signs her in only when it is walked) */
  const maiIn = once(() => signInBy(walk, M, base, who.member, "R21 · Mai signs in on her own computer"));
  const asMai = async () => { await maiIn(); return M; };
  /* a member's row opened on Members, its acts and capability boxes drawn (interface-shell's row panel) */
  const openRow = async (p, id) => {
    const ctl = p.locator(`#cs-main [data-shell="row"][data-id="${id}"]`).first();
    if ((await ctl.getAttribute("aria-expanded").catch(() => null)) !== "true") { await ctl.click(); await settle(p); }
  };
  /* Mai joined the walk's project and seated as its second owner (the owner standing down needs two) */
  const maiOwner = once(async () => {
    await maiIn();
    await go(F, project);
    await act(F, "projectinvite", { fields: { "project-invite": who.member.handle }, reason: "She lives in flat 4." });
    await go(M, project);
    await act(M, "projectjoin", { reason: "I was invited." });
    await go(F, project);
    await act(F, "projectowneradd", { which: `[data-handle="${who.member.handle}"]`, reason: "She shares the work." });
  });
  /* the second project made findable (a project the member is not in; a join request to answer) */
  const ownFindable = once(async () => {
    await go(F, ctx.own.project);
    await type(F, "project-visibility-why", "Other tenants should be able to find it.");
    await act(F, "projectvisibilityset", { reason: "Other tenants should be able to find it." });
  });
  /* a fresh question in the walk's project, by its title */
  const freshQuestion = (title) => once(async () => {
    await go(F, project);
    await act(F, "promote", { fields: { "project-question": title }, reason: "Recorded by the release walk." });
    await F.waitForURL((u) => u.pathname.startsWith("/app/question/"), { timeout: 15000 });
    return F.url();
  });
  /* a fresh question citing the walk's vouched notice: a question's set-aside fold, its plan and state b are drawn only once it cites */
  const citedQ = (title) => once(async () => {
    const q = await freshQuestion(title)();
    if (!ctx.made.document) throw new Error("the walk holds no vouched document to cite (R9 step 6 did not record one)");
    await readAndCite(walk, F, { document: ctx.made.document, question: q, prefix: "R21 · " });
    return q;
  });
  const deferQ = citedQ("Will the city inspect the roof again this winter?");
  const dismissQ = citedQ("Did the landlord's insurer pay for the last repair?");
  const askQ = citedQ("Does the notice set a date for the roof repair?");
  /* an action in the walk's project, its date passed with no reply */
  const action = once(async () => {
    await go(F, at(`/app/actionnew/${encodeURIComponent(projectId())}`));
    await type(F, "an-who", "The city's housing inspection office");
    await type(F, "an-ask", "Please confirm when the roof repair ordered by notice 2026-118 will be inspected.");
    const leg = F.locator("#an-leg");
    if (await leg.count()) { await reveal(leg); await leg.selectOption(idOf(question)).catch(async () => leg.selectOption({ index: 1 })); }
    await type(F, "an-due-text", "A reply from the inspection office");
    await type(F, "an-due-date", "2026-10-01");
    await type(F, "an-due-because", "The office said it answers within ten days.");
    await act(F, "actioncreate", { reason: "The tenants asked for an inspection date." });
    await F.waitForURL((u) => u.pathname.startsWith("/app/action/"), { timeout: 15000 });
    return F.url();
  });
  /* an ordinance and an office the record follows, made on People (each lands on its own page) */
  const other = (name, kind, note) => once(async () => {
    /* People draws its "Show" choice once the record follows someone */
    await landlord();
    await go(F, at("/app/people"));
    await F.locator("#people-show").selectOption(kind === "office" ? "offices" : "ordinances");
    await act(F, "search");
    await type(F, "people-other-name", name);
    await F.locator("#people-other-kind").selectOption(kind);
    await type(F, "people-other-note", note);
    await act(F, "entitycreate", { reason: "The record follows it." });
    await F.waitForURL((u) => u.pathname.startsWith("/app/person/"), { timeout: 15000 });
    return F.url();
  });
  const ordinance = other("Oakland Rent Adjustment Ordinance", "ordinance", "The city's rules on rent and repairs.");
  const office = other("Director of Housing Inspection", "office", "Signs the city's repair orders.");
  /* an organization named the way the walk's documents name their address, so Find's subjects route answers too */
  const landlord = once(async () => {
    await go(F, at("/app/people"));
    await type(F, "people-add-name", "Lakeshore Row Holdings");
    await F.locator("#people-add-kind").selectOption("institution");
    await type(F, "people-add-note", "Owns 14 Lakeshore Row.");
    await act(F, "entitycreate", { reason: "The record follows it." });
  });
  /* a new member joined on a device of her own, stopped before her first Home (her first visit is the state) */
  const newMember = (id, cover, handle, startProjects) => once(async () => {
    const link = await inviteMember(walk, F, base, { id, cover, startProjects });
    const page = await ctx.device();
    const pw = walk.keepSecret(`${id}-` + Math.random().toString(36).slice(2, 14));
    await page.goto(link);
    await page.waitForURL((u) => u.pathname === "/app/join", { timeout: 15000 });
    await settle(page);
    if (await page.locator("#jn-lang").count()) await page.locator("#jn-lang").selectOption({ index: 0 });
    await act(page, "enroll", { fields: { "jn-handle": handle, "jn-pw": pw, "jn-pw2": pw } });
    await page.locator('[data-state="joined"]').first().waitFor({ state: "visible", timeout: 15000 });
    return { page, handle, password: pw };
  });
  /* an administrator invited (the grant confirmed, R72) and joined on her own device */
  const newAdmin = (id, cover, handle) => once(async () => {
    await go(F, at("/app/members"));
    const box = F.locator('input[name="mi-caps"][value="administer"]');
    await reveal(box); await box.check(); await settle(F);
    await type(F, "mi-id", id); await type(F, "mi-cover", cover);
    /* a grant that includes administering is confirmed first (R72): the first press asks, nothing is sent until yes */
    await act(F, "memberadd", { reason: "The team shares the administration." });
    const yes = F.locator('input[name="mi-ok"][value="yes"]');
    await yes.first().waitFor({ state: "visible", timeout: 10000 }); await yes.first().check(); await settle(F);
    await act(F, "memberadd", { reason: "The team shares the administration." });
    const shownLink = F.locator('[data-shown="invite"] code').first();
    await shownLink.waitFor({ state: "visible", timeout: 15000 });
    const link = walk.keepSecret((await shownLink.textContent()).trim());
    const page = await ctx.device();
    const pw = walk.keepSecret(`${id}-` + Math.random().toString(36).slice(2, 14));
    await page.goto(link);
    await page.waitForURL((u) => u.pathname === "/app/join", { timeout: 15000 });
    await settle(page);
    if (await page.locator("#jn-lang").count()) await page.locator("#jn-lang").selectOption({ index: 0 });
    await act(page, "enroll", { fields: { "jn-handle": handle, "jn-pw": pw, "jn-pw2": pw } });
    await page.locator('[data-state="joined"]').first().waitFor({ state: "visible", timeout: 15000 });
    return { page, password: pw };
  });
  /* with three administrators, Ana proposes Dev's removal: two of three needed, the founder's vote still awaited */
  const removalOpen = once(async () => {
    const ana = await newAdmin("ana", "Ana, from flat 3", "ana-p")();
    await newAdmin("dev", "Dev, from flat 5", "dev-s")();
    await go(ana.page, at("/app/members"));
    await act(ana.page, "adminremove", { fields: { "mr-dev": "Dev has moved away and no longer takes part." }, which: '[data-member="dev"]', password: ana.password, reason: "Dev has moved away." });
  });
  const lea = newMember("lea", "Lea, from flat 2", "lea-m", true);
  const ned = newMember("ned", "Ned, from flat 7", "ned-o", false);
  const leaHome = once(() => firstHome(lea)()), nedHome = once(() => firstHome(ned)());
  /* her first Home: from the join screen's own link, once */
  const firstHome = (who) => once(async () => {
    const { page } = await who();
    await page.locator("a[href='/app'][data-nav]").last().click();
    await settle(page);
    await requireDrawn(walk, page, "home");
  });
  /* Mai's own projects: one hidden from the founder, one to which she invites the founder (the founder's queue then holds it) */
  const maiProject = (title, invite) => once(async () => {
    await maiIn();
    await go(M, at("/app/projects"));
    const v = M.locator("#projects-visibility-hidden");
    await reveal(v); await v.check();
    await act(M, "promote", { fields: { "projects-title": title }, reason: "Recorded by the release walk." });
    await M.waitForURL((u) => u.pathname.startsWith("/app/project/"), { timeout: 15000 });
    const url = M.url();
    if (invite) await act(M, "projectinvite", { fields: { "project-invite": invite }, reason: "She knows the building." });
    return url;
  });
  const maiHidden = maiProject("Mai's notes on the stairwell light", null);
  const maiInvites = maiProject("Library branch hours on Lakeshore", who.founder.handle);
  /* Mai asks to join the findable project and the founder answers yes from her queue (a join answer: what she answered) */
  const joinAnswered = once(async () => {
    await maiIn();
    await ownFindable();
    await go(M, ctx.own.project);
    await act(M, "projectrequest", { reason: "I live in flat 6 and the heating is out." });
    await go(F, at("/app/queue"));
    await act(F, "projectrequestanswer", { which: '[data-answer="grant"]', reason: "She lives in the building." });
  });
  /* Teo in the walk's project, then allowed to read but not act (no `contribute`) */
  const teoReadOnly = once(async () => {
    await action();
    await go(F, project);
    await act(F, "projectinvite", { fields: { "project-invite": who.newcomer.handle }, reason: "He lives in flat 9." });
    await go(T, project);
    await act(T, "projectjoin", { reason: "I was invited." });
    await go(F, at("/app/members"));
    await openRow(F, "teo");
    const box = F.locator("#mc-teo-contribute");
    await reveal(box); await box.uncheck();
    await act(F, "membercaps", { which: '[data-member="teo"]', password: who.founder.password, reason: "He reads for now." });
  });
  /* Teo may start a hidden project, starts one, and is then removed from the team: no owner of it is active (the rescue) */
  const orphaned = once(async () => {
    await go(F, at("/app/members"));
    await openRow(F, "teo");
    const box = F.locator("#mc-teo-create_projects");
    await reveal(box); await box.check();
    await act(F, "membercaps", { which: '[data-member="teo"]', password: who.founder.password, reason: "He runs the flat 9 work." });
    await go(T, at("/app/projects"));
    const v = T.locator("#projects-visibility-hidden");
    await reveal(v); await v.check();
    await act(T, "promote", { fields: { "projects-title": "Flat 9 window frames" }, reason: "Recorded by the release walk." });
    await T.waitForURL((u) => u.pathname.startsWith("/app/project/"), { timeout: 15000 });
    const url = T.url();
    await go(F, at("/app/members"));
    await openRow(F, "teo");
    await act(F, "memberset", { which: '[data-member="teo"][data-status="revoked"]', password: who.founder.password, reason: "He moved out." });
    return url;
  });
  /* the team's places: no profile chosen (Elsewhere then lists nothing); put back after */
  const noPlaces = once(async () => {
    await go(F, at("/app/places"));
    const ticked = [];
    for (const box of await F.locator("#cs-main input[data-profile]").all()) if (await box.isChecked()) { ticked.push(await box.getAttribute("id")); await box.uncheck(); }
    if (ticked.length) await act(F, "profilesset", { password: who.founder.password, reason: "The walk asks for a place none covers." });
    return ticked;
  });
  const restorePlaces = async () => {
    const ticked = await noPlaces();
    await go(F, at("/app/places"));
    for (const id of ticked) await F.locator(`[id="${id}"]`).check();
    if (ticked.length) await act(F, "profilesset", { password: who.founder.password, reason: "The walk puts the team's place back." });
  };
  /* uploads, each into a question from its "Add a document": the founder's crafted archive; one of Mai's own */
  const upload = (page, password, q, name, bytes, what) => async () => {
    await go(page, await q());
    await page.locator("#cs-main a").filter({ hasText: wordPattern("question.adddoc") }).first().click();
    await settle(page);
    await page.locator('#cs-main a[href^="/app/capture/file"]').first().click();
    await settle(page);
    const dir = join(walk.out, "upload");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), bytes);
    await page.locator("#ci-how-made").first().check();
    await type(page, "ci-where", "14 Lakeshore Row");
    await type(page, "ci-what", what);
    await page.locator("#ci-file").setInputFiles(join(dir, name));
    await act(page, "captureupload", { password });
    await requireWord(page, "screen.capture.file.done", { within: "#cs-main" });
    return sha256(bytes);
  };
  const ZIP = overlappingZip();
  const brokenZip = once(upload(F, who.founder.password, async () => question, "lakeshore-photos.zip", ZIP, "The photos the tenants sent, in one archive."));
  const MAI_NOTE = Buffer.from("Flat 4, 14 Lakeshore Row. The stairwell light has been out since 3 October 2026.\n");
  const maiUpload = once(async () => { await maiOwner(); return upload(M, who.member.password, async () => question, "flat-4-stairwell.txt", MAI_NOTE, "My note on the stairwell light.")(); });

  /* the welcome on a first Home: offered to continue, or running (screens-wizards' guide) */
  const WELCOME = '[data-guide="start"], [data-guide-state="running"]';

  /* ---- the states ---- */
  const R = {};
  R["document:held"] = { reach: state({ sel: ['#cs-main [data-held="1"]'], words: ["document.held.says"] }, async (p) => {
    await go(p, at("/app/held"));
    const row = p.locator("#cs-main tr").filter({ has: p.locator('a[href^="/app/document/"]') }).first();
    await row.locator('a[href^="/app/document/"]').first().click();
  }) };
  R["project:standing down"] = { reach: state({ sel: ['#state-e[data-state-e="votes"]'] }, async (p) => {
    await maiOwner(); await go(p, project);
    await act(p, "projectownerremove", { which: `[data-handle="${who.founder.handle}"][data-mode="open"]` });
  }) };
  R["project:preparing"] = { reach: state({ sel: ["#project-notice-wording"] }, async (p) => {
    await go(p, project);
    await act(p, "noticeprepare", { which: '[data-mode="open"]' });
  }) };
  R["project:isn't in this project"] = { page: asMai, reach: state({ words: ["screen.project.notjoined"] }, async (p) => { await ownFindable(); await go(p, ctx.own.project); }) };
  R["project:every owner is gone"] = { rank: 3, expect: [/^PROJECT_SEEN_NOT_A_PARTICIPANT$/], reach: state({ sel: ["#state-rescue", '[data-act="projectownerrescue"]'] }, async (p) => go(p, await orphaned())) };
  R["question:deferred"] = { reach: state({ sel: ['[data-aside="deferred"]'] }, async (p) => {
    await go(p, await deferQ());
    await reveal(p.locator("#question-aside-0"));
    await p.locator("#question-aside-0").check();
    await act(p, "proposedispose", { fields: { "question-aside-why": "The inspection is not due until spring." }, which: '[data-which="1"]' });
  }) };
  R["question:dismissed"] = { reach: state({ sel: ['[data-aside="dismissed"]'] }, async (p) => {
    await go(p, await dismissQ());
    await reveal(p.locator("#question-aside-1"));
    await p.locator("#question-aside-1").check();
    await act(p, "proposedispose", { fields: { "question-aside-why": "The insurer is not part of this project." }, which: '[data-which="1"]' });
  }) };
  R["question:each passage is asked"] = { reach: state({ sel: ["#state-b"] }, async (p) => {
    await go(p, await askQ());
  }) };
  R["question:own reading"] = { reach: state({ sel: ['[data-reading="member"]'], words: ["question.reading.by.member"] }, async (p) => go(p, ctx.own.question)) };
  R["review-copy:as a file"] = { reach: state({ sel: ["[data-recall]"] }, async (p) => {
    await go(p, question);
    if (await p.locator('#cs-main [data-act="casedraft"]').count()) { await act(p, "casedraft", { reason: "A copy for review." }); await settle(p); }
    await go(p, at(`/app/review-copy/${encodeURIComponent(projectId())}`));
    await act(p, "reviewexport");
  }) };
  R["plan:several plans"] = { reach: state({ words: ["screen.plan.list.title"], sel: ['#cs-main a[href^="/app/plan/"] >> nth=1'] }, async (p) => {
    /* one open plan for the project's own matter (a second is refused SUBJECT_IN_ACTIVE_PLAN), one from a question of it */
    await go(p, project);
    await act(p, "planopen", { fields: { "project-plan": "Get the roof repaired before winter" }, reason: "The tenants want the repair made." });
    await go(p, await askQ());
    await act(p, "planopen", { fields: { "question-plan": "Get a date for the repair" }, reason: "The tenants want a date." });
    await go(p, at(`/app/plan/${encodeURIComponent(projectId())}`));
  }) };
  R["plan:no plan"] = { reach: state({ words: ["screen.plan.none"] }, async (p) => go(p, at(`/app/plan/${encodeURIComponent(idOf(ctx.own.project))}`))) };
  R["action:no reply recorded"] = { reach: state({ words: ["action.noreply.title"] }, async (p) => go(p, await action())) };
  R["action:silence"] = { reach: state({ sel: ["#action-question"] }, async (p) => {
    await go(p, await action());
    await reveal(p.locator("#action-question"));
    await p.locator("#action-question").waitFor({ state: "visible", timeout: 10000 });
  }) };
  R["action:read and not act"] = { rank: 2, page: () => T, reach: state({ sel: ['#cs-main p.mk-note[role="note"]'] }, async (p) => { await teoReadOnly(); await go(p, await action()); }) };
  R["people:other things"] = { reach: state({ words: ["screen.people.other.note", "screen.people.other.heading"] }, async (p) => {
    await ordinance(); await office();
    await go(p, at("/app/people"));
    await p.locator("#people-show").selectOption("everything");
    await act(p, "search");
  }) };
  R["people:adding someone"] = { reach: state({ words: ["screen.people.add.head"] }, async (p) => {
    await go(p, at("/app/people"));
    await type(p, "people-add-name", "Dana Whitfield");
    await p.locator("#people-add-kind").selectOption("person");
    await type(p, "people-add-note", "Runs the contractor the landlord hired for the roof.");
    await p.locator("#people-add-name").scrollIntoViewIfNeeded();
  }) };
  R["person:ordinance"] = { reach: state({ words: ["screen.person.ties.none.ordinance"] }, async (p) => go(p, await ordinance())) };
  R["person:office"] = { reach: state({ words: ["screen.person.ties.none.office"] }, async (p) => go(p, await office())) };
  /* Home's first visits, each on the new member's own device; Teo's Home before he is in any project or a project is findable */
  R["home:on a new member's first visit \\(one who may start"] = { page: async () => (await lea()).page,
    reach: state({ sel: [WELCOME], none: ["screen.home.needsyou", "screen.home.since"] }, async () => leaHome()) };
  R["home:on a new member's first visit \\(one who may not"] = { page: async () => (await ned()).page,
    reach: state({ sel: [WELCOME], words: ["screen.home.join.heading"] }, async () => {
      await ownFindable();
      await go(F, project);
      await act(F, "projectinvite", { fields: { "project-invite": "ned-o" }, reason: "He lives in flat 7." });
      await nedHome();
    }) };
  R["home:for a member who"] = { rank: -1, page: () => T, reach: state({ words: ["screen.home.join.heading", "screen.home.join.none"] }, async (p) => go(p, at("/app"))) };
  R["members:as a member"] = { page: asMai, reach: state({ sel: ['table[data-list="members"]'], words: ["screen.members.member.note"] }, async (p) => go(p, at("/app/members"))) };
  R["members:an administrator's"] = { reach: state({ sel: ["#cs-main [data-removal]"] }, async (p) => { await removalOpen(); await go(p, at("/app/members")); }) };
  R["security:an"] = { reach: state({ sel: ['[data-risk="ordinary"]'], words: ["screen.security.ordinary.head"] }, async (p) => go(p, at("/app/security"))) };
  R["account:a newer"] = { note: "account, a newer version: the copy's /version answer was given by the walk's own route (no newer release is installed locally)",
    reach: state({ sel: [".mk-updband"] }, async (p) => {
      await go(p, at("/app/account"));
      await p.route((u) => new URL(u).pathname === "/version", (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "walk-newer" }));
      await p.clock.fastForward("05:01");
      await p.locator(".mk-updband").first().waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
    }),
    after: async (p) => { await p.unroute((u) => new URL(u).pathname === "/version").catch(() => {}); await p.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {}); } };
  R["account:making"] = { reach: state({ words: ["screen.account.key.make.heading"], sel: ['[data-act="signerregisterown"]'] }, async (p) => {
    await go(p, at("/app/account"));
    await p.locator('[data-act="signerregisterown"]').first().scrollIntoViewIfNeeded().catch(() => {});
  }) };
  R["recovery:new"] = { reach: state({ sel: ['[data-shown="codes"]'], words: ["screen.recovery.shown"] }, async (p) => {
    await go(p, at("/app/recovery"));
    await act(p, "recoverycodesissue", { password: who.founder.password });
    for (const c of await p.locator('[data-shown="codes"] pre, [data-shown="codes"] code').allInnerTexts().catch(() => [])) for (const x of c.split(/\s+/)) walk.keepSecret(x);
  }) };
  R["updates:nothing"] = { reach: state({ sel: ['#cs-main [data-state="none"]'], words: ["updates.none"] }, async (p) => go(p, at("/app/updates"))) };
  R["translations:a"] = { reach: state({ sel: ['[data-state="nolanguages"]'] }, async (p) => go(p, at("/app/translations"))) };
  R["projects:a new"] = { page: async () => (await lea()).page, reach: state({ words: ["projects.empty.note"] }, async (p) => { await leaHome(); await go(p, at("/app/projects")); }) };
  R["projects:for"] = { page: () => T, reach: state({ words: ["screen.projects.nocreate"] }, async (p) => go(p, at("/app/projects"))) };
  R["unavailable:something"] = { expect: [/^PROJECT_SEEN_NOT_A_PARTICIPANT$/, /^NOT_A_PARTICIPANT$/, /^NOT_VISIBLE$/],
    reach: state({ sel: ['#cs-main [data-unavailable="notyours"]'] }, async (p) => go(p, await maiHidden())) };
  const WHOAMI = (u) => /[?&]op=whoami(&|$)/.test(String(u));
  R["unavailable:your"] = { note: "unavailable, out of reach: the copy's whoami was answered 503 by the walk's own route", expect: [503, "ok: false"],
    reach: state({ sel: ['#cs-main [data-unavailable="unreachable"]'] }, async (p) => {
      await p.route(WHOAMI, (r) => r.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false}' }));
      await go(p, at("/app"));
    }),
    after: async (p) => { await p.unroute(WHOAMI).catch(() => {}); await go(p, at("/app")); } };
  /* the team's places last: what they cover is put back after Elsewhere */
  R["elsewhere:a place"] = { rank: 4, reach: state({ words: ["elsewhere.none.head"] }, async (p) => { await noPlaces(); await go(p, at("/app/elsewhere")); }), after: restorePlaces };
  /* the queue with nothing waiting, on Teo's page (his queue holds nothing) */
  R["queue:the queue"] = { rank: 1, page: () => T, reach: state({ words: ["screen.queue.uptodate"] }, async (p) => go(p, at("/app/queue"))) };
    R["queue:an invitation"] = { reach: state({ sel: ['#cs-main [data-act="projectjoin"]'] }, async (p) => { await maiInvites(); await go(p, at("/app/queue")); }) };
  R["queue:choosing"] = { reach: state({ sel: ['#cs-main .cs-hold [data-act="taskresolve"][data-multi="1"]'] }, async (p) => {
    await maiInvites();
    await go(p, at("/app/queue/choose"));
    await p.locator('#cs-main input.mk-pick[data-table="queue"]').first().check();
  }) };
  R["queue:what happened"] = { reach: state({ words: ["queue.multi.back"] }, async (p) => {
    await maiInvites();
    await go(p, at("/app/queue/choose"));
    await p.locator('#cs-main input.mk-pick[data-table="queue"]').first().check();
    await act(p, "taskresolve", { which: '[data-multi="1"]', reason: "Recorded by the release walk." });
  }) };
  R["queue:what you"] = { reach: state({ words: ["queue.answered.title", "queue.answered.heading"] }, async (p) => { await joinAnswered(); await go(p, at("/app/queue/answered")); }) };
  /* Find */
  R["finder:a search with"] = { reach: state({ sel: ['#cs-main .mk-note[data-state="empty"]'] }, async (p) => {
    await go(p, at("/app/finder"));
    await act(p, "search", { fields: { "finder-q": "quokka zeppelin" } });
  }) };
  R["finder:Find"] = { reach: state({ words: ["find.browse.says"] }, async (p) => go(p, at("/app/finder"))) };
  R["finder:citing"] = { reach: state({ sel: ["#finder-cite-q"] }, async (p) => {
    await go(p, at("/app/finder"));
    /* "Hold these together" holds documents: the rows Find marks as one (find.row.kind.document) */
    const kind = word("find.row.kind.document");
    const ids = await p.evaluate((kind) => [...document.querySelectorAll('#cs-main input.mk-pick[id^="finder-pick-"]')].filter((b) => {
      for (let e = b.parentElement; e && e.id !== "cs-main"; e = e.parentElement) if (e.querySelector("a")) return new RegExp(`(^|\\s)${kind}(\\s|$)`).test(e.innerText);
      return false;
    }).map((b) => b.id).slice(0, 2), kind);
    if (ids.length < 2) throw new Error(`Find lists ${ids.length} documents to hold together, not two`);
    for (const id of ids) { await p.locator(`[id="${id}"]`).check(); await settle(p); }
    await act(p, "select");
    await act(p, "cite", { which: ":not([data-cite])" });
  }) };
  R["finder:the whole record"] = { reach: state({ sel: ["#cs-main table.mk-table"] }, async (p) => {
    await go(p, at("/app/finder"));
    await p.locator("#finder-view").selectOption("table");
  }) };
  R["finder:a search answered"] = { reach: state({ words: ["screen.finder.route.fields", "screen.finder.route.passages", "screen.finder.subjects.heading"] }, async (p) => {
    await landlord();
    await go(p, at("/app/finder"));
    await act(p, "search", { fields: { "finder-q": "Lakeshore" } });
  }) };
  R["archive:an archive that could"] = { expect: [/^ARCHIVE_[A-Z_]+$/],
    reach: state({ words: ["screen.archive.refused.none"] }, async (p) => go(p, at(`/app/archive/${await brokenZip()}`))) };
  R["open-file:a high-risk"] = { reach: state({ sel: ['#cs-main .cs-risk[data-risk="high"]'], none: ["screen.open-file.high.yours"] }, async (p) => go(p, at(`/app/open-file/${await maiUpload()}`))) };
  R["open-file:a file you"] = { reach: state({ words: ["screen.open-file.high.yours"] }, async (p) => go(p, at(`/app/open-file/${sha256(Buffer.from(UPLOAD_TEXT))}`))) };
  R["counsel:defense"] = { reach: state({ words: ["screen.counsel.chal.heading"] }, async (p) => {
    await go(p, at(`/app/counsel/${encodeURIComponent(idOf(await action()))}`));
    await p.locator("#cp-purpose").selectOption("defence");
  }) };
  return R;
}
