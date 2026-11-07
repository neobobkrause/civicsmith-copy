/* journey-check R1: the steps of journey 28 (DEC-201 (9), DEC-206 (5); `mock-journeys.js`) and journey 3 (the library's
   "Welcome a new member"), and the sweep of the registry's screens. Each step drives the page as a person does: the
   screens' own fields and controls (`[data-act]`, interface-shell R13; the shell's confirmation and reason, R11; the
   wizard guide's own controls, `[data-guide]`), the installer's own page; no op is called by the walker. Journey 28's
   first two steps are civicsmith.org's (`site`), served by the local arm at its address (`walkSite`). */
import { StepFailed, settle } from "./walker.mjs";
import { drawnState, sweepScreens, addressOf, adminAsName, ADMIN_WORDS } from "./screens.mjs";
import { FAIL } from "./walker.mjs";
import { requireWord, wordPattern, byWord, drawsWord } from "./words.mjs";
import { localize } from "../setup-words/index.mjs";
import { pair, WIDTHS, viewportOf } from "./design.mjs";
import { join, relative } from "node:path";
import { WAIT_BOUND_MINUTES } from "../../../newgroup/src/steps/api.mjs";

const rand = (n) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString("base64url");
export const SLUG = "lakeshore-tenants";
export const GROUP_NAME = "Lakeshore Tenants";
export const FOUNDER_HANDLE = "rosa-l";

/* ---------- the page's controls ---------- */

const where = (page) => new URL(page.url()).pathname;

/* Opens each closed disclosure (`<details>`) that holds `locator`'s first element, outermost first, by clicking its
   summary as a person does. */
export async function reveal(locator) {
  const n = await locator.first().evaluate((e) => {
    let k = 0;
    for (let d = e.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) if (!d.open) k += 1;
    return k;
  }).catch(() => 0);
  for (let i = 0; i < n; i += 1) {
    const summary = await locator.first().evaluateHandle((e) => {
      const closed = [];
      for (let d = e.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) if (!d.open) closed.push(d);
      const outer = closed[closed.length - 1];
      return outer && outer.querySelector(":scope > summary");
    });
    const el = summary.asElement();
    if (!el) break;
    await el.click();
  }
}

/* The visible control of act `op` (in `within`, a selector, when given), opening the disclosure that holds it; throws,
   naming it, when the screen does not draw it. */
export async function control(page, op, { within = null, timeout = 10000, which = "" } = {}) {
  const scope = within ? page.locator(within) : page;
  const shown = scope.locator(`[data-act="${op}"]${which}:visible`).first();
  try { await shown.waitFor({ state: "visible", timeout: Math.min(timeout, 2000) }); return shown; } catch { /* closed, or not drawn */ }
  const any = scope.locator(`[data-act="${op}"]${which}`);
  if (await any.count()) await reveal(any);
  try { await shown.waitFor({ state: "visible", timeout }); }
  catch { throw new Error(`control ${op} is not on ${where(page)}`); }
  return shown;
}

/* Types `value` into the field with id `id`, as a person does, opening the disclosure that holds it. */
export async function type(page, id, value) {
  const f = page.locator(`[id="${id}"]`).first();
  if (await f.count()) await reveal(f);
  try { await f.waitFor({ state: "visible", timeout: 10000 }); }
  catch { throw new Error(`no field ${id} on ${where(page)}`); }
  await f.fill(value);
}

/* Presses act `op` after filling `fields` ({id: value}); then answers what the shell asks before it sends (interface-shell
   R11): its confirmation, or a reason (`reason`); and, when the shell asks her password again before an act that needs
   a fresh sign-in (`REAUTH_DUE`), gives `password`. Waits for the answer to arrive. `nth` picks among several controls
   of one act; `which` (a selector suffix, as `[data-version="…"]`) picks the control of one subject. */
export async function act(page, op, { fields = {}, within = null, reason = "Recorded by the release walk.", password = null, nth = 0, which = "" } = {}) {
  for (const [id, value] of Object.entries(fields)) await type(page, id, value);
  const c = await control(page, op, { within, which });
  await (nth ? (within ? page.locator(within) : page).locator(`[data-act="${op}"]${which}:visible`).nth(nth) : c).click();
  const ask = page.locator('[data-shell="confirm"]:visible, [data-shell="reason-send"]:visible, [data-shell="reauth"]:visible').first();
  for (let i = 0; i < 3; i += 1) {
    let h = null;
    try { h = await ask.elementHandle({ timeout: 1500 }); } catch { break; }
    const kind = await h.getAttribute("data-shell").catch(() => null);
    if (!kind) break;
    if (kind === "reason-send") await page.locator(".cs-reason textarea:visible").first().fill(reason);
    if (kind === "reauth") {
      if (!password) throw new Error(`act ${op} asks her password again, and the walk was given none`);
      await page.locator("#cs-reauth-pw").fill(password);
    }
    await h.click().catch(() => {});
    /* the shell takes its question away once answered; a next one is a new question */
    await h.waitForElementState("hidden", { timeout: 15000 }).catch(() => {});
    await settle(page);
  }
  await settle(page);
}

/* Opens `path` on the copy and requires screen `id` drawn. */
export async function open(walk, page, base, path, id) {
  await page.goto(new URL(path, base).href);
  await settle(page);
  if (id) await requireDrawn(walk, page, id);
}
export async function requireDrawn(walk, page, id) {
  const st = await drawnState(page, id);
  if (!st.drawn) { walk.fail(FAIL.NOT_DRAWN, `${id}: ${st.why}`); throw new Error(`screen ${id} not drawn (${st.why})`); }
}
/* Waits for `selector` to be shown; throws with `what` when it is not. */
async function shown(page, selector, what, timeout = 15000) {
  try { await page.locator(selector).first().waitFor({ state: "visible", timeout }); }
  catch { throw new Error(`${what} is not shown on ${where(page)}`); }
}
/* Ten recovery codes, shown once (screens-entry's `pre[data-codes]`, K3306). */
async function tenCodes(page) {
  await shown(page, "pre[data-codes]", "the ten recovery codes");
  const n = (await page.locator("pre[data-codes]").first().textContent()).trim().split(/\n/).filter(Boolean).length;
  if (n !== 10) throw new Error(`${n} recovery codes are shown, not ten`);
}

/* ---------- journey 28, the installer's half (local arm) ---------- */

/* Journey 28's first two steps (DEC-201 (9), DEC-206 (5)): civicsmith.org, what Civicsmith is; "Start a group", what a
   group needs; its "Create your group" opens the installer. Each control is found by its word (R14). */
export async function walkSite(walk, page, siteOrigin, installerOrigin) {
  await walk.step(page, "civicsmith.org: what Civicsmith is", async (p) => {
    await p.goto(siteOrigin + "/");
    await settle(p);
    await shownWord(p, "screen.site.start");
  });
  await walk.step(page, "civicsmith.org: start a team, and create it", async (p) => {
    await byWord(p, "screen.site.start").click();
    await p.waitForURL((u) => u.pathname === "/start", { timeout: 15000 });
    await settle(p);
    await byWord(p, "screen.site.create").click();
    await p.waitForURL((u) => u.origin === installerOrigin, { timeout: 15000 });
    await settle(p);
  });
}
async function shownWord(page, key) {
  try { await byWord(page, key).waitFor({ state: "visible", timeout: 10000 }); }
  catch { throw new Error(`no link or control "${key}" on ${page.url()}`); }
}

/* The installer's first page, to the short name typed: installer R85 asks first whether she already has a Cloudflare account and
   holds the short name's stage (`#stage-choose`, which holds `#slug`) back until it is answered; the walk's person has one (the
   fake account), so she answers yes (`[data-guide="yes"]`, the installer's own control). A walk that came from civicsmith.org is
   on the installer's first page already. */
export async function installerFirstPage(p, installerOrigin) {
  if (new URL(p.url()).origin !== installerOrigin) await p.goto(installerOrigin + "/");
  const yes = p.locator('#stage-guide [data-guide="yes"]');
  try { await yes.waitFor({ state: "visible", timeout: 10000 }); }
  catch { throw new Error(`the installer's first page does not ask whether she has a Cloudflare account (no [data-guide="yes"] on ${p.url()})`); }
  await yes.click();
  await p.locator("#slug").fill(SLUG);
  const profile = p.locator('input[name="profile"]').first();
  if (await profile.count()) await profile.check();
}

/* From the installer's first page to its last: the short name, Cloudflare's consent, the progress, the checks. Answers
   the copy's address and the one-time password (kept secret by the walk). A walk that came from civicsmith.org is on the
   installer's first page already. */
export async function walkInstaller(walk, page, installerOrigin) {
  let copy = null, boot = null;
  walk.mask.push("#out-boot", "#out-probe", '[href*="#invite="]', "[data-invite-link]", '[data-secret]');
  await walk.step(page, "install: the installer's first page", (p) => installerFirstPage(p, installerOrigin));
  await walk.step(page, "install: the short name, confirmed permanent", async (p) => {
    await p.locator("#go").click();
    await p.locator("#confirm-yes").click();
    await p.locator("#stage-before:not([hidden])").waitFor({ timeout: 10000 });
  });
  /* installer R86, R90, R91: the page's act begins "Check my account"; the install begins only from the check list's "Install
     now", once every line is ready, and Cloudflare asks its permission again for it */
  await walk.step(page, "install: before Cloudflare, what it will be asked to allow", async (p) => {
    await p.locator("#cloudflare").click();
    await p.waitForURL(/dash\.cloudflare\.com\/oauth2\/auth/, { timeout: 15000 });
  });
  await walk.step(page, "install: Cloudflare's permission for the check, allowed", async (p) => {
    await p.locator("#allow").click({ noWaitAfter: true });
    await p.waitForURL(/\/callback\?/, { timeout: 60000 });
  });
  await walk.step(page, "install: the account checked, every line ready", async (p) => {
    const whole = p.locator("#check-whole");
    await whole.waitFor({ timeout: 60000 });
    const state = await whole.getAttribute("data-state");
    if (state !== "ready") throw new Error(`the check of the account is ${state}, not ready: `
      + (await p.locator('#check-lines [data-state]:not([data-state="ready"])').allTextContents()).join(" | "));
    await p.locator("#install-now:not([disabled])").click();
    await p.waitForURL(/dash\.cloudflare\.com\/oauth2\/auth/, { timeout: 15000 });
  });
  await walk.step(page, "install: Cloudflare's permission, allowed", async (p) => {
    /* the callback streams the install as it runs: the step ends when the page is the callback's, never waiting for it to load */
    await p.locator("#allow").click({ noWaitAfter: true });
    await p.waitForURL(/\/callback\?/, { timeout: 180000, waitUntil: "commit" });
  });
  await walk.step(page, "install: each step finishes, the checks pass", async (p) => {
    /* the install's verification may wait on Cloudflare up to the installer's own bound before it says what is not confirmed,
       so the walk waits that long and a minute more, and then names what the page says, never a bare timeout */
    await p.locator("#done:not([hidden]), #fail:not([hidden])").first().waitFor({ timeout: (WAIT_BOUND_MINUTES + 1) * 60000 });
    if (await p.locator("#fail:not([hidden])").count())
      throw new Error("the installer stopped: " + (await p.locator("#fail-h").textContent()) + " " + (await p.locator("#fail-p").textContent()));
    const stopped = await p.locator('#log [data-r="no"], #checks [data-r="no"]').allTextContents();
    if (stopped.length) throw new Error("a step did not finish: " + stopped.join(" | "));
    if (!(await p.locator("#done .okbox").count())) throw new Error("the final panel does not say the copy is running: "
      + (await p.locator("#done").textContent()).slice(0, 300));
    copy = (await p.locator("#out-url").textContent()).trim();
    boot = walk.keepSecret((await p.locator("#out-boot").textContent()).trim());
    walk.keepSecret((await p.locator("#out-probe").textContent()).trim());
  });
  return { copy, boot };
}

/* ---------- journey 28, inside the group's Civicsmith ---------- */

/* The founder: the hand-over, the claim with the one-time password filled in and her own handle (R9 step 1), the ten
   codes, the group's name, Home in a new group, and an invitation for the first member. She claims by her handle where
   the claim asks it (screens-entry R6), or, where the claim does not, chooses it on setup once claimed
   (`founderhandleset`, DEC-230); either way she then signs in by it. `founder.handle` null claims with none (R7's
   handleless founder, DEC-230), as a group claimed before T49 was. `whileHandleless(page)`, when given, is walked while
   she has no handle yet (R7's sweep with none, K3380), before she chooses one. Answers the invitation link and whether
   the claim itself took her handle. */
export async function walkFounder(walk, page, { base, founder, whileHandleless = null }) {
  await walk.step(page, "hand-over: to the team's address, finishing setup", async (p) => {
    await p.locator("#handover").click();
    await p.waitForURL((u) => u.origin === base && u.pathname === "/app/setup", { timeout: 20000 });
    await settle(p);
    await requireDrawn(walk, p, "setup");
    if (!(await p.locator("#su-otp").inputValue())) throw new Error("the one-time password is not filled in");
  });
  let byHandle = false;
  await walk.step(page, founder.handle ? "1 · setup: claim with her own handle; she is the team's first administrator"
    : "setup: claim; she is the team's first administrator", async (p) => {
    const fields = { "su-pw": founder.password, "su-pw2": founder.password };
    /* the claim's form drawn first: whether it asks a handle is read from the form, never before it is there */
    try { await p.locator("#su-pw").waitFor({ state: "attached", timeout: 15000 }); } catch { throw new Error("the claim's form is not drawn"); }
    if (await p.locator("#su-handle").count()) {
      /* the claim requires a handle (screens-entry R17): hers, or, for a walk with none chosen, the walk's own */
      if (!founder.handle) founder.handle = FOUNDER_HANDLE;
      fields["su-handle"] = founder.handle; byHandle = true;
    }
    await act(p, "claim", { fields });
    await shown(p, '[data-state="claimed"]', "the claim");
  });
  /* a claim that answers no session: she signs in by her handle on her own device (screens-entry R6, R17) */
  if (byHandle && !(await page.locator("pre[data-codes]").count()) && await page.locator('[data-state="claimed"] ~ * a[href="/app/front"], a[href="/app/front"]').count())
    await signInBy(walk, page, base, founder, "1 · sign in by her handle");
  await walk.step(page, "setup: her ten recovery codes, shown once", async (p) => {
    if (where(p) !== "/app/setup") await open(walk, p, base, "/app/setup", "setup");
    await tenCodes(p);
  });
  if (!byHandle && whileHandleless) await whileHandleless(page);
  if (founder.handle && !byHandle) {
    /* a handle not chosen fails the walk, and she goes on as she is signed in, so the rest is still walked */
    let chosen = true;
    await walk.step(page, "1 · setup: she chooses her own handle", async (p) => {
      await open(walk, p, base, "/app/setup", "setup");
      await act(p, "founderhandleset", { fields: { "su-fh": founder.handle }, password: founder.password });
      await requireWord(p, "founder.handle.done", { vars: { handle: founder.handle }, within: "#cs-main" });
    }).catch((e) => { if (!(e instanceof StepFailed)) throw e; chosen = false; });
    if (!chosen) founder.handle = null;
  }
  if (founder.handle && !byHandle) {
    await walk.step(page, "1 · sign out, to sign in by her handle", async (p) => {
      await open(walk, p, base, "/app/account", "account");
      await act(p, "signout");
      await shown(p, '[data-state="signedout"]', "the signed-out state");
    });
    await signInBy(walk, page, base, founder, "1 · sign in by her handle");
  }
  await walk.step(page, "setup: the team's name", async (p) => {
    if (where(p) !== "/app/setup") await open(walk, p, base, "/app/setup", "setup");
    await act(p, "groupnameset", { fields: { "su-name": GROUP_NAME } });
    await p.locator("a[href='/app'][data-nav]").last().click();
    await settle(p);
  });
  await walk.step(page, "home: a new team's home, inviting members and saying who it is", async (p) => {
    await requireDrawn(walk, p, "home");
    await shown(p, "a[href='/app/members']", "the invitation to invite members");
  });
  /* journey 29's Security step (DEC-245): looked at once, and it says nothing is unusual */
  await walk.step(page, "security: a first look at Security", async (p) => {
    await open(walk, p, base, "/app/security", "security");
    await requireWord(p, "screen.security.level.ordinary", { within: "#cs-main" });
  });
  const invite = await inviteMember(walk, page, base, { id: "mai", cover: "Mai, from flat 4", startProjects: true });
  return { invite, byHandle };
}

/* Signs `who` in by her handle on the front screen; `whoami` must then answer that handle (R9 step 1). */
export async function signInBy(walk, page, base, who, label) {
  await walk.step(page, label, async (p) => {
    walk.whoami = null;
    await open(walk, p, base, "/", "front");
    await act(p, "login", { fields: { "fs-handle": who.handle, "fs-pw": who.password } });
    await p.waitForFunction(() => !document.querySelector("#fs-pw"), null, { timeout: 15000 });
    await settle(p);
    const handle = walk.whoami && (walk.whoami.handle ?? walk.whoami.session?.handle);
    if (handle !== undefined && handle !== null && handle !== who.handle) throw new Error(`signed in, the plane answers the handle ${handle}, not hers`);
  });
}

/* An administrator makes an invitation link for a new member, with the short id and the cover the group knows them by
   (`memberadd`), and `startProjects` ticks that she may start projects; the link is shown once. */
/* The choice that lets the invited member start projects, as `members` draws the invitation's capabilities (`cs.checks("mi-caps")`:
   one checkbox per capability, named `mi-caps`, valued by the capability, its id numbered by its place in the vocabulary). */
export const START_PROJECTS_BOX = 'input[name="mi-caps"][value="create_projects"]';

export async function inviteMember(walk, page, base, { id, cover, startProjects = false }) {
  let link = null;
  await walk.step(page, `members: an invitation link for ${id}`, async (p) => {
    await open(walk, p, base, "/app/members", "members");
    /* journey 28: she lets Mai start projects as well as contribute (DEC-286: a member may not by default), so Home offers her "What happened?" */
    if (startProjects) {
      const box = p.locator(START_PROJECTS_BOX);
      if (!(await box.count())) throw new Error(`the invitation form has no choice to let her start projects on ${where(p)}`);
      await reveal(box);
      await box.check();
    }
    await act(p, "memberadd", { fields: { "mi-id": id, "mi-cover": cover } });
    await shown(p, '[data-shown="invite"] code', "the invitation link");
    link = walk.keepSecret((await p.locator('[data-shown="invite"] code').first().textContent()).trim());
    if (!link.includes("#invite=")) throw new Error("the invitation shown is not a link into the group's address");
  });
  return link;
}

/* The new member (journey 28's second half): joining, her codes, the welcome, her first settings, a first piece of
   work, signing out, signing in kept on her own device, the lock and unlock. */
export async function walkMember(walk, page, { base, invite, member, phone }) {
  await walk.step(page, "join: the invitation link opens the join screen", async (p) => {
    await p.goto(invite);
    await p.waitForURL((u) => u.pathname === "/app/join", { timeout: 15000 });
    await settle(p);
    await requireDrawn(walk, p, "join");
  });
  await walk.step(page, "join: a handle, free, and a password; joined and signed in", async (p) => {
    await act(p, "handlecheck", { fields: { "jn-handle": member.handle } });
    await shown(p, '[data-due="met"]', `that ${member.handle} is free`);
    await act(p, "enroll", { fields: { "jn-pw": member.password, "jn-pw2": member.password } });
    await shown(p, '[data-state="joined"]', "that she joined");
  });
  await walk.step(page, "join: her ten recovery codes, shown once", async (p) => {
    await tenCodes(p);
    await p.locator("a[href='/app'][data-nav]").last().click();
    await settle(p);
  });
  await walk.step(page, "home: the guided welcome she began when she joined, continued", async (p) => {
    await requireDrawn(walk, p, "home");
    await shown(p, '[data-guide="start"], [data-guide-state="running"]', "the welcome to continue");
  });
  await walk.step(page, "account: her first settings, her expertise declared", async (p) => {
    await open(walk, p, base, "/app/account", "account");
    await act(p, "expertisedeclare", { fields: { "ma-exp": "Interpreting, Spanish and English" } });
    await shown(p, "text=Interpreting, Spanish and English", "the expertise declared");
  });
  await walk.step(page, "home: what happened? a problem I live with", async (p) => {
    await open(walk, p, base, "/app", "home");
    /* the door for "A problem I live with", opened as a person opens it (a door is a closed card, screens-daily R9); its
       first offered script starts in the wizard runner */
    const door = '[data-door]:has-text("problem")';
    if (!(await p.locator(door).count())) throw new Error(`no door for a problem she lives with on ${where(p)}`);
    const card = p.locator(door).first();
    if ((await card.evaluate((e) => e.tagName)) === "DETAILS" && !(await card.evaluate((e) => e.open))) await card.locator("summary").first().click();
    await (await control(p, "startfrom", { within: door })).click();
    await settle(p);
  });
  await walk.step(page, "capture: her first testimony, labelled as hers", async (p) => {
    await open(walk, p, base, "/app/capture/saw", "capture");
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    await act(p, "testify", { fields: { "ci-words": "Water has come through the ceiling of flat 4 since Monday; reported twice.",
      "ci-where": "Flat 4, second floor", "ci-when": yesterday } });
    await shown(p, '[data-tab="saw"] [role="status"]', "the testimony recorded");
  });
  /* R16 (DEC-251 (1)): Sign out is in the shell's menu, by its word (`shell.menu.signout`) */
  await walk.step(page, "shell menu: sign out on this device", async (p) => {
    await open(walk, p, base, "/app/account", "account");
    await p.locator('[data-shell="menu"]:visible').first().click();
    await requireWord(p, "shell.menu.signout", { within: "#cs-menu" });
    await p.locator('#cs-menu [data-shell="signout"]').click();
    await shown(p, '[data-state="signedout"], [data-overlay="signedout"]', "the signed-out state");
  });
  /* Next morning, on her own phone (another device): the group's address, signed in and kept signed in there. */
  await walk.step(phone, "front: on her phone, sign in, kept signed in", async (p) => {
    await open(walk, p, base, "/", "front");
    await act(p, "login", { fields: { "fs-handle": member.handle, "fs-pw": member.password } });
    await p.waitForFunction(() => !document.querySelector("#fs-pw"), null, { timeout: 15000 });
    await settle(p);
    await requireDrawn(walk, p, "home");
  });
  await walk.step(phone, "lock: idle half an hour on her own device", async (p) => {
    await p.clock.fastForward("31:00");
    await shown(p, '[data-overlay="lock"], [data-state="locked"]', "the lock");
  });
  await walk.step(phone, "unlock: her password again, back where she was", async (p) => {
    const overlay = await p.locator('[data-overlay="lock"]').count();
    if (overlay) { await type(p, "cs-lock-pw", member.password); await p.locator('[data-shell="unlock"]').click(); }
    else await act(p, "unlock", { fields: { "fl-lock": member.password } });
    try { await p.waitForFunction(() => !document.querySelector('[data-overlay="lock"], [data-state="locked"]'), null, { timeout: 10000 }); }
    catch { throw new Error("still locked after her password"); }
    await settle(p);
    await requireDrawn(walk, p, "home");
  });
}

/* ---------- journey 3: a member joins and finds their footing (the welcome wizard) ---------- */

export async function walkWelcome(walk, page, { base, link, member }) {
  walk.journey = "journey 3";
  await walk.step(page, "welcome 1–2: join, the language and a handle and a password", async (p) => {
    await p.goto(link);
    await p.waitForURL((u) => u.pathname === "/app/join", { timeout: 15000 });
    await settle(p);
    await requireDrawn(walk, p, "join");
    if (await p.locator("#jn-lang").count()) await p.locator("#jn-lang").selectOption({ index: 0 });
    await act(p, "enroll", { fields: { "jn-handle": member.handle, "jn-pw": member.password, "jn-pw2": member.password } });
    await shown(p, '[data-state="joined"]', "that he joined");
    await p.locator("a[href='/app'][data-nav]").last().click();
    await settle(p);
  });
  await walk.step(page, "welcome 3: this is your team's home", async (p) => {
    await requireDrawn(walk, p, "home");
    if (!(await p.locator('[data-guide-state="running"]').count())) await p.locator('[data-guide="start"]').first().click();
    await shown(p, '[data-guide-state="running"]', "the welcome running");
  });
  for (const [n, id, label] of [[4, "question", "a question's strength, and Undetermined"],
    [5, "connect", "optional: connect your own Claude account, skipped"], [6, "ties", "optional: your own ties, skipped"],
    [7, "home", "a first step"]]) {
    await walk.step(page, `welcome ${n}: ${label}`, async (p) => {
      await p.locator('[data-guide="next"]').first().click();
      await settle(p);
      /* a side trip the step offers is a choice: skipped (Stop), it returns to the welcome at the same step */
      try { await p.locator("[data-guide-trip]").first().waitFor({ state: "visible", timeout: 3000 }); } catch { /* no trip */ }
      if (await p.locator("[data-guide-trip]").count()) { await p.locator('[data-guide="stop"]').first().click(); await settle(p); }
      const at = new RegExp(`step ${n} of 7`, "i");
      try { await p.locator(".cs-wizard .step").filter({ hasText: at }).first().waitFor({ state: "visible", timeout: 8000 }); }
      catch { throw new Error(`the welcome is not at step ${n} of 7: ${(await p.locator(".cs-wizard .step").first().textContent().catch(() => "none")) || "none"}`); }
    });
  }
  await walk.step(page, "welcome: finished", async (p) => {
    await p.locator('[data-guide="next"]').first().click();
    await settle(p);
    if (await p.locator('[data-guide-state="running"]').count()) throw new Error("the welcome did not finish");
  });
}

/* ---------- the sweep: every registry screen, drawn ---------- */

/* A screen opened at its bare address has no subject: the answers interface-shell R35 draws as "Nothing is here" or
   "You can't open this" are its designed absence, expected; any other refusal fails the sweep. */
export const ABSENCE = /^(?:NOT_FOUND|NO_SUCH_[A-Z_]+|[A-Z_]+_NOT_FOUND|NOT_VISIBLE|NOT_A_PARTICIPANT)$/;

/* `each(page, screen, drawn)`, when given, is done on each screen within its step, once it is opened and judged. */
export async function sweep(walk, page, base, { screens = sweepScreens(), journey = "screens", each = null } = {}) {
  walk.journey = journey;
  for (const s of screens) {
    await walk.step(page, `screen ${s.id}`, async (p) => {
      await p.goto(new URL(addressOf(s.id), base).href);
      await settle(p);
      const st = await drawnState(p, s.id);
      if (!st.drawn) walk.fail(FAIL.NOT_DRAWN, `${s.id}: ${st.why}`);
      if (each) await each(p, s, st.drawn);
    }, { expect: [ABSENCE] }).catch((e) => { if (!(e instanceof StepFailed)) throw e; });
  }
}

/* The acts the page draws, by op (interface-shell R13's `data-act`; an act a member may not do is absent from the page). */
export const drawnActs = (page) => page.evaluate(() => [...new Set([...document.querySelectorAll("[data-act]")].map((e) => e.getAttribute("data-act")))].sort());

export const credentials = () => ({
  founder: { handle: FOUNDER_HANDLE, password: "founder-" + rand(12) },
  member: { handle: "mai-k", password: "member-" + rand(12) },
  newcomer: { handle: "teo-r", password: "newcomer-" + rand(12) },
});

/* R7: the sweep as the founder, her handle held or with none: no screen draws `admin` as a person's name or handle. With
   no handle, DEC-230's own words are excepted (they say she signs in as admin until she chooses); with one, nothing is. */
export function sweepAsFounder(walk, page, base, { handle, screens = undefined }) {
  const except = handle ? [] : ADMIN_WORDS.map((k) => wordPattern(k));
  return sweep(walk, page, base, { ...(screens ? { screens } : {}), journey: handle ? "R7 as the founder, her handle held" : "R7 as the founder, with no handle",
    each: async (p, s, drawn) => {
      if (!drawn) return;
      const at = adminAsName(await p.locator("body").innerText(), { except });
      if (at.length) walk.fail(FAIL.ADMIN_NAME, localize("journey-check.journeys.id_draws_admin_as_a", "{id} draws admin as a name: {map}", { id: String(s.id), map: String(at.map((a) => `…${a.at}…`).join(" | ")) }));
    } });
}

/* ---------- R22, R25: the dashboards, and the signing page gone ---------- */

/* R22 (K3815, K4146; screens-inquiry R79, screens-action R30, screens-daily R17): `dash-project` and `dash-action` opened as
   working screens, drawn, neither drawing "Nothing is here" (interface-shell R61) nor the failed state. Home's
   Investigation block opens `dash-project`. Home's Action block opens `dash-action` when Home draws that block; when the team holds no action Home
   draws no Action block (DEC-219 (3): no empty block), which is asserted and noted, and `dash-action` is then opened by its address. */
export const DASHBOARDS = Object.freeze(["dash-project", "dash-action"]);
export const ACTION_BLOCK_NOT_DRAWN = localize("journey-check.journeys.action_block_not_drawn_the_team_holds", "Action block: not drawn, the team holds no action");
export async function walkDashboards(walk, page, base, { mock = null, b = null, out = null } = {}) {
  for (const id of DASHBOARDS) {
    await walk.step(page, localize("journey-check.journeys.dashboard_id_opened_from_the_door", "dashboard {id}: opened from the door on Home", { id: String(id) }), async (p) => {
      await open(walk, p, base, "/app", "home");
      const door = p.locator(`#cs-main a[href^="/app/${id}"]`).first();
      let byAddress = false;
      /* Home's areas are drawn together: once the Investigation block is there, an Action block that is not has been left out */
      if (id === "dash-action") await p.locator('#cs-main a[href^="/app/dash-project"], #cs-main a[href="/app/projects"]').first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
      try { await door.waitFor({ state: "visible", timeout: id === "dash-action" ? 1500 : 8000 }); } catch {
        if (id !== "dash-action") throw new Error(`Home draws no door to ${id}`);
        /* DEC-219 (3): no Action block for a team with no action; a block drawn without its door is a fault */
        if (await p.locator('#cs-main [data-area="action"]').count()) throw new Error(`Home draws the Action block without a door to ${id}`);
        walk.notes.push(ACTION_BLOCK_NOT_DRAWN);
        byAddress = true;
      }
      if (byAddress) await open(walk, p, base, `/app/${id}`, id);
      else { await door.click(); await settle(p); }
      await requireDrawn(walk, p, id);
      const main = (await p.locator("#cs-main").innerText()).replace(/\s+/g, " ");
      if (drawsWord(main, "shell.unavailable.nothing.title")) throw new Error(`${id} draws "Nothing is here"`);
      if (await p.locator('#cs-main [data-state="failed"]').count()) throw new Error(`${id} draws the failed state`);
      /* R6 (R22: both arms pair it): where the arm gives the design mock (the local arm; the live arm's sweep pairs every working screen), the
         dashboard beside the design's drawing of it at both widths */
      if (mock) await pairDashboard(walk, p, id, { mock, b, out });
    });
  }
}
async function pairDashboard(walk, p, id, { mock, b, out }) {
  try {
    for (const width of WIDTHS) {
      await p.setViewportSize(viewportOf(width));
      await p.reload(); await settle(p);
      const design = await mock.draw(id, width);
      if (!design) { walk.fail(FAIL.DESIGN, localize("journey-check.journeys.id_the_design_mock_at", "{id}: the design mock at {commit} draws no such screen", { id: String(id), commit: String(mock.commit) })); continue; }
      walk.pairs.push(relative(out, await pair(b, await p.screenshot(), design, join(out, "pairs", `dashboard-${id}-${width}.png`), { title: `${id}, ${width}px` })));
    }
  } finally { await p.setViewportSize(viewportOf(WIDTHS[0])); }
}

/* R25 (K3807, K3835; control-plane R109): `/sign` is requested once on the copy, expecting 404, and answers the interface's
   "nothing is here" page, holding no signing page. */
export async function walkSignGone(walk, page, base) {
  await walk.step(page, "sign: /sign answers the nothing-is-here page", async (p) => {
    const res = await p.goto(new URL("/sign", base).href);
    await settle(p);
    if (!res || res.status() !== 404) throw new Error(`/sign answered ${res ? res.status() : "nothing"}, not 404`);
    const main = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    if (!drawsWord(main, "shell.unavailable.nothing.title")) throw new Error("/sign does not answer the interface's nothing-is-here page");
    if (await p.locator("#cs-main :is(form, input, textarea, select, [type=file])").count()) throw new Error("/sign holds a signing page");
  }, { expect: [404] });
}
