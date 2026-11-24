/* T47's L11 fold (K3100): the installer's pages in the member interface's visual language. R50 the first page and Before
 * Cloudflare, R51 the progress lines, the stops and the finished panel, R52 the update page, R53 interface-assets'
 * stylesheet and faces, carried in the bundle and served by the installer itself. Each test drives the Worker at its
 * interface (its routes, its streamed page read as the browser's script reads it, and the pages' own script run against
 * a stand-in for the elements it touches), against the stateful fake account in fixture.mjs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CFG } from "../src/index.mjs";
import { HOSTING_CONTROL } from "../../bio-plane/src/setup-fleet.mjs";
import { ASSET_FILES } from "../../bio-plane/src/interface-assets/index.mjs";
import { PROFILE_CHOICES, ALLOWED, BEFORE_CLOUDFLARE_CONTROL, STYLESHEET, ASSET_PREFIX, UPDATE_KEEPS, LEFT_OUT, PAGE_CSS } from "../src/ui.mjs";
import { RELEASE_VERSION } from "../src/release.mjs";
import { word } from "../src/words.mjs";
import { pageWorld, req, run, begin, callback, script, realFetch, release, armWith, restoreSigners, SIGNER, bump, VPC_ID, jres, headOf } from "./fixture.mjs";

const text = async (path) => (await req(path)).text();
const NEXT = bump(RELEASE_VERSION);
const UPDATE_PATH = "/update?version=" + NEXT;
const escd = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/* The markup between an element's opening tag (found by its id) and the matching close of that tag. */
function section(page, id) {
  const open = new RegExp(`<([a-z0-9]+)\\b[^>]*\\bid="${id}"[^>]*>`).exec(page);
  if (!open) return null;
  const tag = open[1];
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = open.index;
  for (let m; (m = re.exec(page));) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return page.slice(open.index, m.index + m[0].length);
  }
  return null;
}
const controls = (html) => [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)]
  .map((m) => `${m[1]}#${m[2].match(/\bid="([^"]+)"/)?.[1] ?? ""}${m[2].match(/\bname="([^"]+)"/) ? "[" + m[2].match(/\bname="([^"]+)"/)[1] + "]" : ""}`);
/* The part of a key's sentence before its `{said}`: what tells one stop from another. */
const words = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&ldquo;|&rdquo;/g, "\"").replace(/\s+/g, " ")
  .replace(/ ([.,])/g, "$1");

/* ---------------------------------------------------------------------------------------------------- R50 the first page */

test("R50 GET / asks only the permanent short name (R41's dialog) and the places (R21), with what is needed in one block (R23); then Before Cloudflare: what will be allowed in plain words, and R34's words; Continue to Cloudflare sends POST /begin", async () => {
  const home = await text("/");
  const choose = section(home, "stage-choose"), before = section(home, "stage-before");
  assert.ok(choose && before, "two stages");
  /* The first stage's asks: the short name and the places, nothing else. */
  /* (R72, DEC-257) the places' "none of these" is a choice of its own, `profile-none`. */
  assert.deepEqual(controls(choose), ["input#slug", ...PROFILE_CHOICES.map(() => "input#[profile]"), "input#profile-none[profile-none]"]);
  assert.ok(choose.includes(`<h2>${escd(word("screen.install.short.heading"))}</h2>`));
  assert.ok(choose.includes(`<h2>${escd(word("installer.places.heading"))}</h2>`));
  /* What is needed, in one block, before the asks: R23's prerequisites and (T46) the parts the carried release cannot install. */
  assert.equal(home.split(`<h2>${escd(word("installer.need.heading"))}</h2>`).length - 1, 1, "one block");
  const need = section(home, "need");
  assert.ok(choose.indexOf(need) >= 0 && choose.indexOf(need) < choose.indexOf('id="slug"'), "the block comes before the asks");
  /* R23, R57: the prerequisites are the design's keys, and the assistant's is a Claude plan with cloud sessions (nothing ties it to a container). */
  const needWords = words(need);
  for (const k of ["screen.install.need.cloudflare", "screen.install.cf.containers", "screen.install.need.claude"])
    assert.ok(needWords.includes(word(k)), k);
  assert.ok(needWords.includes(word("installer.assistant.needs")), "the assistant's prerequisite, a Claude plan with cloud sessions");
  assert.ok(!needWords.includes(word("installer.assistant.offer")), "R57: the assistant is not tied to a container");
  if (LEFT_OUT) assert.ok(need.includes(LEFT_OUT), "the parts left out, in the same block");
  /* Before Cloudflare: hidden until the dialog's confirming act; what will be allowed, one plain line per scope R2 asks; R34's words. */
  assert.match(before, /^<div class="ng-stage" id="stage-before" hidden>/);
  assert.ok(before.includes(`<h1>${escd(word("screen.install.cf.title"))}</h1>`));
  /* (R72) the design's four lines cover the five scopes: the scripts and the storage share one (`screen.install.cf.programs`). */
  assert.deepEqual([...ALLOWED], ["programs", "plan", "containers", "join", "logs"].map((k) => word("screen.install.cf." + k)));
  /* R2's six scopes (K3819: the sixth, `account-logs.read`, reads the Logpush list) against the design's four lines: the design holds no
     line for the sixth, so none is drawn and the gap is reported (R79: no sentence is written as English meanwhile). */
  assert.equal(CFG.SCOPES.length, 6);
  const allowed = section(before, "allowed");
  assert.deepEqual([...allowed.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]), [...ALLOWED].map(escd));
  assert.ok(!/[a-z]+(?:-[a-z]+)*\.(write|read|bind)\b/.test(words(allowed)), "plain words, never a scope's code");
  const control = section(before, "control-before");
  assert.ok(control.includes(`<h2>${escd(BEFORE_CLOUDFLARE_CONTROL)}</h2>`));
  for (const s of HOSTING_CONTROL.sentences) assert.ok(control.includes(`<p>${escd(s)}</p>`), s);
  assert.ok(before.includes(`<button id="cloudflare" class="cs-btn" data-tone="primary">${escd(word("act.bootstrap.label.install"))}</button>`));
  /* The assistant's words (R37) and the optional Workers VPC field (R45) are on the page, folded and closed, never one of the first page's asks. */
  for (const id of ["about-assistant", "security-fold"]) {
    const fold = section(before, id);
    assert.ok(fold && /^<details class="ng-fold" id="[^"]+"><summary>/.test(fold) && !/^<details[^>]*\bopen\b/.test(fold), id);
  }
  assert.deepEqual(controls(before), ["input#vpc"]);
  assert.ok(section(before, "security-fold").includes('<input id="vpc"'));

  /* The behaviour: the short name's act opens the dialog; its confirming act draws Before Cloudflare; Continue to Cloudflare sends /begin, with the places in the order chosen and the VPC service named. */
  const w = pageWorld(home);
  w.el("slug").value = "river-keepers";
  await w.el("go").click();
  assert.equal(w.el("confirm").open, true);
  assert.deepEqual(w.sent, []);
  await w.el("confirm-yes").click();
  assert.deepEqual([w.sent, w.el("stage-before").hidden, w.el("stage-choose").hidden], [[], false, true]);
  await w.el("cloudflare").click();
  assert.deepEqual(w.sent.map((s) => [s.url, s.body.mode, s.body.slug]), [["/begin", "install", "river-keepers"]], "Continue to Cloudflare sends /begin");
  assert.deepEqual(w.sent[0].body.profiles, [], "no place chosen for the founder");
  assert.equal(w.location.href, "https://dash.cloudflare.com/oauth2/auth?x=1");
  /* Control: closing the dialog, or Back from Before Cloudflare, sends nothing, and Continue to Cloudflare before a confirmation sends nothing. */
  const c = pageWorld(home);
  c.el("slug").value = "river-keepers";
  await c.el("cloudflare").click();
  await c.el("go").click(); await c.el("confirm-no").click();
  await c.el("go").click(); await c.el("confirm-yes").click(); await c.el("back").click();
  await c.el("cloudflare").click();
  assert.deepEqual(c.sent, [], "nothing is sent without the confirming act and Continue to Cloudflare in that order");
  /* And what /begin answers is the permission R2 states: the page's act reaches Cloudflare with exactly R2's scopes. */
  const calls = script([]);
  const { j } = await begin("river-keepers", "install", { profiles: [], securityVpc: VPC_ID });
  globalThis.fetch = realFetch;
  assert.deepEqual(calls, []);
  assert.deepEqual(new URL(j.authorize).searchParams.get("scope").split(" "), CFG.SCOPES);
});

/* ------------------------------------------------------------------------------------------- R51 the progress page */

test("R51 the progress page draws one plain line per step as it starts and ends; a stop names the step, what to do, and \"nothing was created\" where R4 holds; the finished panel shows the checks, the one-time password and address once, the probe key behind \"most teams never need it\", and hands over to <address>/app/setup#boot=<password>", async () => {
  /* One line per step, drawn as it starts and redrawn as it ends: every step started ends, ok or not, and no step is drawn twice. */
  armWith(SIGNER.line);
  const fine = await run({ slug: "lines-ok", rel: await release({ version: NEXT }) });
  restoreSigners();
  for (const w of [fine]) {
    const started = w.page.events.filter((e) => e.k === "step").map((e) => e.id);
    assert.deepEqual(started, [...new Set(started)], "one line per step");
    for (const id of started) {
      const at = w.page.events.findIndex((e) => e.k === "step" && e.id === id);
      assert.ok(w.page.events.slice(at + 1).some((e) => e.id === id && (e.k === "ok" || e.k === "no")), `${id} ends`);
    }
  }
  /* The shell draws each line with its state in a word beside it, and the stop's box names the step. */
  assert.match(fine.raw, /<div id="log" class="cs-sheet ng-log"><\/div>/);
  assert.ok(fine.raw.includes(`const W=${JSON.stringify({ go: word("installer.state.go"), ok: word("installer.state.ok"), no: word("installer.state.no") })};`), "the state words are the keys'");
  assert.ok(fine.raw.includes('$("#fail-s").textContent=s||""'), "the stop names the step it stopped at, by installer.stopped.at");

  /* The stops before `install` (R4): each names the step it stopped at (the line in progress), says nothing was created,
     and says what to do. */
  /* An account lookup that keeps failing is a lasting stop (R66) that names its step and leaves nothing half-installed. */
  const lasting = await run({ slug: "stop-lasting", settingsFail: true });
  assert.equal(lasting.page.failed.s, word("installer.stopped.at", { step: lasting.page.events.find((e) => e.k === "step" && e.id === "fresh").label }));
  assert.equal(lasting.page.failed.d, word("screen.install.stopped.lasting.do"));
  /* R75: each is one sentence by key, which says the cause, that nothing was created, and what to do. */
  const stops = [["auth", { tokenFail: true }, "installer.install.stopped.permission"], ["acct", { accountsFail: true }, "installer.install.stopped.account"],
    ["fresh", { pre: { "stop-fresh-taken": [] } }, "screen.install.stopped.nametaken", "stop-fresh-taken", { name: "stop-fresh-taken" }],
    ["plan", { plan: "free" }, "screen.install.stopped.plan"], ["plan", { plan: "unknown" }, "installer.install.stopped.planunknown"],
    ["r2", { r2: "refused" }, "installer.install.stopped.storage"]];
  for (const [step, opts, key, slug, vars] of stops) {
    const w = await run({ slug: slug || `stop-${step}`, ...opts });
    const label = w.page.events.find((e) => e.k === "step" && e.id === step).label;
    assert.equal(w.page.failed.s, word("installer.stopped.at", { step: label }), `${step}: the stop names its step`);
    assert.ok(w.page.failed.said.startsWith(headOf(key, vars)), `${step}: the stop is ${key}`);
    assert.equal(w.page.done, null);
  }
  /* Control: a stop after the install (no address) names its step and what to do, and never says nothing was created. */
  const late = await run({ slug: "stop-late", enableFail: true });
  assert.equal(late.page.failed.s, word("installer.stopped.at", { step: late.page.events.find((e) => e.k === "step" && e.id === "addr").label }));
  assert.ok(late.page.failed.said.startsWith(headOf("installer.install.stopped.noaddress")), "installed, with no address yet: what to do is in the sentence");
  assert.ok(!late.page.failed.said.includes(word("installer.install.stopped.refused", { said: "" }).slice(0, 30)), "and it never says nothing was left behind");

  /* The finished panel. */
  const done = fine.page.done;
  const boot = done.match(/id="out-boot">([^<]+)</)[1], url = done.match(/id="out-url">([^<]+)</)[1];
  assert.equal(url, "https://lines-ok.grp.workers.dev");
  assert.equal(fine.raw.split(boot).length - 1, 1, "the one-time password, once");
  assert.equal([...done.matchAll(/id="out-url"/g)].length, 1, "the address, once");
  assert.ok(done.includes(`<h2 id="otp-head">${word("screen.install.otp.head")}</h2>`), "R73: the password is introduced as one-time");
  /* The checks: each a line with its outcome in a word; all passed on a confirmed install. */
  const checks = section(done, "checks");
  const rows = [...checks.matchAll(/<div class="cs-row" data-r="([a-z]+)"><span class="mk">([^<]+)<\/span><span>([^<]+)<\/span>/g)];
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r[2]), Array(4).fill(word("installer.check.passed")));
  assert.equal(rows[0][3], word("screen.install.ready.answers") + ".");
  assert.equal(rows[1][3], escd(word("installer.check.builds.all", { version: NEXT })));
  assert.equal(rows[2][3], escd(word("installer.check.bytes.ok", { version: NEXT })));
  assert.equal(rows[3][3], word("screen.install.ready.nolog") + ".");
  assert.ok(done.indexOf('id="checks"') < done.indexOf('id="out-boot"'), "the checks, then the password");
  /* The probe key, folded behind "most teams never need it", closed. */
  const probe = section(done, "probe-fold");
  assert.ok(probe.startsWith(`<details class="ng-fold" id="probe-fold"><summary>${escd(word("screen.install.probe.summary"))}</summary>`));
  assert.match(probe, /id="out-probe">[^<]+</);
  assert.ok(!/id="out-probe"/.test(done.replace(probe, "")), "the probe key is nowhere else");
  /* The hand-over: to the setup screen, the password in the fragment, read from the panel at the click. */
  assert.ok(done.includes(`data-url="https://lines-ok.grp.workers.dev/app/setup"`));
  assert.ok(fine.raw.includes(`location.href=h.dataset.url+"#boot="+encodeURIComponent(document.getElementById("out-boot").textContent)`));
  assert.ok(!done.includes("#boot="), "the password rides in no address on the page");
  /* Controls: a check that did not pass says so in its own word. */
  const unread = await run({ slug: "checks-und", logpush: "refused" });
  const r2 = [...section(unread.page.done, "checks").matchAll(/<span class="mk">([^<]+)<\/span><span>([^<]+)<\/span>/g)];
  assert.equal(r2[3][1], word("installer.check.undetermined"));
  armWith(SIGNER.line);
  const lag = await run({ slug: "checks-lag", rel: await release({ version: NEXT }), copy: { storeVersion: "0.1.0" } });
  restoreSigners();
  const r3 = [...section(lag.page.done, "checks").matchAll(/<span class="mk">([^<]+)<\/span><span>([^<]+)<\/span>/g)];
  assert.equal(r3[1][1], word("installer.check.notyet"));
  // fixtures-own: platform a copy still waking: its self-check answers not-ok, the fake network's own double of a platform that is not up yet, not any module's answer
  const asleep = await run({ slug: "checks-asleep", copy: { selftest: () => jres({ ok: false }) } });
  const r4 = [...section(asleep.page.done, "checks").matchAll(/<span class="mk">([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(r4.slice(0, 2), Array(2).fill(word("installer.check.notyet")));
});

/* -------------------------------------------------------------------------------------------- R52 the update page */

test("R52 GET /update draws the version before and after and \"Continue to Cloudflare to update\"; a stop says your team's Civicsmith keeps running as it was", async () => {
  const upd = await text(UPDATE_PATH);
  const versions = section(upd, "versions");
  assert.ok(words(section(versions, "version-before")).includes(word("installer.update.row.now")));
  assert.ok(section(versions, "version-after").includes(escd(word("installer.update.chosen.nodate", { version: NEXT }))));
  assert.ok(upd.includes(`<button id="go" class="cs-btn" data-tone="primary">${escd(word("act.bootstrap.label.update"))}</button>`));
  assert.equal(UPDATE_KEEPS, word("installer.update.keeps"));
  assert.ok(upd.includes(escd(UPDATE_KEEPS)));
  /* Once read, the version before and after are drawn: on the progress line and the last screen. */
  const planeBase = (slug, v) => [{ type: "durable_object_namespace", name: "STORE", class_name: "Store" },
    { type: "plain_text", name: "VERSION", text: v }, { type: "secret_text", name: "ADMIN_TOKEN", text: "admin-kept" },
    { type: "secret_text", name: "PROBE_TOKEN", text: "probe-kept" }, { type: "service", name: "SELF", service: slug }];
  armWith(SIGNER.line);
  const w = await run({ slug: "upd-ver", mode: "update", pre: { "upd-ver": planeBase("upd-ver", "0.70.0") }, rel: await release({ version: NEXT }) });
  restoreSigners();
  assert.equal(w.page.label("up"), word("installer.update.progress.placing", { to: NEXT }));
  const v = section(w.page.done, "versions");
  assert.ok(words(v).includes(`${word("installer.update.label.before")} ${word("installer.update.before.known", { version: "0.70.0" })}`));
  assert.ok(words(v).includes(`${word("installer.update.label.after")} ${word("installer.update.after", { version: NEXT, signed: word("installer.update.after.signed") })}`));
  assert.ok(w.page.done.includes(escd(word("installer.update.done.says", { to: NEXT, from: "0.70.0" }))));
  /* Control: a version before that could not be read is said so, never guessed. */
  const blind = await run({ slug: "upd-blind", mode: "update", pre: { "upd-blind": planeBase("upd-blind", "0.70.0") }, subdomain: null });
  assert.ok(words(section(blind.page.done, "versions")).includes(word("installer.update.before.unknown")));
  /* R75: every stop of an update is one sentence by key, which says the copy keeps running as it was; the install's stops never say so. */
  for (const [opts, key, vars] of [[{ tokenFail: true }, "installer.update.stopped.permission"], [{ accountsFail: true }, "installer.update.stopped.account"],
      [{}, "installer.update.stopped.noteam", { slug: "upd-stop-none" }], [{ refuseUpdate: true }, "installer.update.stopped", { version: "0.70.0" }]]) {
    const slug = "upd-stop-" + (Object.keys(opts).join("").toLowerCase() || "none");
    const pre = opts.refuseUpdate ? { [slug]: planeBase(slug, "0.70.0") } : {};
    const s = await run({ slug, mode: "update", pre, ...opts });
    assert.ok(s.page.failed, JSON.stringify(opts));
    assert.ok(s.page.failed.said.startsWith(headOf(key, { slug, ...vars })), `${JSON.stringify(opts)}: ${s.page.failed.said}`);
  }
  const installStop = await run({ slug: "inst-stop", plan: "free" });
  assert.ok(!installStop.page.failed.said.includes(UPDATE_KEEPS));
});

/* -------------------------------------------------------------------------- R53 interface-assets' stylesheet and faces */

test("R53 the pages use interface-assets' stylesheet and faces, carried in the installer's bundle and served by it; no other origin (R35)", async () => {
  armWith(SIGNER.line);
  const streamed = await run({ slug: "styled", rel: await release({ version: NEXT }) });
  restoreSigners();
  const { cookie } = await begin("styled");
  const denied = await callback("error=access_denied", cookie);
  const pages = { "/": await text("/"), "/update": await text(UPDATE_PATH), "404": await text("/nowhere"), progress: streamed.raw, refusal: denied.raw };
  const sheet = ASSET_FILES["civicsmith.css"].body;
  const defined = new Set([...sheet.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const classes = new Set([...sheet.matchAll(/\.(cs-[a-z0-9-]+)/g)].map((m) => m[1]));
  for (const [where, page] of Object.entries(pages)) {
    /* Each page links interface-assets' stylesheet, on its own origin, and no other; its own layout is in the stylesheet's tokens. */
    assert.deepEqual([...page.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0]), [`<link rel="stylesheet" href="${STYLESHEET}">`], where);
    assert.ok(page.includes('<link rel="icon" href="data:,">'), `${where}: its icon loads nothing`);
    assert.match(page, /<html lang="en" class="cs">/, where);
    /* Every cs- component it uses is the stylesheet's. */
    for (const [, cls] of page.matchAll(/class="([^"]*)"/g))
      for (const c of cls.split(/\s+/).filter((x) => x.startsWith("cs-"))) assert.ok(classes.has(c), `${where}: ${c}`);
  }
  for (const [, name] of PAGE_CSS.matchAll(/var\((--[a-z0-9-]+)\)/g)) assert.ok(defined.has(name), `PAGE_CSS's ${name} is the stylesheet's`);
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(PAGE_CSS), false, "no colour of its own");
  /* The stylesheet draws a .cs-dialog as a grid, which would show R41's dialog before it is opened: the layout hides it while closed. */
  assert.match(sheet, /\.cs-dialog \{[^}]*display: grid/);
  assert.ok(PAGE_CSS.includes("dialog.cs-dialog:not([open]){display:none}"));
  /* The installer serves every file of interface-assets, byte for byte, with its type; the stylesheet's faces resolve to them. */
  for (const [name, f] of Object.entries(ASSET_FILES)) {
    const r = await req(ASSET_PREFIX + name);
    assert.equal(r.status, 200, name);
    assert.equal(r.headers.get("content-type").split(";")[0], f.type, name);
    const got = Buffer.from(await r.arrayBuffer());
    assert.ok(got.equals(f.encoding === "base64" ? Buffer.from(f.body, "base64") : Buffer.from(f.body, "utf8")), name);
    assert.equal(r.headers.get("set-cookie"), null);
  }
  const faces = [...sheet.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.equal(faces.length, 15);
  for (const u of faces) assert.ok(u.startsWith(ASSET_PREFIX) && Object.hasOwn(ASSET_FILES, u.slice(ASSET_PREFIX.length)), u);
  /* Controls: a name the assets do not hold, and any method but GET, are R1's 404. */
  for (const [path, init] of [[ASSET_PREFIX + "fonts/other.woff2", {}], [ASSET_PREFIX + "../index.mjs", {}], [ASSET_PREFIX + "civicsmith.css", { method: "POST" }]]) {
    const r = await req(path, init);
    assert.equal(r.status, 404, path);
  }
  /* Carried in the bundle: the committed bundle holds the stylesheet's own text and every face. */
  const { readFileSync } = await import("node:fs");
  const bundle = readFileSync(new URL("../dist/newgroup.bundled.mjs", import.meta.url), "utf8");
  for (const [name, f] of Object.entries(ASSET_FILES)) {
    /* A face is its base64 as written; a text file, its lines as written that need no escaping in a string. */
    const lines = f.encoding === "base64" ? [f.body] : f.body.split("\n").filter((l) => l.length > 40 && !/["'`\\$]|[^\x20-\x7e]/.test(l));
    assert.ok(lines.length > 0 && lines.every((l) => bundle.includes(l)), name);
  }
});

/* ------------------------------------------------------------------------------- R54 the amendments of R1 and R41 (K3144) */

test("R54 R1's 404 excepts GET /app/assets/<name> for exactly ASSET_FILES' names, byte for byte with their type and an immutable cache header, storing nothing; nothing sends /begin before R41's confirming act, and R50's Continue to Cloudflare sends it; GET /update draws the release it installs, the version before and after drawn on the progress page and the finished panel; the finished panel draws no \"Run the checks again\"", async () => {
  /* R1's exception: exactly the names of ASSET_FILES, nothing else under the prefix, GET only. */
  const calls = script([]);
  for (const name of Object.keys(ASSET_FILES)) {
    const r = await req(ASSET_PREFIX + name);
    assert.equal(r.status, 200, name);
    assert.equal(r.headers.get("cache-control"), "public, max-age=31536000, immutable", name);
    assert.equal(r.headers.get("set-cookie"), null, name);
  }
  for (const [path, init] of [[ASSET_PREFIX + "Civicsmith.css", {}], [ASSET_PREFIX + "fonts/", {}], [ASSET_PREFIX + "icons.svg/x", {}],
      [ASSET_PREFIX + "icons.svg", { method: "HEAD" }], [ASSET_PREFIX + "icons.svg", { method: "PUT", body: "x" }], ["/assets/civicsmith.css", {}]]) {
    const r = await req(path, init);
    assert.equal(r.status, 404, `${init.method || "GET"} ${path}`);
  }
  globalThis.fetch = realFetch;
  assert.deepEqual(calls, [], "the files are the bundle's: nothing fetched, nothing stored");
  /* R41 as amended: the confirming act sends nothing; Continue to Cloudflare, after it, sends /begin. */
  const home = await text("/");
  const w = pageWorld(home);
  w.el("slug").value = "amended";
  await w.el("go").click();
  await w.el("confirm-yes").click();
  assert.deepEqual(w.sent, [], "the confirming act sends nothing");
  await w.el("cloudflare").click();
  assert.deepEqual(w.sent.map((s) => s.body.slug), ["amended"]);
  /* GET /update draws the release it installs and says the version before is read later; the progress line and the last screen draw both. */
  const upd = await text(UPDATE_PATH);
  assert.ok(section(upd, "version-after").includes(NEXT));
  assert.doesNotMatch(section(upd, "version-before"), /\d+\.\d+\.\d+/, "no version before is claimed before it is read");
  const planeBase = (slug, v) => [{ type: "durable_object_namespace", name: "STORE", class_name: "Store" },
    { type: "plain_text", name: "VERSION", text: v }, { type: "secret_text", name: "ADMIN_TOKEN", text: "admin-kept" },
    { type: "secret_text", name: "PROBE_TOKEN", text: "probe-kept" }, { type: "service", name: "SELF", service: slug }];
  const u = await run({ slug: "amend-up", mode: "update", pre: { "amend-up": planeBase("amend-up", "0.70.0") } });
  assert.equal(u.page.label("up"), word("installer.update.progress.placing", { to: NEXT }));
  assert.ok(section(u.page.done, "versions").includes("0.70.0"));
  /* No "Run the checks again" on the finished panel, nor anywhere on the progress page. */
  const i = await run({ slug: "amend-in" });
  assert.ok(i.page.done && !/Run the checks again/i.test(i.raw), "drawn nowhere");
  assert.ok(!/Run the checks again/i.test(home + upd));
});
