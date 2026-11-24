/* T50's L11 fold: R56–R73. The module at its interface, driven through its own routes against the stateful fake account of
 * `fixture.mjs`; each requirement is named in its test's title, and each test keeps its control beside it. R56 and R58 are
 * named here and not met (they wait on the remote proof, BOB's K3777: accepted red by name). */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as installer from "../src/index.mjs";
import { CFG } from "../src/index.mjs";
import { word, hasWord, KEYS } from "../src/words.mjs";
import { bootstrapVersions } from "../../bio-plane/test/m/credentials/fixtures.mjs";
import { fleetReports, bootstrapFacts } from "../../bio-plane/test/m/instance-setup/fixtures.mjs";
import { WAIT_BOUND_MINUTES } from "../src/steps/api.mjs";
import { ASSISTANT_NEEDS, ASSISTANT_OFFER } from "../src/ui.mjs";
import { partsLeftOut, leftOutNotice } from "../src/images.mjs";
import { IMAGE_UNPULLABLE } from "../src/steps/images.mjs";
import { RELEASE_VERSION, RELEASE_CONTAINERS } from "../src/release.mjs";
import { FLEET_BINDINGS, HOSTING_CONTROL } from "../../bio-plane/src/setup-fleet.mjs";
import { WORD_ROWS } from "../../bio-plane/src/setup-words/rows.mjs";
import { req, run, begin, cookieValue, release, armWith, restoreSigners, SIGNER, bump, heldCopy, heldCopies, DESCRIPTOR, DEFAULT_VERSION,
  CAPABLE_SRC, RUNNER, SCANNER, SCANNER_CLASSES, bindingOf, jres, headOf, like } from "./fixture.mjs";

after(restoreSigners);
const NEXT = bump(RELEASE_VERSION);
const MEMBERS = FLEET_BINDINGS.map(([m]) => m);
const strip = (html) => (html || "").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ")
  .replace(/&#39;/g, "'").replace(/&ldquo;|&rdquo;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
/* The calls that wrote something to the account: everything but the exchange of the sign-in code. */
const writes = (w) => w.calls.filter((c) => c.method !== "GET" && c.u !== CFG.TOKEN).map((c) => `${c.method} ${c.u.replace(CFG.API, "")}`);
const metaOf = async (w, name) => {
  const c = w.calls.filter((x) => x.method === "PUT" && x.u.endsWith("/workers/scripts/" + name)).at(-1);
  return c ? JSON.parse(await c.init.body.get("metadata").text()) : null;
};
const planeBase = (slug, v = "0.1.0") => [{ type: "durable_object_namespace", name: "STORE", class_name: "Store" },
  { type: "plain_text", name: "VERSION", text: v }, { type: "secret_text", name: "ADMIN_TOKEN", text: "admin-kept" },
  { type: "secret_text", name: "PROBE_TOKEN", text: "probe-kept" }, { type: "service", name: "SELF", service: slug }];
/* The installer's own counts from Cloudflare's API, as the exists page and the removal page say them (R63, R76: a plural pair by the number). */
const counted = ({ workers, containers, captured, published }) => [word(`installer.fallback.programs.${workers === 1 ? "one" : "other"}`, { n: workers }),
  word(`installer.fallback.containers.${containers === 1 ? "one" : "other"}`, { n: containers }), word(`installer.fallback.captured.${captured === 1 ? "one" : "other"}`, { n: captured }),
  word(`installer.fallback.published.${published === 1 ? "one" : "other"}`, { n: published })].join(", ");
/* The facts a held copy tells (instance-setup R95): the real `bootstrapfacts` answer, for the team and counts these arms state. */
const TEAM = await bootstrapFacts({ team: "Lakeshore Tenants", members: 6, projects: 3, documents: 412, published: 1 });

/* ------------------------------------------------------------------------------------------ the two not yet met */

test.todo("R56 the install and the update bind agent-worker's REMOTE Durable Object and DOOR_ADDRESS, and no RUNNER (not yet met: the remote proof, BOB's K3777)");
test.todo("R58 verify names the remote Worker among the parts and says whether it answers this release (not yet met: the remote proof, BOB's K3777)");

/* ------------------------------------------------------------------------------------------------ R57 */

test("R57 no page ties the assistant to a container: the Containers permission is named for the file scanner and the safe view, the assistant's prerequisite is a Claude plan with cloud sessions, and agent-runner's absence names nothing the assistant lacks; control: the file scanner is still named with what it lacks", async () => {
  const done = await run({ slug: "r57-run" });
  const pages = [await (await req("/")).text(), await (await req("/update?version=" + NEXT)).text(), await (await req("/nowhere")).text(),
    readFileSync(new URL("../../bio-plane/public/newgroup/index.html", import.meta.url), "utf8"), done.raw, done.page.words];
  for (const page of pages) {
    const sentences = strip(page).split(/(?<=[.!?])\s+/);
    for (const s of sentences) assert.ok(!(/\bassistant\b/i.test(s) && /\bcontainers?\b/i.test(s)), `a sentence ties the assistant to a container: ${s}`);
  }
  assert.ok(strip(pages[0]).includes(word("installer.assistant.needs")), "the assistant's prerequisite is a Claude plan with cloud sessions");
  assert.equal(ASSISTANT_NEEDS, word("installer.assistant.needs"));
  assert.ok(ASSISTANT_OFFER.length > 0);
  /* agent-runner is installed as R38 says; left out, it is named with its reason and nothing the assistant lacks. */
  const left = [{ member: RUNNER, class_name: "AgentRunner", image: "ghcr.io/x/agent-runner@sha256:" + "a".repeat(64) }];
  assert.deepEqual(partsLeftOut(left), []);
  /* Control: a container member that provides something (file-scanner) is named with what the copy then lacks. */
  const scanner = [{ member: SCANNER, class_name: "FileScanner", image: "ghcr.io/x/file-scanner@sha256:" + "b".repeat(64) }];
  assert.deepEqual(partsLeftOut(scanner).map((p) => p.member), [SCANNER]);
  assert.equal(partsLeftOut(scanner)[0].why, IMAGE_UNPULLABLE);
  assert.ok(strip(leftOutNotice(scanner, "9.9.9")).includes(word("installer.image.lacks.scanner")), "what the copy then lacks");
});

/* ------------------------------------------------------------------------------------------------ R59 */

test("R59 the install and the update bind agent-worker's SEGMENTS (class SegmentDriver, migration v1) and CHECKS (class CheckRecord, migration v2), both migrations in order; control: no other member carries either, and an upload without them is not accepted by this test", async () => {
  const bindsBoth = (meta) => {
    const dos = (meta?.bindings || []).filter((b) => b.type === "durable_object_namespace");
    const migrated = (meta?.migrations?.steps || []).flatMap((s) => s.new_sqlite_classes);
    return dos.some((b) => b.name === "SEGMENTS" && b.class_name === "SegmentDriver") && dos.some((b) => b.name === "CHECKS" && b.class_name === "CheckRecord")
      && JSON.stringify(migrated) === JSON.stringify(["SegmentDriver", "CheckRecord"]) && meta.migrations.new_tag === "v2";
  };
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  const inst = await run({ slug: "r59-install", rel });
  assert.ok(bindsBoth(await metaOf(inst, "agent-worker-r59-install")), "the install's upload carries both bindings and both migrations in order");
  /* An update of a copy that holds only the first migration (tag v1) takes the second, from that tag. */
  const old = [{ type: "plain_text", name: "VERSION", text: "0.1.0" }];
  const held = { "r59-update": planeBase("r59-update"), "agent-worker": old, "pdf-worker": old };
  const upd = await run({ slug: "r59-update", mode: "update", rel, pre: held, preClasses: { "agent-worker": ["SegmentDriver"] }, preTags: { "agent-worker": "v1" } });
  const m = await metaOf(upd, "agent-worker");
  assert.deepEqual(m.migrations, { old_tag: "v1", new_tag: "v2", steps: [{ new_sqlite_classes: ["CheckRecord"] }] }, "only the step after the tag it holds, from that tag");
  assert.ok(m.bindings.some((b) => b.name === "SEGMENTS") && m.bindings.some((b) => b.name === "CHECKS"));
  /* An update of a copy that holds neither takes both, in order. */
  const none = await run({ slug: "r59-none", mode: "update", rel, pre: { "r59-none": planeBase("r59-none"), "agent-worker": old } });
  assert.ok(bindsBoth(await metaOf(none, "agent-worker")));
  /* One that already holds the last step is sent no migration, and keeps its bindings. */
  const done = await run({ slug: "r59-done", mode: "update", rel, pre: { "r59-done": planeBase("r59-done"), "agent-worker": old },
    preClasses: { "agent-worker": ["SegmentDriver", "CheckRecord"] }, preTags: { "agent-worker": "v2" } });
  assert.equal((await metaOf(done, "agent-worker")).migrations, undefined);
  /* Control: no other member carries either binding, and an upload without them fails this test by name. */
  for (const member of MEMBERS.filter((x) => x !== "agent-worker")) {
    const other = await metaOf(inst, `${member}-r59-install`);
    assert.ok(!(other?.bindings || []).some((b) => b.name === "SEGMENTS" || b.name === "CHECKS"), member);
    assert.equal(bindsBoth(other), false, `${member}: a member upload without both fails the check`);
  }
  assert.equal(installer.objectMigrations(null), null);
  restoreSigners();
});

/* ------------------------------------------------------------------------------------------------ R60 */

test("R60 a container part naming an instance_type is created with it, per class; control: a part naming none is created without the field", async () => {
  armWith(SIGNER.line);
  const sized = await run({ slug: "r60-sized", rel: await release({ version: NEXT, container: true, descriptor: { ...DESCRIPTOR, instance_type: "standard-1" } }) });
  assert.equal(sized.apps.length, 1);
  assert.equal(sized.apps[0].configuration.instance_type, "standard-1");
  const bare = await run({ slug: "r60-bare", rel: await release({ version: NEXT, container: true }) });
  assert.equal(bare.apps.length, 1);
  assert.equal("instance_type" in bare.apps[0].configuration, false, "none stated, none guessed");
  /* Per class: the two classes of file-scanner each take their own. */
  const two = await run({ slug: "r60-two", rel: await release({ version: NEXT, scanner: true, scannerParts: {
    "container/FileScanner.json": { class_name: "FileScanner", image: "docker.io/civicos/file-scanner-scanner@sha256:" + "d".repeat(64), scheduling_policy: "default", max_instances: 3, instance_type: "basic", bind: [{ member: SCANNER, binding: "SCANNER" }] } } }) });
  const byName = Object.fromEntries(two.apps.map((a) => [a.name, a.configuration]));
  assert.equal(byName["file-scanner-filescanner-r60-two"].instance_type, "basic");
  assert.equal("instance_type" in byName["file-scanner-safeviewrenderer-r60-two"], false);
  restoreSigners();
});

/* ------------------------------------------------------------------------------------------------ R61 */

test("R61 every part comes from one release's own signed fleet statement: the built-in release installs its own members and the finished panel lists each part with its version; control: a plane paired with another release's statement installs no member and names why, and a member not in the statement is not installed", async () => {
  restoreSigners();
  const own = await run({ slug: "r61-own", rel: null, builtInFleet: true });
  const parts = [...own.page.done.matchAll(/<span class="mono">([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.equal(parts[0], `civicsmith ${RELEASE_VERSION}`, "the plane, from the release R8 chose");
  const installed = MEMBERS.filter((m) => own.acct.has(`${m}-r61-own`));
  assert.ok(installed.includes("pdf-worker") && installed.includes("agent-worker"), "its own members");
  for (const m of installed) assert.ok(parts.includes(`${m} ${RELEASE_VERSION}`), `${m} is listed with its version`);
  assert.equal(parts.length, installed.length + 1, "the list is exactly what was installed");
  assert.ok(!own.calls.some((c) => c.u.startsWith(CFG.RELEASE_LATEST) && /-worker\.bundled\.mjs$/.test(c.u)), "none of the repository's members");
  /* Control: the built-in's statement paired with parts built elsewhere (the repository serving the built-in's version with other
     bytes) installs no member, each named for its integrity. */
  const paired = await run({ slug: "r61-paired", rel: await release({ version: RELEASE_VERSION }), builtInFleet: true });
  for (const m of MEMBERS) assert.ok(!paired.acct.has(`${m}-r61-paired`), m);
  assert.match(paired.page.label("fleet"), like("installer.fleet.why.integrity"));
  assert.ok(paired.page.done, "the plane still installed");
  /* Control: a member the statement does not name is not installed, whatever the repository serves. */
  armWith(SIGNER.line);
  const extra = await release({ version: NEXT, members: [...MEMBERS] });
  extra.assets["extra-worker.bundled.mjs"] = "export default {};";
  const w = await run({ slug: "r61-extra", rel: extra });
  assert.ok(!w.acct.has("extra-worker-r61-extra") && !w.acct.has("extra-worker"));
  restoreSigners();
});

/* ------------------------------------------------------------------------------------------------ R62 */

test("R62 an account that already holds a Civicsmith is told and offered three ways on, and nothing is created or changed; each choice begins its own path with a new consent; control: with no choice made nothing changed", async () => {
  const h = heldCopy({ slug: "mine-one" });
  const w = await run({ slug: "other-two", ...h });
  assert.equal(w.page.status("fresh"), "no");
  assert.equal(w.page.label("fresh"), word("screen.install.stopped.exists"));
  const done = w.page.done;
  assert.ok(done.includes(word("screen.install.exists.title")));
  for (const k of ["update", "alongside", "remove"]) assert.ok(done.includes(word(`screen.install.exists.${k}.name`)), k);
  /* Nothing created or changed: no write at all, the account exactly as it was, no plane upload. */
  assert.deepEqual(writes(w), [], "control: with no choice made nothing is changed");
  assert.deepEqual([...w.acct.keys()].sort(), Object.keys(h.pre).sort());
  assert.deepEqual([...w.buckets].sort(), h.preBuckets.slice().sort());
  assert.equal(w.planePuts.length, 0);
  /* Each choice is a new POST /begin carrying it, in R2's cookie. */
  const begins = [...done.matchAll(/data-begin="([^"]*)"/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"')));
  assert.deepEqual(begins.map((b) => b.mode), ["update", "install", "remove"]);
  assert.deepEqual(begins[0], { mode: "update", slug: "mine-one", version: begins[0].version });
  assert.ok(/^\d+\.\d+\.\d+$/.test(begins[0].version), "R55 requires its version V");
  assert.equal(begins[1].alongside, true);
  const cookies = [];
  cookies.push(cookieValue((await begin("mine-one", "update", { version: begins[0].version })).cookie));
  cookies.push(cookieValue((await begin("third-one", "install", { alongside: true })).cookie));
  cookies.push(cookieValue((await begin("mine-one", "remove")).cookie));
  assert.deepEqual(cookies.map((c) => [c.mode, c.slug]), [["update", "mine-one"], ["install", "third-one"], ["remove", "mine-one"]]);
  assert.equal(cookies[1].al, 1);
  /* The update choice runs the update of that copy; the alongside choice installs beside it; the remove choice draws its page. */
  const upd = await run({ slug: "mine-one", mode: "update", ...h });
  assert.equal(upd.page.status("up"), "ok");
  const beside = await run({ slug: "third-one", alongside: true, ...h });
  assert.equal(beside.page.status("install"), "ok");
  const rem = await run({ slug: "mine-one", mode: "remove", ...h });
  assert.ok(rem.page.done.includes(word("screen.install.remove.title")) || strip(rem.raw).includes(word("screen.install.remove.title")));
  /* A finished copy under per-slug names is told from a copy this installer has begun and not finished: the latter is continued, not offered. */
  const unfinished = heldCopy({ slug: "mine-one", finished: false });
  const cont = await run({ slug: "mine-one", ...unfinished });
  assert.notEqual(cont.page.label("fresh"), word("screen.install.stopped.exists"), "an unfinished copy of this slug is continued");
  assert.equal(cont.page.status("fresh"), "ok");
});

/* ------------------------------------------------------------------------------------------------ R63 */

test("R63 the page draws whose it is, its release and what it holds as that copy's own worker answers; a fact it does not answer is not known, with the reason; with no counts the installer's own from Cloudflare are drawn and said; control: a silent copy draws each as not known and still offers the three ways", async () => {
  const h = heldCopy({ slug: "mine-one" });
  const known = await run({ slug: "other-two", ...h, copy: { held: { "mine-one": TEAM } } });
  const p = strip(known.page.done);
  assert.ok(p.includes(word("screen.install.exists.whose", { team: "Lakeshore Tenants", address: "https://mine-one.grp.workers.dev" })));
  assert.ok(p.includes(word("screen.install.exists.release", { release: "0.80.0", date: TEAM.installed_at.slice(0, 10), used: TEAM.last_used_at.slice(0, 10) })));
  assert.ok(p.includes(word("screen.install.exists.holds", { holdings: "3 projects, 412 documents, 1 published case, 6 members" })));
  /* Asked once, with no credential. */
  const asked = known.calls.filter((c) => c.u.includes("mine-one.grp.workers.dev"));
  assert.equal(asked.length, 1);
  assert.equal(asked[0].init?.headers?.authorization, undefined);
  /* A copy that answers without a fact (an older release, or one that withholds the facts from a caller with no credential, R95): the fact is
     not known, and nothing is claimed of its release (K3864): `.short`, never `.older`. */
  const older = await run({ slug: "other-two", ...h, copy: { held: { "mine-one": { team_name: "Old Team" } } } });
  const po = strip(older.page.done);
  assert.ok(po.includes(word("installer.fact.unknown.installed", { reason: word("installer.fact.unknown.short") })));
  assert.ok(po.includes(word("installer.fact.unknown.counts", { reason: word("installer.fact.unknown.short") })));
  assert.ok(!po.includes(word("installer.fact.unknown.older")) && !po.includes(word("installer.fact.unknown.silent")), "a copy that answered is never said not to have, nor to be older");
  /* Control: a silent copy: each fact not known with the reason; the installer's own counts in place of the team's; the three ways. */
  const silent = await run({ slug: "other-two", ...h, copy: { silent: true }, objects: { "bio-captures-mine-one": ["a", "b", "c"] } });
  const ps = strip(silent.page.done);
  assert.ok(ps.includes(word("installer.fact.unknown.counts", { reason: word("installer.fact.unknown.silent") })));
  assert.ok(ps.includes(word("screen.install.exists.holds", { holdings: counted({ workers: 4, containers: 0, captured: 3, published: 0 }) })), "the installer's own counts from Cloudflare");
  assert.ok(ps.includes(word("installer.fallback.note")), "and the team's own were not available");
  assert.ok(ps.includes(word("screen.install.exists.update.name")) && ps.includes(word("screen.install.exists.alongside.name")) && ps.includes(word("screen.install.exists.remove.name")));
  assert.deepEqual(writes(silent), []);
});

/* ------------------------------------------------------------------------------------------------ R64 */

test("R64 installing alongside uses names no other copy holds: two installs into one account hold disjoint names and neither changes the other's bytes, bindings or buckets; control: an install under a slug a copy already holds is refused before anything is created, and a copy under the older fixed names is neither read nor changed", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  const first = await run({ slug: "first-one", rel });
  assert.equal(first.page.status("install"), "ok");
  const firstState = Object.fromEntries(first.acct);
  const firstSources = Object.fromEntries(first.sources);
  const second = await run({ slug: "second-one", alongside: true, rel, pre: firstState, preBuckets: [...first.buckets], preClasses: Object.fromEntries(first.classes),
    preSources: firstSources, preTags: Object.fromEntries(first.tags) });
  assert.equal(second.page.status("install"), "ok");
  const names = (w, tag) => [...w.acct.keys()].filter((k) => k.endsWith(`-${tag}`) || k === tag);
  assert.ok(names(second, "second-one").length >= 2);
  const mine = new Set(names(second, "second-one"));
  for (const k of names(first, "first-one")) assert.ok(!mine.has(k), `${k} is the first copy's`);
  assert.deepEqual([...second.buckets].filter((b) => b.endsWith("second-one")).sort(), ["bio-captures-second-one", "bio-published-second-one"]);
  /* Neither changes the other: the first copy's scripts and buckets are exactly as they were. */
  for (const [k, v] of Object.entries(firstState)) if (k !== "bio-install-lock") assert.deepEqual(second.acct.get(k), v, `${k} unchanged`);
  for (const b of first.buckets) assert.ok(second.buckets.has(b), b);
  assert.ok(!second.calls.some((c) => c.method !== "GET" && /first-one/.test(c.u)), "nothing the first copy holds was written");
  /* Each member that reads captured bytes is bound to its own copy's CAPTURES bucket (R13). */
  const scannerMeta = await metaOf(second, `${SCANNER}-second-one`);
  if (scannerMeta) assert.ok((scannerMeta.bindings || []).filter((b) => b.name === "CAPTURES").every((b) => b.bucket_name === "bio-captures-second-one"));
  /* The plane's service bindings and every member's PLANE binding target that slug's workers. */
  const planeB = second.acct.get("second-one");
  for (const [m, b] of FLEET_BINDINGS) assert.equal(planeB.find((x) => x.name === b)?.service, `${m}-second-one`, b);
  assert.equal(second.acct.get("agent-worker-second-one").find((x) => x.name === "PLANE")?.service, "second-one");
  /* Control: a slug a copy already holds is refused before anything is created. */
  const clash = await run({ slug: "first-one", alongside: true, rel, pre: firstState, preBuckets: [...first.buckets], preClasses: Object.fromEntries(first.classes) });
  assert.equal(clash.page.status("fresh"), "no");
  assert.equal(clash.page.failed.said, word("screen.install.stopped.nametaken", { name: "first-one" }));
  assert.deepEqual(writes(clash), []);
  /* Control: a copy under the older fixed names is no collision and is neither read nor changed. */
  const legacy = heldCopy({ slug: "old-one", scheme: "legacy" });
  const beside = await run({ slug: "new-one", alongside: true, rel, ...legacy });
  assert.equal(beside.page.status("install"), "ok");
  for (const [k, v] of Object.entries(legacy.pre)) assert.deepEqual(beside.acct.get(k), v, `${k} unchanged`);
  assert.ok(beside.buckets.has("bio-captures") && beside.buckets.has("bio-captures-new-one"));
  assert.ok(!beside.calls.some((c) => c.u.includes("old-one.grp.workers.dev")), "the older copy is not even asked");
  restoreSigners();
});

/* ------------------------------------------------------------------------------------------------ R65 */

test("R65 removal is guided, confirmed and complete: the page lists what would be deleted and deletes nothing; only the short name typed exactly confirms; the confirmation deletes every resource the copy holds, names each, and offers the new install; a refusal names what remains; control: installremove alone deletes nothing, a wrong name deletes nothing", async () => {
  const h = heldCopy({ slug: "mine-one" });
  /* The copy being removed is the run's own slug, so it answers as the copy of the run does. */
  const view = await run({ slug: "mine-one", mode: "remove", ...h, copy: { bootstrap: async () => jres({ ...(await bootstrapVersions({ storeVersion: "0.80.0" })), ...TEAM }) } });
  const pv = strip(view.page.done);
  assert.ok(pv.includes(word("screen.install.remove.lost.records", { team: "Lakeshore Tenants", holdings: "3 projects, 412 documents, 1 published case, 6 members" })), "the holdings equal what R63 reads");
  for (const k of ["lost.members", "lost.published", "lost.address", "keep", "type.label"]) assert.ok(pv.includes(word("screen.install.remove." + k)), k);
  assert.ok(pv.includes(word("screen.install.remove.type.help", { slug: "mine-one" })));
  assert.deepEqual(writes(view), [], "control: installremove alone deletes nothing");
  assert.deepEqual([...view.acct.keys()].sort(), Object.keys(h.pre).sort());
  assert.match(view.page.done, /id="confirm-remove"[^>]*disabled/, "the act is disabled until the short name is typed");
  /* A silent copy lists the installer's own counts, and says the team's own were unavailable. */
  const silent = await run({ slug: "mine-one", mode: "remove", ...h, copy: { silent: true }, objects: { "bio-captures-mine-one": ["a", "b"] } });
  assert.ok(strip(silent.page.done).includes(counted({ workers: 4, containers: 0, captured: 2, published: 0 })));
  assert.ok(strip(silent.page.done).includes(word("installer.fact.unknown.counts", { reason: word("installer.fact.unknown.silent") })));
  /* Only the typed short name, exactly, reaches the removal. */
  for (const typed of ["", "mine-on", "MINE-ONE", "mine-one "]) {
    const r = await req("/begin", { method: "POST", body: JSON.stringify({ slug: "mine-one", mode: "removeconfirm", typed }) });
    assert.equal(r.status, 400, JSON.stringify(typed));
  }
  /* The confirmation: the account holds none of the copy's resources, each deletion is named, and the new install is offered. */
  const exact = await req("/begin", { method: "POST", body: JSON.stringify({ slug: "mine-one", mode: "removeconfirm", typed: "mine-one" }) });
  assert.equal(exact.status, 200, "control: the short name exactly");
  const gone = await run({ slug: "mine-one", mode: "removeconfirm", typed: "mine-one", ...h, objects: { "bio-captures-mine-one": ["a", "b"] } });
  assert.deepEqual([...gone.acct.keys()].filter((k) => k !== "bio-install-lock"), [], "no worker of the copy remains");
  assert.deepEqual([...gone.buckets], [], "no bucket remains");
  assert.deepEqual(gone.bucketObjects.get("bio-captures-mine-one"), [], "the objects were deleted with the bucket");
  for (const name of ["mine-one", ...MEMBERS.filter((m) => h.pre[`${m}-mine-one`]).map((m) => `${m}-mine-one`), "bucket:bio-captures-mine-one", "bucket:bio-published-mine-one"])
    assert.ok(gone.removed.includes(name), `${name} deleted`);
  assert.ok(gone.page.events.filter((e) => e.k === "ok" && e.label).some((e) => e.label === word("installer.remove.progress", { what: "mine-one" })), "each deletion is named");
  assert.ok(gone.page.done.includes(word("act.bootstrap.label.install")) && gone.page.done.includes('id="after-remove"'), "the new install is offered");
  assert.ok(strip(gone.page.done).includes(word("installer.removed.what", { team: "mine-one" })) && strip(gone.page.done).includes(word("installer.removed.next")), "what was removed, and that the account is clear");
  assert.equal(gone.page.says, word("installer.remove.done", { n: gone.removed.filter((x) => x !== "bio-install-lock").length }), "how many parts were deleted");
  /* A refusal names what remains, and the rest stays. */
  const refused = await run({ slug: "mine-one", mode: "removeconfirm", typed: "mine-one", ...h, refuseDelete: ["pdf-worker-mine-one"] });
  assert.ok(refused.acct.has("pdf-worker-mine-one"), "the refused resource remains");
  const text = `${refused.page.failed?.said ?? ""} ${refused.page.failed?.d ?? ""} ${strip(refused.page.words)}`;
  assert.ok(text.includes("pdf-worker-mine-one"), "the stop names what remains");
  assert.ok(!refused.page.done || !refused.page.done.includes('id="after-remove"'), "the new install is not offered while a resource remains");
});

/* ------------------------------------------------------------------------------------------------ R66 */

test("R66 waits are sized for a cold start and never report a not-yet-ready step as failed: an address that answers after the third try ends done; one that never answers ends a named failure with one action; a 429 then a 200 completes; the bound is the stated minutes", async () => {
  assert.equal(WAIT_BOUND_MINUTES, 5, "the bound BOB set (K3777)");
  const slow = await run({ slug: "r66-slow", wakeAfter: 3 });
  assert.equal(slow.page.status("verify"), "ok", "never 'not done' while the address is still waking");
  assert.ok(slow.page.done);
  assert.ok(slow.page.waits.some((t) => t === word("screen.install.progress.retrying", { minutes: WAIT_BOUND_MINUTES })), "the wait is drawn with its bound");
  /* Control: one that never answers ends a named failure with one action. */
  const never = await run({ slug: "r66-never", silentAddress: true });
  assert.equal(never.page.status("verify"), "no");
  assert.ok(never.page.label("verify").includes(word("screen.install.stopped.lasting")));
  assert.ok(never.page.label("verify").includes(word("screen.install.stopped.lasting.do")), "one action");
  /* A Cloudflare answer that is rate-limited or transiently failed is backed off and retried, with the wait drawn. */
  for (const [status, label] of [[429, "a 429"], [503, "a 503"]]) {
    const flaky = await run({ slug: "r66-flaky", cfFlaky: { status, times: 2, path: "/r2/buckets", method: "POST" } });
    assert.equal(flaky.page.status("r2"), "ok", `${label} then a 200 completes`);
    assert.ok(flaky.page.done, label);
    assert.ok(flaky.page.waits.length >= 1, `${label}: the wait is drawn`);
  }
  /* One that never comes right within the bound is a lasting failure, in plain words with one action. */
  const dead = await run({ slug: "r66-dead", cfFlaky: { status: 503, times: 100000, path: "/r2/buckets", method: "POST" } });
  assert.equal(dead.page.failed.said, word("screen.install.stopped.lasting"));
  assert.equal(dead.page.failed.d, word("screen.install.stopped.lasting.do"));
  assert.deepEqual([...dead.buckets], [], "nothing half-made");
});

/* ------------------------------------------------------------------------------------------------ R67 */

test("R67 'done' is judged by the whole deployed state: an upload with identical bytes and a missing binding is not skipped; identical bytes with every binding is left as it is; a container still serving the old image is restarted and then confirmed; control: an update whose new version does not answer is not reported done, and is put back", async () => {
  /* A copy begun and not finished, holding exactly this release's bytes. */
  const stateOf = (drop) => {
    const h = heldCopy({ slug: "sync-one", finished: false, members: [], version: DEFAULT_VERSION });
    if (drop) h.pre["sync-one"] = h.pre["sync-one"].filter((b) => b.name !== drop);
    return h;
  };
  const same = await run({ slug: "sync-one", ...stateOf(null), preSources: { "sync-one": CAPABLE_SRC } });
  assert.equal(same.page.label("install"), word("installer.install.inplace"));
  assert.equal(same.planePuts.length, 1, "only the last restatement of the plane, no upload at the install step");
  assert.ok(same.secretPuts.includes("sync-one/ADMIN_TOKEN"), "its credentials are stated by secret, not by upload");
  /* Control: the same bytes with a binding missing are applied. */
  for (const drop of ["SELF", "BROWSER", "CAPTURES"]) {
    const missing = await run({ slug: "sync-one", ...stateOf(drop), preSources: { "sync-one": CAPABLE_SRC } });
    assert.notEqual(missing.page.label("install"), same.page.label("install"), `${drop}: not skipped`);
    assert.ok(missing.planePuts.length >= 1 && missing.planePuts[0].meta.bindings.some((b) => b.name === drop), `${drop}: applied`);
  }
  /* Other bytes, all bindings: uploaded. */
  const other = await run({ slug: "sync-one", ...stateOf(null), preSources: { "sync-one": CAPABLE_SRC + "\n/* older */" } });
  assert.ok(other.planePuts.length >= 1 && other.page.label("install") !== same.page.label("install"));
  /* A container still serving the old image is restarted (a rollout to the release's digest) and then confirmed. */
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, container: true });
  const old = [{ type: "plain_text", name: "VERSION", text: "0.1.0" }];
  const pre = { "upd-box": planeBase("upd-box"), [RUNNER]: old, "agent-worker": old, "pdf-worker": old, "ocr-worker": old, "sheet-worker": old };
  const box = (extra) => run({ slug: "upd-box", mode: "update", rel, pre, preClasses: { [RUNNER]: ["AgentRunner"] },
    preApps: [{ id: "app9", name: RUNNER, configuration: { image: "docker.io/civicos/agent-runner@sha256:" + "f".repeat(64) } }], ...extra });
  const restarted = await box({});
  assert.deepEqual(restarted.rollouts.map((r) => r.target_configuration.image), [DESCRIPTOR.image]);
  assert.equal(restarted.page.status("verify"), "ok");
  assert.ok(strip(restarted.page.done).includes(word("installer.update.done.title")));
  /* Control: an update whose new version does not answer is not reported done, and the copy is put back where it was. */
  const silent = await run({ slug: "upd-silent", mode: "update", rel, pre: { "upd-silent": planeBase("upd-silent") }, silentAddress: true });
  assert.equal(silent.page.failed.said, word("installer.update.stopped.noanswer", { version: word("installer.update.unread") }), "the release before could not be read either: the address is silent");
  assert.deepEqual(silent.rolledBack.map((r) => r.name), ["upd-silent"], "put back through the deployments API");
  assert.ok(!silent.page.done, "never reported done");
  restoreSigners();
});

/* ------------------------------------------------------------------------------------------------ R68 */

test("R68 an update that left a container's old image running is not done: the deployed image is read back and compared with the digest the release names; agent-worker is confirmed through the plane's binding; control: a matching digest is accepted, and a part that does not answer is named, not shown as a warning", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, container: true });
  const old = [{ type: "plain_text", name: "VERSION", text: "0.1.0" }];
  const pre = { "img-box": planeBase("img-box"), [RUNNER]: old, "agent-worker": old, "pdf-worker": old, "ocr-worker": old, "sheet-worker": old };
  const common = { slug: "img-box", mode: "update", rel, pre, preClasses: { [RUNNER]: ["AgentRunner"] } };
  const stale = "docker.io/civicos/agent-runner@sha256:" + "f".repeat(64);
  /* The platform answers "no changes" and the other image stays: refused as not done, naming the member. */
  const kept = await run({ ...common, preApps: [{ id: "app9", name: RUNNER, configuration: { image: stale } }], rolloutKeepsImage: true });
  assert.equal(kept.page.status("verify"), "no");
  assert.match(kept.page.done.replace(/&#39;/g, "'"), like("installer.image.lag.older", { name: RUNNER }), "named");
  assert.ok(!strip(kept.page.done).includes(word("installer.update.done.title")), "never reported as success");
  /* Control: the matching digest is accepted. */
  const match = await run({ ...common, preApps: [{ id: "app9", name: RUNNER, configuration: { image: DESCRIPTOR.image } }] });
  assert.equal(match.page.status("verify"), "ok");
  assert.ok(strip(match.page.done).includes(word("installer.update.done.title")));
  /* Each part's version is confirmed through a path the copy has: agent-worker, with no public address, through the plane's binding. */
  assert.ok(match.calls.some((c) => c.u.includes("op=bootstrap&members=1")), "asked through the plane, members=1");
  assert.ok(!match.calls.some((c) => /agent-worker/.test(c.u) && /workers\.dev/.test(c.u)), "agent-worker is asked at no address of its own");
  /* Control: a part that does not answer is named, and is not a warning the founder must judge: no success is claimed. */
  const silentPart = await run({ ...common, preApps: [{ id: "app9", name: RUNNER, configuration: { image: DESCRIPTOR.image } }],
    copy: { bootstrap: async (q, s) => jres(await bootstrapVersions({ storeVersion: s.v, version: s.v, memberVersions: { ...s.members, "agent-worker": (await fleetReports()).silent.memberVersions["ocr-worker"] } })) } });
  assert.equal(silentPart.page.status("verify"), "no");
  assert.match(silentPart.page.done.replace(/&#39;/g, "'"), like("installer.lag.member.silent", { name: "agent-worker" }));
  assert.ok(!strip(silentPart.page.done).includes(word("installer.update.done.title")));
  restoreSigners();
});

/* ------------------------------------------------------------------------------------------------ R69 */

test("R69 every step is resumable, partial states are detected, one install runs at a time: a copy begun under this short name and not finished is continued and says so; a worker created without its binding is completed; the mark is written last; control: a finished copy is offered the page, two concurrent runs leave the second saying one is running and changing nothing", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  /* Stopped after the plane upload: the plane and its evidence storage stand, no member, no mark. */
  const stopped = heldCopy({ slug: "resume-one", finished: false, members: [], version: "0.1.0" });
  const w = await run({ slug: "resume-one", rel, ...stopped });
  assert.equal(w.page.status("fresh"), "ok", "never refused");
  assert.ok(w.raw.includes(JSON.stringify(word("screen.install.resumed")).slice(1, -1)), "says it continues");
  for (const m of MEMBERS) assert.ok(w.acct.has(`${m}-resume-one`), `${m} completed at bind`);
  assert.deepEqual(w.acct.get("resume-one").filter((b) => b.type === "service" && b.name !== "SELF").map((b) => b.service).sort(), MEMBERS.map((m) => `${m}-resume-one`).sort());
  assert.ok(w.page.says.startsWith(word("installer.partial.completed", { what: "\u0000" }).split("\u0000")[0]), "what it completed is named");
  /* The mark is the last write, and only a finished run carries it. */
  assert.equal(w.secretPuts.at(-1), "resume-one/INSTALL_COMPLETE");
  assert.ok(w.acct.get("resume-one").some((b) => b.name === "INSTALL_COMPLETE"));
  const fresh = await run({ slug: "fresh-mark", rel });
  assert.equal(fresh.secretPuts.at(-1), "fresh-mark/INSTALL_COMPLETE");
  /* A worker created without its binding (a member present, the plane not bound to it) is completed. */
  const half = heldCopy({ slug: "half-one", finished: false, members: ["pdf-worker"], version: "0.1.0" });
  half.pre["half-one"] = half.pre["half-one"].filter((b) => b.name !== "PDF_WORKER");
  const wh = await run({ slug: "half-one", rel, ...half });
  assert.equal(wh.acct.get("half-one").find((b) => b.name === "PDF_WORKER")?.service, "pdf-worker-half-one");
  /* Control: a finished copy under the same short name is told and offered the page, not resumed. */
  const done = await run({ slug: "resume-one", rel, ...heldCopy({ slug: "resume-one" }) });
  assert.equal(done.page.label("fresh"), word("screen.install.stopped.exists"));
  assert.deepEqual(writes(done), []);
  /* One at a time: a run that finds another's lock, touched a moment ago, says so and changes nothing. */
  const lock = { "bio-install-lock": [{ type: "plain_text", name: "T", text: String(Date.now()) }, { type: "plain_text", name: "ID", text: "another-run" }] };
  const second = await run({ slug: "second-run", rel, pre: lock });
  assert.equal(second.page.failed.said, word("installer.stopped.running"));
  assert.deepEqual(writes(second), [], "changes nothing");
  assert.deepEqual([...second.acct.keys()], ["bio-install-lock"]);
  const upd = await run({ slug: "second-upd", mode: "update", rel, pre: { ...lock, "second-upd": planeBase("second-upd") } });
  assert.equal(upd.page.failed.said, word("installer.stopped.running"));
  assert.equal(upd.planePuts.length, 0);
  /* Control: a lock nobody has touched for longer than it lives belongs to a run that died. */
  const stale = await run({ slug: "after-dead", rel, pre: { "bio-install-lock": [{ type: "plain_text", name: "T", text: String(Date.now() - 10 * 60 * 1000) }] } });
  assert.equal(stale.page.status("install"), "ok");
  assert.ok(!stale.acct.has("bio-install-lock"), "the run drops its own lock when it ends");
  /* An update that replaces running containers and classes runs their migrations in order (R59) and confirms every part before done (R68). */
  const old = [{ type: "plain_text", name: "VERSION", text: "0.1.0" }];
  const up = await run({ slug: "mig-upd", mode: "update", rel, pre: { "mig-upd": planeBase("mig-upd"), "agent-worker": old }, preClasses: { "agent-worker": ["SegmentDriver"] }, preTags: { "agent-worker": "v1" } });
  assert.deepEqual((await metaOf(up, "agent-worker")).migrations.steps, [{ new_sqlite_classes: ["CheckRecord"] }]);
  assert.equal(up.page.status("verify"), "ok");
  restoreSigners();
});

/* ------------------------------------------------------------------------------------------------ R70 */

test("R70 what is missing is found before anything is created: a free-plan account, a Containers-off account, an account at its worker limit and a taken name each stop before a write, naming the cause and that nothing was created; control: a clean account passes all four", async () => {
  const stops = [
    ["plan", { plan: "free" }, word("screen.install.stopped.plan") + " " + word("installer.install.stopped.plan.why"), word("screen.install.stopped.plan.do")],
    /* R84 (2): Containers refused for the plan (Cloudflare's code, not its words) is the plan's own stop. */
    ["containers", { containersOff: true }, word("screen.install.stopped.plan") + " " + word("installer.install.stopped.plan.why"), word("screen.install.stopped.plan.do")],
    ["limit", { pre: Object.fromEntries([...Array(496)].map((_, i) => [`other-${i}`, []])) }, word("screen.install.stopped.limit", { limit: word("installer.limit.workers.other", { n: 500 }) }), word("screen.install.stopped.limit.do")],
    ["name", { pre: { "taken-name": [] } }, word("screen.install.stopped.nametaken", { name: "taken-name" }), word("screen.install.stopped.nametaken.do", { free: "taken-name-2" })],
  ];
  for (const [why, opts, head, doo] of stops) {
    const w = await run({ slug: why === "name" ? "taken-name" : "pre-" + why, ...opts });
    /* R70, R75: the cause, and the way out beside it (the keys that say nothing was created hold it themselves). */
    assert.equal(w.page.failed.said, head, why);
    assert.equal(w.page.failed.d, doo, `${why}: the way out`);
    assert.deepEqual([...w.buckets], [], `${why}: nothing exists afterwards`);
    assert.ok(![...w.acct.keys()].some((k) => /^pre-|-pre-/.test(k)), why);
    /* Before a write: no write to the account other than the plan probe the plan check itself makes (deleted again) and the lock. */
    assert.deepEqual(writes(w).filter((x) => !/bio-plan-probe/.test(x)), [], `${why}: before a write`);
  }
  /* The stop waits for the founder to say it is done, which begins again: the page offers its "Check again", which begins the run again
     with what it held (the same short name and mode), through the same /begin. */
  const containers = await run({ slug: "pre-containers", containersOff: true });
  assert.equal(containers.page.retry.label, word("screen.install.stopped.plan.done"));
  assert.equal(containers.page.retry.body.slug, "pre-containers");
  assert.equal(containers.page.retry.body.mode, "install");
  assert.equal(JSON.stringify(containers.page.retry.body).includes("token"), false, "no credential rides it");
  const { slug: again, mode: how, ...rest } = containers.page.retry.body;
  const begun = await begin(again, how, rest);
  assert.equal(begun.j.ok, true, "/begin takes it, and goes to Cloudflare again");
  /* F2: an answer that does not show Containers on is not read as on: an unknown answer stops, saying it could not tell, with Cloudflare's own words and "Check again". */
  const odd = await run({ slug: "pre-odd", containersOdd: true });
  assert.ok(odd.page.failed.said.includes("Something unexpected happened with the request"));
  assert.ok(odd.page.retry, "it offers Check again");
  assert.equal(odd.page.status("install"), null, "nothing installed");
  assert.deepEqual([...odd.buckets], [], "nothing created");
  /* R84 (2): a refusal for want of permission asks to approve again, before anything is created. */
  const noperm = await run({ slug: "pre-noperm", containers: "read" });
  assert.equal(noperm.page.status("room"), "no");
  assert.ok(noperm.page.done.includes("data-begin"), "the approval is asked again");
  assert.deepEqual([...noperm.buckets], [], "nothing created");
  /* The Workers Paid stop offers its own "Check again", beginning the run again as the Containers stop's does. */
  const free = await run({ slug: "pre-free", plan: "free" });
  assert.equal(free.page.retry.label, word("screen.install.stopped.plan.done"));
  assert.equal(free.page.retry.body.slug, "pre-free");
  /* R84 (4), F7: an account with no workers.dev prefix is asked, before anything is created, to choose the name it is offered; one that has a prefix is asked nothing. */
  const fresh = await run({ slug: "offer-one", subdomain: null });
  assert.equal(fresh.page.status("room"), "no");
  assert.match(fresh.page.done, /id="address-name"[^>]*value="offer-one"/);
  assert.deepEqual([...fresh.buckets], [], "nothing created");
  assert.equal(fresh.prefix(), null, "nothing registered without the click");
  const had = await run({ slug: "offer-two" });
  assert.equal(had.page.says, null);
  /* Control: a clean account passes all four checks. */
  const clean = await run({ slug: "clean-one" });
  assert.equal(clean.page.status("plan"), "ok");
  assert.equal(clean.page.status("room"), "ok");
  assert.equal(clean.page.status("fresh"), "ok");
  assert.equal(clean.page.status("install"), "ok");
  /* An account just under a limit passes; a limit of another kind is named by its own noun. */
  const under = await run({ slug: "under-one", pre: Object.fromEntries([...Array(480)].map((_, i) => [`other-${i}`, []])) });
  assert.equal(under.page.status("room"), "ok");
});

test("R70 an update checks the account's limits too when the chosen release adds members, classes, buckets or containers: stopped before an upload, naming the limit; control: an update that adds nothing, or an account with room, goes on", async () => {
  armWith(SIGNER.line);
  const slug = "r70-upd";
  const others = (n) => Object.fromEntries([...Array(n)].map((_, i) => [`other-${i}`, []]));
  const adds = await release({ version: bump(RELEASE_VERSION), container: true });
  const adds0 = await release({ version: bump(RELEASE_VERSION), fleet: false });
  const full = { [slug]: planeBase(slug), ...others(499) };
  const stop = await run({ slug, mode: "update", rel: adds, pre: full });
  assert.equal(stop.page.failed.said, word("screen.install.stopped.limit", { limit: word("installer.limit.workers.other", { n: 500 }) }));
  assert.equal(stop.page.failed.d, word("screen.install.stopped.limit.do"));
  assert.equal(stop.planePuts.length, 0, "nothing uploaded");
  /* Control: the same account with a release that adds nothing, and an account with room, update. */
  const none = await run({ slug, mode: "update", rel: adds0, pre: full });
  assert.equal(none.page.failed, null);
  const room = await run({ slug, mode: "update", rel: adds, pre: { [slug]: planeBase(slug), ...others(400) } });
  assert.equal(room.page.failed, null);
  restoreSigners();
});

test("R66 R71 the sign-in's token exchange waits out a 503 as every call does (the wait drawn), a token endpoint that never comes right is the named lasting stop, and a refused code is still the permission stop; the same for an update", async () => {
  for (const mode of ["install", "update"]) {
    const slug = "r66-tok-" + mode;
    const opts = mode === "update" ? { mode, pre: { [slug]: planeBase(slug) } } : {};
    const flaky = await run({ slug, tokenFlaky: 2, ...opts });
    assert.equal(flaky.page.status("auth"), "ok", `${mode}: a 503 twice then the token completes`);
    assert.ok(flaky.page.done, mode);
    assert.ok(flaky.page.waits.length >= 1, `${mode}: the wait is drawn`);
    const dead = await run({ slug, tokenFlaky: 100000, ...opts });
    assert.equal(dead.page.failed.said, word("screen.install.stopped.lasting"), mode);
    assert.equal(dead.page.status("auth"), "no");
    assert.equal(dead.page.done, null);
    /* Control: a code Cloudflare refuses is not waited on. */
    const refused = await run({ slug, tokenFail: true, ...opts });
    assert.equal(refused.page.waits.length, 0, `${mode}: no wait`);
    assert.ok(refused.page.failed.said.includes("code spent"), mode);
  }
});

/* ------------------------------------------------------------------------------------------------ R71 */

test("R71 a lost source or consent ends with a named stop and nothing half-made: a registry that answers 503 three times then 200 completes; one that never answers ends the named stop with no resource created; an expired grant mid-install asks again and the install continues after approval; control: without the continuation the second run finds the lock the first left", async () => {
  const flaky = await run({ slug: "r71-flaky", rel: null, builtInFleet: true, sourceFlaky: 3 });
  assert.equal(flaky.page.status("fleet"), "ok");
  assert.ok(flaky.acct.has("pdf-worker-r71-flaky"), "completed");
  assert.ok(flaky.page.done);
  assert.ok(flaky.page.waits.length >= 1, "the wait is drawn");
  const down = await run({ slug: "r71-down", rel: null, builtInFleet: true, sourceDown: true });
  assert.equal(down.page.failed.said, word("screen.install.stopped.source"));
  assert.equal(down.page.failed.d, word("screen.install.stopped.source.do"));
  assert.deepEqual([...down.acct.keys()], [], "no resource created");
  assert.deepEqual([...down.buckets], []);
  /* The grant expires mid-install, after the plane stands: the founder is asked to approve again. */
  const first = await run({ slug: "r71-grant", expireAfter: 36 });
  assert.equal(first.page.failed.said, word("screen.install.approveagain"));
  assert.ok(first.planePuts.length >= 1 && !first.page.done?.includes("out-boot"), "stopped part way, after the plane");
  const body = JSON.parse(first.page.done.match(/data-begin="([^"]*)"/)[1].replace(/&quot;/g, '"'));
  assert.equal(body.slug, "r71-grant");
  assert.ok(typeof body.lock === "string" && body.lock.length >= 6, "the continuation names the run it continues");
  assert.equal(JSON.stringify(body).includes("TOKEN"), false, "never a credential");
  assert.ok(!first.acct.get("r71-grant").some((b) => b.name === "INSTALL_COMPLETE"), "a run that stopped part way left no mark");
  const state = { pre: Object.fromEntries(first.acct), preBuckets: [...first.buckets], preClasses: Object.fromEntries(first.classes),
    preSources: Object.fromEntries(first.sources), preTags: Object.fromEntries(first.tags) };
  /* After approval the install continues from where it stopped, and finishes. */
  const again = await begin("r71-grant", "install", { lock: body.lock });
  const second = await run({ slug: "r71-grant", cookie: again.cookie, state: again.state, ...state });
  assert.equal(second.page.failed, null);
  assert.ok(second.page.done.includes('id="out-boot"'), "finished");
  assert.ok(second.raw.includes(JSON.stringify(word("screen.install.resumed")).slice(1, -1)), "says it continues");
  assert.ok(second.acct.get("r71-grant").some((b) => b.name === "INSTALL_COMPLETE"));
  /* Control: a second run that does not name the run it continues finds the lock the first could not drop, and says so. */
  const bare = await begin("r71-grant", "install");
  const blocked = await run({ slug: "r71-grant", cookie: bare.cookie, state: bare.state, ...state });
  assert.equal(blocked.page.failed.said, word("installer.stopped.running"));
  /* The continuation is a name, not a key: one that does not match the lock's owner does not take it. */
  const wrong = await begin("r71-grant", "install", { lock: "not-the-owner" });
  const refused = await run({ slug: "r71-grant", cookie: wrong.cookie, state: wrong.state, ...state });
  assert.equal(refused.page.failed.said, word("installer.stopped.running"));
  assert.equal((await req("/begin", { method: "POST", body: JSON.stringify({ slug: "r71-grant", lock: "bad lock!" }) })).status, 200, "a malformed continuation is dropped, not stored");
});

/* ------------------------------------------------------------------------------------------------ R72 */

test("R72 words by key and 'team': every key the installer reads is held by setup-words; every word() the source calls is in the list the bundle is cut to; R42's two lines are the keys' and no copy; no served page says 'group' for a team; control: the bundle holds no row the installer does not read", async () => {
  for (const k of KEYS) assert.ok(hasWord(k), `the key ${k} is held`);
  assert.equal(new Set(KEYS).size, KEYS.length, "no key twice");
  assert.deepEqual([...KEYS], [...KEYS].slice().sort(), "sorted");
  /* Every literal key a source file calls is in the list; dynamic keys are in it by expansion. */
  const here = fileURLToPath(new URL("../src/", import.meta.url));
  const called = new Set();
  for (const f of readdirSync(here).filter((x) => x.endsWith(".mjs") && x !== "release.mjs")) {
    const src = readFileSync(here + f, "utf8");
    for (const m of src.matchAll(/\bword\(\s*"([a-z0-9_.-]+)"/g)) called.add(m[1]);
  }
  assert.ok(called.size > 50, "the source reads many keys");
  for (const k of called) assert.ok(KEYS.includes(k), `${k} is called and not in the list the bundle is cut to`);
  /* R42's two lines are `public-read`'s keys, read by key. */
  const home = await (await req("/")).text();
  assert.ok(home.includes(word("public-read.free_software_groups")) && home.includes(word("public-read.neighborhood_issue_groups")));
  const srcUi = readFileSync(here + "ui.mjs", "utf8");
  assert.equal(/Free software for (groups|teams) that check/.test(srcUi), false, "the installer holds no copy of the line");
  /* No served page says 'group' for a team (the design's own 'groups' in R42's second line, and the places' data, excepted). */
  const pages = [home, await (await req("/update?version=" + NEXT)).text(), await (await req("/nowhere")).text(),
    readFileSync(new URL("../../bio-plane/public/newgroup/index.html", import.meta.url), "utf8"), (await run({ slug: "r72-run" })).raw];
  for (const page of pages) {
    /* instance-setup's hosting block (R34) is that module's words, taken out as the requirements suite takes it out. */
    let text = strip(page).replace(word("public-read.neighborhood_issue_groups"), "");
    for (const x of [HOSTING_CONTROL.heading, ...HOSTING_CONTROL.sentences]) text = text.split(x).join(" ");
    const hit = text.match(/.{0,40}\b(your group|the group|group's|a group|groups?)\b.{0,30}/i);
    assert.equal(hit, null, hit?.[0]);
  }
  /* Control: the bundle holds no row the installer does not read. */
  const esbuild = await import("esbuild");
  const { bundleText, bundledKeys } = await import("../scripts/build.mjs");
  const text = await bundleText(esbuild);
  const head = text.match(/\bWORD_ROWS ?= ?Object\.freeze\(/);       /* the build minifies whitespace (installer R82) */
  assert.ok(head, "the bundle carries the rows");
  const at = head.index;
  const arr = text.slice(at + head[0].length, text.indexOf("].map(", at) + 1);
  const rows = (await import("node:vm")).runInNewContext("(" + arr + ")");
  const keep = new Set(await bundledKeys());
  assert.ok(WORD_ROWS.length > 5000);
  assert.ok(rows.length > 100 && rows.length < WORD_ROWS.length / 5, `${rows.length} rows, not the whole list`);
  assert.deepEqual(Array.from(rows, (r) => r[0]).filter((k) => !keep.has(k)), [], "no row the installer does not read");
  for (const k of KEYS) assert.ok(rows.some((r) => r[0] === k), `${k} is in the bundle`);
});

/* ------------------------------------------------------------------------------------------------ R73 */

test("R73 the one-time password is introduced as one-time: the finished panel holds the three keys' words beside the password; control: the update's last screen, which shows no password, draws none of them", async () => {
  const w = await run({ slug: "otp-one" });
  const done = w.page.done;
  const boot = done.match(/id="out-boot">([^<]+)</)[1];
  const at = done.indexOf(boot);
  for (const k of ["head", "what", "help"]) {
    const html = done.replace(/&#39;/g, "'");
    const word_ = word("screen.install.otp." + k);
    assert.ok(html.includes(word_) || done.includes(word_.replace(/'/g, "&#39;")), k);
    const pos = Math.max(done.indexOf(word_), done.indexOf(word_.replace(/'/g, "&#39;")));
    assert.ok(Math.abs(pos - at) < 1500, `${k} sits beside the password`);
  }
  const upd = await run({ slug: "otp-upd", mode: "update", pre: { "otp-upd": planeBase("otp-upd") } });
  assert.ok(!/id="out-boot"/.test(upd.page.done));
  for (const k of ["head", "what", "help"]) {
    const word_ = word("screen.install.otp." + k);
    assert.ok(!upd.page.done.includes(word_) && !upd.page.done.includes(word_.replace(/'/g, "&#39;")), `the update draws no ${k}`);
  }
});

/* ------------------------------------------------------------------------------------------------ R15, R38 (K3793) */

test("R15 R38 (K3793) a container member R38 leaves out (images on ghcr.io, which an account cannot pull) is named once at the fleet step with why and what the copy lacks, and is no lag: the install and the update confirm when every other member serves; control: a member whose upload fails still holds the verdict, and the verdict names it", async () => {
  armWith(SIGNER.line);
  const ghcr = (n, c) => `ghcr.io/believeinoakland/${n}@sha256:${c.repeat(64)}`;
  const rel = await release({ version: NEXT, container: true, descriptor: { ...DESCRIPTOR, image: ghcr("agent-runner", "a") }, scanner: true,
    scannerParts: { "container/FileScanner.json": { ...SCANNER_CLASSES[0], image: ghcr("file-scanner-scanner", "d") },
      "container/SafeViewRenderer.json": { ...SCANNER_CLASSES[1], image: ghcr("file-scanner-renderer", "e") } } });
  for (const [mode, pre] of [["install", {}], ["update", { "r15-ghcr": planeBase("r15-ghcr") }]]) {
    const w = await run({ slug: "r15-ghcr", mode, rel, pre });
    const said = w.page.label("fleet");
    for (const m of [RUNNER, SCANNER]) assert.match(said, like("installer.fleet.left.item", { member: m, why: like("installer.fleet.why.unpullable") }), `${mode}: ${m} named once at the fleet step with R38's reason`);
    assert.equal(said.split(`${SCANNER} (`).length - 1, 1, `${mode}: file-scanner named once`);
    assert.match(said, like("installer.image.lacks.scanner"), `${mode}: what the copy lacks`);
    assert.equal(w.page.status("verify"), "ok", `${mode}: the verdict confirms (${w.page.words})`);
    assert.ok(w.page.done, `${mode}: finished`);
    assert.doesNotMatch(w.page.done.replace(/&#39;/g, "'"), like("installer.lag.member.failed", { name: /\S+/ }), `${mode}: neither member is a lag`);
    for (const m of MEMBERS.filter((x) => x !== RUNNER && x !== SCANNER)) assert.ok(w.acct.has(`${m}-r15-ghcr`), `${mode}: ${m} serves`);
  }
  /* Control: a member whose upload is attempted and fails stays a lag, and the verdict holds. */
  const failed = await run({ slug: "r15-failed", rel: await release({ version: NEXT, missing: "ocr-worker" }) });
  assert.equal(failed.page.status("verify"), "no");
  assert.match(failed.page.done.replace(/&#39;/g, "'"), like("installer.lag.member.failed", { name: "ocr-worker" }));
  restoreSigners();
});
