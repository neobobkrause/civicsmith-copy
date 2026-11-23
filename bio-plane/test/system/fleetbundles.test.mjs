/* THE FLEET'S BUNDLES, BUILT AFRESH FROM THE CHECKOUT (release R46, R22, R31, R39; bundler R6 over the real fleet).
 *
 * No bundle is committed (ARCH's decision "Committed built files", 22 Nov 2026). Each fleet member's bundle and
 * manifest are built here by the member's OWN build (`node scripts/build.mjs` in its directory, which writes into its
 * `dist/`), and every assertion below reads that build. Nothing here reads, compares with or copies a bundle that was
 * in `dist/` before: each artifact and manifest is removed before its member's build runs. The plane, whose `dist/` its
 * own module still holds, is built in memory by the same recipe and never written.
 *
 * What it proves, each test naming its requirement:
 *   - R46: every member's build writes an artifact and a manifest that agree, and a second build of the same checkout
 *     gives the same bytes (so a release built from one checkout is one release).
 *   - bundler R6 over the real fleet: each fresh build passes the fleet guard — every input its manifest records is the
 *     tree's, and it imports nothing a one-part upload cannot resolve.
 *   - R22's installability: each member's fresh build boots under workerd from one part with its upload parts, and
 *     answers /version.
 *   - R31: each member's and the plane's size and start-up time against the fleet's budget, printed, with the budget's
 *     own negative control on synthetic artifacts.
 *   - R39: the real fleet is coherent — every binding names a class or service the release's bundles export.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { Miniflare } from "miniflare";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REPO_ROOT, discoverMembers, buildMember, verifyStatic, unresolvableSpecifiers, sha256, planeMember, assetsOf,
  DEFAULT_EXTERNAL, BUDGET, MIB, sizeVerdict, startVerdict, measureStart, budgetReport, releaseBindingFindings,
} from "../../scripts/fleet-bundle.mjs";

/* each member that declares a bundle, its `bundle` read once as present */
const guarded = discoverMembers(REPO_ROOT).flatMap((m) => (m.bundle ? [{ ...m, bundle: m.bundle }] : []));
/** Each member's own build's output: name -> {artifact, manifest} */
const built = new Map();
/** The plane, built in memory: its bytes, and a descriptor whose artifact is those bytes in a temporary directory. */
let plane = null;
const work = mkdtempSync(join(tmpdir(), "fleetbundles-"));

before(async () => {
  for (const m of guarded) {
    rmSync(join(m.abs, m.bundle.outfile), { force: true });
    rmSync(join(m.abs, m.bundle.manifest), { force: true });
    const r = spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: m.abs, encoding: "utf8" });
    const artifact = existsSync(join(m.abs, m.bundle.outfile)) ? readFileSync(join(m.abs, m.bundle.outfile)) : null;
    const manifest = existsSync(join(m.abs, m.bundle.manifest)) ? JSON.parse(readFileSync(join(m.abs, m.bundle.manifest), "utf8")) : null;
    built.set(m.name, { status: r.status, out: (r.stdout || "") + (r.stderr || ""), artifact, manifest });
  }
  const p = planeMember(REPO_ROOT);
  const b = await buildMember(p);
  mkdirSync(join(work, "plane"), { recursive: true });
  writeFileSync(join(work, "plane", "bio-plane.bundled.mjs"), b.bytes);
  plane = { built: b, member: { ...p, abs: join(work, "plane"), bundle: { ...p.bundle, outfile: "bio-plane.bundled.mjs", assets: [] } } };
});

process.on("exit", () => rmSync(work, { recursive: true, force: true }));

test("R46: the fleet is discovered by each member's own marker, and every member that declares a bundle is among those built here", () => {
  const names = guarded.map((m) => m.name);
  for (const n of ["agent-worker", "pdf-worker", "ocr-worker", "sheet-worker", "file-scanner", "agent-runner"])
    assert.ok(names.includes(n), `${n} declares a bundle: ${names.join(", ")}`);
});

test("R46: each member's own scripts/build.mjs writes its artifact and manifest into its dist/, and the two agree", () => {
  for (const m of guarded) {
    const b = built.get(m.name);
    assert.equal(b.status, 0, `${m.name}: its build exited ${b.status}\n${b.out}`);
    assert.ok(b.artifact && b.artifact.length > 0, `${m.name}: wrote ${m.bundle.outfile}`);
    assert.ok(b.manifest, `${m.name}: wrote ${m.bundle.manifest}`);
    assert.equal(b.manifest.sha256, sha256(b.artifact), `${m.name}: the manifest's sha256 is the artifact's`);
    assert.equal(b.manifest.bytes, b.artifact.length, `${m.name}: and its size`);
    assert.equal(b.manifest.member, m.name);
  }
});

test("R46: two builds from one checkout give the same bytes, for every member and the plane", async () => {
  for (const m of guarded) {
    const again = await buildMember(m);
    assert.ok(again.bytes.equals(built.get(m.name).artifact), `${m.name}: a second build differs from its own build's`);
  }
  const again = await buildMember(planeMember(REPO_ROOT));
  assert.ok(again.bytes.equals(plane.built.bytes), "bio-plane: a second build differs from the first");
});

test("bundler R6 over the real fleet: each member's fresh build passes the fleet guard — its recorded inputs are the tree's and it imports nothing an upload cannot resolve", () => {
  for (const m of guarded) {
    const { findings } = verifyStatic(m);
    for (const f of findings) console.log(`         ! ${f}`);
    assert.deepEqual(findings, [], m.name);
    assert.ok(built.get(m.name).manifest.inputs.length > 0, `${m.name}: its manifest records its inputs`);
  }
  const p = planeMember(REPO_ROOT);
  assert.deepEqual(unresolvableSpecifiers(plane.built.bytes.toString("utf8"), (p.bundle && p.bundle.external) || DEFAULT_EXTERNAL), [],
    "bio-plane: imports nothing outside its declared externals");
  assert.ok(plane.built.inputs.length > 100, "bio-plane: built from the whole plane's sources");
});

test("R22: each member's fresh build boots under workerd from one part, with its upload parts, and answers /version", async () => {
  for (const [name, extra] of [["agent-worker", { serviceBindings: { PLANE: () => new Response("{}") } }],
                               ["pdf-worker", { r2Buckets: ["CAPTURES"] }],
                               ["ocr-worker", { r2Buckets: ["CAPTURES"] }],
                               ["sheet-worker", { r2Buckets: ["CAPTURES"] }]]) {
    const m = guarded.find((x) => x.name === name);
    assert.ok(m, `${name} is a member`);
    const p = join(m.abs, m.bundle.outfile);
    const script = built.get(name).artifact.toString("utf8");
    /* A part is typed as the platform types it at upload: `CompiledWasm` (Workers forbid compiling wasm at runtime) and
       `Data`; `modulesRoot` is the member's directory, because the module names are the specifiers the bundle imports. */
    const assets = assetsOf(m);
    const mf = new Miniflare({
      ...(assets.length
        ? { modulesRoot: m.abs,
            modules: [{ type: "ESModule", path: p, contents: script },
                      ...assets.map((rel) => ({ type: rel.endsWith(".wasm") ? "CompiledWasm" : "Data", path: join(m.abs, rel),
                                                contents: readFileSync(join(m.abs, rel)) }))] }
        : { modules: true, modulesRoot: "/", scriptPath: p, script }),
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
      bindings: { VERSION: "bundle-gate" }, ...extra,
    });
    try {
      const res = await mf.dispatchFetch(`http://${name}/version`);
      const body = await res.json();
      assert.deepEqual([res.status, body.name, body.version], [200, name, "bundle-gate"], `${name}: boots and answers /version`);
      /* A member deployed without its wasm part initialises and then cannot work: the one that says so is asked. */
      if (assets.length && "engine_loaded" in body) assert.equal(body.engine_loaded, true, `${name}: its upload parts arrived`);
    } finally { await mf.dispose(); }
  }
});

test("R31: every member's and the plane's fresh build is measured for size and start-up against the fleet's budget, and none is past the 48 MiB fail", async () => {
  assert.deepEqual([BUDGET.sizeWarn, BUDGET.sizeFail, BUDGET.startWarnMs], [32 * MIB, 48 * MIB, 500],
    "warn past 32 MiB, fail past 48 MiB, warn past 500 ms");
  const measured = [];
  for (const m of [...guarded, plane.member]) {
    const r = await budgetReport(m);
    console.log(`        ${r.line}`);
    for (const w of r.warnings) console.log(`  WARN  ${w}`);
    assert.deepEqual([typeof r.bytes, typeof r.ms, r.findings], ["number", "number", []], m.name);
    measured.push(m.name);
  }
  assert.deepEqual(measured, [...guarded.map((x) => x.name), "bio-plane"]);
});

test("R31 (control): synthetic artifacts the budget must fail, warn on, and pass; an unmeasurable start-up fails by name", async () => {
  assert.deepEqual([48 * MIB, 48 * MIB + 1, 32 * MIB, 32 * MIB + 1].map((n) => sizeVerdict({ name: "x", abs: "", dir: "x", bundle: null }, n).verdict),
    ["warn", "fail", "ok", "warn"], "past is strictly greater");
  assert.deepEqual([startVerdict({ name: "x", abs: "", dir: "x", bundle: null }, 500).verdict, startVerdict({ name: "x", abs: "", dir: "x", bundle: null }, 500.5).verdict],
    ["ok", "warn"], "start-up past 500 ms warns, never fails");
  const dir = join(work, "r31-probe");
  mkdirSync(join(dir, "dist"), { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "assets/engine.wasm"), Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
  writeFileSync(join(dir, "assets/model.bin"), Buffer.from("MODEL"));
  const SLOW_MS = 60, SLOW_FLOOR_MS = 50;
  const artifact = [
    'import { DurableObject, env as ENV } from "cloudflare:workers";',
    'import wasm from "../assets/engine.wasm";',
    'import model from "../assets/model.bin";',
    "globalThis.__r31Probe = (globalThis.__r31Probe || 0) + 1;",
    "globalThis.__r31Seen = [typeof DurableObject, typeof ENV, wasm instanceof WebAssembly.Module, model instanceof ArrayBuffer && model.byteLength];",
    `const t0 = performance.now(); while (performance.now() - t0 < ${SLOW_MS}) { /* a slow global scope */ }`,
    "export class Probe extends DurableObject {}",
    'export default { fetch() { return new Response("ok"); } };',
    "",
  ].join("\n") + "/*" + "x".repeat(4000) + "*/\n";
  writeFileSync(join(dir, "dist/probe.bundled.mjs"), artifact);
  const probe = { name: "r31-probe", dir: "r31-probe", abs: dir,
    bundle: { entry: "src/index.mjs", manifest: "dist/probe.bundle.json", outfile: "dist/probe.bundled.mjs", assets: ["assets/engine.wasm", "assets/model.bin"] } };
  const size = Buffer.byteLength(artifact);
  try {
    const failing = await budgetReport(probe, { sizeWarn: 1000, sizeFail: 2000, startWarnMs: 60_000 });
    assert.equal(failing.size, "fail");
    assert.ok(failing.findings.length === 1 && failing.findings[0].startsWith("r31-probe:") && failing.findings[0].includes(`${size} B`),
      `past the fail budget, it fails naming the member and its size: ${failing.findings}`);
    const warning = await budgetReport(probe, { sizeWarn: 1000, sizeFail: 10 * MIB, startWarnMs: 60_000 });
    assert.deepEqual([warning.size, warning.findings, warning.warnings.length], ["warn", [], 1], "past the warn budget only, it warns");
    const within = await budgetReport(probe, { sizeWarn: 10 * MIB, sizeFail: 20 * MIB, startWarnMs: 60_000 });
    assert.deepEqual([within.size, within.start, within.findings, within.warnings], ["ok", "ok", [], []], "within both, nothing");
    const slow = await budgetReport(probe, { sizeWarn: 10 * MIB, sizeFail: 20 * MIB, startWarnMs: 10 });
    assert.deepEqual([slow.start, slow.findings, (slow.ms ?? 0) >= SLOW_FLOOR_MS], ["warn", [], true], "a slow global scope warns, never fails");
    assert.ok(slow.warnings.some((w) => w.startsWith("r31-probe:") && /global scope took \d+ ms/.test(w)), "naming the member and the time");
    assert.deepEqual(/** @type {any} */ (globalThis).__r31Seen, ["function", "object", true, 5], "its global scope ran with its parts as the platform hands them");
    const count = /** @type {any} */ (globalThis).__r31Probe;
    const again = await measureStart(probe);
    assert.deepEqual([again.measured, /** @type {any} */ (globalThis).__r31Probe], [true, count + 1], "each measurement is a fresh import");
    assert.equal(await import("cloudflare:workers").then(() => "resolved", () => "refused"), "refused", "and its import hooks are removed after");
    writeFileSync(join(dir, "dist/throws.bundled.mjs"), 'throw new Error("r31 boom");\nexport default {};\n');
    const throws = await budgetReport({ ...probe, bundle: { ...probe.bundle, outfile: "dist/throws.bundled.mjs" } });
    assert.ok(throws.ms === null && throws.findings.length === 1 && /r31 boom/.test(throws.findings[0]) && /start-up time is unmeasured/.test(throws.findings[0]),
      `a global scope that throws is unmeasured and fails by name: ${throws.findings}`);
    const gone = await budgetReport({ ...probe, bundle: { ...probe.bundle, outfile: "dist/absent.bundled.mjs" } });
    assert.deepEqual([gone.bytes, gone.ms, gone.findings.length], [null, null, 2], "a missing artifact fails on size and start-up");
  } finally {
    delete (/** @type {any} */ (globalThis)).__r31Probe; delete (/** @type {any} */ (globalThis)).__r31Seen;
  }
});

test("R39: over the real fleet as it stands, every service and Durable Object binding, container class and migration class names a class or service the release's bundles export", async () => {
  const { findings, unchecked } = await releaseBindingFindings([planeMember(REPO_ROOT), ...guarded]);
  for (const f of findings) console.log(`         ! ${f.text}`);
  assert.deepEqual(findings.map((f) => f.text), [], "every binding is exported by the bundle that would ship");
  assert.deepEqual(unchecked.map((u) => `${u.name}: ${u.reason}`), [], "every bundle was built here to read its exports");
});
