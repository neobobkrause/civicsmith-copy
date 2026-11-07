/* installer-check R86-R93 (T53; N1265): "Check my account", its list, the card line, the re-run, the gate, the Get-ready buttons,
 * the links as data and their words. The installer (newgroup) is driven through its own routes against the stateful fake account
 * of its fixture (`newgroup/test/fixture.mjs`, installer's world), so each answer of Cloudflare's is the fixture's measured or
 * documented shape, never one hand-built here. A sentence is never held here: each is read from the word table by key. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { run, req, begin, callback, script, realFetch, pageWorld, restoreSigners, passedCheck, cookieValue, cookieOf } from "../../../../newgroup/test/fixture.mjs";
import { CFG } from "../../../../newgroup/src/index.mjs";
import { CHECK_LINES, CHECK_STATES, FIX_LINKS, GET_READY_LINKS, CHECK_COOKIE, checkCookieValue } from "../../../../newgroup/src/ready.mjs";
import { GUIDE_STEPS } from "../../../../newgroup/src/guide.mjs";
import { WIZARD_HTML } from "../../../../newgroup/src/ui.mjs";
import { word, hasWord, KEYS } from "../../../../newgroup/src/words.mjs";
import { WORD_ROWS } from "../../../../bio-plane/src/setup-words/index.mjs";
import { RELEASE_VERSION } from "../../../../newgroup/src/release.mjs";

after(restoreSigners);

const SRC = new URL("../../../../newgroup/src/", import.meta.url);
const unesc = (s) => String(s).replace(/&(lt|gt|quot|amp|#39);/g, (_, c) => ({ lt: "<", gt: ">", quot: '"', amp: "&", "#39": "'" }[c]));
/* The list's lines as drawn: id, state, the row's text, its fix button's address and the "Use" choice. */
function linesOf(done) {
  return [...String(done).matchAll(/<div class="cs-row" data-line="(\w+)" data-state="(\w+)"[^>]*>([\s\S]*?)<\/span><\/div>/g)].map(([, id, state, inner]) => ({
    id, state, text: unesc(inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")),
    fix: inner.match(/data-fix="\w+"/) ? unesc(inner.match(/href="([^"]+)"/)[1]) : null,
    fixAttrs: inner.match(/<a [^>]*data-fix[^>]*>/)?.[0] ?? null,
    use: inner.match(/data-use="([^"]+)"/)?.[1] ?? null,
  }));
}
const byId = (lines) => Object.fromEntries(lines.map((l) => [l.id, l]));
const has = (text, key, vars) => unesc(text).includes(word(key, vars));
const dataBegin = (html, id) => JSON.parse(unesc(html.match(new RegExp(`id="${id}"[^>]*data-begin="([^"]*)"`))[1]));
const check = (slug, opts = {}) => run({ slug, mode: "check", ...opts });
/* Every call that changes the account: anything but a read, the token exchange left out (it is not the account's). */
const writes = (w) => w.calls.filter((c) => c.method !== "GET" && c.u.startsWith(CFG.API)).map((c) => `${c.method} ${c.u.slice(CFG.API.length).replace(/^\/accounts\/[^/]+/, "")}`);
/* 500 Durable Object classes held: the account's ceiling for them (ready.mjs ACCOUNT_LIMITS) is reached. */
const FULL = { other: Array.from({ length: 500 }, (_, i) => `C${i}`) };

/* ------------------------------------------------------------------------------------------------ R86 */

test("R86 \"Check my account\" is a run that makes nothing that stays: /begin takes mode check (slug validated, R2's scopes), the callback draws the list for the account it read, clears its cookie, takes no lock, registers no prefix, makes no bucket, and its only write is the plan probe's upload and delete; a probe it cannot delete is named; control: an install and an update answer as before", async () => {
  /* /begin: the slug is validated as for an install; the scopes asked are exactly R2's. */
  assert.equal((await begin("x", "check")).r.status, 400);
  const b = await begin("river-keepers", "check", { chk: false });
  assert.equal(b.j.ok, true, "a check needs no passed check");
  assert.deepEqual(new URL(b.j.authorize).searchParams.get("scope").split(" "), CFG.SCOPES);
  assert.equal(cookieValue(b.cookie).mode, "check");

  const w = await check("river-keepers", { pre: { "someone-else": [] } });
  assert.ok(w.page.done && w.page.done.includes('id="check-list"'), "the list is drawn");
  assert.ok(has(w.page.done, "screen.install.check.account", { account: "Group Account" }), "it names the account it read");
  assert.deepEqual(writes(w), ["PUT /workers/scripts/bio-plan-probe", "DELETE /workers/scripts/bio-plan-probe?force=true"], "the only write is the probe's");
  assert.deepEqual([...w.acct.keys()], ["someone-else"], "the account's Workers are as before: the probe is gone");
  assert.deepEqual([...w.buckets], [], "no bucket");
  assert.equal(w.prefix(), "grp", "the workers.dev prefix unchanged");
  assert.equal(w.calls.lock, undefined, "no lock taken (bio-install-lock never touched)");
  assert.ok(w.r.headers.getSetCookie().some((c) => c.startsWith(`${CFG.COOKIE}=deleted;`)), "the begin cookie is cleared");
  /* An account with no workers.dev prefix: none is registered by a check. */
  const bare = await check("river-keepers", { subdomain: null });
  assert.equal(bare.prefix(), null);
  assert.ok(!writes(bare).some((x) => x.includes("/workers/subdomain")));
  /* A probe that cannot be deleted is a line, not a silence. */
  const left = await check("river-keepers", { probeDelete: "fail" });
  assert.ok(left.page.done.includes('id="check-probe-left"') && has(left.page.done, "screen.install.check.probe.left", { name: "bio-plan-probe" }));
  /* A permission that does not reach before the list asks for approval again (R71), and draws no list. */
  const scopes = await check("river-keepers", { grantedScope: "workers-scripts.write" });
  assert.ok(!scopes.page.done.includes('id="check-list"'));
  assert.ok(scopes.page.done.includes(word("act.owed_installcheck.label.install")), "the approval again begins the check again");
  /* Control: an install and an update answer as before. */
  const inst = await run({ slug: "river-keepers" });
  assert.equal(inst.page.failed, null);
  assert.ok(inst.page.done.includes('id="out-boot"'));
  const upd = await run({ slug: "river-keepers", mode: "update", pre: { "river-keepers": [{ type: "durable_object_namespace", name: "STORE", class_name: "Store" }] } });
  assert.ok(!upd.page.done || !upd.page.done.includes('id="check-list"'));
});

/* ------------------------------------------------------------------------------------------------ R87 */

test("R87 the list draws every line at once, in CHECK_LINES' fixed order, each ready, not ready or unknown with its own fix: a free plan with a taken name and the limits reached draws them not ready in one run; a failing Containers read is unknown and the rest stand; a ready account draws five ready; a line answering permission asks for approval again; control: the install's own stops answer as before", async () => {
  assert.deepEqual([...CHECK_LINES], ["plan", "containers", "limits", "name", "card"]);
  assert.ok(Object.isFrozen(CHECK_LINES));
  const bad = await check("river-keepers", { plan: "free", pre: { "river-keepers": [] }, preClasses: FULL });
  const lines = linesOf(bad.page.done);
  assert.deepEqual(lines.map((l) => l.id), [...CHECK_LINES], "every line, in order");
  const L = byId(lines);
  for (const id of ["plan", "limits", "name"]) {
    assert.equal(L[id].state, "not_ready", id);
    assert.equal(L[id].fix, FIX_LINKS[id].not_ready.url, `${id} has its own fix`);
  }
  assert.ok(L.plan.text.includes(word("screen.install.check.plan.fix")));
  assert.ok(L.name.text.includes(word("screen.install.check.name.fix", { name: "river-keepers", free: "river-keepers-2" })));
  assert.equal(L.name.use, "river-keepers-2", "a free name is offered");
  assert.ok(L.limits.text.includes(word("screen.install.check.limits.fix", { limit: word("installer.limit.classes.other", { n: 500 }) })));
  assert.equal(L.containers.state, "ready", "judged on its own");
  assert.ok(bad.page.done.includes(word("screen.install.check.closed")));

  const odd = byId(linesOf((await check("river-keepers", { containersOdd: true })).page.done));
  assert.equal(odd.containers.state, "unknown");
  assert.equal(odd.containers.fix, FIX_LINKS.containers.unknown.url);
  for (const id of ["plan", "limits", "name", "card"]) assert.equal(odd[id].state, "ready", id);

  const good = await check("river-keepers");
  assert.deepEqual(linesOf(good.page.done).map((l) => l.state), ["ready", "ready", "ready", "ready", "ready"]);
  assert.ok(linesOf(good.page.done).every((l) => l.fix === null), "a ready line has no fix");

  const perm = await check("river-keepers", { containers: "read" });
  assert.ok(!perm.page.done.includes('id="check-list"'), "no list drawn");
  assert.equal(perm.page.failed.said, word("installer.ready.containers.permission"));

  /* Control: R70's and R84's stops in the install. */
  const named = await run({ slug: "river-keepers", pre: { "river-keepers": [] } });
  assert.equal(named.page.failed.said, word("screen.install.stopped.nametaken", { name: "river-keepers" }));
  assert.equal(named.page.failed.d, word("screen.install.stopped.nametaken.do", { free: "river-keepers-2" }));
  const free = await run({ slug: "river-keepers", plan: "free" });
  assert.ok(free.page.failed.said.startsWith(word("screen.install.stopped.plan")));
});

/* ------------------------------------------------------------------------------------------------ R88 */

test("R88 the card line is derived from the plan line and one storage read: free plan, not ready with the plan's fix; paid with R2 not entitled, the storage fix; paid with R2 on, ready and saying the plan's probe is the only write; paid with R2 unknown, unknown; control: no create call in any of the four", async () => {
  const cases = [
    [{ plan: "free" }, "not_ready", word("screen.install.check.plan.fix"), FIX_LINKS.plan.not_ready.url],
    [{ storage: "off" }, "not_ready", word("screen.install.check.card.storage"), FIX_LINKS.card.not_ready.url],
    [{}, "ready", word("screen.install.check.card.ok") + " " + word("screen.install.check.probe"), null],
    [{ storage: "other" }, "unknown", word("screen.install.check.unknown.fix", { cause: "The request could not be understood by R2" }), FIX_LINKS.card.unknown.url],
  ];
  for (const [opts, state, said, fix] of cases) {
    const w = await check("river-keepers", opts);
    const card = byId(linesOf(w.page.done)).card;
    assert.equal(card.state, state, JSON.stringify(opts));
    assert.ok(card.text.includes(said), JSON.stringify(opts));
    assert.equal(card.fix, fix, JSON.stringify(opts));
    assert.ok(writes(w).every((x) => x.includes("/workers/scripts/bio-plan-probe")), `no create call: ${writes(w)}`);
  }
});

/* ------------------------------------------------------------------------------------------------ R89 */

test("R89 \"Check again\" re-runs the check from the start with the choices kept, offered with every list; a run depends on no earlier one; a 429 that never mends on one read draws that line unknown with try-again-in-a-minute and the rest as they are; control: a ready account's repeated runs all draw ready", async () => {
  const choose = { profiles: [], securityVpc: "0123456789abcdef0123456789abcdef" };
  const first = await check("river-keepers", { plan: "free", choose });
  assert.equal(byId(linesOf(first.page.done)).plan.state, "not_ready");
  const again = dataBegin(first.page.done, "check-again");
  assert.deepEqual([again.mode, again.slug, again.securityVpc], ["check", "river-keepers", choose.securityVpc], "Check again begins the check again, with the choices");
  assert.ok(first.page.done.includes(word("screen.install.check.again")));
  /* The account changed between the runs: the second draws its own state. */
  const b = await begin("river-keepers", "check", again);
  const paid = await check("river-keepers", { cookie: b.cookie, state: b.state });
  assert.equal(byId(linesOf(paid.page.done)).plan.state, "ready");
  assert.ok(paid.page.done.includes('id="check-again"'), "offered with every list");

  const busy = byId(linesOf((await check("river-keepers", { cfFlaky: { status: 429, times: 100000, path: "/containers/applications" } })).page.done));
  assert.equal(busy.containers.state, "unknown");
  assert.ok(busy.containers.text.includes(word("screen.install.check.unknown.busy")));
  for (const id of ["plan", "limits", "name", "card"]) assert.equal(busy[id].state, "ready", id);

  for (let i = 0; i < 3; i++) assert.equal((await check("river-keepers")).page.done.match(/data-state="ready"/g).length, 6, "five lines and the whole");
});

/* ------------------------------------------------------------------------------------------------ R90 */

test("R90 Install now opens only on a passed check: a passed check sets chk (slug and instant only, HttpOnly, Secure, SameSite=Lax, 30 minutes); install /begin with none, an expired one or another slug's is refused CHECK_NOT_PASSED and creates nothing; with it, it proceeds; update and removal need none; R84 stopping what the check passed says it is rare; control: the cookie's decoded bytes", async () => {
  const good = await check("river-keepers");
  const set = good.r.headers.getSetCookie().find((c) => c.startsWith(`${CHECK_COOKIE}=`));
  assert.ok(set, "a passed check sets chk");
  for (const a of ["Path=/", "Max-Age=1800", "HttpOnly", "Secure", "SameSite=Lax"]) assert.ok(set.split("; ").includes(a), a);
  const value = set.split(";")[0].slice(CHECK_COOKIE.length + 1);
  const decoded = JSON.parse(Buffer.from(value, "base64url").toString());
  assert.deepEqual(Object.keys(decoded).sort(), ["slug", "t"], "slug and instant, nothing else");
  assert.equal(decoded.slug, "river-keepers");
  assert.ok(Math.abs(decoded.t - Date.now()) < 60e3);
  /* The ready list offers Install now, saying Cloudflare asks once more; a list not ready draws it closed. */
  assert.ok(!/id="install-now"[^>]*disabled/.test(good.page.done));
  assert.equal(dataBegin(good.page.done, "install-now").mode, "install");
  assert.ok(good.page.done.includes(word("screen.install.check.now.note")));
  const notReady = await check("river-keepers", { plan: "free" });
  assert.ok(/id="install-now"[^>]*disabled/.test(notReady.page.done));
  assert.ok(notReady.page.done.includes(word("screen.install.check.closed")));
  assert.ok(!notReady.r.headers.getSetCookie().some((c) => /^chk=(?!deleted)/.test(c)), "a check not passed sets no pass");

  /* The gate. */
  const calls = script([]);
  const none = await begin("river-keepers", "install", { chk: false });
  const old = await begin("river-keepers", "install", { chk: checkCookieValue("river-keepers", Date.now() - 31 * 60e3) });
  const other = await begin("river-keepers", "install", { chk: checkCookieValue("other-team", Date.now()) });
  globalThis.fetch = realFetch;
  for (const [what, b] of [["none", none], ["expired", old], ["another slug", other]]) {
    assert.equal(b.r.status, 400, what);
    assert.deepEqual([b.j.ok, b.j.code, b.j.error], [false, "CHECK_NOT_PASSED", word("refusal.CHECK_NOT_PASSED")], what);
    assert.equal(cookieOf(b.r), "", `${what}: no sign-in begun`);
  }
  assert.ok(word("refusal.CHECK_NOT_PASSED").includes(word("screen.install.check.title")), "the refusal names Check my account");
  assert.deepEqual(calls, [], "nothing is created");
  const passed = await begin("river-keepers", "install", { chk: value });
  assert.equal(passed.j.ok, true);
  const proceeds = await run({ slug: "river-keepers", cookie: passed.cookie, state: passed.state });
  assert.ok(proceeds.page.done.includes('id="out-boot"'), "with chk it proceeds to the callback and installs");
  for (const [mode, extra] of [["update", { version: RELEASE_VERSION }], ["remove", {}], ["removeconfirm", { typed: "river-keepers" }], ["check", {}]])
    assert.equal((await begin("river-keepers", mode, { chk: false, ...extra })).j.ok, true, `${mode} needs none`);

  /* After a pass, the account changed to the free plan: R84 stops the install, and the rare-case sentence is drawn. */
  const b = await begin("river-keepers");
  const rare = await run({ slug: "river-keepers", plan: "free", cookie: `${b.cookie}; ${passedCheck("river-keepers")}`, state: b.state });
  assert.ok(rare.page.failed.said.startsWith(word("screen.install.stopped.plan")));
  assert.equal(rare.page.says, word("screen.install.refused.rare"));
});

/* ------------------------------------------------------------------------------------------------ R91 */

test("R91 Get ready is R85's guide with Cloudflare's pages as buttons: each of the first three steps opens its page from GET_READY_LINKS in a new tab with what the founder will see there; the last ends with check your account; the first page's act begins a check; no field asks for a token or an id; the page makes no outbound call; control: the update page draws no Get-ready", async () => {
  assert.deepEqual([...GUIDE_STEPS], ["account", "plan", "storage", "signin"]);
  const calls = script([]);
  const home = await (await req("/")).text();
  const update = await (await req("/update?version=" + RELEASE_VERSION)).text();
  globalThis.fetch = realFetch;
  assert.deepEqual(calls, [], "the page makes no outbound call");
  for (const id of ["account", "plan", "storage"]) {
    const step = home.match(new RegExp(`<section class="guide-step"[^>]*data-step="${id}"[\\s\\S]*?</section>`))[0];
    const a = step.match(new RegExp(`<a [^>]*data-getready="${id}"[^>]*>([^<]*)</a>`));
    assert.ok(a, `${id} has its button`);
    assert.equal(unesc(a[0].match(/href="([^"]+)"/)[1]), GET_READY_LINKS[id].url);
    assert.ok(/target="_blank"/.test(a[0]) && /rel="noopener noreferrer"/.test(a[0]), "a new tab");
    assert.equal(unesc(a[1]), word(GET_READY_LINKS[id].key));
    assert.ok(has(step, `screen.install.getready.${id}.see`), "what the founder will see there");
  }
  const last = home.match(/<section class="guide-step"[^>]*data-step="signin"[\s\S]*?<\/section>/)[0];
  assert.ok(has(last, "screen.install.getready.done"));
  assert.ok(has(last, "act.owed_installcheck.label.install"), "the last step's act is the check");
  assert.ok(!/data-getready/.test(last));
  /* No field asks for a token or an account id. */
  for (const [, attrs] of home.matchAll(/<input\b([^>]*)>/g)) assert.ok(!/token|account/i.test(attrs), attrs);
  /* The first page's act begins a check, never an install. */
  const w = pageWorld(home);
  w.el("slug").value = "river-keepers";
  await w.el("go").click(); await w.el("confirm-yes").click(); await w.el("cloudflare").click();
  assert.deepEqual(w.sent.map((s) => [s.url, s.body.mode, s.body.slug]), [["/begin", "check", "river-keepers"]]);
  assert.ok(!home.includes('mode:"install"'));
  /* A founder answering "yes" goes on without the guide: the short name and its act are on the page apart from the guide. */
  assert.ok(home.includes('data-guide="yes"') && home.includes('id="stage-choose"'));
  /* Control: the update page draws no Get-ready. */
  assert.ok(!/data-getready|stage-guide/.test(update));
});

/* ------------------------------------------------------------------------------------------------ R92 */

test("R92 every link is data in one place: every cloudflare.com address a served page draws comes from GET_READY_LINKS or FIX_LINKS; every CHECK_LINES id has an entry for not_ready and unknown, and a ready line none; ui.mjs and guide.mjs hold no Cloudflare page of their own; control: the tables' URLs are what the pages draw", async () => {
  assert.ok(Object.isFrozen(GET_READY_LINKS) && Object.isFrozen(FIX_LINKS));
  for (const id of CHECK_LINES) {
    for (const st of ["not_ready", "unknown"]) {
      const f = FIX_LINKS[id][st];
      assert.ok(f && hasWord(f.fix_key) && /^https:\/\/dash\.cloudflare\.com\//.test(f.url), `${id} ${st}`);
    }
    assert.equal(FIX_LINKS[id].ready, undefined, `${id}: a ready line has no fix`);
  }
  assert.deepEqual(Object.keys(GET_READY_LINKS), GUIDE_STEPS.slice(0, 3));
  const tables = new Set([...Object.values(GET_READY_LINKS).map((l) => l.url), ...CHECK_LINES.flatMap((id) => CHECK_STATES.slice(1).map((s) => FIX_LINKS[id][s].url))]);
  const pages = [await (await req("/")).text(), await (await req("/update?version=" + RELEASE_VERSION)).text(),
    (await check("river-keepers", { plan: "free", pre: { "river-keepers": [] }, preClasses: FULL })).page.done,
    (await check("river-keepers", { containersOdd: true, storage: "off" })).page.done];
  const drawn = new Set();
  for (const p of pages) for (const [, url] of p.matchAll(/href="([^"]+)"/g)) if (/cloudflare\.com/.test(unesc(url))) drawn.add(unesc(url));
  assert.ok(drawn.size >= 5);
  for (const url of drawn) assert.ok(tables.has(url), `${url} comes from the tables`);
  for (const f of ["ui.mjs", "guide.mjs"]) assert.ok(!/https?:\/\/[^"'`\s]*cloudflare\.com/.test(readFileSync(new URL(f, SRC), "utf8")), `${f} holds no Cloudflare page`);
  /* Control: each fix button opens exactly the table's page for its line and state, in a new tab. */
  for (const l of linesOf(pages[2]).concat(linesOf(pages[3]))) if (l.fix) assert.ok(/target="_blank" rel="noopener noreferrer"/.test(l.fixAttrs), l.id);
  const P = byId(linesOf(pages[2]));
  for (const id of ["plan", "limits", "name"]) assert.equal(P[id].fix, FIX_LINKS[id].not_ready.url, id);
  assert.equal(P.card.fix, FIX_LINKS.plan.not_ready.url, "a card not ready for the plan opens the plan's page (R88)");
  const L = byId(linesOf(pages[3]));
  assert.equal(L.containers.fix, FIX_LINKS.containers.unknown.url);
  assert.equal(L.card.fix, FIX_LINKS.card.not_ready.url);
});

/* ------------------------------------------------------------------------------------------------ R93 */

test("R93 words by key: every key the list, the gate and CHECK_NOT_PASSED read resolves and is in the installer's KEYS; the drawn list holds no sentence of English beside the keys' words; control: the update page is unchanged by the check", async () => {
  const read = new Set();
  for (const f of ["ready.mjs", "index.mjs", "guide.mjs", "ui.mjs"]) {
    const src = readFileSync(new URL(f, SRC), "utf8");
    for (const m of src.matchAll(/"((?:screen\.install\.(?:check|getready|refused)|refusal\.CHECK_NOT_PASSED|act\.owed_installcheck)[a-z0-9_.A-Z-]*)"/g)) read.add(m[1]);
  }
  for (const id of CHECK_LINES) read.add(`screen.install.check.${id}.name`);
  assert.ok(read.size >= 30, `${read.size} keys`);
  for (const k of read) {
    assert.ok(hasWord(k), `${k} resolves`);
    assert.ok(KEYS.includes(k), `${k} is in the list the bundle is cut to`);
  }
  /* R79's stub, from the other side: take every key's words out of a drawn list; no run of three English words is left. */
  const rows = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
  const flat = (h) => unesc(h.replace(/<script>[\s\S]*?<\/script>/g, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
  const pats = KEYS.map((k) => rows.get(k)).filter((t) => typeof t === "string" && t.length > 1).sort((a, b) => b.length - a.length)
    .map((t) => new RegExp(t.split(/\{[A-Za-z0-9_]+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")).join(".{0,200}?"), "g"));
  for (const opts of [{}, { plan: "free", pre: { "river-keepers": [] }, preClasses: FULL }, { containersOdd: true, probeDelete: "fail" }]) {
    let rest = " " + flat((await check("river-keepers", opts)).page.done) + " ";
    for (const re of pats) rest = rest.replace(re, " ◆ ");
    const english = [...rest.matchAll(/(?:(?<![\w.-])[a-z][a-z'’]+(?![\w-]|\.\w)[ ,;:.]*){3,}/g)].map((m) => m[0]);
    assert.deepEqual(english, [], JSON.stringify(opts));
  }
  /* Control: the update page carries none of the check's words. */
  const update = await (await req("/update?version=" + RELEASE_VERSION)).text();
  assert.ok(!update.includes(word("screen.install.check.title")) && !update.includes(word("screen.install.getready.done")));
});
