/* bundler's two verification arms over fixture members only: proves R6 (verifyStatic, with nothing installed, names the
 * stale input or lockfile), R7 (verifyFresh: byte equality where installed, "could not check" where not), R10 (no
 * verifying call creates or changes a file) and R24 (a container member with no Worker bundle is listed and never
 * reported stale, unguarded or missing an artifact). */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, rmSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import {
  discoverMembers, writeMember, verifyStatic, verifyFresh, freshBuildRunnable, unresolvableSpecifiers,
  isContainer, isGuarded, markerIsContainer,
} from "../../../../scripts/fleet-bundle.mjs";
import { scratch, makeMember, snapshot, put, withBundle, same, descriptor, checkedFindings } from "./fixture.mjs";

const s = scratch("verify");
after(() => s.done());

/** A written fixture member and its committed artifact. */
async function written(dir, opts) {
  const m = makeMember(s.root, dir, opts);
  const { manifest } = await writeMember(m);
  return { m, manifest, committed: readFileSync(join(m.abs, m.bundle.outfile)) };
}

/* ------------------------------------------------------------------------- R6 */

test("R6: with no dependencies installed, a fresh artifact verifies; a changed or vanished input, or a changed or removed lockfile, is stale, naming it", async () => {
  const { m, manifest } = await written("r6");
  rmSync(join(m.abs, "node_modules"), { recursive: true });            /* no dependencies installed */
  assert.deepEqual(verifyStatic(m).findings, [], "a fresh artifact verifies with nothing installed");
  assert.deepEqual(manifest.inputs.map((i) => i.path).sort(), ["src/dep.mjs", "src/index.mjs"]);
  for (const inp of manifest.inputs) {
    const p = join(m.abs, inp.path), before = readFileSync(p);
    writeFileSync(p, before + "\n/* a comment the build would strip */\n");
    let f = verifyStatic(m).findings;
    assert.equal(f.length, 1, String(f));
    assert.match(f[0], new RegExp(`^r6: STALE BUNDLE — the source ${inp.path.replace(".", "\\.")} has changed since`), inp.path);
    rmSync(p);
    f = verifyStatic(m).findings;
    assert.match(f.join("\n"), new RegExp(`a recorded build input has vanished: ${inp.path.replace(".", "\\.")}`), `${inp.path} vanished`);
    writeFileSync(p, before);
    assert.deepEqual(verifyStatic(m).findings, [], `${inp.path} restored`);
  }
  const lock = join(m.abs, "package-lock.json"), lockBefore = readFileSync(lock);
  writeFileSync(lock, lockBefore + " ");
  assert.match(verifyStatic(m).findings.join("\n"), /^r6: STALE BUNDLE — package-lock\.json has changed since the bundle was built/);
  rmSync(lock);
  assert.match(verifyStatic(m).findings.join("\n"), /package-lock\.json has changed .*lock is now absent/, "a lock removed");
  writeFileSync(lock, lockBefore);
  assert.deepEqual(verifyStatic(m).findings, []);
});

test("R6: a present vendored input that changed, an artifact that is not its manifest's, a missing manifest or artifact, or a recipe the tree no longer declares is stale too", async () => {
  const { m, manifest, committed } = await written("r6b");
  const named = (re) => assert.match(verifyStatic(m).findings.join("\n"), re);
  const dep = join(m.abs, "node_modules/fakedep/index.mjs");
  writeFileSync(dep, "export const V = 41;\n");
  named(/STALE BUNDLE — the vendored input node_modules\/fakedep\/index\.mjs has changed/);
  writeFileSync(dep, "export const V = 40;\n");

  const art = join(m.abs, m.bundle.outfile);
  writeFileSync(art, Buffer.concat([committed, Buffer.from("\n")]));
  named(/the committed artifact does not match its own manifest/);
  rmSync(art);
  named(/its committed artifact dist\/r6b\.bundled\.mjs is missing/);
  writeFileSync(art, committed);

  const mf = join(m.abs, m.bundle.manifest);
  rmSync(mf);
  named(/its committed manifest dist\/r6b\.bundle\.json is missing or unreadable/);
  writeFileSync(mf, JSON.stringify({ ...manifest, inputs: [] }));
  named(/records NO first-party inputs/);
  writeFileSync(mf, JSON.stringify(manifest));

  const moved = withBundle(m, { external: ["cloudflare:workers", "node:*", "other"] });
  assert.match(verifyStatic(moved).findings.join("\n"), /recipe\.external is .*, the tree says /);
  assert.match(verifyStatic(withBundle(m, { entry: "src/dep.mjs" })).findings.join("\n"), /recipe\.entry/);
  assert.deepEqual(verifyStatic(m).findings, [], "restored, it verifies");
  const noBundle = descriptor({ ...m, bundle: null });
  assert.match(verifyStatic(noBundle).findings[0], /^r6b: declares no `bundle` block/, "a member with no bundle is named unguarded");
});

/* ------------------------------------------------------------------------- R7 */

test("R7: with dependencies installed, verifyFresh rebuilds without writing and is stale unless the bytes equal the committed artifact exactly", async () => {
  const { m, committed } = await written("r7");
  const ok = await verifyFresh(m, committed);
  assert.deepEqual([ok.checked, ok.findings], [true, []]);
  assert.ok(same(ok.built.bytes, committed));
  const flipped = Buffer.from(committed); flipped[flipped.length - 2] ^= 1;
  for (const [label, bytes] of [["one bit", flipped], ["one byte more", Buffer.concat([committed, Buffer.from("\n")])],
    ["one byte less", committed.subarray(0, -1)], ["empty", Buffer.alloc(0)]]) {
    const r = await verifyFresh(m, bytes);
    assert.equal(r.checked, true, label);
    assert.equal(r.findings.length, 1, label);
    assert.match(r.findings[0], /^r7: STALE BUNDLE — a fresh build of src\/index\.mjs is \d+ B .* They must be byte-identical/, label);
  }
  /* A dependency's bytes moved under an unchanged lockfile: only the fresh build sees it. */
  writeFileSync(join(m.abs, "node_modules/fakedep/index.mjs"), "export const V = 41;\n");
  assert.match(checkedFindings(await verifyFresh(m, committed)), /STALE BUNDLE — a fresh build/);
});

test("R7: where the dependencies are not installed verifyFresh says it could not check, naming what is absent, never that the artifact is fresh", async () => {
  const { m, manifest, committed } = await written("r7b");
  rmSync(join(m.abs, "node_modules"), { recursive: true });
  const r = await verifyFresh(m, committed);
  assert.deepEqual([r.checked, r.findings, r.built], [false, null, null], "no empty list a caller could read as fresh");
  assert.match(String(r.reason), /^r7b: not checked — 1 vendored input\(s\) are not installed, e\.g\. node_modules\/fakedep\/index\.mjs/);
  assert.deepEqual(freshBuildRunnable(m, manifest).runnable, false);
  /* No manifest to name the dependencies, and they are absent: the build fails here, and that is not fresh either. */
  rmSync(join(m.abs, m.bundle.manifest));
  const rn = await verifyFresh(m, committed);
  assert.deepEqual([rn.checked, rn.findings], [false, null]);
  assert.match(String(rn.reason), /^r7b: not checked — a fresh build of src\/index\.mjs failed here: .*fakedep/);
  /* A member with no dependencies is always checkable. */
  const bare = await written("r7bare", { vendored: false });
  assert.deepEqual(freshBuildRunnable(bare.m, bare.manifest), { runnable: true, reason: null });
  const rb = await verifyFresh(bare.m, bare.committed);
  assert.deepEqual([rb.checked, rb.findings], [true, []]);
});

/* ------------------------------------------------------------------------ R10 */

test("R10: no verifying call creates or changes a file: fresh or stale, dependencies installed or not, artifact or manifest absent", async () => {
  const { m, manifest, committed } = await written("r10");
  const verifyAll = async () => {
    verifyStatic(m);
    freshBuildRunnable(m, manifest);
    await verifyFresh(m, committed);
    await verifyFresh(m, Buffer.from("stale"));
    unresolvableSpecifiers(committed.toString("utf8"));
  };
  const states = [
    ["fresh, installed", () => {}],
    ["a source changed (stale)", () => writeFileSync(join(m.abs, "src/dep.mjs"), "export const N = 2;\n")],
    ["the dependencies removed (not installed)", () => rmSync(join(m.abs, "node_modules"), { recursive: true })],
    ["the dependencies reinstalled", () => cpSync(join(s.root, "r10-deps"), join(m.abs, "node_modules"), { recursive: true })],
    ["the artifact removed", () => rmSync(join(m.abs, m.bundle.outfile))],
    ["the manifest removed", () => rmSync(join(m.abs, m.bundle.manifest))],
  ];
  cpSync(join(m.abs, "node_modules"), join(s.root, "r10-deps"), { recursive: true });
  for (const [label, arrange] of states) {
    arrange();
    const before = snapshot(m.abs);
    await verifyAll();
    assert.deepEqual(snapshot(m.abs), before, `${label}: nothing created or changed`);
  }
  /* A member never built: verifying creates no dist directory. */
  const unbuilt = makeMember(s.root, "r10-unbuilt", { vendored: false });
  const before = snapshot(unbuilt.abs);
  verifyStatic(unbuilt);
  await verifyFresh(unbuilt, Buffer.from(""));
  assert.deepEqual(snapshot(unbuilt.abs), before);
  assert.equal(existsSync(join(unbuilt.abs, "dist")), false);
});

/* ------------------------------------------------------------------------ R24 */

const IMAGE = { repository: "docker.io/fixture/runner", digest: "sha256:" + "0f".repeat(32), platform: "linux/amd64", port: 8080 };

/** A container member's marker under `root/dir`, with no Worker bundle. */
function containerMember(root, dir, marker) {
  put(join(root, dir), { "src/entry.mjs": "export const runner = 1;\n", "fleet-member.json": JSON.stringify({ name: dir, entry: "src/entry.mjs", ...marker }) });
}

test("R24: a marker with kind container and an image block (or a containers list each with one) is a container member, listed with its kind and image; every other marker is a worker or not a container member", () => {
  const { root, done } = scratch("r24");
  try {
    makeMember(root, "w", { name: "w-worker", vendored: false });
    containerMember(root, "runner", { kind: "container", image: IMAGE });
    containerMember(root, "multi", { kind: "container", containers: [{ class_name: "A", image: IMAGE }, { class_name: "B", image: { ...IMAGE, port: 9 } }] });
    containerMember(root, "no-image", { kind: "container" });
    containerMember(root, "odd-image", { kind: "container", image: "docker.io/x@sha256:0" });
    containerMember(root, "half-list", { kind: "container", containers: [{ class_name: "A", image: IMAGE }, { class_name: "B" }] });
    const got = discoverMembers(root);
    assert.deepEqual(got.map((m) => [m.name, m.kind, isContainer(m), isGuarded(m)]), [
      ["half-list", "container", false, true], ["multi", "container", true, false], ["no-image", "container", false, true],
      ["odd-image", "container", false, true], ["runner", "container", true, false], ["w-worker", "worker", false, true]]);
    const by = Object.fromEntries(got.map((m) => [m.name, m]));
    assert.deepEqual(by.runner.image, IMAGE, "listed with its image, as its marker states it");
    assert.deepEqual([by.runner.entry, by.runner.bundle], ["src/entry.mjs", null]);
    assert.deepEqual(by.multi.containers, [{ class_name: "A", image: IMAGE }, { class_name: "B", image: { ...IMAGE, port: 9 } }]);
    assert.equal(by["w-worker"].image, null, "a worker has no image");
    assert.deepEqual(got.map((m) => markerIsContainer(m.marker)), [false, true, false, false, true, false]);
  } finally { done(); }
});

test("R24: verifyStatic and verifyFresh never report a container member with no Worker bundle stale, unguarded or missing an artifact, and say it is not guarded; one that states no image is still named unguarded", async () => {
  const { root, done } = scratch("r24v");
  try {
    containerMember(root, "runner", { kind: "container", image: IMAGE });
    containerMember(root, "no-image", { kind: "container" });
    const [noImage, runner] = discoverMembers(root);
    const before = snapshot(root);
    assert.deepEqual(verifyStatic(runner), { findings: [], manifest: null, committed: null, guarded: false });
    const f = await verifyFresh(runner, descriptor(null));
    assert.deepEqual([f.checked, f.guarded, f.findings, f.built], [false, false, null, null], "never said to be fresh (R7)");
    assert.match(String(f.reason), /^runner: not checked — a container member with no Worker bundle is not bundle-guarded \(bundler R24\)/);
    assert.deepEqual(snapshot(root), before, "R10: nothing written");
    const named = verifyStatic(noImage).findings;
    assert.equal(named.length, 1);
    assert.match(named[0], /^no-image: declares no `bundle` block/, "a marker that is not a container member's is not exempt");
  } finally { done(); }
});

test("R24: a container member that declares a Worker bundle is guarded like any member: built, verified, and named stale when its source moves", async () => {
  const m = makeMember(s.root, "r24b", { vendored: false, marker: { kind: "container", image: IMAGE } });
  assert.deepEqual([isContainer(m), isGuarded(m)], [true, true]);
  await writeMember(m);
  assert.deepEqual(verifyStatic(m).findings, []);
  const fresh = await verifyFresh(m, readFileSync(join(m.abs, m.bundle.outfile)));
  assert.deepEqual([fresh.checked, fresh.findings], [true, []]);
  writeFileSync(join(m.abs, "src/dep.mjs"), "export const N = 9;\n");
  assert.match(verifyStatic(m).findings.join("\n"), /^r24b: STALE BUNDLE — the source src\/dep\.mjs has changed/);
  assert.match(checkedFindings(await verifyFresh(m, readFileSync(join(m.abs, m.bundle.outfile)))), /STALE BUNDLE/);
});
