/* A test deploy's names and the p3dev guard (bio-plane/scripts/p3dev.mjs), against CLAUDE.md's Cloudflare paragraph: a test
 * deploy creates and binds only resources whose name begins with `p3dev-` or contains `-p3dev-`, named as the installer names
 * a copy's parts. The unit tests drive the real configs of this tree; the command tests drive the real scripts in a fixture
 * repository over the stubbed account (`stubfetch.mjs`), as release.test.mjs's R40 tests do. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { slugMember, slugPlane, memberPlan, planePlan, p3devFindings, isP3devName, appName, refuseUnlessP3dev } from "../../../scripts/p3dev.mjs";
import { deriveBindings } from "../../../scripts/derive-bindings.mjs";
import { parseJsonc } from "../../../scripts/jsonc.mjs";
import { containerClasses, markerIsContainer } from "../../../scripts/fleet-bundle.mjs";
import { makeRepo, run, rm, VERSION, PLANE, addContainerMember } from "./repo.mjs";

const ROOT = join(PLANE, "..");
const SLUG = "p3dev-l1";
const MEMBERS = ["agent-runner", "agent-worker", "file-scanner", "ocr-worker", "pdf-worker", "reader-container", "sheet-worker"];
const cfgOf = (dir) => parseJsonc(readFileSync(join(ROOT, dir, "wrangler.jsonc"), "utf8"), `${dir}/wrangler.jsonc`);
const markerOf = (dir) => JSON.parse(readFileSync(join(ROOT, dir, "fleet-member.json"), "utf8"));

/* CLAUDE.md's list of what a session may not change, and the account's other named resources. */
const FORBIDDEN_WORKERS = ["biosmoke8", "plat-s1", "agent-runner", "agent-runner-plat-s1", "agent-worker", "agent-worker-plat-s1",
  "file-scanner", "ocr-worker", "pdf-worker", "pdf-worker-plat-s1", "sheet-worker", "civicsmith-site", "newgroup"];
const FORBIDDEN_BUCKETS = ["bio-captures", "bio-published", "bio-captures-plat-s1", "bio-published-plat-s1", "bio-walks"];

const memberPlanOf = (m, slug = SLUG) => {
  const marker = markerOf(m);
  const multi = markerIsContainer(marker) ? !!containerClasses({ marker }).multi : false;
  const cfg = slugMember(cfgOf(m), { member: m, slug, multi });
  const images = markerIsContainer(marker) ? containerClasses({ marker }).classes.map((c) => `${appName(m, c.class_name, multi, slug)}:abc`) : [];
  return { cfg, plan: memberPlan(cfg, { slug, images }) };
};
const planeBindings = (slug = SLUG) => deriveBindings(slugPlane(cfgOf("bio-plane"), { slug }), { slug, version: VERSION });

test("p3dev: a p3dev-l1 plan of every real member passes, every name slugged as the installer names it", () => {
  for (const m of MEMBERS) {
    const { cfg, plan } = memberPlanOf(m);
    assert.deepEqual(p3devFindings(plan), [], m);
    assert.equal(cfg.name, `${m}-${SLUG}`);
    for (const b of cfg.r2_buckets || []) assert.equal(b.bucket_name, `bio-captures-${SLUG}`, `${m}'s bucket`);
    for (const s of cfg.services || []) assert.ok(s.service === SLUG || s.service.endsWith(`-${SLUG}`), `${m} ${s.binding}`);
  }
  const aw = memberPlanOf("agent-worker").cfg;
  assert.equal(aw.services.find((s) => s.binding === "PLANE").service, SLUG, "the phantom is the plane");
  assert.equal(aw.durable_objects.bindings.find((d) => d.name === "REMOTE").script_name, `agent-runner-${SLUG}`);
  const fs = memberPlanOf("file-scanner").cfg;
  assert.deepEqual(fs.containers.map((c) => c.name).sort(), [`file-scanner-filescanner-${SLUG}`, `file-scanner-safeviewrenderer-${SLUG}`]);
  assert.deepEqual(memberPlanOf("agent-runner").cfg.containers.map((c) => c.name), [`agent-runner-${SLUG}`]);
});

test("p3dev: the plane of p3dev-l1 binds its own buckets, its slugged members, SELF and BROWSER, and nothing else", () => {
  const b = planeBindings();
  assert.deepEqual(p3devFindings(planePlan(b, { slug: SLUG, cfg: cfgOf("bio-plane") })), []);
  assert.deepEqual(b.filter((x) => x.type === "r2_bucket").map((x) => x.bucket_name).sort(), [`bio-captures-${SLUG}`, `bio-published-${SLUG}`]);
  const services = Object.fromEntries(b.filter((x) => x.type === "service").map((x) => [x.name, x.service]));
  assert.equal(services.SELF, SLUG);
  for (const [name, target] of Object.entries(services)) if (name !== "SELF") assert.match(target, new RegExp(`^[a-z-]+-${SLUG}$`), name);
  assert.deepEqual(b.filter((x) => !["plain_text", "r2_bucket", "service"].includes(x.type)).map((x) => `${x.type} ${x.name}`), ["browser BROWSER"]);
});

test("R45 p3dev: each forbidden name in CLAUDE.md's list is refused by name in every place a plan can carry it", () => {
  const base = memberPlanOf("agent-worker").plan;
  assert.deepEqual(p3devFindings(base), []);
  for (const n of FORBIDDEN_WORKERS) {
    for (const k of ["workers", "services", "doScripts", "apps", "images"]) {
      const f = p3devFindings({ ...base, [k]: [...base[k], k === "images" ? `${n}:abc` : n] });
      assert.equal(f.length, 1, `${n} as ${k}: ${f}`);
      assert.ok(f[0].includes(JSON.stringify(k === "images" ? `${n}:abc` : n)), f[0]);
    }
  }
  for (const n of FORBIDDEN_BUCKETS) {
    const f = p3devFindings({ ...base, buckets: [n] });
    assert.equal(f.length, 1, n);
    assert.ok(f[0].includes(JSON.stringify(n)));
  }
  /* the plane of an unslugged copy: the slug itself is refused, and so is each fixed name it would bind */
  for (const slug of ["biosmoke8", "plat-s1", "trial-copy", "xp3dev-l1", "p3dev"]) {
    const f = p3devFindings({ ...base, slug });
    assert.ok(f.some((x) => x.startsWith("the copy")), `${slug}: ${f}`);
  }
  const unslugged = planePlan(deriveBindings(cfgOf("bio-plane"), { slug: "biosmoke8", version: VERSION }), { slug: "biosmoke8" });
  const found = p3devFindings(unslugged).join("\n");
  for (const n of ["biosmoke8", "pdf-worker", "agent-worker", "ocr-worker", "sheet-worker", "file-scanner", "bio-captures", "bio-published"]) assert.ok(found.includes(`"${n}"`), n);
  /* a config key this route does not slug */
  assert.ok(p3devFindings(memberPlan({ name: `x-${SLUG}`, kv_namespaces: [{ binding: "K", id: "1" }] }, { slug: SLUG })).some((x) => x.includes("kv_namespaces")));
  for (const k of ["vpc_services", "streaming_tail_consumers", "ratelimits", "ai", "images", "worker_loaders", "logfwdr"])
    assert.ok(p3devFindings(memberPlan({ name: `x-${SLUG}`, [k]: [{}] }, { slug: SLUG })).some((x) => x.includes(`\`${k}\``)), `${k} is a key the route does not know`);
  assert.equal(isP3devName("p3dev-x"), true);
  assert.equal(isP3devName("a-p3dev-x"), true);
  assert.equal(isP3devName("ap3dev-x"), false);
});

/* ---- the scripts themselves, in a fixture repository ---- */

const ACCT = "20b533579290b9b93168345edd3b7f72";
const ASSET = "dist/bio-plane.bundled.mjs";
const repo = () => makeRepo({ members: { "alpha-worker": { account: ACCT } },
  plane: { config: { services: [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }] } } });
const env = (copy) => ({ CF_TOKEN: "t", CF_ACCT: ACCT, CIVICSMITH_TEST_INSTANCE: copy });
const fleet = (root, copy, flags, stub) => run(root, ".", ["bio-plane/scripts/deploy-fleet.mjs", "alpha-worker", "--instance", copy, "--test-instance", ...flags], { env: env(copy), stub });
const plane = (root, copy, flags, stub) => run(root, "bio-plane", ["scripts/deploy.mjs", copy, VERSION, ASSET, "--test-instance", ...flags], { env: env(copy), stub });
const refusedBy = (r, code) => { assert.notEqual(r.status, 0, r.stdout); assert.match(r.stderr, new RegExp(`REFUSED \\[${code}\\]`), r.stderr); };

test("R45 p3dev: a marked copy that does not begin with p3dev- is refused NOT_A_P3DEV_NAME by both scripts before any request", async () => {
  const root = await repo();
  try {
    for (const r of [fleet(root, "biosmoke8", ["--dry-run"], {}), plane(root, "biosmoke8", ["--dry-run"], {})]) {
      refusedBy(r, "NOT_A_P3DEV_NAME");
      assert.match(r.stderr, /biosmoke8/);
      assert.deepEqual(r.calls, [], "no request was made");
      assert.deepEqual(r.wrangler, []);
    }
  } finally { rm(root); }
});

test("R45 p3dev: a passing guard prints the exact line 'p3dev guard: passed' on its own line, a refusing guard does not, and both scripts print it on a dry --test-instance run", async () => {
  const LINE = "p3dev guard: passed";
  const capture = (plan) => {
    const out = []; let code = null;
    const ret = refuseUnlessP3dev(plan, { log: (s) => out.push(String(s)), err: (s) => out.push(String(s)), exit: (c) => { code = c; } });
    return { lines: out.join("\n").split("\n"), code, ret };
  };
  const pass = capture(memberPlanOf("pdf-worker").plan);
  assert.equal(pass.code, null);
  assert.ok(pass.ret);
  assert.equal(pass.lines[0], LINE, "the first line printed is exactly the guard line");
  assert.equal(pass.lines.filter((l) => l === LINE).length, 1);
  for (const plan of [{ ...memberPlanOf("pdf-worker").plan, slug: "biosmoke8" }, { ...memberPlanOf("pdf-worker").plan, buckets: ["bio-captures"] }]) {
    const no = capture(plan);
    assert.equal(no.code, 1);
    assert.ok(!no.lines.some((l) => l.startsWith(LINE)), no.lines.join("\n"));
  }
  const root = await repo();
  try {
    const stub = { subdomain: "sub", scripts: { [SLUG]: { body: "x", settings: {} } } };
    for (const r of [fleet(root, SLUG, ["--dry-run"], stub), plane(root, SLUG, ["--dry-run"], stub)]) {
      assert.ok(r.stdout.split("\n").includes(LINE), r.stdout + r.stderr);
      assert.deepEqual(r.calls.filter((c) => c.method !== "GET"), [], "the dry run only reads");
    }
  } finally { rm(root); }
});

test("p3dev: a member's generated config names its Worker, bucket, Durable Object script and services by the slug, and its missing bucket is created", async () => {
  const root = await repo();
  try {
    const p = join(root, "alpha-worker", "wrangler.jsonc");
    const cfg = parseJsonc(readFileSync(p, "utf8"), p);
    cfg.r2_buckets = [{ binding: "CAPTURES", bucket_name: "bio-captures" }];
    cfg.services.push({ binding: "OTHER", service: "pdf-worker" });
    cfg.durable_objects = { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }] };
    writeFileSync(p, JSON.stringify(cfg));
    const stub = { subdomain: "sub", scripts: { [SLUG]: { settings: {} }, [`pdf-worker-${SLUG}`]: { settings: {} } } };
    const dry = fleet(root, SLUG, ["--dry-run"], stub);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.match(dry.stdout, /^p3dev guard: passed\n  for p3dev-l1: /m);
    assert.match(dry.stdout, new RegExp(`bucket   : bio-captures-${SLUG} missing; a real run creates it`));
    assert.deepEqual(dry.calls.filter((c) => c.method !== "GET"), [], "the dry run only reads");
    const real = fleet(root, SLUG, [], stub);
    assert.equal(real.status, 0, real.stdout + real.stderr);
    assert.deepEqual(real.calls.filter((c) => c.method === "POST").map((c) => c.bucket), [`bio-captures-${SLUG}`]);
    const gen = JSON.parse(real.wrangler[0].config);
    assert.equal(gen.name, `alpha-worker-${SLUG}`);
    assert.deepEqual(gen.services.map((s) => s.service), [SLUG, `pdf-worker-${SLUG}`]);
    assert.equal(gen.r2_buckets[0].bucket_name, `bio-captures-${SLUG}`);
    assert.equal(gen.durable_objects.bindings[0].script_name, `agent-runner-${SLUG}`);
    /* a service target the route does not deploy, missing, is still refused on a real run */
    const missing = fleet(root, SLUG, [], { subdomain: "sub", scripts: { [SLUG]: { settings: {} } } });
    refusedBy(missing, "BINDING_TARGET_MISSING");
  } finally { rm(root); }
});

test("p3dev: a fresh copy's plane is installed first with STORE, its migration and SELF alone; --first-install on a copy that exists does nothing", async () => {
  const root = await repo();
  try {
    const wp = join(root, "bio-plane", "wrangler.jsonc");
    writeFileSync(wp, JSON.stringify({ ...parseJsonc(readFileSync(wp, "utf8"), wp), migrations: [{ tag: "v1", new_sqlite_classes: ["Store"] }] }));
    const dry = plane(root, SLUG, ["--first-install", "--dry-run"], { subdomain: "sub", put: "accept" });
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.match(dry.stdout, /first install: SELF only; .*AGENT -> alpha-worker-p3dev-l1/);
    assert.match(dry.stdout, /first install: p3dev-l1 does not exist yet; the upload sends STORE \(class Store\)/);
    assert.deepEqual(dry.calls.filter((c) => c.method !== "GET"), []);
    const first = plane(root, SLUG, ["--first-install"], { subdomain: "sub", put: "accept" });
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const put = first.calls.find((c) => c.method === "PUT" && c.metadata);
    assert.deepEqual(put.metadata.bindings.filter((b) => b.type === "service").map((b) => `${b.name} ${b.service}`), [`SELF ${SLUG}`]);
    assert.deepEqual(put.metadata.bindings.filter((b) => b.type === "durable_object_namespace"), [{ type: "durable_object_namespace", name: "STORE", class_name: "Store" }]);
    assert.deepEqual(put.metadata.migrations, { new_tag: "v1", new_sqlite_classes: ["Store"] }, "the store's migration is sent");
    assert.deepEqual(put.metadata.bindings.filter((b) => b.type === "r2_bucket").map((b) => b.bucket_name).sort(), [`c-${SLUG}`, `p-${SLUG}`]);
    assert.deepEqual(first.calls.filter((c) => c.method === "POST" && c.bucket).map((c) => c.bucket).sort(), [`c-${SLUG}`, `p-${SLUG}`]);
    assert.ok(first.calls.some((c) => c.method === "POST" && c.url.endsWith(`/workers/scripts/${SLUG}/subdomain`)), "the copy's workers.dev address is turned on");
    assert.match(first.stdout, /address: p3dev-l1's workers.dev address is on/);
    /* on a copy that exists the step does nothing */
    const again = plane(root, SLUG, ["--first-install"], { subdomain: "sub", put: "accept", scripts: { [SLUG]: { body: "x", settings: {} } } });
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.match(again.stdout, /exists already; nothing to do/);
    assert.deepEqual(again.calls.filter((c) => c.method !== "GET"), []);
  } finally { rm(root); }
});

test("R45 p3dev: a plane script that already holds a binding to a fixed name, which the upload would keep, is refused before any write", async () => {
  const root = await repo();
  try {
    const stub = { subdomain: "sub", put: "accept", scripts: { [`alpha-worker-${SLUG}`]: { settings: {} },
      [SLUG]: { body: "x", settings: { bindings: [{ type: "service", name: "PDF_WORKER", service: "pdf-worker" }] } } } };
    const r = plane(root, SLUG, [], stub);
    refusedBy(r, "NOT_A_P3DEV_NAME");
    assert.match(r.stderr, /"pdf-worker"/);
    assert.deepEqual(r.calls.filter((c) => c.method !== "GET"), [], "nothing written");
  } finally { rm(root); }
});

/* ---- the walk's two people (p3dev-walk-setup.mjs) ---- */

test("p3dev walk setup: claims, invites and joins against a copy, writes the credentials mode 600 outside the repository, and prints none", async () => {
  const { credentials, claimAndJoin, writeCreds, readCreds, outsideRepo } = await import("../../../scripts/p3dev-walk-setup.mjs");
  const { mkdtempSync, statSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "p3dev-walk-"));
  const file = join(dir, "p3dev-l1.env");
  const c = credentials();
  assert.match(c.JOURNEY_ADMIN_HANDLE, /^[a-z0-9][a-z0-9-]{1,40}$/);
  assert.match(c.JOURNEY_MEMBER_HANDLE, /^[a-z0-9][a-z0-9-]{1,40}$/);
  assert.ok(c.JOURNEY_ADMIN_PASSWORD.length >= 12 && c.JOURNEY_MEMBER_PASSWORD.length >= 12);
  const calls = [];
  const answers = { claim: { ok: true }, login: { ok: true, token: "sess" }, memberadd: { ok: true, invite: "inv" }, enroll: { ok: true } };
  const fetchOf = async (url, init) => {
    const name = new URL(url).searchParams.get("op");
    calls.push({ name, body: JSON.parse(init.body), auth: init.headers.authorization || null });
    return new Response(JSON.stringify(answers[name]), { status: 200 });
  };
  const logged = [];
  const out = await claimAndJoin({ address: "https://p3dev-l1.sub.workers.dev/", creds: { ...c, P3DEV_STAGE: "bootstrap" },
    save: (x) => writeCreds(file, x), fetchOf, log: (l) => logged.push(l), wait: async () => {} });
  assert.deepEqual(calls.map((x) => x.name), ["claim", "login", "memberadd", "enroll", "login"]);
  assert.deepEqual(calls[0].body, { bootstrapToken: c.P3DEV_BOOTSTRAP_TOKEN, handle: c.JOURNEY_ADMIN_HANDLE, password: c.JOURNEY_ADMIN_PASSWORD });
  assert.equal(calls[2].auth, "Bearer sess", "the invitation is the founder's");
  assert.deepEqual(calls[3].body, { invite: "inv", handle: c.JOURNEY_MEMBER_HANDLE, password: c.JOURNEY_MEMBER_PASSWORD });
  assert.equal(out.P3DEV_STAGE, "joined");
  for (const v of [c.P3DEV_BOOTSTRAP_TOKEN, c.JOURNEY_ADMIN_PASSWORD, c.JOURNEY_MEMBER_PASSWORD, c.JOURNEY_ADMIN_HANDLE, c.JOURNEY_MEMBER_HANDLE])
    assert.ok(!logged.join("\n").includes(v), "no credential is printed");
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const back = readCreds(file);
  for (const k of ["JOURNEY_ADMIN_HANDLE", "JOURNEY_ADMIN_PASSWORD", "JOURNEY_MEMBER_HANDLE", "JOURNEY_MEMBER_PASSWORD"]) assert.equal(back[k], c[k], k);
  assert.equal(outsideRepo(file), true);
  assert.equal(outsideRepo(join(PLANE, "x.env")), false, "a file inside the repository is refused");
  /* a run resumed after the join asks nothing of the copy but the sign-ins */
  calls.length = 0;
  await claimAndJoin({ address: "https://x", creds: { ...back }, save: () => {}, fetchOf, log: () => {}, wait: async () => {} });
  assert.deepEqual(calls.map((x) => x.name), ["login", "login"]);
  /* a refused claim stops, naming the reason code only */
  const refusing = async () => new Response(JSON.stringify({ ok: false, reason: "BOOTSTRAP_CREDENTIAL_MISMATCH" }), { status: 403 });
  await assert.rejects(claimAndJoin({ address: "https://x", creds: { ...c, P3DEV_STAGE: "bootstrap" }, save: () => {}, fetchOf: refusing, log: () => {}, wait: async () => {} }),
    (e) => e.code === "CLAIM_FAILED" && /BOOTSTRAP_CREDENTIAL_MISMATCH/.test(e.message) && !e.message.includes(c.JOURNEY_ADMIN_PASSWORD));
  rm(dir);
});

test("p3dev: a container member's test deploy names its application by the slug and deploys the Docker Hub image by digest, pushing nothing", async () => {
  const root = await repo();
  try {
    addContainerMember(root, "runner-worker");
    const p = join(root, "runner-worker", "wrangler.jsonc");
    const cfg = parseJsonc(readFileSync(p, "utf8"), p);
    cfg.account_id = ACCT;
    writeFileSync(p, JSON.stringify(cfg));
    const marker = JSON.parse(readFileSync(join(root, "runner-worker", "fleet-member.json"), "utf8"));
    const r = run(root, ".", ["bio-plane/scripts/deploy-fleet.mjs", "runner-worker", "--instance", SLUG, "--test-instance"],
      { env: env(SLUG), stub: { subdomain: "sub", containers: 200, scripts: { [SLUG]: { settings: {} } } } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(r.docker, [], "nothing pulled or pushed");
    assert.equal(r.wrangler.length, 1, "one deploy, no containers push");
    const gen = JSON.parse(r.wrangler[0].config);
    assert.equal(gen.name, `runner-worker-${SLUG}`);
    assert.deepEqual(gen.containers.map((c) => [c.name, c.image]), [[`runner-worker-${SLUG}`, `${marker.image.repository}@${marker.image.digest}`]]);
  } finally { rm(root); }
});
