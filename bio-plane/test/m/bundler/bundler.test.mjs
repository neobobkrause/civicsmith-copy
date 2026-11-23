/* bundler: requirement-named tests at the module's interface
 * (build/requirements/bundler.md). Each test names the requirement id it checks
 * in its title. Every build runs over a tiny fixture member in a temporary
 * directory; esbuild comes from the plane's installed dependencies. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_EXTERNAL, discoverMembers, buildMember, manifestFrom, sha256, isContainer, containerDescriptor, imageReference, containerClasses, containerParts, classPackages, statementPackages, workerPart, WORKER_PART_PATH, BUCKET_ROLES, SOURCE_FIELD, containerSourceHash, containerImageStates, containerImageFindings, recordContainerDigest, bundleExports, bindingFindings } from "../../../scripts/fleet-bundle.mjs";
import { parseJsonc } from "../../../scripts/jsonc.mjs";

/** @import { Member } from "../../../scripts/fleet-bundle.mjs" */

const hex = (b) => createHash("sha256").update(b).digest("hex");
/**
 * A fixture descriptor as a Member: what a test leaves out is filled with values no function under test reads.
 * @param {Record<string, any>} o
 * @returns {Member}
 */
const asMember = (o) => /** @type {Member} */ ({ dir: o.name, abs: "/nowhere", ...o,
  bundle: o.bundle ? { outfile: "dist/x.bundled.mjs", manifest: "dist/x.bundle.json", ...o.bundle } : o.bundle });
/**
 * A value the test requires to be present, failing by name where it is not.
 * @template T
 * @param {T} x
 * @param {string} [what]
 * @returns {NonNullable<T>}
 */
const must = (x, what = "present") => { assert.ok(x !== null && x !== undefined, what); return /** @type {NonNullable<T>} */ (x); };
const tmp = (tag) => mkdtempSync(join(tmpdir(), `bundler-${tag}-`));

/** Writes a fixture member under `root/dir`: a two-file first-party source, one
 *  vendored dependency under node_modules, a lockfile, and the declared externals. */
function fixture(root, dir = "probe", { name = dir, lock = true, vendored = true, external } = {}) {
  const abs = join(root, dir);
  mkdirSync(join(abs, "src"), { recursive: true });
  writeFileSync(join(abs, "src/dep.mjs"), "export const N = 1;\n");
  writeFileSync(join(abs, "src/index.mjs"),
    'import { N } from "./dep.mjs";\n'
    + (vendored ? 'import { V } from "fakedep";\n' : "const V = 0;\n")
    + 'import { env } from "cloudflare:workers";\n'
    + 'import { readFileSync } from "node:fs";\n'
    + "export default { fetch() { return new Response(String(N + V) + typeof env + typeof readFileSync); } };\n");
  if (vendored) {
    mkdirSync(join(abs, "node_modules/fakedep"), { recursive: true });
    writeFileSync(join(abs, "node_modules/fakedep/package.json"),
      JSON.stringify({ name: "fakedep", version: "1.0.0", type: "module", exports: "./index.mjs" }));
    writeFileSync(join(abs, "node_modules/fakedep/index.mjs"), "export const V = 40;\n");
  }
  if (lock) writeFileSync(join(abs, "package-lock.json"), JSON.stringify({ name, lockfileVersion: 3 }) + "\n");
  const bundle = { entry: "src/index.mjs", outfile: `dist/${name}.bundled.mjs`, manifest: `dist/${name}.bundle.json` };
  if (external) bundle.external = external;
  writeFileSync(join(abs, "fleet-member.json"), JSON.stringify({ name, entry: "src/index.mjs", bundle }));
  return must(discoverMembers(root).find((m) => m.name === name), name);
}

/* ------------------------------------------- container fixtures (R25, R27, R35, R36, R37) */

const DIGEST = "sha256:" + "0f".repeat(32);
const IMAGE = { repository: "docker.io/civicos/runner", digest: DIGEST, platform: "linux/amd64", port: 8080, schedulingPolicy: "default" };

/** A container member's marker under `root/dir`, with no Worker bundle unless `bundle` is given. */
function containerFixture(root, dir, { image = IMAGE, noImage = false, kind = "container", extra = {} } = {}) {
  mkdirSync(join(root, dir, "src"), { recursive: true });
  writeFileSync(join(root, dir, "src/entry.mjs"), "export const runner = 1;\n");
  writeFileSync(join(root, dir, "fleet-member.json"), JSON.stringify({ name: dir, kind, entry: "src/entry.mjs",
    ...(noImage ? {} : { image }), ...extra }));
}

/* ------------------------------------------------------------- R25 (functions) */

test("R25: containerDescriptor writes the part from the marker — class_name, image as <repository>@sha256:<64 hex>, scheduling_policy default, max_instances, bind — and names every field it lacks", () => {
  const member = (marker, bundle = { entry: "src/index.mjs" }) => asMember({ name: "runner", bundle, marker });
  const full = { kind: "container", image: IMAGE, class_name: "AgentRunner", max_instances: 4,
    bind: [{ member: "agent-worker", binding: "RUNNER" }] };
  const names = ["agent-worker", "runner"];
  const d = containerDescriptor(member(full), names);
  const want = { class_name: "AgentRunner", image: `docker.io/civicos/runner@${DIGEST}`, scheduling_policy: "default",
    max_instances: 4, bind: [{ member: "agent-worker", binding: "RUNNER" }] };
  assert.deepEqual(d.descriptor, want);
  assert.deepEqual(Object.keys(d.descriptor), ["class_name", "image", "scheduling_policy", "max_instances", "bind"]);
  assert.equal(d.bytes.toString("utf8"), JSON.stringify(want, null, 2) + "\n");
  assert.equal(must(containerDescriptor(member({ ...full, image: { ...IMAGE, schedulingPolicy: undefined } }), names).descriptor).scheduling_policy,
    "default", "an unstated policy is default, the only one the part carries");

  const lacks = (marker, bundle) => containerDescriptor(member(marker, bundle), names).missing;
  assert.deepEqual(lacks(full, null), ["bundle"]);
  assert.deepEqual(lacks({ ...full, image: { ...IMAGE, digest: null } }), ["image.digest"]);
  for (const digest of ["sha256:" + "0f".repeat(31), "sha256:" + "0F".repeat(32), "0f".repeat(32), "sha512:" + "0f".repeat(32)])
    assert.deepEqual(lacks({ ...full, image: { ...IMAGE, digest } }), ["image.digest"], digest);
  for (const repository of [undefined, "", "runner", "docker.io/civicos/runner@sha256:x", "Docker.io/x/y"])
    assert.deepEqual(lacks({ ...full, image: { ...IMAGE, repository } }), ["image.repository"], String(repository));
  assert.deepEqual(lacks({ ...full, image: undefined }), ["image"]);
  assert.deepEqual(lacks({ ...full, image: { ...IMAGE, schedulingPolicy: "regional" } }), ["image.schedulingPolicy"]);
  for (const class_name of [undefined, "", "1Runner", "a-b"])
    assert.deepEqual(lacks({ ...full, class_name }), ["class_name"], String(class_name));
  for (const max_instances of [undefined, 0, -1, 1.5, "4"])
    assert.deepEqual(lacks({ ...full, max_instances }), ["max_instances"], String(max_instances));
  for (const bind of [undefined, [], [{ member: "no-such", binding: "RUNNER" }], [{ member: "agent-worker" }],
    [{ member: "agent-worker", binding: "bad-name" }], ["agent-worker"]])
    assert.deepEqual(lacks({ ...full, bind }), ["bind"], JSON.stringify(bind));
  assert.deepEqual(lacks({ kind: "container" }, null), ["bundle", "image", "class_name", "max_instances", "bind"],
    "every field it lacks, each named");
});

test("R25: imageReference names the image only by digest, in agent-runner R7's form, or names the field that does not say it", () => {
  assert.deepEqual(imageReference(IMAGE), { reference: `docker.io/civicos/runner@${DIGEST}` });
  assert.deepEqual(imageReference({ ...IMAGE, repository: "registry.example.test:5000/a/b" }),
    { reference: `registry.example.test:5000/a/b@${DIGEST}` });
  assert.deepEqual(imageReference(null), { missing: "image" });
  assert.deepEqual(imageReference(/** @type {any} a digest left null on purpose */ ({ ...IMAGE, digest: null })), { missing: "image.digest" });
  assert.deepEqual(imageReference({ ...IMAGE, repository: "runner" }), { missing: "image.repository" });
  /* The repository's own marker states no digest until the release publishes the image (T33-D1). */
  const runner = must(discoverMembers().find((m) => m.name === "agent-runner"), "agent-runner");
  const own = imageReference(runner.image);
  assert.ok(own.reference ? /@sha256:[0-9a-f]{64}$/.test(own.reference) : own.missing === "image.digest", JSON.stringify(own));
});

/* --------------------------------------------- R24, R25, R27: a member with two classes (T36-2) */

const BASE = "sha256:" + "1e".repeat(32), OTHER = "sha256:" + "2e".repeat(32);
const TWO = () => [
  { class_name: "FileScanner", max_instances: 4,
    image: { ...IMAGE, repository: "docker.io/civicos/file-scanner", base: { digest: BASE }, packages: "img/scan.json" } },
  { class_name: "SafeViewRenderer",
    image: { ...IMAGE, repository: "docker.io/civicos/safe-view", digest: "sha256:" + "3e".repeat(32), base: { digest: BASE } } },
];

test("R25: a member with more than one class gets one Container part per class, container/<class>.json, each its own class_name and image, max_instances and bind from the class else the member; one class is container.json as before", () => {
  const names = ["agent-worker", "plane-x"];
  const member = (marker) => asMember({ name: "scanner", dir: "scanner", abs: "/nowhere", bundle: { entry: "src/index.mjs" }, marker });
  const top = { kind: "container", containers: TWO(), max_instances: 1, bind: [{ member: "plane-x", binding: "FILE_SCANNER" }] };
  const got = containerParts(member(top), names, { packages: false });
  assert.deepEqual(must(got.parts).map((p) => p.path), ["container/FileScanner.json", "container/SafeViewRenderer.json"]);
  assert.deepEqual(must(got.parts).map((p) => p.descriptor), [
    { class_name: "FileScanner", image: `docker.io/civicos/file-scanner@${DIGEST}`, scheduling_policy: "default", max_instances: 4,
      bind: [{ member: "plane-x", binding: "FILE_SCANNER" }] },
    { class_name: "SafeViewRenderer", image: `docker.io/civicos/safe-view@sha256:${"3e".repeat(32)}`, scheduling_policy: "default",
      max_instances: 1, bind: [{ member: "plane-x", binding: "FILE_SCANNER" }] },
  ], "each class its own image; max_instances from the class where stated, else the member's");
  for (const p of must(got.parts)) assert.equal(p.bytes.toString("utf8"), JSON.stringify(p.descriptor, null, 2) + "\n");
  const perClassBind = TWO().map((c, i) => ({ ...c, bind: [{ member: "agent-worker", binding: i ? "RENDER" : "SCAN" }] }));
  assert.deepEqual(must(containerParts(member({ ...top, containers: perClassBind }), names, { packages: false }).parts).map((p) => must(p.descriptor).bind),
    [[{ member: "agent-worker", binding: "SCAN" }], [{ member: "agent-worker", binding: "RENDER" }]], "a class's own bind wins");

  /* One class, either form: the part is container.json, exactly what containerDescriptor writes. */
  const one = { kind: "container", image: IMAGE, class_name: "Runner", max_instances: 2, bind: [{ member: "agent-worker", binding: "R" }] };
  const single = containerParts(member(one), names, { packages: false });
  assert.deepEqual(must(single.parts).map((p) => [p.path, p.bytes.toString()]), [["container.json", must(containerDescriptor(member(one), names).bytes).toString()]]);
  const listOfOne = { kind: "container", containers: [{ class_name: "Runner", image: IMAGE }], max_instances: 2, bind: one.bind };
  assert.deepEqual(must(containerParts(member(listOfOne), names, { packages: false }).parts).map((p) => [p.path, p.bytes.toString()]),
    must(single.parts).map((p) => [p.path, p.bytes.toString()]), "a list of one is one class");
  assert.equal(containerClasses(member(listOfOne)).multi, false);
  assert.equal(containerClasses(member(top)).multi, true);
});

test("R25: a class lacking a field is refused naming the class and every field; a duplicated class, both forms at once, or no bundle are refused too", () => {
  const names = ["plane-x"];
  const member = (marker, bundle = { entry: "src/index.mjs" }) => asMember({ name: "scanner", dir: "scanner", abs: "/nowhere", bundle, marker });
  const base = { kind: "container", max_instances: 1, bind: [{ member: "plane-x", binding: "FILE_SCANNER" }] };
  const lacks = (containers, extra = {}) => containerParts(member({ ...base, containers, ...extra }), names, { packages: false });
  const [a, b] = TWO();
  assert.deepEqual(lacks([a, { ...b, image: { ...b.image, digest: null } }]), { missing: ["image.digest"], class: "SafeViewRenderer" });
  assert.deepEqual(lacks([{ ...a, max_instances: 0 }, b]), { missing: ["max_instances"], class: "FileScanner" });
  assert.deepEqual(lacks([a, b], { bind: undefined }), { missing: ["bind"], class: "FileScanner" }, "no bind on the class or the member");
  assert.deepEqual(lacks([a, { ...b, class_name: "bad-name", image: { ...b.image, schedulingPolicy: "regional" } }]),
    { missing: ["image.schedulingPolicy", "class_name"], class: "bad-name" }, "every field it lacks");
  assert.deepEqual(lacks([a, { ...b, class_name: undefined }]), { missing: ["class_name"], class: "(unnamed)" });
  assert.deepEqual(lacks([a, { ...b, class_name: "FileScanner" }]), { missing: ["class_name"], class: "FileScanner" }, "two classes, one name");
  assert.match(must(lacks([a, b], { image: IMAGE }).missing)[0], /^image \(a top-level image beside a `containers` list\)$/);
  assert.deepEqual(containerParts(member({ ...base, containers: TWO() }, null), names), { missing: ["bundle"] });
});

test("R27: a class naming a package statement reads its packages from it, sorted, under the ecosystem it names, only when its base digest is the marker's; otherwise unread naming the file, the package or the digest", () => {
  const root = tmp("r27st");
  try {
    const dir = join(root, "scanner");
    mkdirSync(join(dir, "img"), { recursive: true });
    const st = { ecosystem: "Debian:12", base: { repository: "docker.io/library/debian", digest: BASE },
      packages: [{ name: "clamav", version: "1.4.3" }, { name: "bzip2", version: "1.0.8" }, { name: "clamav", version: "1.0.0" }] };
    const file = join(dir, "img/scan.json");
    const write = (o) => writeFileSync(file, typeof o === "string" ? o : JSON.stringify(o));
    write(st);
    const sorted = [{ name: "bzip2", version: "1.0.8" }, { name: "clamav", version: "1.0.0" }, { name: "clamav", version: "1.4.3" }];
    assert.deepEqual(statementPackages(file, "scanner/img/scan.json", BASE), { ecosystem: "Debian:12", packages: sorted });
    const m = asMember({ name: "scanner", dir: "scanner", abs: dir, bundle: { entry: "src/index.mjs" },
      marker: { kind: "container", containers: TWO(), max_instances: 1, bind: [{ member: "plane-x", binding: "F" }] } });
    const [scan, render] = containerClasses(m).classes;
    assert.deepEqual(classPackages(m, scan), { ecosystem: "Debian:12", packages: sorted });
    assert.deepEqual(classPackages(m, render), { unread: "scanner/package-lock.json is missing" },
      "a class naming no statement installs from npm: the member's lockfile");
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/x": { version: "1.0.0" } } }));
    assert.deepEqual(classPackages(m, render), { ecosystem: "npm", packages: [{ name: "x", version: "1.0.0" }] });
    const parts = containerParts(m, ["plane-x"]);
    assert.deepEqual(must(parts.parts).map((p) => must(p.descriptor).packages), [sorted, [{ name: "x", version: "1.0.0" }]], "each part its own image's list, last");

    const unread = () => statementPackages(file, "scanner/img/scan.json", BASE).unread;
    const cases = [
      ["scanner/img/scan.json is missing", () => rmSync(file)],
      ["scanner/img/scan.json does not parse", () => write("{ torn")],
      ["scanner/img/scan.json does not parse: it names no ecosystem", () => write({ ...st, ecosystem: undefined })],
      ["scanner/img/scan.json does not parse: it has no `packages` list", () => write({ ...st, packages: undefined })],
      ["scanner/img/scan.json names no base image digest", () => write({ ...st, base: { repository: "debian" } })],
      [`scanner/img/scan.json was taken against the base ${OTHER}, not the base the marker pins (${BASE})`, () => write({ ...st, base: { digest: OTHER } })],
      ["scanner/img/scan.json names the package bzip2 without a version", () => write({ ...st, packages: [{ name: "bzip2" }] })],
      ["scanner/img/scan.json names a package with no name", () => write({ ...st, packages: [{ version: "1" }] })],
    ];
    for (const [named, arrange] of cases) {
      arrange();
      const u = unread();
      assert.ok(typeof u === "string" && u.startsWith(named), `${named}: ${u}`);
      write(st);
    }
    assert.match(must(statementPackages(file, "scanner/img/scan.json", null).unread), /not the base the marker pins \(none\)/, "a marker pinning no base");
    const away = { ...scan, image: { ...scan.image, packages: "../elsewhere.json" } };
    assert.match(must(classPackages(m, away).unread), /names no package statement for FileScanner as a member-relative path/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------- R25 (functions): a member's Worker part (N772, K2155) */

test("R25: workerPart writes {r2_buckets, crons} from a member's config, each bucket by its role and the crons as stated; none for a member with neither; every binding with no role, and every list that is not one, named", () => {
  assert.equal(WORKER_PART_PATH, "worker.json");
  assert.deepEqual(BUCKET_ROLES, { "bio-captures": "captures", "bio-published": "published" }, "the plane's two buckets, the only roles");
  const cfg = { name: "m", r2_buckets: [{ binding: "PUBLISHED", bucket_name: "bio-published" }, { binding: "CAPTURES", bucket_name: "bio-captures" }],
    triggers: { crons: ["17 4 * * *"] }, services: [{ binding: "PLANE", service: "bio-plane" }] };
  const w = workerPart(cfg);
  const want = { r2_buckets: [{ binding: "PUBLISHED", bucket: "published" }, { binding: "CAPTURES", bucket: "captures" }], crons: ["17 4 * * *"] };
  assert.deepEqual(must(w.part).descriptor, want, "the config's order, the role for the bucket name");
  assert.equal(must(w.part).bytes.toString("utf8"), JSON.stringify(want, null, 2) + "\n");
  assert.deepEqual(must(workerPart({ r2_buckets: [{ binding: "CAPTURES", bucket_name: "bio-captures" }] }).part).descriptor,
    { r2_buckets: [{ binding: "CAPTURES", bucket: "captures" }], crons: [] });
  assert.deepEqual(must(workerPart({ triggers: { crons: ["0 0 * * *"] } }).part).descriptor, { r2_buckets: [], crons: ["0 0 * * *"] });
  for (const none of [{}, { r2_buckets: [], triggers: { crons: [] } }, { triggers: {} }, null, undefined])
    assert.deepEqual(workerPart(none), { part: null }, JSON.stringify(none));

  const lacks = (c) => workerPart(c).missing;
  assert.deepEqual(lacks({ r2_buckets: [{ binding: "ARCHIVE", bucket_name: "archive" }, { binding: "CAPTURES", bucket_name: "bio-captures" },
    { binding: "X" }, { bucket_name: "bio-published" }, "CAPTURES"] }),
    ["ARCHIVE", "X", "(an R2 bucket binding with no name)", "(an R2 bucket binding with no name)"], "each binding with no role, by name");
  assert.deepEqual(lacks({ r2_buckets: [{ binding: "C", bucket_name: "constructor" }] }), ["C"], "only the two roles, never an inherited key");
  assert.deepEqual(lacks({ r2_buckets: {} }), ["r2_buckets"]);
  for (const triggers of [{ crons: "17 4 * * *" }, { crons: [1] }, { crons: [" "] }, ["17 4 * * *"], "x"])
    assert.deepEqual(lacks({ triggers }), ["triggers.crons"], JSON.stringify(triggers));
  assert.deepEqual(lacks({ r2_buckets: [{ binding: "A", bucket_name: "a" }], triggers: { crons: [null] } }), ["A", "triggers.crons"], "both named");
});

test("R25: the repository's own members with buckets or crons carry a Worker part, every bucket with a role; file-scanner's names CAPTURES and its daily schedule", () => {
  const got = Object.fromEntries(discoverMembers().map((m) => {
    let cfg = null;
    try { cfg = parseJsonc(readFileSync(join(m.abs, "wrangler.jsonc"), "utf8")); } catch { /* a member with no config */ }
    return [m.name, cfg];
  }).filter(([, c]) => c));
  for (const [name, cfg] of Object.entries(got)) assert.equal(workerPart(cfg).missing, undefined, `${name}: every bucket has a role`);
  const scanner = must(workerPart(got["file-scanner"]).part).descriptor;
  assert.deepEqual(scanner.r2_buckets, [{ binding: "CAPTURES", bucket: "captures" }]);
  assert.ok(scanner.crons.length >= 1, "its schedule is stated");
});

test("R25 (K4094): workerPart states a member's own Durable Objects and migrations in order, each migration as {tag, classes}; another script's object (script_name) is not the member's and is left out; a part the Durable Objects alone need is written, and a member owning none is not", () => {
  const own = [{ name: "SEGMENTS", class_name: "SegmentDriver" }, { name: "CHECKS", class_name: "CheckRecord" }];
  const cfg = { durable_objects: { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }, ...own] },
    migrations: [{ tag: "v1", new_sqlite_classes: ["SegmentDriver"] }, { tag: "v2", new_sqlite_classes: ["CheckRecord"] }] };
  const w = workerPart(cfg);
  assert.deepEqual(must(w.part).descriptor, { r2_buckets: [], crons: [], durable_objects: { bindings: own,
    migrations: [{ tag: "v1", classes: ["SegmentDriver"] }, { tag: "v2", classes: ["CheckRecord"] }] } }, "the member's own objects, the migrations in order");
  assert.equal(must(w.part).bytes.toString("utf8"), JSON.stringify(must(w.part).descriptor, null, 2) + "\n");
  assert.deepEqual(workerPart({ durable_objects: { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }] } }), { part: null },
    "only another script's object: nothing of this member's to bind");
  assert.deepEqual(workerPart({ durable_objects: { bindings: [] }, migrations: [] }), { part: null }, "stated and empty: none");

  const lacks = (c) => workerPart(c).missing;
  assert.deepEqual(lacks({ durable_objects: { bindings: [{ name: "SCANNER" }] } }), ["durable_objects.bindings"], "a binding with no class");
  assert.deepEqual(lacks({ durable_objects: [{ name: "SCANNER", class_name: "FileScanner" }] }), ["durable_objects.bindings"], "a list that is not bindings");
  assert.deepEqual(lacks({ durable_objects: { bindings: [{ name: "SCANNER", class_name: "FileScanner" }] }, migrations: [{ tag: "1", new_sqlite_classes: ["FileScanner"] }] }),
    ["migrations"], "a tag the installer does not read");
  assert.deepEqual(lacks({ durable_objects: { bindings: [{ name: "S", class_name: "F" }] }, migrations: [{ tag: "v1", renamed_classes: [{ from: "A", to: "F" }] }] }),
    ["migrations"], "a migration that is not new classes is refused, never dropped");
  assert.deepEqual(lacks({ migrations: {} }), ["migrations"]);
});

test("R25 (K4094): over the repository's own fleet, each member's Worker part states the Durable Objects its configuration owns: agent-worker its two, agent-runner its one binding and every migration it declares, file-scanner its two", () => {
  const cfgOf = (name) => parseJsonc(readFileSync(join(must(discoverMembers().find((m) => m.name === name), name).abs, "wrangler.jsonc"), "utf8"));
  assert.deepEqual(must(must(workerPart(cfgOf("agent-worker")).part).descriptor.durable_objects), {
    bindings: [{ name: "SEGMENTS", class_name: "SegmentDriver" }, { name: "CHECKS", class_name: "CheckRecord" }],
    migrations: [{ tag: "v1", classes: ["SegmentDriver"] }, { tag: "v2", classes: ["CheckRecord"] }] });
  const runner = must(must(workerPart(cfgOf("agent-runner")).part).descriptor.durable_objects);
  assert.deepEqual(must(runner).bindings, [{ name: "AGENT_RUNNER", class_name: "AgentRunner" }]);
  assert.deepEqual(must(runner).migrations, cfgOf("agent-runner").migrations.map((m) => ({ tag: m.tag, classes: m.new_sqlite_classes })));
  assert.deepEqual(must(must(workerPart(cfgOf("file-scanner")).part).descriptor.durable_objects).bindings,
    [{ name: "SCANNER", class_name: "FileScanner" }, { name: "RENDERER", class_name: "SafeViewRenderer" }]);
});


/* ------------------------------------------------------------------------ R35 */

const HUB_IMAGE = /^docker\.io\/civicsmith\/(agent-runner|file-scanner-scanner|file-scanner-renderer)@sha256:[0-9a-f]{64}$/;
/** R35's real-fleet test (K2266), as a function of the members it is given: every image the container members state
 *  that is not `docker.io/civicsmith/<repository>@sha256:<64 hex>`, as the part R25 would write it. */
const imagesOf = (members) => members.filter(isContainer)
  .flatMap((m) => (m.containers ? m.containers.map((c) => c.image) : [m.image])).map((i) => imageReference(i).reference ?? "(none)");
const notOnDockerHub = (members) => imagesOf(members).filter((r) => !HUB_IMAGE.test(r));

test("R35: the real fleet's three container images (agent-runner's, file-scanner's two classes) are named docker.io/civicsmith/<repository>@sha256:<64 hex> by their markers, and the part R25 writes carries that address", () => {
  const members = discoverMembers();
  const images = imagesOf(members);
  assert.equal(images.length, 3, "agent-runner's image and file-scanner's two classes, no other");
  assert.deepEqual(notOnDockerHub(members), []);
  assert.deepEqual(images.map((r) => r.split("@")[0]).sort(),
    ["docker.io/civicsmith/agent-runner", "docker.io/civicsmith/file-scanner-renderer", "docker.io/civicsmith/file-scanner-scanner"]);
  const names = members.map((m) => m.name);
  for (const m of members.filter(isContainer)) {
    const d = containerParts(m, names, { packages: false });
    assert.ok(d.parts, `${m.name}: ${JSON.stringify(d)}`);
    for (const part of d.parts) assert.match(must(must(part.descriptor).image), HUB_IMAGE, `${m.name} ${part.class_name}: no credential is needed to pull it`);
  }
});

test("R35: R24's and R25's fixtures name docker.io/<org>/…@sha256 markers and are listed and written as stated; control: a marker naming another registry is written as stated by R25, and the real-fleet test fails on it", () => {
  const root = tmp("r35");
  try {
    containerFixture(root, "hub", { image: { ...IMAGE, repository: "docker.io/civicsmith/agent-runner" },
      extra: { class_name: "Runner", max_instances: 2, bind: [{ member: "hub", binding: "RUNNER" }], bundle: { entry: "src/entry.mjs", outfile: "dist/a.mjs", manifest: "dist/a.json" } } });
    containerFixture(root, "ghcr", { image: { ...IMAGE, repository: "ghcr.io/believeinoakland/agent-runner" },
      extra: { class_name: "Runner", max_instances: 2, bind: [{ member: "hub", binding: "RUNNER" }], bundle: { entry: "src/entry.mjs", outfile: "dist/a.mjs", manifest: "dist/a.json" } } });
    const [ghcr, hub] = discoverMembers(root);
    assert.equal(must(containerDescriptor(hub, ["hub"]).descriptor).image, `docker.io/civicsmith/agent-runner@${DIGEST}`);
    assert.equal(must(containerDescriptor(ghcr, ["hub"]).descriptor).image, `ghcr.io/believeinoakland/agent-runner@${DIGEST}`, "emitted as written");
    assert.deepEqual(notOnDockerHub([hub]).length, 0);
    assert.deepEqual(notOnDockerHub([ghcr]), [`ghcr.io/believeinoakland/agent-runner@${DIGEST}`], "the real-fleet test fails on it");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* --------------------------------------------------------------------- R36, R37 */

const IMG_BASE = "sha256:" + "1c".repeat(32);
const NEW_DIGEST = "sha256:" + "9e".repeat(32);
/** A container member whose one class is built from a Dockerfile that COPYs `package.json` and `container/`, with its
 *  image's digest and source recorded as R36 leaves them (`recorded: false` for a marker that records no source). */
function imageMember(root, dir = "runner", { recorded = true, classes = null } = {}) {
  mkdirSync(join(root, dir, "container"), { recursive: true });
  writeFileSync(join(root, dir, "package.json"), '{"name":"runner"}\n');
  writeFileSync(join(root, dir, "container/app.mjs"), "export const app = 1;\n");
  writeFileSync(join(root, dir, "README.md"), "not copied into the image\n");
  const dockerfiles = classes || [{ class_name: "Runner", dockerfile: "Dockerfile" }];
  for (const c of dockerfiles)
    writeFileSync(join(root, dir, c.dockerfile), `FROM docker.io/library/node@${IMG_BASE}\nCOPY package.json ./\nCOPY container ./container/\nCOPY --from=build /out ./out\n`);
  const image = (c, i) => ({ repository: `docker.io/civicsmith/${dir}${i}`, digest: DIGEST, platform: "linux/amd64", port: 8080 });
  const marker = classes
    ? { name: dir, kind: "container", containers: dockerfiles.map((c, i) => ({ class_name: c.class_name, image: image(c, i), build: { dockerfile: c.dockerfile } })) }
    : { name: dir, kind: "container", class_name: "Runner", image: image(null, ""), build: { dockerfile: "Dockerfile" } };
  writeFileSync(join(root, dir, "fleet-member.json"), JSON.stringify(marker, null, 2) + "\n");
  writeFileSync(join(root, dir, "wrangler.jsonc"), `// the container block\n{\n  "containers": [\n`
    + dockerfiles.map((c, i) => `    // ${c.class_name}'s image\n    { "class_name": "${c.class_name}", "image": "ghcr.io/believeinoakland/${dir}${classes ? i : ""}@${DIGEST}", "max_instances": 1 }`).join(",\n")
    + `\n  ]\n}\n`);
  const member = () => must(discoverMembers(root).find((m) => m.name === dir), dir);
  if (recorded) for (const c of dockerfiles) {
    const m = member();
    const r = recordContainerDigest(m, c.class_name, DIGEST);
    assert.ok(r.files, JSON.stringify(r));
  }
  return member;
}

test("R37: a class whose image files match what its recorded digest was built from is current; a changed byte in a copied file, an added file in a copied directory, a changed Dockerfile, or a file removed from a copied directory is stale, naming the class; a file the Dockerfile does not copy, and a COPY --from, change nothing", () => {
  const root = tmp("r37");
  try {
    const member = imageMember(root);
    const states = () => containerImageStates(member()).map((s) => [s.class_name, s.state]);
    assert.deepEqual(states(), [["Runner", "current"]]);
    assert.deepEqual(containerImageFindings(member()), []);
    writeFileSync(join(root, "runner/README.md"), "changed, still not copied\n");
    assert.deepEqual(states(), [["Runner", "current"]], "control: a file the image is not built from");
    for (const [change, undo] of [
      [() => writeFileSync(join(root, "runner/container/app.mjs"), "export const app = 2;\n"), () => writeFileSync(join(root, "runner/container/app.mjs"), "export const app = 1;\n")],
      [() => writeFileSync(join(root, "runner/container/extra.mjs"), "x\n"), () => rmSync(join(root, "runner/container/extra.mjs"))],
      [() => writeFileSync(join(root, "runner/Dockerfile"), `FROM docker.io/library/node@sha256:${"2d".repeat(32)}\nCOPY package.json ./\nCOPY container ./container/\n`),
        () => writeFileSync(join(root, "runner/Dockerfile"), `FROM docker.io/library/node@${IMG_BASE}\nCOPY package.json ./\nCOPY container ./container/\nCOPY --from=build /out ./out\n`)],
      [() => writeFileSync(join(root, "runner/package.json"), '{"name":"runner","x":1}\n'), () => writeFileSync(join(root, "runner/package.json"), '{"name":"runner"}\n')],
    ]) {
      change();
      assert.deepEqual(states(), [["Runner", "stale"]]);
      const f = containerImageFindings(member());
      assert.equal(f.length, 1);
      assert.equal(f[0].class_name, "Runner");
      assert.match(f[0].text, /^runner: .*class Runner/);
      undo();
      assert.deepEqual(states(), [["Runner", "current"]], "restored, current again");
    }
    rmSync(join(root, "runner/container/app.mjs"));
    assert.deepEqual(states(), [["Runner", "stale"]], "a file removed from a copied directory moves the hash");
    rmSync(join(root, "runner/container"), { recursive: true });
    assert.deepEqual(states(), [["Runner", "unread"]], "a copied path that is not in the tree cannot be hashed, and is not skipped");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R37: a marker that records nothing its digest was built from, or a source that is not a 64-hex digest, is unrecorded; a Dockerfile naming no file, copying a wildcard or an address, or a marker naming no Dockerfile, is unread", () => {
  const root = tmp("r37b");
  try {
    const member = imageMember(root, "runner", { recorded: false });
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["unrecorded"]);
    const marker = join(root, "runner/fleet-member.json");
    const good = JSON.parse(readFileSync(marker, "utf8"));
    writeFileSync(marker, JSON.stringify({ ...good, image: { ...good.image, [SOURCE_FIELD]: "not-a-hash" } }));
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["unrecorded"]);
    for (const line of ["COPY container/* ./container/", "ADD https://x.test/a.tar ./a.tar", "COPY ../outside ./x", "COPY [\"container\",", "ADD /abs ./x"]) {
      writeFileSync(join(root, "runner/Dockerfile"), `FROM x@${IMG_BASE}\n${line}\n`);
      assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["unread"], line);
    }
    const { build: _b, ...noBuild } = good;
    writeFileSync(marker, JSON.stringify(noBuild));
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["unread"], "no build.dockerfile is named, never defaulted");
    assert.ok(containerSourceHash(member(), "Runner").unread);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R36: recording the digest a build produced writes it, and the files it was built from, into the marker's image block and the digest into the image the wrangler.jsonc container block names, both agreeing, keeping the wrangler comments and repository; the class is current afterwards", () => {
  const root = tmp("r36");
  try {
    const member = imageMember(root, "runner", { recorded: false });
    writeFileSync(join(root, "runner/container/app.mjs"), "export const app = 3; // the changed code\n");
    const r = recordContainerDigest(member(), "Runner", NEW_DIGEST);
    assert.deepEqual(r, { files: ["runner/fleet-member.json", "runner/wrangler.jsonc"] });
    const marker = JSON.parse(readFileSync(join(root, "runner/fleet-member.json"), "utf8"));
    assert.equal(marker.image.digest, NEW_DIGEST);
    assert.equal(marker.image[SOURCE_FIELD], containerSourceHash(member(), "Runner").sha256);
    assert.equal(marker.image.repository, "docker.io/civicsmith/runner", "the other fields are untouched");
    assert.deepEqual(Object.keys(marker.image), ["repository", "digest", SOURCE_FIELD, "platform", "port"]);
    const wrangler = readFileSync(join(root, "runner/wrangler.jsonc"), "utf8");
    const cfg = parseJsonc(wrangler);
    assert.equal(cfg.containers[0].image, `ghcr.io/believeinoakland/runner@${NEW_DIGEST}`, "its own repository, the new digest");
    assert.match(wrangler, /^\/\/ the container block\n/);
    assert.match(wrangler, /\/\/ Runner's image/);
    assert.equal(must(imageReference(member().image).reference).split("@")[1], cfg.containers[0].image.split("@")[1], "the two files agree");
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["current"]);
    /* Changing the code again outruns the new digest until it is recorded again. */
    writeFileSync(join(root, "runner/container/app.mjs"), "export const app = 4;\n");
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["stale"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R36: a member with two classes records the digest of the class named and leaves the other's digest, source and image as they were", () => {
  const root = tmp("r36b");
  try {
    const classes = [{ class_name: "Scanner", dockerfile: "Dockerfile.scanner" }, { class_name: "Renderer", dockerfile: "Dockerfile.renderer" }];
    const member = imageMember(root, "multi", { classes });
    const before = JSON.parse(readFileSync(join(root, "multi/fleet-member.json"), "utf8"));
    writeFileSync(join(root, "multi/Dockerfile.renderer"), `FROM docker.io/library/node@${IMG_BASE}\nCOPY container ./container/\n`);
    assert.deepEqual(containerImageStates(member()).map((s) => [s.class_name, s.state]), [["Scanner", "current"], ["Renderer", "stale"]]);
    assert.ok(recordContainerDigest(member(), "Renderer", NEW_DIGEST).files);
    const after = JSON.parse(readFileSync(join(root, "multi/fleet-member.json"), "utf8"));
    assert.deepEqual(after.containers[0], before.containers[0], "the scanner is untouched");
    assert.equal(after.containers[1].image.digest, NEW_DIGEST);
    const cfg = parseJsonc(readFileSync(join(root, "multi/wrangler.jsonc"), "utf8"));
    assert.equal(cfg.containers[0].image, `ghcr.io/believeinoakland/multi0@${DIGEST}`);
    assert.equal(cfg.containers[1].image, `ghcr.io/believeinoakland/multi1@${NEW_DIGEST}`);
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["current", "current"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R36: a digest that is not sha256:<64 hex> (CONTAINER_DIGEST_INVALID), a class the member does not state, a member that is not a container member, a wrangler.jsonc naming no digest image for the class, and a Dockerfile that cannot be hashed are each refused, with neither file written", () => {
  const root = tmp("r36c");
  try {
    const member = imageMember(root, "runner", { recorded: false });
    mkdirSync(join(root, "plain/src"), { recursive: true });
    writeFileSync(join(root, "plain/src/index.mjs"), "export default {};\n");
    writeFileSync(join(root, "plain/fleet-member.json"), JSON.stringify({ name: "plain", entry: "src/index.mjs" }));
    const files = () => ["runner/fleet-member.json", "runner/wrangler.jsonc", "plain/fleet-member.json"].map((f) => readFileSync(join(root, f), "utf8"));
    const before = files();
    const code = (r) => r.refused;
    for (const bad of ["sha256:abc", "abc", `sha256:${"A".repeat(64)}`, undefined, null, 5])
      assert.equal(code(recordContainerDigest(member(), "Runner", /** @type {any} a digest of the wrong kind on purpose */ (bad))), "CONTAINER_DIGEST_INVALID", String(bad));
    assert.equal(code(recordContainerDigest(member(), "NoSuchClass", NEW_DIGEST)), "CONTAINER_UNDESCRIBED");
    const plain = must(discoverMembers(root).find((m) => m.name === "plain"), "plain");
    assert.equal(code(recordContainerDigest(plain, "Runner", NEW_DIGEST)), "CONTAINER_UNDESCRIBED", "a non-container member gets no digest");
    const w = join(root, "runner/wrangler.jsonc");
    const wrangler = readFileSync(w, "utf8");
    writeFileSync(w, wrangler.replace(/@sha256:[0-9a-f]{64}/, ":latest"));
    assert.equal(code(recordContainerDigest(member(), "Runner", NEW_DIGEST)), "CONTAINER_UNDESCRIBED", "a tag is not a digest");
    writeFileSync(w, wrangler);
    writeFileSync(join(root, "runner/Dockerfile"), "FROM x\nCOPY nothing-here ./\n");
    assert.equal(code(recordContainerDigest(member(), "Runner", NEW_DIGEST)), "CONTAINER_UNDESCRIBED");
    writeFileSync(join(root, "runner/Dockerfile"), `FROM docker.io/library/node@${IMG_BASE}\nCOPY package.json ./\nCOPY container ./container/\nCOPY --from=build /out ./out\n`);
    assert.deepEqual(files(), before, "nothing was written by any refusal");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------- R36 (T51-144): the two digests agree */

/** T51-144: each container class whose marker `image.digest` is not the digest its `wrangler.jsonc` container block
 *  (matched by class) names, as text naming the member and the class; `[]` when every class agrees. */
const digestDisagreements = (members) => members.filter(isContainer).flatMap((m) => {
  const cfg = parseJsonc(readFileSync(join(m.abs, "wrangler.jsonc"), "utf8"), `${m.dir}/wrangler.jsonc`);
  const blocks = Array.isArray(cfg.containers) ? cfg.containers : [];
  return containerClasses(m).classes.flatMap((cls) => {
    const marked = cls.image && cls.image.digest;
    const block = blocks.find((b) => b.class_name === cls.class_name);
    const named = block && typeof block.image === "string" ? block.image.split("@")[1] : null;
    return marked && marked === named ? [] : [`${m.name} ${cls.class_name}: fleet-member.json names ${marked}, wrangler.jsonc names ${named}`];
  });
});

test("R36 (T51-144): over the real fleet, each container class's fleet-member.json image.digest is the digest its wrangler.jsonc containers[] entry names, so a cut cannot leave one stale", () => {
  const members = discoverMembers();
  assert.equal(members.filter(isContainer).flatMap((m) => containerClasses(m).classes).length, 3, "agent-runner's class and file-scanner's two, no other");
  assert.deepEqual(digestDisagreements(members), []);
});

test("R36 (T51-144): control: a fixture whose two digests differ fails the agreement test naming the member and the class; the same fixture with them equal passes", () => {
  const root = tmp("t144");
  try {
    imageMember(root);
    const members = () => discoverMembers(root);
    assert.deepEqual(digestDisagreements(members()), [], "the fixture's two digests agree");
    const wrangler = join(root, "runner/wrangler.jsonc");
    writeFileSync(wrangler, readFileSync(wrangler, "utf8").replace(DIGEST, NEW_DIGEST));
    assert.deepEqual(digestDisagreements(members()),
      [`runner Runner: fleet-member.json names ${DIGEST}, wrangler.jsonc names ${NEW_DIGEST}`]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------------- R38 */

/* bundler's own fixture tests prove R38's rules; these hold the real fleet to them, each member built afresh from its
   source by the recipe its scripts/build.mjs runs (never a committed bundle: release R46). */

/** The keys of the rows a built bundle carries, read from its `WORD_ROWS` literal. */
function keptKeys(bytes) {
  const text = bytes.toString("utf8");
  const at = text.indexOf("WORD_ROWS=Object.freeze([");
  if (at < 0) return null;
  const end = text.indexOf("]])", at);
  return [...text.slice(at, end + 2).matchAll(/\[("(?:[^"\\]|\\.)*"),/g)].map((m) => JSON.parse(m[1]));
}

/** The rows the real fleet's members keep, stated by member in the test output. */
const REAL_WORDS = [];

test("bundler R38: over the real fleet, each member that builds carries only the rows its inputs name (each member's row count stated); the bundles' keys are all named by literal at a call or under a literal prefix of its inputs", async () => {
  for (const m of discoverMembers().filter((x) => x.bundle)) {
    const built = await buildMember(m);
    /* a member whose inputs reach no word table records nothing (`words` null) and carries none of it (agent-runner:
       its Worker's own data holds the rows its image reads, K4011): the control is that no table input is bundled */
    if (built.words === null) {
      assert.ok(!Object.keys(must(built.metafile).inputs).some((p) => /setup-words\/rows\.mjs$/.test(p)), `${m.name} bundles the word table and records no rows`);
      continue;
    }
    if (built.words.rows === "all") continue;     /* keeps the whole table for a site of another module: the next test */
    const keys = keptKeys(built.bytes);
    assert.ok(keys && keys.length > 0 && keys.length === built.words.rows, `${m.name}: carries a word table of ${built.words?.rows} rows`);
    assert.ok(keys.length < 200, `${m.name}: ${keys.length} rows of ${built.words.total}, not the whole table`);
    const table = (await import(`file://${join(m.abs, Object.keys(must(built.metafile).inputs).find((p) => /setup-words\/rows\.mjs$/.test(p)))}`)).WORD_ROWS;
    assert.deepEqual(keys, table.map((r) => r[0]).filter((k) => new Set(keys).has(k)), `${m.name}: in the table's order`);
    /* independent of the parser: the sources of the member's bundled first-party inputs name every kept key as a
       quoted literal, or begin it with a literal prefix followed by a join (a `+` or a `${`) */
    const sources = Object.keys(must(built.metafile).inputs).filter((p) => !p.split("/").includes("node_modules") && /\.(mjs|js)$/.test(p) && !/setup-words\/rows/.test(p))
      .map((p) => readFileSync(join(m.abs, p), "utf8")).join("\n");
    const prefixes = [...sources.matchAll(/["'`]([A-Za-z0-9_.-]+\.)["'`]\s*\+|`([A-Za-z0-9_.-]+\.)\$\{/g)].map((x) => x[1] ?? x[2]);
    for (const k of keys)
      assert.ok(["\"", "'", "`"].some((q) => sources.includes(q + k + q)) || prefixes.some((p) => k.startsWith(p)), `${m.name}: ${k} is named by its inputs`);
    REAL_WORDS.push(`${m.name} ${keys.length} of ${built.words.total}`);
  }
  assert.ok(REAL_WORDS.length >= 3, `the members built here: ${REAL_WORDS.join("; ")}`);
  console.log(`# R38 real fleet: ${REAL_WORDS.join("; ")}`);
});

test("bundler R38: over the real fleet, a member whose inputs hold a word read with a variable key keeps the whole table and its manifest names the sites by file and line (agent-worker today; K3958)", async () => {
  const keepsWhole = [];
  for (const m of discoverMembers().filter((x) => x.bundle)) {
    const built = await buildMember(m);
    if (built.words?.rows !== "all") continue;
    keepsWhole.push(m.name);
    const man = manifestFrom(m, built);
    assert.equal(man.words, "all");
    assert.ok(must(man.wordSites).length > 0 && must(man.wordSites).every((s) => /^\S+\.mjs:\d+$/.test(s)), `${m.name}: each site is a file and a line`);
    assert.deepEqual(man.wordSites, [...must(man.wordSites)].sort(), "in code-point order");
    for (const site of man.wordSites) {
      const [file, line] = [site.slice(0, site.lastIndexOf(":")), Number(site.slice(site.lastIndexOf(":") + 1))];
      assert.ok(readFileSync(join(m.abs, file), "utf8").split("\n").length >= line, `${site} is a line of its file`);
    }
    console.log(`# R38 real fleet: ${m.name} keeps the whole table (${built.words.total} rows) for ${man.wordSites.length} site(s): ${man.wordSites.join(", ")}`);
  }
  assert.ok(!keepsWhole.includes("pdf-worker") && !keepsWhole.includes("ocr-worker") && !keepsWhole.includes("sheet-worker"), `the members that keep the whole table: ${keepsWhole.join(", ")}`);
});

/* --------------------------------------------------------------------- R39 */

const unit = (name, exports, config = {}) => ({ name, exports, config });
const naming = (fs, member, binding, what) => fs.filter((f) => f.member === member && f.binding === binding && f.name === what);

test("R39: every kind of binding is held to what the release exports: a service names the plane or a member; a Durable Object with a script_name names a member whose bundle exports the class, one without names its own bundle's; a container class and each class a migration creates, renames to or transfers are exported by the member's own bundle", () => {
  const plane = unit("bio-plane", ["Store", "default"], { durable_objects: { bindings: [{ name: "STORE", class_name: "Store" }] },
    services: [{ binding: "SELF", service: "bio-plane" }, { binding: "PDF", service: "pdf-worker" }] });
  const pdf = unit("pdf-worker", ["default"], { services: [{ binding: "PLANE", service: "bio-plane" }] });
  const runner = unit("agent-runner", ["AgentRunner", "default"], {
    containers: [{ class_name: "AgentRunner" }], durable_objects: { bindings: [{ name: "AGENT_RUNNER", class_name: "AgentRunner" }] },
    migrations: [{ tag: "v1", new_sqlite_classes: ["AgentRunner"] }] });
  const worker = unit("agent-worker", ["default", "SegmentDriver"], { services: [{ binding: "PLANE", service: "bio-plane" }],
    durable_objects: { bindings: [{ name: "SEGMENTS", class_name: "SegmentDriver" },
      { name: "REMOTE", class_name: "AgentRunner", script_name: "agent-runner" }] } });
  assert.deepEqual(bindingFindings([plane, pdf, runner, worker]), [], "a coherent release has no finding");

  /* the defect K4176 found: REMOTE names a class the other member's bundle lacks */
  const lacking = bindingFindings([plane, pdf, { ...runner, exports: ["default"] }, { ...worker,
    config: { ...worker.config, durable_objects: { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }] } } }]);
  const remote = naming(lacking, "agent-worker", "REMOTE", "RemoteSession");
  assert.equal(remote.length, 1, JSON.stringify(lacking));
  assert.match(remote[0].text, /agent-worker/);
  assert.match(remote[0].text, /REMOTE/);
  assert.match(remote[0].text, /RemoteSession/);
  assert.match(remote[0].text, /agent-runner/);

  /* a service naming no member of the release */
  const stray = bindingFindings([plane, { ...pdf, config: { services: [{ binding: "GHOST", service: "ghost-worker" }] } }]);
  assert.equal(naming(stray, "pdf-worker", "GHOST", "ghost-worker").length, 1);
  assert.equal(naming(stray, "bio-plane", "PDF", "pdf-worker").length, 0, "pdf-worker is in this release");
  /* a script_name naming no member */
  const nowhere = bindingFindings([unit("a", [], { durable_objects: { bindings: [{ name: "X", class_name: "C", script_name: "nobody" }] } })]);
  assert.equal(naming(nowhere, "a", "X", "C").length, 1);
  /* no script_name: the member's own bundle; a script_name naming itself is the same */
  const own = bindingFindings([unit("a", ["C"], { durable_objects: { bindings: [{ name: "X", class_name: "C" }, { name: "Y", class_name: "C", script_name: "a" }, { name: "Z", class_name: "D" }] } })]);
  assert.deepEqual(own.map((f) => [f.binding, f.name]), [["Z", "D"]]);
  /* a container class and the migration forms */
  const cont = bindingFindings([unit("a", ["A"], { containers: [{ class_name: "A" }, { class_name: "B" }],
    migrations: [{ tag: "v1", new_sqlite_classes: ["A", "M1"] }, { tag: "v2", new_classes: ["M2"] },
      { tag: "v3", renamed_classes: [{ from: "Old", to: "M3" }] }, { tag: "v4", transferred_classes: [{ from: "O", from_script: "s", to: "M4" }] },
      { tag: "v5", deleted_classes: ["Gone"] }] })]);
  assert.deepEqual(cont.map((f) => f.name).sort(), ["B", "M1", "M2", "M3", "M4"], "a deleted class needs no export");
  /* a config with none of these keys, or none at all, binds nothing */
  assert.deepEqual(bindingFindings([unit("a", []), { name: "b", exports: new Set(), config: null }]), []);
});

test("R39: bundleExports reads the names the built bundle exports from the build, not from the source", async () => {
  const root = tmp("r39x");
  try {
    const abs = join(root, "probe");
    mkdirSync(join(abs, "src"), { recursive: true });
    writeFileSync(join(abs, "src/dep.mjs"), "export class FromDep {}\nexport class NeverExported {}\n");
    writeFileSync(join(abs, "src/index.mjs"), 'import { FromDep } from "./dep.mjs";\nclass Local {}\nexport { FromDep as Renamed, Local };\nexport class Direct {}\nexport default { fetch() { return new Response("ok"); } };\n');
    const m = { dir: "probe", name: "probe", abs, entry: "src/index.mjs", bundle: { entry: "src/index.mjs", outfile: "dist/probe.bundled.mjs", manifest: "dist/probe.bundle.json", external: [...DEFAULT_EXTERNAL] } };
    const built = await buildMember(m);
    assert.deepEqual([...bundleExports(m, built)].sort(), ["Direct", "Local", "Renamed", "default"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
