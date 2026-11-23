/* release R43, R44, R45: `dev-copy.mjs deploy|seed|remove <copy>`, run as ARCH's session runs it, against a fixture
 * repository (`repo.mjs`) with a stand-in for the Cloudflare account (`stubfetch.mjs` and `devcopystub.mjs`, preloaded:
 * every request is answered in-process and none reaches a real account), a fake wrangler and a fake docker. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Miniflare } from "miniflare";
import { makeRepo, run, rm, ACCOUNT, addContainerMember, DIGEST } from "./repo.mjs";
import { copyNames, generatedConfig, documentsModule, noticePage, DOCUMENTS, INSTANCE_VALUES, GROUP, PREFIX } from "../../../scripts/dev-copy.mjs";

const DEVSTUB = join(import.meta.dirname, "devcopystub.mjs");
const OTHER = "fedcba9876543210fedcba9876543210";
/* The installer's slug rule (newgroup; bio-plane/src/setup-fleet.mjs GROUP_SLUG_RE), and the forms of an installed site's
   names (newgroup/src/steps/account.mjs namesFor): restated here as the facts a copy's names must stay clear of. */
const INSTALLED_SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const MEMBERS = ["agent-worker", "agent-runner", "file-scanner", "ocr-worker", "pdf-worker", "sheet-worker"];

/** A fixture repository whose process.json names the development account, and a folder outside it for instance values. */
async function repo(dev = ACCOUNT) {
  const root = await makeRepo({ build: false });
  writeFileSync(join(root, "process.json"), JSON.stringify({ hosting: { provider: "cloudflare", development_account: dev } }) + "\n");
  const keep = mkdtempSync(join(tmpdir(), "devcopy-values-"));
  return { root, keep, done: () => { rm(root); rmSync(keep, { recursive: true, force: true }); } };
}
const devCopy = (r, args, { env = {}, stub = {} } = {}) => run(r.root, ".", ["--import", DEVSTUB, "bio-plane/scripts/dev-copy.mjs", ...args],
  { env: { CF_TOKEN: "cf-test-token-value", CF_ACCT: ACCOUNT, CIVICSMITH_DEV_COPIES: r.keep, ...env }, stub: { subdomain: "sub", put: "accept", ...stub } });
const refused = (res, code) => {
  assert.notEqual(res.status, 0, `${code}\n${res.stdout}${res.stderr}`);
  assert.match(res.stderr, new RegExp(`REFUSED \\[${code}\\]`), res.stdout + res.stderr);
};

test("R43: the names made from two copies differ from each other and from any an installed site can take, and what is named for one copy is never named for another", () => {
  for (const [a, b] of [["a", "ab"], ["walk1", "walk2"], ["z", "zzzzzzzzzzzz"]]) {
    const A = copyNames(a), B = copyNames(b);
    const workers = (N) => [N.plane, N.documents, ...MEMBERS.map(N.member)];
    const buckets = (N) => [N.bucket("captures"), N.bucket("published")];
    for (const N of [A, B]) {
      for (const w of workers(N)) {
        assert.match(w, /^[a-z0-9-]{41,63}$/, `${w}: a Worker name of 41 to 63 characters`);
        assert.doesNotMatch(w, INSTALLED_SLUG, `${w}: no installed site's plane (its slug, at most 40 characters)`);
        assert.ok(!MEMBERS.some((m) => w.startsWith(`${m}-`)), `${w}: no installed site's member or container (<member>-<slug>)`);
      }
      for (const k of buckets(N)) {
        assert.match(k, /^[a-z0-9-]{3,63}$/, `${k}: a bucket name`);
        assert.ok(!k.startsWith("bio-"), `${k}: no installed site's bucket (bio-captures-<slug>, bio-published-<slug>)`);
      }
    }
    const all = (N) => [...workers(N), ...buckets(N)];
    assert.equal(new Set([...all(A), ...all(B)]).size, all(A).length + all(B).length, `${a} and ${b}: no name shared`);
    assert.ok(!all(B).some((n) => n.startsWith(A.prefix)) && !all(A).some((n) => n.startsWith(B.prefix)), `${a} and ${b}: neither's names begin the other's`);
    assert.ok(A.prefix.startsWith(PREFIX));
  }
  for (const bad of ["", "A1", "1a", "a-b", "a_b", "abcdefghijklm", "a b"])
    assert.throws(() => copyNames(bad), /REFUSED \[BAD_COPY\]/, JSON.stringify(bad));
});

test("R43: a configuration is generated for the copy: its names, the one account, its buckets, and every service and Durable Object target renamed; a target that is neither the plane nor a member is refused", () => {
  const N = copyNames("w1");
  const members = ["pdf-worker", "agent-runner", "agent-worker"];
  const plane = generatedConfig({ $schema: "x", name: "bio-plane", account_id: OTHER, main: "src/plane/index.mjs", vars: { VERSION: "1.2.3" },
    services: [{ binding: "PDF_WORKER", service: "pdf-worker" }, { binding: "SELF", service: "bio-plane" }],
    r2_buckets: [{ binding: "CAPTURES", bucket_name: "bio-captures" }, { binding: "PUBLISHED", bucket_name: "bio-published" }],
    durable_objects: { bindings: [{ name: "STORE", class_name: "Store" }] } },
  { name: N.plane, account: ACCOUNT, names: N, members, plane: true, host: `${N.plane}.sub.workers.dev`, main: "dist/bio-plane.bundled.mjs" });
  assert.deepEqual(plane, { name: N.plane, account_id: ACCOUNT, main: "dist/bio-plane.bundled.mjs", workers_dev: true,
    vars: { VERSION: "1.2.3", INSTANCE_NAME: N.plane, OWN_HOSTS: `${N.plane}.sub.workers.dev` },
    services: [{ binding: "PDF_WORKER", service: N.member("pdf-worker") }, { binding: "SELF", service: N.plane }],
    r2_buckets: [{ binding: "CAPTURES", bucket_name: N.bucket("captures") }, { binding: "PUBLISHED", bucket_name: N.bucket("published") }],
    durable_objects: { bindings: [{ name: "STORE", class_name: "Store" }] } });
  const worker = { name: "agent-worker", account_id: ACCOUNT, services: [{ binding: "PLANE", service: "bio-plane" }],
    durable_objects: { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }, { name: "SEGMENTS", class_name: "SegmentDriver" }] } };
  const first = generatedConfig(worker, { name: N.member("agent-worker"), account: ACCOUNT, names: N, members, services: false });
  assert.equal(first.services, undefined, "a member's first deploy carries no service binding");
  assert.deepEqual(first.durable_objects.bindings, [{ name: "REMOTE", class_name: "RemoteSession", script_name: N.member("agent-runner") }, { name: "SEGMENTS", class_name: "SegmentDriver" }]);
  assert.deepEqual(generatedConfig(worker, { name: N.member("agent-worker"), account: ACCOUNT, names: N, members }).services, [{ binding: "PLANE", service: N.plane }]);
  assert.deepEqual(worker.services, [{ binding: "PLANE", service: "bio-plane" }], "the Worker's own configuration is left as it was");
  assert.throws(() => generatedConfig({ name: "x", services: [{ binding: "S", service: "somewhere-else" }] }, { name: "y", account: ACCOUNT, names: N, members }), /REFUSED \[UNKNOWN_TARGET\]/);
  assert.throws(() => generatedConfig({ name: "x", r2_buckets: [{ binding: "OTHER", bucket_name: "b" }] }, { name: "y", account: ACCOUNT, names: N, members }), /REFUSED \[UNKNOWN_BUCKET\]/);
});

test("R43, R44, R45: another account, none, no token, or a process.json naming no development account is refused before any request", async () => {
  const r = await repo();
  try {
    for (const cmd of ["deploy", "seed", "remove"]) {
      for (const [env, code] of [[{ CF_ACCT: OTHER }, "NOT_DEVELOPMENT_ACCOUNT"], [{ CF_ACCT: "" }, "NOT_DEVELOPMENT_ACCOUNT"], [{ CF_TOKEN: "" }, "NO_TOKEN"]]) {
        const res = devCopy(r, [cmd, "walk1"], { env });
        refused(res, code);
        assert.deepEqual([res.calls, res.wrangler], [[], []], `${cmd} ${code}: no request was made, nothing deployed`);
      }
      const bad = devCopy(r, [cmd, "Walk-1"]);
      refused(bad, "BAD_COPY");
      assert.deepEqual(bad.calls, []);
    }
    writeFileSync(join(r.root, "process.json"), "{}\n");
    const none = devCopy(r, ["deploy", "walk1"]);
    refused(none, "NO_DEVELOPMENT_ACCOUNT");
    assert.deepEqual(none.calls, []);
    assert.equal(devCopy(r, []).status, 2, "no command: the usage line");
  } finally { r.done(); }
});

test("R43: deploy builds the checkout, puts up the whole copy under its own names in the development account, sends fresh instance values it never prints or writes to the repository, and prints the copy's and the documents site's addresses", async () => {
  const r = await repo();
  const N = copyNames("walk1");
  try {
    const res = devCopy(r, ["deploy", "walk1"]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    /* the checkout was built (R46), every bundle into its dist/ */
    for (const d of ["alpha-worker/dist/alpha-worker.bundled.mjs", "beta-worker/dist/beta-worker.bundled.mjs", "bio-plane/dist/bio-plane.bundled.mjs"])
      assert.ok(existsSync(join(r.root, d)), `built ${d}`);
    /* every request named the development account, and only it */
    assert.ok(res.calls.length > 0 && res.calls.every((c) => !c.url.includes("api.cloudflare.com") || c.url.includes(`/accounts/${ACCOUNT}/`)), "every request is to the development account");
    assert.ok(res.calls.every((c) => c.bearer || !c.url.includes("api.cloudflare.com")), "with the token");
    /* the buckets, the Workers in order, the secrets */
    assert.deepEqual(res.calls.filter((c) => c.bucket).map((c) => c.bucket), [N.bucket("captures"), N.bucket("published")]);
    const deployed = res.wrangler.map((w) => JSON.parse(w.config));
    assert.deepEqual(deployed.map((c) => c.name), [N.member("alpha-worker"), N.member("beta-worker"), N.plane, N.member("alpha-worker"), N.member("beta-worker"), N.documents]);
    assert.ok(deployed.every((c) => c.account_id === ACCOUNT), "every Worker pinned to the development account");
    assert.ok(res.wrangler.every((w) => w.args[0] === "deploy" && w.token === "present"));
    assert.deepEqual(deployed.slice(0, 2).map((c) => c.services), [undefined, undefined], "members first without service bindings");
    assert.deepEqual(deployed.slice(3, 5).map((c) => c.services), [[{ binding: "PLANE", service: N.plane }], [{ binding: "PLANE", service: N.plane }]], "then whole, bound to the copy's plane");
    const plane = deployed[2];
    assert.deepEqual([plane.main, plane.workers_dev, plane.vars.INSTANCE_NAME, plane.vars.OWN_HOSTS], ["dist/bio-plane.bundled.mjs", true, N.plane, `${N.plane}.sub.workers.dev`]);
    assert.deepEqual(plane.services, [{ binding: "SELF", service: N.plane }]);
    assert.deepEqual(plane.r2_buckets.map((b) => b.bucket_name), [N.bucket("captures"), N.bucket("published")]);
    assert.deepEqual(res.calls.filter((c) => c.secret).map((c) => [c.url.includes(`/workers/scripts/${N.plane}/secrets`), c.secret, c.type, c.text]),
      INSTANCE_VALUES.map((n) => [true, n, "secret_text", "present"]));
    assert.deepEqual(deployed[5].durable_objects.bindings, [{ name: "EDITION", class_name: "Edition" }]);
    /* the instance values: kept outside the repository, owner only, and nowhere else */
    const file = join(r.keep, "walk1.json");
    assert.equal(statSync(file).mode & 0o777, 0o600);
    const { values } = JSON.parse(readFileSync(file, "utf8"));
    assert.deepEqual(Object.keys(values), [...INSTANCE_VALUES]);
    for (const v of Object.values(values)) assert.match(v, /^[A-Za-z0-9_-]{43}$/, "32 random bytes, base64url");
    const everywhere = [res.stdout, res.stderr, JSON.stringify(res.calls), JSON.stringify(res.wrangler)].join("\n");
    const repoFiles = [];
    const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === "node_modules") continue; const p = join(d, e.name); e.isDirectory() ? walk(p) : repoFiles.push(p); } };
    walk(r.root);
    for (const v of Object.values(values)) {
      assert.ok(!everywhere.includes(v), "no instance value is printed, logged or handed to wrangler");
      for (const f of repoFiles) assert.ok(!readFileSync(f).includes(v), `no instance value in ${relative(r.root, f)}`);
    }
    assert.ok(!repoFiles.some((f) => f.endsWith(".wrangler.devcopy.generated.json")), "every generated configuration removed");
    /* what it printed */
    assert.match(res.stdout, new RegExp(`address: https://${N.plane}\\.sub\\.workers\\.dev/`));
    assert.match(res.stdout, new RegExp(`documents site: https://${N.documents}\\.sub\\.workers\\.dev/`));
    for (const p of Object.keys(DOCUMENTS)) assert.ok(res.stdout.includes(`https://${N.documents}.sub.workers.dev${p}`), `prints ${p}`);
    for (const line of ["built:", "bucket:", "deployed:", "secrets:"]) assert.ok(res.stdout.includes(line), `prints each step: ${line}`);
    /* again: replaced in place, with values made fresh */
    const again = devCopy(r, ["deploy", "walk1"], { stub: { account: { buckets: { [N.bucket("captures")]: [], [N.bucket("published")]: [] } } } });
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.match(again.stdout, /already there/);
    const fresh = JSON.parse(readFileSync(file, "utf8")).values;
    assert.ok(INSTANCE_VALUES.every((n) => fresh[n] !== values[n]), "never reused");
  } finally { r.done(); }
});

test("R43: a build or a wrangler deploy that fails stops the deploy by name", async () => {
  const r = await repo();
  try {
    const failing = devCopy(r, ["deploy", "walk1"], { env: { WRANGLER_EXIT: "7" } });
    refused(failing, "DEPLOY_FAILED");
    assert.equal(failing.wrangler.length, 1, "nothing deployed after the first failure");
    writeFileSync(join(r.root, "alpha-worker/src/word.mjs"), 'export { word } from "./missing.mjs";\n');
    const unbuilt = devCopy(r, ["deploy", "walk1"]);
    refused(unbuilt, "BUILD_FAILED");
    assert.deepEqual([unbuilt.calls, unbuilt.wrangler], [[], []], "nothing requested or deployed from a checkout that does not build");
    const inside = devCopy(r, ["deploy", "walk1"], { env: { CIVICSMITH_DEV_COPIES: join(r.root, "values") } });
    refused(inside, "STATE_IN_REPOSITORY");
  } finally { r.done(); }
});

test("R43: a container member's image is pulled by the digest its marker names, pushed under the copy's name, and its Worker deployed with that image", async () => {
  const r = await repo();
  const N = copyNames("walk1");
  try {
    addContainerMember(r.root, "runner-worker");
    const res = devCopy(r, ["deploy", "walk1"]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const tag = `${N.member("runner-worker")}:${DIGEST.slice(7, 19)}`;
    assert.deepEqual(res.docker.map((d) => d.args), [["pull", `docker.io/civicos/runner@${DIGEST}`], ["tag", `docker.io/civicos/runner@${DIGEST}`, tag]]);
    assert.ok(res.wrangler.some((w) => w.args.join(" ") === `containers push ${tag}`), "pushed to the account's registry");
    const runner = res.wrangler.filter((w) => w.config).map((w) => JSON.parse(w.config)).filter((c) => c.name === N.member("runner-worker"));
    assert.equal(runner.length, 2, "deployed first and whole");
    for (const c of runner) assert.deepEqual(c.containers.map((x) => x.image), [`registry.cloudflare.com/${ACCOUNT}/${tag}`]);
    refused(devCopy(r, ["deploy", "walk1"], { env: { DOCKER_EXIT: "1" } }), "DEPLOY_FAILED");
  } finally { r.done(); }
});

test("R43: the documents site serves each document the journeys capture at its fixed address, and the amended notice at the notice's own address once asked (J23)", async () => {
  const mf = new Miniflare({ modules: true, script: documentsModule(), compatibilityDate: "2026-07-01",
    durableObjects: { EDITION: { className: "Edition", useSQLite: true } } });
  try {
    const get = async (p) => { const res = await mf.dispatchFetch(`https://docs.test${p}`); return { status: res.status, type: res.headers.get("content-type"), text: await res.text() }; };
    for (const [p, d] of Object.entries(DOCUMENTS)) {
      const g = await get(p);
      assert.deepEqual([g.status, g.type], [200, d.type], p);
    }
    const notice = "/lakeshore/housing/notices/2026-118";
    assert.equal((await get(notice)).text, noticePage(false));
    assert.match((await get(notice)).text, /within 28 days/);
    assert.match((await get("/lakeshore/data/housing-repair-orders-2026.csv")).text, /^2026-118,14 Lakeshore Row,/m);
    assert.match((await get("/courts/lakeshore-county/cv-2026-0412/order-2026-09-15")).text, /no later than 15 December 2026/);
    assert.match((await get("/lakeshore/finance/adopted-budget-2026")).text, /Housing code inspections<\/td><td>\$1,240,000/);
    assert.equal((await mf.dispatchFetch("https://docs.test/_walk/notice/amended")).status, 405, "only a POST changes the edition");
    assert.equal((await mf.dispatchFetch("https://docs.test/_walk/notice/amended", { method: "POST" })).status, 200);
    assert.match((await get(notice)).text, /within 14 days/, "the same address now serves the amended notice");
    await mf.dispatchFetch("https://docs.test/_walk/notice/original", { method: "POST" });
    assert.match((await get(notice)).text, /within 28 days/);
    assert.equal((await get("/nowhere")).status, 404);
    assert.match((await get("/")).text, /Documents the walks capture/);
  } finally { await mf.dispose(); }
});

test("R44: seed records the copy's group through the plane's own admin operation, with the instance value deploy made, and leaves the first-use door open; it refuses a copy that is not up", async () => {
  const r = await repo();
  const N = copyNames("walk1");
  try {
    const notDeployed = devCopy(r, ["seed", "walk1"], { stub: { account: { scripts: [N.plane] } } });
    refused(notDeployed, "COPY_NOT_UP");
    assert.ok(!notDeployed.calls.some((c) => c.op), "no operation of the plane was called");
    writeFileSync(join(r.keep, "walk1.json"), JSON.stringify({ copy: "walk1", plane: N.plane, values: { ADMIN_TOKEN: "an-admin-value-for-the-test-0123456789abcd" } }));
    const down = devCopy(r, ["seed", "walk1"]);
    refused(down, "COPY_NOT_UP");
    assert.ok(!down.calls.some((c) => c.op));

    const up = devCopy(r, ["seed", "walk1"], { stub: { account: { scripts: [N.plane] } } });
    assert.equal(up.status, 0, up.stdout + up.stderr);
    const ops = up.calls.filter((c) => c.op);
    assert.deepEqual(ops.map((c) => [c.op, c.method, c.bearer, c.body]), [["instancegroupseed", "POST", true, { slug: GROUP }], ["bootstrap", "GET", false, null]],
      "only the admin operation, by the copy's ADMIN_TOKEN, and the door's own state; no member, sign-in or team");
    assert.ok(ops.every((c) => c.url.startsWith(`https://${N.plane}.sub.workers.dev/api/`)));
    assert.match(up.stdout, /first-use door: open/);
    assert.ok(!(up.stdout + up.stderr + JSON.stringify(up.calls)).includes("an-admin-value-for-the-test"), "the instance value is never printed");
    assert.equal(devCopy(r, ["seed", "walk1"], { stub: { account: { scripts: [N.plane], planeAdmin: { recorded: true } } } }).status, 0, "seeded twice is seeded");
    refused(devCopy(r, ["seed", "walk1"], { stub: { account: { scripts: [N.plane], planeAdmin: { door: "closed" } } } }), "DOOR_CLOSED");
  } finally { r.done(); }
});

test("R45: remove deletes every Worker, container application, bucket with its objects and database named for the copy and nothing else, reads the account back, and succeeds for a copy already gone", async () => {
  const r = await repo();
  const A = copyNames("walk1"), B = copyNames("walk2");
  const holding = (copy) => ({ scripts: [copy.plane, copy.documents, copy.member("pdf-worker")],
    buckets: { [copy.bucket("captures")]: ["captures/one", "captures/two"], [copy.bucket("published")]: [] },
    containers: [{ id: `id-${copy.plane}`, name: `${copy.member("agent-runner")}-agentrunner` }], d1: [{ uuid: `u-${copy.plane}`, name: `${copy.prefix}db` }] });
  const installed = { scripts: ["lakeshore", "pdf-worker-lakeshore", "bio-install-lock"], buckets: { "bio-captures-lakeshore": ["x"] },
    containers: [{ id: "c1", name: "agent-runner-lakeshore" }], d1: [{ uuid: "u1", name: "lakeshore-db" }] };
  const account = (extra = {}) => {
    const a = holding(A), b = holding(B);
    return { scripts: [...a.scripts, ...b.scripts, ...installed.scripts], buckets: { ...a.buckets, ...b.buckets, ...installed.buckets },
      containers: [...a.containers, ...b.containers, ...installed.containers], d1: [...a.d1, ...b.d1, ...installed.d1], ...extra };
  };
  try {
    writeFileSync(join(r.keep, "walk1.json"), "{}");
    const res = devCopy(r, ["remove", "walk1"], { stub: { account: account() } });
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const deletes = res.calls.filter((c) => c.method === "DELETE").map((c) => decodeURIComponent(new URL(c.url).pathname));
    assert.ok(deletes.length >= 9 && deletes.every((p) => p.includes(A.prefix) || p.includes(`id-${A.plane}`) || p.includes(`u-${A.plane}`)), `only walk1's: ${deletes.join("\n")}`);
    for (const n of [A.plane, A.documents, A.member("pdf-worker")]) assert.ok(deletes.some((p) => p.endsWith(`/workers/scripts/${n}`)), `Worker ${n}`);
    for (const k of ["captures/one", "captures/two"]) assert.ok(deletes.some((p) => p.endsWith(`/r2/buckets/${A.bucket("captures")}/objects/${k}`)), `object ${k}`);
    for (const b of [A.bucket("captures"), A.bucket("published")]) assert.ok(deletes.some((p) => p.endsWith(`/r2/buckets/${b}`)), `bucket ${b}`);
    assert.ok(deletes.some((p) => p.endsWith(`/containers/applications/id-${A.plane}`)) && deletes.some((p) => p.endsWith(`/d1/database/u-${A.plane}`)));
    assert.match(res.stdout, /copy walk1 removed: 7 thing\(s\) deleted, and the account holds nothing named for it/);
    assert.equal(existsSync(join(r.keep, "walk1.json")), false, "its instance values are gone with it");
    assert.ok(res.calls.filter((c) => c.method === "GET" && /\/workers\/scripts$/.test(new URL(c.url).pathname)).length === 2, "the account was read back");

    const gone = devCopy(r, ["remove", "walk1"], { stub: { account: { scripts: [...holding(B).scripts, ...installed.scripts], buckets: {}, containers: [], d1: [] } } });
    assert.equal(gone.status, 0, gone.stdout + gone.stderr);
    assert.match(gone.stdout, /copy walk1 was not there/);
    assert.ok(!gone.calls.some((c) => c.method === "DELETE"));

    const left = devCopy(r, ["remove", "walk1"], { stub: { account: account({ sticky: [A.documents, A.bucket("published")] }) } });
    refused(left, "LEFTOVERS");
    assert.match(left.stderr, new RegExp(`Worker ${A.documents}.*bucket ${A.bucket("published")}`));
  } finally { r.done(); }
});
