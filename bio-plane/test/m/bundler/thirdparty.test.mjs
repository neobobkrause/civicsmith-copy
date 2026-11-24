/* bundler's third-party code (T35-6; F20, F21; K1881): requirement-named tests at the module's interface,
 * build/requirements/bundler.md R27–R29. R27 is driven through the release assembly (R22, R23) against a throwaway
 * fixture repository (`repo.mjs`); R28 is called as a function, over fixtures and over the real repository; R29 is
 * called as `run()` and run as the command an operator runs, with OSV stubbed (`osvstub.mjs`). Nothing here reaches
 * the real advisory database or writes the real repository. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { npmProductionPackages, containerDescriptor, discoverMembers } from "../../../scripts/fleet-bundle.mjs";
import { thirdPartyInventory, checkAdvisories, run as advisories, DECLARATION } from "../../../scripts/release-advisories.mjs";
import { signerPublicLine } from "../../../scripts/sign-sshsig.mjs";
import { osvFetch } from "./osvstub.mjs";
import {
  makeRepo, addMember, addContainerMember, addScannerMember, buildAll, run, snapshot, readJson, writeJson, rm, hex, VERSION, DIGEST,
  CONTAINER_LOCK, CONTAINER_PACKAGES, PLANE, REAL_ROOT, SCANNER_PACKAGES, SCANNER_STATEMENTS, BASE_A,
} from "./repo.mjs";

const OSVSTUB = join(dirname(fileURLToPath(import.meta.url)), "osvstub.mjs");
const refused = (r, code) => {
  assert.notEqual(r.status, 0, `${code}: exits non-zero\n${r.stdout}\n${r.stderr}`);
  assert.ok(r.stderr.includes(`REFUSED [${code}]`), `${code} on stderr:\n${r.stderr}\n${r.stdout}`);
};
const put = (root, rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
const putJson = (root, rel, obj) => put(root, rel, JSON.stringify(obj, null, 2) + "\n");
const assemble = (root, args = [], env = {}) => run(root, ".", ["bio-plane/scripts/release-assemble.mjs", ...args], { env });
const envelope = () => `BIOKEY-RAW1.test.${randomBytes(32).toString("base64")}`;
/* R30: `--sign` runs only in the GitHub Actions signing environment; these tests stand in for it, with a throwaway key. */
const SIGNING = { GITHUB_ACTIONS: "true" };

/* ------------------------------------------------------------------------ R27 */

test("R27: npmProductionPackages lists every non-dev installed copy from the lockfile, by name then version, an alias by its own name; unread names the file or the package", () => {
  const dir = mkdtempSync(join(tmpdir(), "bundler-lock-"));
  try {
    const p = join(dir, "package-lock.json");
    writeJson(p, CONTAINER_LOCK);
    assert.deepEqual(npmProductionPackages(p, "runner/package-lock.json"), { packages: CONTAINER_PACKAGES });
    assert.deepEqual(npmProductionPackages(join(dir, "none.json"), "x/package-lock.json"), { unread: "x/package-lock.json is missing" });
    writeFileSync(p, "{ not json");
    assert.match(npmProductionPackages(p, "x/package-lock.json").unread, /^x\/package-lock\.json does not parse$/);
    writeJson(p, { lockfileVersion: 1, dependencies: { a: { version: "1.0.0" } } });
    assert.match(npmProductionPackages(p, "x/package-lock.json").unread, /^x\/package-lock\.json does not parse: it has no `packages` map/);
    writeJson(p, { packages: { "": {}, "node_modules/a": { version: "1.0.0" }, "node_modules/b": { resolved: "x" } } });
    assert.equal(npmProductionPackages(p, "x/package-lock.json").unread, "x/package-lock.json names the installed package b (node_modules/b) without a version");
    writeJson(p, { packages: { "node_modules/b": { version: "1.0.0", dev: true }, "node_modules/b/node_modules/c": { dev: true } } });
    assert.deepEqual(npmProductionPackages(p), { packages: [] }, "a dev package is neither listed nor required to state a version");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R27: the container.json part gains `packages` from the member's own package-lock.json, last; R25's other fields are unchanged", () => {
  const member = { dir: "runner", name: "runner", abs: "/nowhere", bundle: { entry: "src/w.mjs" },
    marker: { kind: "container", image: { repository: "docker.io/civicos/runner", digest: DIGEST }, class_name: "Runner",
      max_instances: 3, bind: [{ member: "alpha-worker", binding: "RUNNER" }] } };
  const before = containerDescriptor(member, ["alpha-worker"]);
  const after = containerDescriptor(member, ["alpha-worker"], { packages: CONTAINER_PACKAGES });
  const { packages, ...rest } = after.descriptor;
  assert.deepEqual(rest, before.descriptor, "R25's fields unchanged");
  assert.deepEqual(Object.keys(after.descriptor), ["class_name", "image", "scheduling_policy", "max_instances", "bind", "packages"]);
  assert.deepEqual(packages, CONTAINER_PACKAGES);
});

test("R27: the release's container.json part lists the image's packages, signed with the part, and an install reads its other fields as before", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner");
    await buildAll(root);
    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const bytes = readFileSync(join(root, "release/runner/container.json"));
    const part = JSON.parse(bytes);
    assert.deepEqual(part.packages, CONTAINER_PACKAGES, "every non-dev installed copy, sorted by name then version");
    assert.ok(!part.packages.some((p) => p.name === "devonly" || p.name === "runner"), "no dev package, no root");
    assert.deepEqual(part, { class_name: "Runner", image: `docker.io/civicos/runner@${DIGEST}`, scheduling_policy: "default",
      max_instances: 3, bind: [{ member: "alpha-worker", binding: "RUNNER" }], packages: CONTAINER_PACKAGES });
    const rel = readJson(join(root, "release/RELEASE.json"));
    const listed = rel.fleet.find((m) => m.member === "runner").parts.find((p) => p.path === "container.json");
    assert.deepEqual(listed, { path: "container.json", type: "Container", sha256: hex(bytes), bytes: bytes.length });
    assert.match(r.stdout, new RegExp(`^member runner .* parts=container\\.json:Container:${hex(bytes)}:${bytes.length}$`, "m"),
      "the fleet signature's payload carries the part's hash, packages included");
    /* The installer's own reading of the part (newgroup's containerDescriptor) is unchanged by the new field. */
    const ng = await import(pathToFileURL(join(REAL_ROOT, "newgroup/src/index.mjs")).href);
    assert.deepEqual(ng.containerDescriptor(bytes), { ok: true, d: { class_name: "Runner",
      image: `docker.io/civicos/runner@${DIGEST}`, max_instances: 3, bind: [{ member: "alpha-worker", binding: "RUNNER" }] } });
  } finally { rm(root); }
});

test("R27: a container member whose package-lock.json is missing, does not parse, or names an installed package without a version is refused CONTAINER_PACKAGES_UNREAD naming it, before anything is written", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner");
    await buildAll(root);
    const lock = join(root, "runner/package-lock.json");
    const seed = envelope();
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer: signerPublicLine(seed) });
    const noVersion = structuredClone(CONTAINER_LOCK);
    delete noVersion.packages["node_modules/zeta"].version;
    const cases = [
      ["runner/package-lock.json is missing", () => rmSync(lock)],
      ["runner/package-lock.json does not parse", () => writeFileSync(lock, "{ torn")],
      ["runner/package-lock.json does not parse: it has no `packages` map", () => writeJson(lock, { lockfileVersion: 1 })],
      ["runner/package-lock.json names the installed package zeta (node_modules/zeta) without a version", () => writeJson(lock, noVersion)],
    ];
    for (const [named, arrange] of cases) {
      arrange();
      const before = snapshot(root);
      const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
      refused(r, "CONTAINER_PACKAGES_UNREAD");
      assert.ok(r.stderr.includes(`runner is a container member and ${named}`), `${named}:\n${r.stderr}`);
      assert.doesNotMatch(r.stdout, /guard: /, "refused before any build ran");
      assert.deepEqual(snapshot(root), before, `${named}: nothing written`);
    }
  } finally { rm(root); }
});

test("R27: an image whose packages are not npm's lists them from the member's committed package statement for that image, sorted, in its own class's part, signed with it", async () => {
  const root = await makeRepo({ build: false });
  try {
    addScannerMember(root, "scanner");
    await buildAll(root);
    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rel = readJson(join(root, "release/RELEASE.json"));
    for (const c of ["FileScanner", "SafeViewRenderer"]) {
      const bytes = readFileSync(join(root, `release/scanner/container/${c}.json`));
      const part = JSON.parse(bytes);
      assert.deepEqual(part.packages, SCANNER_PACKAGES[c], `${c}: its own image's list, by name then version`);
      assert.deepEqual(Object.keys(part), ["class_name", "image", "scheduling_policy", "max_instances", "bind", "packages"]);
      assert.deepEqual(rel.fleet.find((m) => m.member === "scanner").parts.find((p) => p.path === `container/${c}.json`),
        { path: `container/${c}.json`, type: "Container", sha256: hex(bytes), bytes: bytes.length });
      assert.match(r.stdout, new RegExp(`container/${c}\\.json:Container:${hex(bytes)}:${bytes.length}`), `${c}: in the signed payload`);
    }
  } finally { rm(root); }
});

test("R27: a package statement missing or not parsing, a package without a version, or a statement naming no base digest or another than the marker's is refused CONTAINER_PACKAGES_UNREAD naming it, before anything is written", async () => {
  const root = await makeRepo({ build: false });
  try {
    addScannerMember(root, "scanner");
    await buildAll(root);
    const st = join(root, "scanner/images/scan.packages.json");
    const good = SCANNER_STATEMENTS["images/scan.packages.json"];
    const other = "sha256:" + "ee".repeat(32);
    const cases = [
      ["scanner/images/scan.packages.json is missing", () => rmSync(st)],
      ["scanner/images/scan.packages.json does not parse", () => writeFileSync(st, "{ torn")],
      ["scanner/images/scan.packages.json names the package clamav without a version",
        () => writeJson(st, { ...good, packages: [{ name: "clamav" }] })],
      ["scanner/images/scan.packages.json names no base image digest", () => writeJson(st, { ...good, base: {} })],
      [`scanner/images/scan.packages.json was taken against the base ${other}, not the base the marker pins (${BASE_A})`,
        () => writeJson(st, { ...good, base: { digest: other } })],
    ];
    for (const [named, arrange] of cases) {
      arrange();
      const before = snapshot(root);
      const r = assemble(root, ["--dry-run"]);
      refused(r, "CONTAINER_PACKAGES_UNREAD");
      assert.ok(r.stderr.includes(`scanner is a container member and ${named}`), `${named}:\n${r.stderr}`);
      assert.doesNotMatch(r.stdout, /guard: /, "refused before any build ran");
      assert.deepEqual(snapshot(root), before, `${named}: nothing written`);
      writeJson(st, good);
    }
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "restored, it assembles");
  } finally { rm(root); }
});

/* ------------------------------------------------------------------------ R28 */

test("R28: a container member's system packages are listed under the ecosystem its package statement names, for the member that ships them; an unread statement is named in unread", async () => {
  const root = await makeRepo({ build: false, members: { "alpha-worker": {} } });
  try {
    addScannerMember(root, "scanner");
    putJson(root, DECLARATION, { sources: [] });
    const inv = thirdPartyInventory(root);
    assert.deepEqual(inv.unread, []);
    assert.deepEqual(inv.packages, [...SCANNER_PACKAGES.FileScanner, ...SCANNER_PACKAGES.SafeViewRenderer]
      .map((p) => ({ ecosystem: "Debian:12", name: p.name, version: p.version, shippedIn: ["scanner"] }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)));
    rmSync(join(root, "scanner/images/render.packages.json"));
    const partial = thirdPartyInventory(root);
    assert.deepEqual(partial.unread, ["scanner/images/render.packages.json is missing"]);
    assert.ok(partial.packages.some((p) => p.name === "clamav"), "the other image's list is still read");
    assert.ok(!partial.packages.some((p) => p.name === "poppler-utils"));
  } finally { rm(root); }
});

test("R29: a system package is asked of OSV under its statement's ecosystem", async () => {
  const root = await makeRepo({ build: false, members: { "alpha-worker": {} } });
  try {
    addScannerMember(root, "scanner");
    putJson(root, DECLARATION, { sources: [] });
    await withOsv({ vulns: { "Debian:12|clamav|1.4.3+dfsg-1": [GHSA.id] }, details: { [GHSA.id]: { ...GHSA,
      affected: [{ package: { ecosystem: "Debian:12", name: "clamav" }, ranges: [{ events: [{ fixed: "1.4.4" }] }] }] } } }, async (calls) => {
      const { text, exit } = await advisories({ root, now: NOW });
      assert.equal(exit, 0, text);
      assert.ok(calls.find((c) => c.path === "/v1/querybatch").body.queries.some((q) => q.package.ecosystem === "Debian:12" && q.package.name === "clamav"));
      assert.match(text, /^ {2}Debian:12 clamav 1\.4\.3\+dfsg-1 {2}\[scanner\] {2}1 known advisory$/m);
      assert.match(text, /fixed in 1\.4\.4/);
    });
  } finally { rm(root); }
});


const CARGO = `# generated
version = 4

[[package]]
name = "engine"
version = "0.1.0"
dependencies = [
 "zcrate",
]

[[package]]
name = "zcrate"
version = "1.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "00"

[[package]]
name = "acrate"
version = "0.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
`;

const lockOf = (prod, dev = {}) => ({ lockfileVersion: 3, packages: { "": {},
  ...Object.fromEntries(Object.entries(prod).map(([n, v]) => [`node_modules/${n}`, { version: v }])),
  ...Object.fromEntries(Object.entries(dev).map(([n, v]) => [`node_modules/${n}`, { version: v, dev: true }])) } });
const withDeps = (root, dir, deps) => { const p = join(root, dir, "package.json"); writeJson(p, { ...readJson(p), dependencies: deps }); };

/** A fixture with every R28 source: the plane's and members' lockfiles, a container member, one left out, and a
 *  declaration naming a package, a Cargo.lock and a pins file. */
async function inventoryRepo() {
  const root = await makeRepo({ build: false, members: { "alpha-worker": {}, "beta-worker": {} } });
  withDeps(root, "bio-plane", { lefty: "1.0.0" });
  putJson(root, "bio-plane/package-lock.json", lockOf({ lefty: "1.0.0" }, { esbuild: "0.25.0" }));
  withDeps(root, "alpha-worker", { shared: "2.0.0" });
  putJson(root, "alpha-worker/package-lock.json", lockOf({ shared: "2.0.0" }));
  withDeps(root, "beta-worker", { shared: "2.0.0", "@b/only": "0.0.1" });
  putJson(root, "beta-worker/package-lock.json", lockOf({ shared: "2.0.0", "@b/only": "0.0.1" }, { miniflare: "4.0.0" }));
  addContainerMember(root, "runner");
  addContainerMember(root, "idle", { bundle: false, lock: lockOf({ ghost: "6.6.6" }) });
  put(root, "alpha-worker/engine/Cargo.lock", CARGO);
  putJson(root, "vend/pins.json", { packages: [{ package: "py-two", version: "2.0" }, { package: "py-one", version: "1.0" }] });
  putJson(root, DECLARATION, { sources: [
    { shippedIn: "beta-worker", package: { ecosystem: "npm", name: "committed-wasm", version: "0.11.0" } },
    { shippedIn: "alpha-worker", package: { ecosystem: "npm", name: "lefty", version: "1.0.0" } },
    { shippedIn: "alpha-worker", lock: "alpha-worker/engine/Cargo.lock", format: "cargo-lock", ecosystem: "crates.io" },
    { shippedIn: "bio-plane", lock: "vend/pins.json", format: "pins", ecosystem: "PyPI" },
  ] });
  return root;
}

test("R28: thirdPartyInventory lists each ecosystem, name and version once, with the sorted members that ship it, from the production lockfiles, each container member's R27 list and the declaration; sorted; nothing unread", async () => {
  const root = await inventoryRepo();
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("R28 made a request"); };
  try {
    const inv = thirdPartyInventory(root);
    const npm = (name, version, shippedIn) => ({ ecosystem: "npm", name, version, shippedIn });
    assert.deepEqual(inv, { unread: [], packages: [
      { ecosystem: "PyPI", name: "py-one", version: "1.0", shippedIn: ["bio-plane"] },
      { ecosystem: "PyPI", name: "py-two", version: "2.0", shippedIn: ["bio-plane"] },
      { ecosystem: "crates.io", name: "acrate", version: "0.3.1", shippedIn: ["alpha-worker"] },
      { ecosystem: "crates.io", name: "zcrate", version: "1.2.0", shippedIn: ["alpha-worker"] },
      npm("@b/only", "0.0.1", ["beta-worker"]),
      npm("@scope/pkg", "3.1.0", ["runner"]),
      npm("alpha", "0.9.0", ["runner"]),
      npm("alpha", "1.0.0", ["runner"]),
      npm("committed-wasm", "0.11.0", ["beta-worker"]),
      npm("lefty", "1.0.0", ["alpha-worker", "bio-plane"]),
      npm("real-name", "5.0.0", ["runner"]),
      npm("shared", "2.0.0", ["alpha-worker", "beta-worker"]),
      npm("zeta", "2.0.0", ["runner"]),
    ] });
    for (const absent of ["esbuild", "miniflare", "devonly", "engine", "ghost"])
      assert.ok(!inv.packages.some((p) => p.name === absent), `${absent}: a dev package, the root crate, or a left-out member's`);
  } finally { globalThis.fetch = realFetch; rm(root); }
});

test("R28: a source that is missing or does not parse is named in unread, never left out silently; never throws", async () => {
  const root = await inventoryRepo();
  try {
    /* A member that declares dependencies and has no lockfile is unread; one with neither installs nothing. */
    addMember(root, "gamma-worker");
    assert.deepEqual(thirdPartyInventory(root).unread, [], "no dependencies and no lockfile: nothing to read");
    withDeps(root, "gamma-worker", { x: "1.0.0" });
    const cases = [
      ["gamma-worker/package-lock.json is missing", () => {}],
      ["alpha-worker/package-lock.json does not parse", () => writeFileSync(join(root, "alpha-worker/package-lock.json"), "{")],
      ["runner/package-lock.json is missing", () => rmSync(join(root, "runner/package-lock.json"))],
      [`${DECLARATION} is missing`, () => rmSync(join(root, DECLARATION))],
      [`${DECLARATION} does not parse`, () => writeFileSync(join(root, DECLARATION), "[")],
      ["alpha-worker/engine/Cargo.lock is missing", () => rmSync(join(root, "alpha-worker/engine/Cargo.lock"))],
      ["alpha-worker/engine/Cargo.lock does not parse: it names no [[package]]", () => writeFileSync(join(root, "alpha-worker/engine/Cargo.lock"), "version = 4\n")],
      ["alpha-worker/engine/Cargo.lock does not parse: a [[package]] states no version (zcrate)", () =>
        writeFileSync(join(root, "alpha-worker/engine/Cargo.lock"), CARGO.replace('version = "1.2.0"\n', ""))],
      ["vend/pins.json does not parse", () => putJson(root, "vend/pins.json", { packages: [{ package: "py-one" }] })],
      [`${DECLARATION} source 1 (beta-worker) does not state its package`, () => {
        const d = readJson(join(root, DECLARATION)); d.sources[0].package.ecosystem = "maven"; writeJson(join(root, DECLARATION), d); }],
      [`${DECLARATION} source 3 (alpha-worker/engine/Cargo.lock) states no known format`, () => {
        const d = readJson(join(root, DECLARATION)); delete d.sources[2].format; writeJson(join(root, DECLARATION), d); }],
      [`${DECLARATION} source 2 names no member`, () => {
        const d = readJson(join(root, DECLARATION)); delete d.sources[1].shippedIn; writeJson(join(root, DECLARATION), d); }],
      [`${DECLARATION} source 4 (bio-plane) names neither a package nor a lock file`, () => {
        const d = readJson(join(root, DECLARATION)); delete d.sources[3].lock; writeJson(join(root, DECLARATION), d); }],
      ["the fleet's members could not be discovered", () => writeFileSync(join(root, "beta-worker/fleet-member.json"), "{")],
    ];
    const pristine = new Map(Object.keys(snapshot(root)).map((k) => [k, readFileSync(join(root, k))]));
    for (const [named, arrange] of cases) {
      arrange();
      let inv;
      assert.doesNotThrow(() => { inv = thirdPartyInventory(root); }, named);
      assert.ok(inv.unread.some((u) => u.startsWith(named)), `${named}:\n${JSON.stringify(inv.unread)}`);
      for (const [k, b] of pristine) writeFileSync(join(root, k), b);
      for (const k of Object.keys(snapshot(root))) if (!pristine.has(k)) rmSync(join(root, k));
    }
    /* What could be read is still listed beside what could not. */
    rmSync(join(root, DECLARATION));
    const partial = thirdPartyInventory(root);
    assert.ok(partial.packages.some((p) => p.name === "shared"));
    assert.ok(!partial.packages.some((p) => p.ecosystem === "PyPI"));
  } finally { rm(root); }
});

test("R28: over the real repository nothing is unread, and every bundled vendored package, declared source and container package is listed for the member that ships it", () => {
  const inv = thirdPartyInventory();
  assert.deepEqual(inv.unread, []);
  const has = (eco, name, version, member) => inv.packages.some((p) => p.ecosystem === eco && p.name === name
    && (version === null || p.version === version) && p.shippedIn.includes(member));
  const lockVersion = (dir, name) => readJson(join(REAL_ROOT, dir, "package-lock.json")).packages[`node_modules/${name}`].version;
  /* Every package a committed bundle inlines (its manifest's vendored inputs) is in the inventory for that member. */
  for (const m of discoverMembers().filter((x) => x.bundle)) {
    const manifest = readJson(join(m.abs, m.bundle.manifest));
    const pkgs = new Set((manifest.vendoredInputs || []).map((i) => {
      const seg = i.path.split("node_modules/").pop().split("/");
      return seg[0].startsWith("@") ? `${seg[0]}/${seg[1]}` : seg[0];
    }));
    for (const name of pkgs) assert.ok(has("npm", name, lockVersion(m.dir, name), m.name), `${m.name} ships ${name}`);
  }
  assert.ok(has("npm", "unpdf", lockVersion("pdf-worker", "unpdf"), "pdf-worker"));
  assert.ok(has("npm", "@anthropic-ai/claude-agent-sdk", lockVersion("agent-runner", "@anthropic-ai/claude-agent-sdk"), "agent-runner"), "the Agent SDK's tree");
  assert.ok(has("npm", "tesseract-wasm", lockVersion("ocr-worker", "tesseract-wasm"), "ocr-worker"), "the declared version is the one ocr-worker installs");
  assert.ok(has("npm", "@cloudflare/containers", lockVersion("agent-runner", "@cloudflare/containers"), "agent-runner"));
  for (const p of readJson(join(REAL_ROOT, "court-citations/pins.json")).packages) assert.ok(has("PyPI", p.package, p.version, "bio-plane"), p.package);
  assert.ok(has("crates.io", "ironcalc", null, "sheet-worker"), "the sheet engine's crates");
  assert.ok(!inv.packages.some((p) => p.name === "sheet-engine"), "its root crate left out");
  assert.ok(!inv.packages.some((p) => ["esbuild", "miniflare", "wrangler"].includes(p.name)), "no dev tooling");
});

/* ------------------------------------------------------------------------ R29 */

/** A small fixture whose inventory is three declared packages, one per ecosystem. */
async function adviseRepo() {
  const root = await makeRepo({ build: false, members: {} });
  putJson(root, DECLARATION, { sources: [
    { shippedIn: "bio-plane", package: { ecosystem: "npm", name: "a-pkg", version: "1.0.0" } },
    { shippedIn: "bio-plane", package: { ecosystem: "crates.io", name: "b-crate", version: "0.1.0" } },
    { shippedIn: "bio-plane", package: { ecosystem: "PyPI", name: "c-wheel", version: "2.0" } },
  ] });
  return root;
}
const GHSA = { id: "GHSA-aaaa-bbbb-cccc", summary: "Prototype pollution in a-pkg", database_specific: { severity: "HIGH" },
  affected: [{ package: { ecosystem: "npm", name: "a-pkg" }, ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "1.0.1" }] }] },
    { package: { ecosystem: "npm", name: "other" }, ranges: [{ events: [{ fixed: "9.0.0" }] }] }] };
const RUSTSEC = { id: "RUSTSEC-2026-0001", summary: "Use after free", severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N" }],
  affected: [{ package: { ecosystem: "crates.io", name: "b-crate" }, ranges: [{ events: [{ introduced: "0" }] }] }] };
const SCENARIO = { vulns: { "npm|a-pkg|1.0.0": [GHSA.id] }, pages: { "crates.io|b-crate|0.1.0": [[RUSTSEC.id]] },
  details: { [GHSA.id]: GHSA, [RUSTSEC.id]: RUSTSEC } };
const NOW = () => new Date("2026-10-07T12:00:00Z");

async function withOsv(S, fn) {
  const realFetch = globalThis.fetch, calls = [];
  globalThis.fetch = osvFetch(structuredClone(S), (e) => calls.push(e));
  try { return await fn(calls); } finally { globalThis.fetch = realFetch; }
}

test("R29: every R28 entry is asked of OSV and printed with its advisories (id, summary, severity, fixed version); every package with one is named, with the database and the time; exit 0 whether or not any was found", async () => {
  const root = await adviseRepo();
  try {
    await withOsv(SCENARIO, async (calls) => {
      const { report, text, exit } = await advisories({ root, now: NOW });
      assert.equal(exit, 0, text);
      assert.match(text, /^ {2}npm a-pkg 1\.0\.0 {2}\[bio-plane\] {2}1 known advisory$/m);
      assert.match(text, /^ {6}GHSA-aaaa-bbbb-cccc \(HIGH\): Prototype pollution in a-pkg — fixed in 1\.0\.1$/m, "only the fixed version for this package");
      assert.match(text, /^ {2}crates\.io b-crate 0\.1\.0 {2}\[bio-plane\] {2}1 known advisory$/m, "found on a further page");
      assert.match(text, /^ {6}RUSTSEC-2026-0001 \(CVSS:3\.1\/AV:N\): Use after free — no fixed version stated$/m);
      assert.match(text, /^ {2}PyPI c-wheel 2\.0 {2}\[bio-plane\] {2}no known advisory$/m);
      assert.match(text, /this release would ship 2 package\(s\) with a known advisory: crates\.io b-crate 0\.1\.0; npm a-pkg 1\.0\.0/, "in the inventory's order");
      assert.match(text, /^database: OSV \(https:\/\/api\.osv\.dev\), asked 2026-10-07T12:00:00\.000Z$/m);
      assert.match(text, /every entry was checked\. Whether the release proceeds over an advisory is the operator's\./);
      assert.deepEqual(report.withAdvisories, ["crates.io b-crate 0.1.0", "npm a-pkg 1.0.0"]);
      assert.deepEqual(report.entries.map((e) => [e.name, e.checked]), [["c-wheel", true], ["b-crate", true], ["a-pkg", true]]);
      const batch = calls.find((c) => c.path === "/v1/querybatch");
      assert.deepEqual(batch.body.queries, [
        { package: { ecosystem: "PyPI", name: "c-wheel" }, version: "2.0" },
        { package: { ecosystem: "crates.io", name: "b-crate" }, version: "0.1.0" },
        { package: { ecosystem: "npm", name: "a-pkg" }, version: "1.0.0" }]);
      assert.ok(calls.every((c) => c.host === "api.osv.dev"), "asks nothing but the database");
    });
    await withOsv({}, async () => {
      const { text, exit } = await advisories({ root, now: NOW });
      assert.equal(exit, 0);
      assert.match(text, /this release would ship no package with a known advisory among those checked/);
    });
  } finally { rm(root); }
});

test("R29: an unread source, an unreachable database, or an unreadable answer is named as not checked, never as free of advisories, and exits 1", async () => {
  const root = await adviseRepo();
  try {
    const cases = [
      ["unreachable", { unreachable: true }, ["a-pkg", "b-crate", "c-wheel"], /OSV could not be asked: fetch failed/],
      ["batch 500", { batchStatus: 500 }, ["a-pkg", "b-crate", "c-wheel"], /OSV could not be asked: \/v1\/querybatch answered 500/],
      ["batch short", { batchShort: true }, ["a-pkg", "b-crate", "c-wheel"], /its answer is unreadable/],
      ["one entry unreadable", { ...SCENARIO, entryUnreadable: ["PyPI|c-wheel|2.0"] }, ["c-wheel"], /OSV's answer for it is unreadable/],
      ["a further page fails", { ...SCENARIO, pageFail: true }, ["b-crate"], /further pages for it could not be read/],
      ["an advisory's details fail", { ...SCENARIO, detailFail: [GHSA.id] }, ["a-pkg"], /the advisory GHSA-aaaa-bbbb-cccc known against it could not be read: answered 404/],
    ];
    for (const [label, S, unchecked, why] of cases) {
      await withOsv(S, async () => {
        const { report, text, exit } = await advisories({ root, now: NOW });
        assert.equal(exit, 1, label);
        for (const name of unchecked) {
          assert.match(text, new RegExp(`^ {2}\\S+ ${name} \\S+ {2}\\[bio-plane\\] {2}NOT CHECKED — `, "m"), `${label}: ${name}`);
          assert.doesNotMatch(text, new RegExp(`${name} \\S+ {2}\\[bio-plane\\] {2}no known advisory`), `${label}: ${name} never clean`);
          assert.ok(report.notChecked.some((n) => n.includes(` ${name} `)), `${label}: ${name} in the report`);
        }
        assert.match(text, why, label);
        assert.match(text, /NOT EVERY ENTRY WAS CHECKED/, label);
        assert.equal(report.entries.filter((e) => !e.checked).length, unchecked.length, label);
      });
    }
    /* An unread source: the rest is still checked, and the exit is 1. */
    put(root, "alpha-worker/fleet-member.json", "{");
    await withOsv(SCENARIO, async () => {
      const { report, text, exit } = await advisories({ root, now: NOW });
      assert.equal(exit, 1);
      assert.match(text, /^NOT CHECKED — a source could not be read: the fleet's members could not be discovered/m);
      assert.equal(report.unread.length, 1);
      assert.ok(report.entries.every((e) => e.checked), "what could be read is still checked");
    });
  } finally { rm(root); }
});

test("R29: more than 1000 entries are asked in batches of at most 1000", async () => {
  const pkgs = Array.from({ length: 1001 }, (_, i) => ({ ecosystem: "npm", name: `p${i}`, version: "1.0.0", shippedIn: ["x"] }));
  await withOsv({}, async (calls) => {
    const out = await checkAdvisories(pkgs);
    assert.deepEqual(calls.filter((c) => c.path === "/v1/querybatch").map((c) => c.body.queries.length), [1000, 1]);
    assert.ok(out.every((e) => e.checked && e.advisories.length === 0));
  });
});

test("R29: the command prints the report, writes it as JSON with --out, writes nothing else, refuses nothing, and exits 0 checked or 1 not", async () => {
  const root = await adviseRepo();
  const work = mkdtempSync(join(tmpdir(), "bundler-adv-"));
  try {
    const cmd = (S, args = []) => {
      writeJson(join(work, "osv.json"), S);
      return run(root, ".", ["--import", OSVSTUB, "bio-plane/scripts/release-advisories.mjs", ...args],
        { env: { OSV_STUB: join(work, "osv.json") } });
    };
    const before = snapshot(root);
    const out = join(work, "report.json");
    const r = cmd(SCENARIO, ["--out", out]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /GHSA-aaaa-bbbb-cccc \(HIGH\)/);
    assert.match(r.stdout, /^database: OSV \(https:\/\/api\.osv\.dev\), asked \d{4}-\d\d-\d\dT/m);
    assert.doesNotMatch(r.stderr, /REFUSED/, "an advisory refuses nothing");
    const rep = readJson(out);
    assert.deepEqual(Object.keys(rep), ["database", "url", "askedAt", "entries", "withAdvisories", "notChecked", "unread"]);
    assert.deepEqual(rep.withAdvisories, ["crates.io b-crate 0.1.0", "npm a-pkg 1.0.0"]);
    assert.deepEqual(rep.entries.find((e) => e.name === "a-pkg").advisories, [{ id: GHSA.id, summary: GHSA.summary, severity: "HIGH", fixed: ["1.0.1"] }]);
    assert.ok(r.stdout.includes(`report written to ${out}`));
    assert.deepEqual(snapshot(root), before, "nothing in the repository written");
    const down = cmd({ unreachable: true });
    assert.equal(down.status, 1);
    assert.match(down.stdout, /NOT EVERY ENTRY WAS CHECKED/);
    assert.equal(cmd(SCENARIO, ["--out"]).status, 2, "--out with no file is a usage error");
    assert.deepEqual(snapshot(root), before);
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});


