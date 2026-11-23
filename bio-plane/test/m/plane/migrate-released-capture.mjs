/* plane's migrate-released suite, its CAPTURE (Process4: ARCH's decision "migrate-released", 23 Nov 2026). Run by hand, once, by plane's job, on a
   machine with the history fetched (each release's commit, e.g. `git fetch --depth=1 origin <commit>...`), from the repository's root:
     node --import ./bio-plane/test/platform-sqlite.mjs bio-plane/test/m/plane/migrate-released-capture.mjs
   For each signed release in `RELEASES` it reads the bundle and manifest at that release's commit, checks the bytes against the manifest's sha256 and
   version, has THAT plane build and write its store (the kit's `seed`), and commits what it wrote under `bio-plane/test/m/plane/fixtures/migrate-released/<label>/`: the
   store as miniflare persisted it (`store/`: the Durable Object's SQLite, every table, column, index, trigger and row the release made, and the
   buckets' objects), and `capture.json` with the release's commit id and the bundle's sha256 beside what the seed read back. For each withdrawn
   release it walks the path a group walked (born on 0.58.0, bricked by the withdrawn bytes, rolled back to 0.58.0) and commits that store too, with
   what the withdrawn bytes and the rollback answered. Every check here must hold, or nothing is written. No plane bundle is committed. Not product code. */
import "../../sandbox.mjs";
import { mkdtempSync, writeFileSync, rmSync, cpSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RELEASES, WITHDRAWN, FIXTURES, slug, sha, boot, probe, client, seed, compactStore } from "./migrate-released-kit.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const gitShow = (commit, path) => execFileSync("git", ["show", `${commit}:${path}`], { cwd: ROOT, maxBuffer: 64 << 20 });

const checks = [];
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  checks.push({ label, ok });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${String(JSON.stringify(got)).slice(0, 800)}`}`);
};

/* each release's signed bytes, checked against its manifest */
const PLANE = {}, SIGNED = {};
for (const [version, commit] of RELEASES) {
  const bundle = gitShow(commit, "release/bio-plane.bundled.mjs");
  const manifest = JSON.parse(gitShow(commit, "release/RELEASE.json").toString("utf8"));
  t(`${version}: the fixture IS the signed release — the manifest at ${commit.slice(0, 8)} names this version, and the bytes hash to its sha256`,
    [manifest.version, manifest.asset, sha(bundle), bundle.length], [version, "bio-plane.bundled.mjs", manifest.sha256, manifest.bytes]);
  const dir = mkdtempSync(join(tmpdir(), `rec143-plane-${version}-`));
  writeFileSync(join(dir, "plane.mjs"), bundle);
  PLANE[version] = dir;
  SIGNED[version] = { commit, bundle_sha256: sha(bundle) };
}
const bootRelease = (version, persist) => boot(join(PLANE[version], "probe.mjs"), probe("./plane.mjs", "./plane.mjs"), persist, version);

const out = [];
const keep = (label, persist, path, seeded, extra = {}) => out.push({ label, persist, capture: {
  label, path: path.map((v) => ({ version: v, ...SIGNED[v] })), doc: seeded.DOC, served: seeded.served, group_before: seeded.groupBefore,
  rows: seeded.rows, ...extra } });

/* a store born on each release */
let n = 0;
for (const [version] of RELEASES) {
  const label = `born on ${version}`;
  console.log(`\n--- ${label} ---`);
  const persist = mkdtempSync(join(tmpdir(), `rec143-born-${version}-`));
  keep(label, persist, [version], await seed(label, version, persist, { bootRelease, t, n: ++n }));
}

/* the path a group walked: born on 0.58.0, the withdrawn release's own bytes brick it, rolled back to 0.58.0 */
for (const [version] of RELEASES.filter(([v]) => WITHDRAWN.has(v))) {
  const label = `0.58.0 -> ${version} -> 0.58.0 -> current`;
  console.log(`\n--- ${label} ---`);
  const persist = mkdtempSync(join(tmpdir(), `rec143-path-${version}-`));
  const seeded = await seed(label, "0.58.0", persist, { bootRelease, t, n: ++n });
  let mf = bootRelease(version, persist);
  const brick = await client(mf).raw("SELECT 1 AS up");
  const bs = await client(mf).get("bootstrap", "", "");
  await mf.dispose();
  const bricked = { brick_ok: brick.ok, brick_error: String(brick.error || "").slice(0, 300), bootstrap_silent: JSON.stringify(bs).includes("STORE_DID_NOT_ANSWER") };
  t(`${label}: REPRODUCED — ${version}'s own bytes BRICK the 0.58.0 store: the Durable Object throws \`no such column: content_id\``,
    [brick.ok, /no such column: content_id/.test(brick.error || "")], [false, true]);
  t(`${label}: and ${version}'s op=bootstrap answers STORE_DID_NOT_ANSWER, as DIST measured on biosmoke7`, bricked.bootstrap_silent, true);
  mf = bootRelease("0.58.0", persist);
  const back = await client(mf).raw("SELECT count(*) AS n FROM inquiry_basis");
  await mf.dispose();
  t(`${label}: the ROLLBACK to 0.58.0 answers again — the failed upgrade left nothing 0.58.0 cannot read`, back.ok ? back.rows[0].n : back.error, 1);
  keep(label, persist, ["0.58.0", version, "0.58.0"], seeded, { withdrawn: bricked, rollback_inquiry_basis: back.ok ? back.rows[0].n : back.error });
}

for (const d of Object.values(PLANE)) rmSync(d, { recursive: true, force: true });
const failed = checks.filter((c) => !c.ok);
if (failed.length) { console.log(`\ncapture: ${failed.length} check(s) failed; nothing written`); process.exit(1); }
rmSync(FIXTURES, { recursive: true, force: true });
for (const { label, persist, capture } of out) {
  const dir = join(FIXTURES, slug(label));
  mkdirSync(dir, { recursive: true });
  cpSync(persist, join(dir, "store"), { recursive: true });
  await compactStore(join(dir, "store"));
  writeFileSync(join(dir, "capture.json"), JSON.stringify({ ...capture, checks: checks.filter((c) => c.label.startsWith(label + ":")).map((c) => c.label) }, null, 1) + "\n");
}
console.log(`\ncapture: ${checks.length} checks pass; ${out.length} stores written under ${FIXTURES}`);
