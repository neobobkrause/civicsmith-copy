/* journey-check R1: the two arms. `runLocal` walks journey 28 from the installer through the hand-over into the copy and
   on, then journey 3, then sweeps the registry's screens; `runLive` signs in to a named test instance as its
   administrator and as a member, each verified by `whoami`, and sweeps every working screen beside the design mock.
   Each answers the walk (its steps, its failures, its report); R3's guard runs before anything is written. */
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { planeScheduleProblem } from "./account.mjs";
import { Walk, StepFailed, FAIL, settle } from "./walker.mjs";
import { drawnState } from "./screens.mjs";
import { requireTestInstance, WalkRefused } from "./guard.mjs";
import { ABSENCE, walkInstaller, walkFounder, inviteMember, walkMember, walkWelcome, sweep, credentials, open, act, requireDrawn, drawnActs,
  signInBy, sweepAsFounder, walkSite, walkDashboards, walkSignGone } from "./journeys.mjs";
import { walkAdministrator, walkMemberJourney, walkUnassisted, journey29Live, notReady, STEP_NAMES } from "./investigation.mjs";
import { sweepScreens, addressOf, registryScreens } from "./screens.mjs";
import { dec340Limits, publicPages } from "./checks.mjs";
import { escapedOnPage, pseudoRoute } from "./pseudo.mjs";
import { walkPublished, PUBLISHED_ENV } from "./published.mjs";
import { walkStates } from "./states.mjs";
import { PLAN_TITLE, PROJECT_TITLE, QUESTION, OWN_PROJECT, OWN_QUESTION, OWN_READING, UPLOAD_NAME, UPLOAD_TEXT } from "./investigation.mjs";
import { GROUP_NAME, SLUG } from "./journeys.mjs";
import { NOTICE_PASSAGE, HEAT_PASSAGE } from "./city.mjs";
import { designMock, pageLimits, pair, WIDTHS, viewportOf, journeyPairs, JOURNEY_29, stepName } from "./design.mjs";
import { localize } from "../setup-words/index.mjs";

export const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");

/* F6 (R5): the acts that are a named person's own act on her own roster row, as the plane declares them: op-declarations'
   `ROSTER_SELF_ACTIONS` (membership R10, R11, R19), read from its file as data (journey-check imports no module). Whether one is
   drawn follows who the viewer is, not what she may administer: `account`'s "Save my choice" (`memberpairingset`) is drawn only
   to a member the pairings hold, and the founder holds no cover (screens-settings R67). */
export const DECLARATIONS_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "op-declarations", "index.mjs");
export function selfActs(file = DECLARATIONS_FILE) {
  const m = /const ROSTER_SELF_ACTIONS = listed\(\[([^\]]*)\]\)/.exec(readFileSync(file, "utf8"));
  if (!m) throw new Error(`no ROSTER_SELF_ACTIONS in ${file}`);
  return Object.freeze([...m[1].matchAll(/"([a-z0-9]+)"/g)].map((x) => x[1]));
}

/* F5: the test page the live arm captures by address, from `JOURNEY_CITY_ORIGIN` (the walk setup hands it over): only a
   development Worker's own workers.dev address, `https://<slug>-testpage.<subdomain>.workers.dev` (`p3dev-t1-testpage`), never an outside site.
   Answers `{city}` (null with none given, and the capture is then noted as not walked) or `{problem}`. */
export const CITY_ENV = "JOURNEY_CITY_ORIGIN";
export function liveCity(env = process.env) {
  const v = env[CITY_ENV];
  if (!v) return { city: null };
  let u = null;
  try { u = new URL(v); } catch { /* said below */ }
  if (!u || u.protocol !== "https:" || u.pathname !== "/" || u.search || !/^p3dev-[a-z0-9-]+-testpage\.[a-z0-9-]+\.workers\.dev$/.test(u.hostname))
    return { problem: `${CITY_ENV} is not a p3dev- test page's own workers.dev address; the walk captures by address only from a page we control` };
  return { city: u.origin };
}

/* R5: the roles compared, screen by screen (`acts.administrator`, `acts.member`: screen id to the acts drawn). The administrator
   must be drawn every act the member is, except a person's own act (`own`, F6), and somewhere an act the member is not.
   Answers each failure's detail. */
export function roleProblems(acts, { own = selfActs() } = {}) {
  const out = [];
  if (!acts.administrator.size || !acts.member.size) return out;
  for (const [id, mine] of acts.member) {
    const theirs = acts.administrator.get(id) || [];
    for (const op of mine) if (!theirs.includes(op) && !own.includes(op)) out.push(localize("journey-check.run.id_the_member_is_drawn", "{id}: the member is drawn {op}, the administrator is not", { id: String(id), op: String(op) }));
  }
  let only = 0;
  for (const [id, theirs] of acts.administrator) only += theirs.filter((op) => !(acts.member.get(id) || []).includes(op)).length;
  if (!only) out.push("no screen draws the administrator an act it does not draw the member: the administrator's walk did not administer");
  return out;
}

/* R5: a Chromium that reaches every address directly, through no proxy the environment names. The headless shell
   ignores `--no-proxy-server` alone and follows an environment proxy; `--proxy-server=direct://`, last, holds in both. */
export const DIRECT_ARGS = Object.freeze(["--no-proxy-server", "--proxy-server=direct://"]);

/* R1: the Chromium the walk launches. `CHROMIUM` names one; else the build `playwright-core` pins; where that build is not on
   disk (a container whose browsers are another version), the Chromium the environment installs at `FALLBACK_CHROMIUM`, when
   it exists; else none, and the launch fails as the pinned build's absence says. */
export const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium";
export function chromiumPath({ env = process.env, pinned, exists = existsSync, fallback = FALLBACK_CHROMIUM } = {}) {
  if (env.CHROMIUM) return env.CHROMIUM;
  if (pinned && exists(pinned)) return undefined;
  return exists(fallback) ? fallback : undefined;
}

export async function browser({ direct = false, args = [] } = {}) {
  let chromium;
  try { ({ chromium } = await import("playwright-core")); }
  catch (e) { throw new Error(`playwright-core cannot be loaded (run \`npm ci\` in ${dirname(fileURLToPath(import.meta.url))}): ${e.message}`); }
  const executablePath = chromiumPath({ pinned: chromium.executablePath() });
  return chromium.launch({ ...(executablePath ? { executablePath } : {}), args: [...args, ...(direct ? DIRECT_ARGS : [])] });
}

/* R5: a fetch that reaches the instance directly. Node's own fetch follows the environment's proxy (NODE_USE_ENV_PROXY);
   a request on an agent of its own does not. */
export async function directFetch(req) {
  const u = new URL(req.url);
  const lib = u.protocol === "https:" ? https : http;
  const body = ["GET", "HEAD"].includes(req.method) ? null : Buffer.from(await req.arrayBuffer());
  return new Promise((done, failed) => {
    const q = lib.request(u, { method: req.method, headers: Object.fromEntries(req.headers), agent: new lib.Agent() }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => done(new Response(res.statusCode === 204 ? null : Buffer.concat(chunks),
        { status: res.statusCode, headers: Object.entries(res.headers).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, String(v)]])) })));
      res.on("error", failed);
    });
    q.on("error", failed);
    q.end(body);
  });
}

/* What an arm's error says in its walk: a refusal, or a step that stopped (a StepFailed has said so already). */
function failed(walk, e) {
  if (e instanceof WalkRefused) walk.fail(FAIL.REFUSAL, e.message);
  else if (!(e instanceof StepFailed)) walk.fail(FAIL.STEP, e.stack || e.message);
}

/* A browser context (one person's device) whose pages the walk watches. `route(context)` sends its requests where the
   arm says; the clock is installed so the lock can be reached without waiting (interface-shell R33). */
async function device(walk, b, route, viewport = { width: 1280, height: 900 }) {
  const context = await b.newContext({ viewport });
  await route(context);
  const page = walk.watch(await context.newPage());
  await page.clock.install();
  return { context, page };
}

/* The local arm (R1 (a), R9–R11), with no account. `world` starts the world, `launch` the browser; `model: false` binds
   the runner with no fake model (R11's control), `segments: false` agent-worker with no `SEGMENTS` binding (R15's
   control); `assistant` is R20's one switch: false (the default, K3717) reports every step that needs the assistant as not walked, with its not-ready state asserted; true walks R9 and R10 whole. `parts` names which walks follow journey 28 and R9 (all by default: `journey 3`, `R10`, `R16`, `sweep`, `R13`). Journey 28 (its founder claiming by her own handle, R9 step 1), journey
   3, then the journey to a first conclusion as administrator (R9) and as the member journey 28 joined (R10), then the
   sweep. Whatever stops the walk (a step, the guard's refusal, a world or a browser that cannot start), the browser and
   the world, with their servers and Miniflare instances, are closed before it answers. */
export const PARTS = Object.freeze(["journey 3", "R10", "R16", "sweep", "R13", "R27"]);
export async function runLocal({ out = join(OUT, "local"), world: makeWorld, launch = browser, model = true, segments = true, parts = PARTS, assistant = false } = {}) {
  const { localWorld, INSTALLER_ORIGIN, SITE_ORIGIN } = await import("./local.mjs");
  const walk = new Walk({ out, arm: "local", ownHosts: [new URL(INSTALLER_ORIGIN).host, "dash.cloudflare.com", new URL(SITE_ORIGIN).host] });
  const who = credentials();
  for (const p of [who.founder.password, who.member.password, who.newcomer.password]) walk.keepSecret(p);
  let world = null, b = null;
  /* the design mock, made once for the arm: R22's dashboards and R13's journey 29 are paired with its drawings */
  let mock = null;
  const mockOf = async () => (mock ||= await designMock(b, { dir: join(out, "design") }));
  try {
    world = await (makeWorld || localWorld)({ model, segments });
    /* R15: whether the world gave agent-worker its `SEGMENTS`, as the world says it (null: a world that does not say) */
    const bound = world.agentBindings ? world.agentBindings().includes("SEGMENTS") : null;
    b = await launch();
    const route = (ctx) => world.route(ctx, (u) => walk.foreign(u));
    walk.journey = "journey 28";
    const founder = await device(walk, b, route);
    await walkSite(walk, founder.page, SITE_ORIGIN, INSTALLER_ORIGIN);
    const { copy } = await walkInstaller(walk, founder.page, INSTALLER_ORIGIN);
    walk.copyHost = new URL(copy).host;
    /* G1 (fix round 6): the plane's script holds the watchdog cron its signed statement states, after the install; a world with no account says nothing */
    const noCron = world.account ? planeScheduleProblem(world.account, SLUG) : null;
    if (noCron) walk.fail(FAIL.STEP, `install: ${noCron}`);
    /* R3: before the hand-over writes anything, the copy must be a test instance. */
    await requireTestInstance(copy, (req) => world.fetchCopy(req));
    /* R7 (K3380): every screen swept as the founder while she has no handle, DEC-230's words excepted; where the claim
       took her handle there is no such founder here, which the report notes */
    const handleless = parts.includes("sweep") ? async (p) => {
      await sweepAsFounder(walk, p, copy, { handle: null });
      walk.journey = "journey 28";
    } : null;
    const { invite, byHandle } = await walkFounder(walk, founder.page, { base: copy, founder: who.founder, whileHandleless: handleless });
    if (byHandle && parts.includes("sweep")) walk.notes.push("R7 with no handle: not walkable here (the claim took a handle)");
    const mai = await device(walk, b, route);
    const phone = await device(walk, b, route, { width: 390, height: 844 });
    await walkMember(walk, mai.page, { base: copy, invite, member: who.member, phone: phone.page });
    if (parts.includes("journey 3")) {
      const teo = await device(walk, b, route);
      walk.journey = "journey 3";
      const second = await inviteMember(walk, founder.page, copy, { id: "teo", cover: "Teo, from flat 9" });
      await walkWelcome(walk, teo.page, { base: copy, link: second, member: who.newcomer });
    }
    /* each journey that stops has said why; the next is still walked, and the sweep after them */
    const going = (e) => { if (!(e instanceof StepFailed)) throw e; return null; };
    const made = {};
    await walkAdministrator(walk, founder.page, { base: copy, founder: who.founder, made, segments: bound, assistant }).catch(going);
    if (parts.includes("R10")) {
      walk.journey = "R10 as member";
      if (!assistant) await (async () => {
        await signInBy(walk, mai.page, copy, who.member, "she signs in on her own computer");
        await notReady(walk, mai.page, copy, { label: "assistant not ready: her connect screen", path: "/app/connect", screen: "connect", assistantSignin: true,
          names: [STEP_NAMES.memberConnect, STEP_NAMES.memberRun, STEP_NAMES.memberProjectai, STEP_NAMES.memberPlan, STEP_NAMES.memberAsk] });
      })().catch(going);
      else if (!made.project) walk.fail(FAIL.STEP, "the member's journey needs the administrator's project, and R9 stopped before it was made");
      else await (async () => {
        await signInBy(walk, mai.page, copy, who.member, "she signs in on her own computer");
        await walkMemberJourney(walk, mai.page, { base: copy, member: who.member, inviter: founder.page, project: made.project, segments: bound });
      })().catch(going);
    }
    /* R16: journey 29's search path, with no assistant, to a conclusion on her own reading */
    if (parts.includes("R16")) await walkUnassisted(walk, founder.page, { base: copy, founder: who.founder }).catch(going);
    /* R22, R25: the dashboards from Home's doors, and the old signing page gone */
    if (parts.includes("sweep")) {
      walk.journey = "R22 the dashboards";
      await walkDashboards(walk, founder.page, copy, { mock: await mockOf(), b, out }).catch(going);
      walk.journey = "R25 the old pages";
      await walkSignGone(walk, founder.page, copy).catch(going);
    }
    /* the sweep with her handle held (a founder who could not choose one was swept handleless above) */
    if (parts.includes("sweep") && who.founder.handle) await sweepAsFounder(walk, founder.page, copy, { handle: who.founder.handle });
    /* R27: every screen at both widths drawn with the pseudo rows, any sentence that escaped the list reported */
    if (parts.includes("R27")) {
      walk.journey = "R27 the pseudo-locale walk";
      const ps = await device(walk, b, async (ctx) => { await route(ctx); await pseudoRoute(ctx, { host: walk.copyHost, fetchCopy: (req) => world.fetchCopy(req) }); });
      /* jurisdiction profiles' display names are data, not sentences (B3) */
      const profiles = await Promise.all((await readdir(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "jurisdictions", "profiles")))
        .filter((f) => f.endsWith(".mjs")).map(async (f) => (await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "jurisdictions", "profiles", f)).href)).default?.name));
      const entered = [...profiles.filter(Boolean), PLAN_TITLE, QUESTION, OWN_PROJECT, OWN_QUESTION, OWN_READING, UPLOAD_NAME, UPLOAD_TEXT.trim(), GROUP_NAME, SLUG, NOTICE_PASSAGE, HEAT_PASSAGE,
        PROJECT_TITLE, "Roof repairs at 14 Lakeshore Row", "Mai, from flat 4", "Teo, from flat 9", "Interpreting, Spanish and English",
        "Water has come through the ceiling of flat 4 since Monday; reported twice.", "Flat 4, second floor", "Housing notice 2026-118: repair order, 14 Lakeshore Row",
        "Housing notice 2026-131: heating order, 14 Lakeshore Row", "When did the tenants first report the leak to the landlord?", "The city withdrawing or amending notice",
        "The city's notice orders", "City repair order", "Flat 4, 14 Lakeshore Row", "My note of when the water came through the ceiling.",
        "The copy is the notice the city published at that address", "Recorded by the release walk.", "This is what the tenants need answered.", "Tenants of 14 Lakeshore Row report water coming in."];
      await signInBy(walk, ps.page, copy, who.founder, "R27 · she signs in on a device that draws the pseudo rows").catch(going);
      for (const s of sweepScreens()) {
        const said = new Set();
        await walk.step(ps.page, `pseudo screen ${s.id}`, async (p) => {
          for (const width of WIDTHS) {
            await p.setViewportSize(viewportOf(width));
            await p.goto(new URL(addressOf(s.id), copy).href); await settle(p);
            for (const e of await escapedOnPage(p, { entered })) if (!said.has(e.text) && said.add(e.text)) walk.fail(FAIL.PSEUDO, localize("journey-check.run.id_at_width_px_element", "{id} at {width}px: {element}: \"{text}\" escaped the word list", { id: String(s.id), width: String(width), element: String(e.element), text: String(e.text) }));
          }
        }, { expect: [ABSENCE] }).catch(going);
      }
    }
    /* R13: design journey 29, step by step, each LIVE step beside the mock's drawing of it */
    if (parts.includes("R13")) {
      walk.journey = "R13 design journey 29";
      const design = await mockOf();
      for (const f of await walkStates(walk, b, design, { out, page: founder.page, base: copy })) walk.pairs.push(f);
      walk.journey = "R13 design journey 29";
      for (const f of await journeyPairs(walk, b, design, { out, notWalked: !assistant, liveOf: (st) => journey29Live(walk, st) })) walk.pairs.push(relative(out, f));
    }
  } catch (e) {
    failed(walk, e);
  } finally {
    if (world) for (const u of world.unansweredAll()) walk.fail(FAIL.ADDRESS, `unanswered: ${u}`);
    if (mock) await mock.close().catch(() => {});
    if (b) await b.close().catch(() => {});
    if (world) await world.close().catch((e) => walk.fail(FAIL.STEP, localize("journey-check.run.the_world_did_not_close", "the world did not close: {message}", { message: String(e.message) })));
  }
  return { walk, report: walk.report(), ok: walk.failures.length === 0 };
}

/* R12: the sign-in's code, typed by the person signing in at the terminal the walk runs in, as she reads it on
   Anthropic's page at `address`; what she types is not echoed, and the walk keeps it secret. With no terminal, or nothing
   typed, there is no code, and step 4 fails by name. */
export async function askCode(role, address) {
  if (!process.stdin.isTTY) return null;
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  process.stderr.write(localize("journey-check.run.as_the_role_open_replace", "\nAs the {role}: open {replace} (the link the connect screen shows), sign in to Claude, approve, then type the code Anthropic's page shows (it is not echoed) and press Enter:\n", { role: String(role), replace: String(address.replace(/\?.*$/, "")) }));
  rl._writeToOutput = () => {};
  const code = await new Promise((done) => rl.question("", done));
  rl.close();
  process.stderr.write("\n");
  return code.trim() || null;
}

/* R12: the administrator's journey (R9) and the member's (R10), each signed in by her own credentials on her own device,
   connecting her own subscription through the real sign-in. A journey that stops has said why. */
async function investigateLive(walk, b, base, { founder, member, codeOf, assistant = false, city = null }) {
  const devices = [];
  const device = async () => {
    const ctx = await b.newContext({ viewport: viewportOf(1280) });
    devices.push(ctx);
    await ctx.route("**/*", (r) => { const u = new URL(r.request().url());
      return u.host === walk.copyHost || u.protocol === "https:" && /(^|\.)(claude\.ai|claude\.com|anthropic\.com)$/.test(u.hostname) ? r.continue()
        : (walk.foreign(r.request().url()), r.abort("blockedbyclient")); });
    return walk.watch(await ctx.newPage());
  };
  const going = (e) => { if (!(e instanceof StepFailed)) throw e; return null; };
  try {
    const admin = await device();
    walk.journey = "R9 as administrator";
    const made = {};
    await (async () => {
      await signInBy(walk, admin, base, founder, "1 · sign in by her handle");
      return walkAdministrator(walk, admin, { base, founder, made, assistant, city, codeOf: (address) => codeOf("administrator", address) });
    })().catch(going);
    walk.journey = "R10 as member";
    if (!assistant) {
      const mine = await device();
      await (async () => {
        await signInBy(walk, mine, base, member, "she signs in by her handle");
        await notReady(walk, mine, base, { label: "assistant not ready: her connect screen", path: "/app/connect", screen: "connect", assistantSignin: true,
          names: [STEP_NAMES.memberConnect, STEP_NAMES.memberRun, STEP_NAMES.memberProjectai, STEP_NAMES.memberPlan, STEP_NAMES.memberAsk] });
      })().catch(going);
      return;
    }
    if (!made.project) { walk.fail(FAIL.STEP, "the member's journey needs the administrator's project, and R9 stopped before it was made"); return; }
    const mine = await device();
    await (async () => {
      await signInBy(walk, mine, base, member, "she signs in by her handle");
      await walkMemberJourney(walk, mine, { base, member, inviter: admin, project: made.project, codeOf: (address) => codeOf("member", address) });
    })().catch(going);
  } finally { for (const c of devices) await c.close().catch(() => {}); }
}

/* R28 (interface-shell R102): the nine named public pages, opened with no session at 1280 and 390 px, each drawn page's title the
   word of its screen and no weight mark in it; a page that needs a subject the instance does not name here draws its
   "Nothing is here" at its bare address and is noted, never passed. */
export async function publicPass(walk, b, base, { pages = publicPages(), registry = registryScreens() } = {}) {
  walk.journey = "R28 the public pages";
  const ctx = await b.newContext({ viewport: viewportOf(1280) });
  try {
    await ctx.route("**/*", (r) => (new URL(r.request().url()).host === walk.copyHost ? r.continue() : (walk.foreign(r.request().url()), r.abort("blockedbyclient"))));
    const page = walk.watch(await ctx.newPage());
    for (const id of pages) {
      await walk.step(page, `public page ${id}`, async (p) => {
        for (const width of WIDTHS) {
          await p.setViewportSize(viewportOf(width));
          await p.goto(new URL(addressOf(id), base).href); await settle(p);
          const st = await drawnState(p, id);
          if (!st.drawn) { if (width === WIDTHS[0]) walk.notes.push(localize("journey-check.run.id_not_drawn_signed_out", "{id}: not drawn signed out at its bare address, so its title and weight marks were not checked ({why})", { id: String(id), why: String(st.why) })); continue; }
          for (const l of await dec340Limits(p, id, { isPublic: true, phone: width <= 390 })) walk.fail(FAIL.DEC340, localize("journey-check.run.id_at_width_px_kind", "{id} at {width}px: {kind}: {detail}", { id: String(id), width: String(width), kind: String(l.kind), detail: String(l.detail) }));
        }
      }, { expect: [/^(?:NOT_FOUND|NO_SUCH_[A-Z_]+|[A-Z_]+_NOT_FOUND|NOT_VISIBLE|NOT_A_PARTICIPANT)$/, 401, 403, 404] }).catch((e) => { if (!(e instanceof StepFailed)) throw e; });
    }
  } finally { await ctx.close().catch(() => {}); }
}

/* The live arm (R1 (b), R5, R6, R12): `base` a named test instance; the credentials are read from the environment and never
   printed: JOURNEY_ADMIN_HANDLE, JOURNEY_ADMIN_PASSWORD, JOURNEY_MEMBER_HANDLE, JOURNEY_MEMBER_PASSWORD. It reaches the
   instance directly (R5). Each role signs in, `whoami` must answer it as that role, and it walks every working screen;
   on each, at 1280 and 390 px, the page's limits are measured and the page is paired with the design mock's drawing
   (R6). The administrator must be drawn every act the member is, and somewhere an act the member is not. `screens`
   narrows the sweep; `commit` names the mock's commit (the interface's ASSETS_COMMIT when not given). */
export async function runLive({ base, env = process.env, out = join(OUT, "live"), fetchOf = directFetch, launch = browser,
  screens = null, commit = undefined, investigate = true, codeOf = askCode, assistant = false } = {}) {
  const walk = new Walk({ out, arm: "live" });
  const need = ["JOURNEY_ADMIN_HANDLE", "JOURNEY_ADMIN_PASSWORD", "JOURNEY_MEMBER_HANDLE", "JOURNEY_MEMBER_PASSWORD"];
  for (const k of need) if (env[k]) walk.keepSecret(env[k]);
  const missing = need.filter((k) => !env[k]);
  try {
    if (!base) throw new WalkRefused("NO_INSTANCE", "the live arm needs the test instance's address (--live <address>)");
    if (missing.length) throw new WalkRefused("NO_CREDENTIALS", `the environment does not hold ${missing.join(", ")}`);
    const { city, problem } = liveCity(env);
    if (problem) throw new WalkRefused("NOT_OUR_PAGE", problem);
    await requireTestInstance(base, fetchOf);
    walk.copyHost = new URL(base).host;
    /* the instance's own short name, never to be read on a screen */
    const slugs = [walk.copyHost.split(".")[0]].filter((x) => !/^\d+$/.test(x) && x !== "localhost");
    const b = await launch({ direct: true });
    let mock = null;
    try {
      mock = await designMock(b, { dir: join(out, "design"), ...(commit ? { commit } : {}) });
      const working = screens || sweepScreens().filter((s) => s.frame === "working" || s.frame === "dock");
      const acts = { administrator: new Map(), member: new Map() };
      const sweepAs = async (role, handle, password, administer) => {
        walk.journey = `as ${role}`;
        walk.whoami = null;
        const ctx = await b.newContext({ viewport: viewportOf(1280) });
        try {
          await ctx.route("**/*", (r) => (new URL(r.request().url()).host === walk.copyHost ? r.continue()
            : (walk.foreign(r.request().url()), r.abort("blockedbyclient"))));
          const page = walk.watch(await ctx.newPage());
          await walk.step(page, `${role}: open / and sign in`, async (p) => {
            await open(walk, p, base, "/", "front");
            await act(p, "login", { fields: { "fs-handle": handle, "fs-pw": password } });
            await p.waitForFunction(() => location.pathname === "/app" || location.pathname === "/", null, { timeout: 15000 });
            await requireDrawn(walk, p, "home");
          });
          /* R5: the plane says who signed in; a credential that is not the role it is given for stops that role */
          const who = walk.whoami;
          if (!who) { walk.fail(FAIL.ROLE, localize("journey-check.run.as_role_whoami_answered_no", "as {role}: whoami answered no member session after sign-in", { role: String(role) })); return; }
          if (!!who.administer !== administer) {
            walk.fail(FAIL.ROLE, localize("journey-check.run.the_role_s_credential_signs", "the {role}'s credential signs in a session whoami answers with administer: {v1}", { role: String(role), v1: String(!!who.administer) }));
            return;
          }
          if (administer) {
            walk.journey = `as ${role}`;
            await walkDashboards(walk, page, base).catch((e) => { if (!(e instanceof StepFailed)) throw e; });
            await walkSignGone(walk, page, base).catch((e) => { if (!(e instanceof StepFailed)) throw e; });
          }
          await sweep(walk, page, base, { screens: working, journey: `as ${role}`, each: async (p, s, drawn) => {
            acts[role].set(s.id, await drawnActs(p));
            if (!drawn) return;
            for (const width of WIDTHS) {
              if (width !== 1280) { await p.setViewportSize(viewportOf(width)); await p.reload(); await settle(p); }
              for (const l of await pageLimits(p, { width, slugs, handles: [...walk.handles] })) walk.fail(l.kind, `${s.id} at ${width}px: ${l.detail}`);
              /* R28 (DEC-340): the screen's title, the explanations, the masthead's name, Projects' controls */
              for (const l of await dec340Limits(p, s.id, { isPublic: false, phone: width <= 390 })) walk.fail(FAIL.DEC340, localize("journey-check.run.id_at_width_px_kind", "{id} at {width}px: {kind}: {detail}", { id: String(s.id), width: String(width), kind: String(l.kind), detail: String(l.detail) }));
              const live = await p.screenshot();
              const design = await mock.draw(s.id, width);
              if (!design) walk.fail(FAIL.DESIGN, localize("journey-check.run.id_the_design_mock_at", "{id}: the design mock at {commit} draws no such screen", { id: String(s.id), commit: String(mock.commit) }));
              else walk.pairs.push(relative(out, await pair(b, live, design, join(out, "pairs", `${role}-${s.id}-${width}.png`),
                { title: `${s.id}, ${width}px, as ${role}` })));
            }
            await p.setViewportSize(viewportOf(1280));
          } });
        } catch (e) { if (!(e instanceof StepFailed)) throw e; }
        finally { await ctx.close().catch(() => {}); }
      };
      await sweepAs("administrator", env.JOURNEY_ADMIN_HANDLE, env.JOURNEY_ADMIN_PASSWORD, true);
      await sweepAs("member", env.JOURNEY_MEMBER_HANDLE, env.JOURNEY_MEMBER_PASSWORD, false);
      /* R28: the named public pages, signed out, at both widths */
      await publicPass(walk, b, base);
      /* R24: the published frame, where the instance holds a published case; R21: the carried states beside the design's */
      await walkPublished(walk, b, base, mock, { out, path: env[PUBLISHED_ENV] });
      for (const f of await walkStates(walk, b, mock, { out })) walk.pairs.push(f);
      /* R12: R9 and R10 on the instance, each through its real subscription sign-in, whose code the person types */
      if (investigate) await investigateLive(walk, b, base, {
        founder: { handle: env.JOURNEY_ADMIN_HANDLE, password: env.JOURNEY_ADMIN_PASSWORD },
        member: { handle: env.JOURNEY_MEMBER_HANDLE, password: env.JOURNEY_MEMBER_PASSWORD }, codeOf, assistant, city });
      /* R18 (K3747): journey 29's steps the design marks for the assistant, which the walk did not reach while the assistant does
         not work, are reported as not walked, never failed */
      walk.journey = "R18 design journey 29";
      for (const [k, st] of (await mock.allSteps(JOURNEY_29)).entries())
        if (st.only === "ai" && !journey29Live(walk, st)) walk.notWalked(stepName(JOURNEY_29, k, st));
      /* R5: the acts only an administrator is drawn */
      walk.journey = "roles";
      for (const d of roleProblems(acts)) walk.fail(FAIL.ROLE, d);
    } finally { if (mock) await mock.close(); await b.close().catch(() => {}); }
  } catch (e) {
    failed(walk, e);
  }
  return { walk, report: walk.report(), ok: walk.failures.length === 0 };
}
