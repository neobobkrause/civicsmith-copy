/* installer-copies R13 and R24: each copy's own buckets, and installs isolated. The installer (newgroup/, installer's code until
 * a job of this module moves it) driven end to end through its own routes against the stateful fake Cloudflare account of
 * installer's fixture (newgroup/test/fixture.mjs), with a release that fixture signs at test time. Each test keeps its control. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { run, release, armWith, restoreSigners, SIGNER, bump, SCANNER } from "../../../../newgroup/test/fixture.mjs";
import { CFG } from "../../../../newgroup/src/index.mjs";
import { RELEASE_VERSION } from "../../../../newgroup/src/release.mjs";

after(restoreSigners);
const NEXT = bump(RELEASE_VERSION);
/* The calls that wrote something to the account: everything but the exchange of the sign-in code. */
const writes = (w) => w.calls.filter((c) => c.method !== "GET" && c.u !== CFG.TOKEN);
const r2Of = (w, name) => (w.acct.get(name) || []).filter((b) => b.type === "r2_bucket");
/* The members whose own signed Worker part states a CAPTURES bucket: the ones that read captured bytes. */
const readersOf = (rel) => (rel.manifest.fleet || []).filter((m) => m.parts.some((p) => p.type === "Worker"
  && (JSON.parse(rel.assets[`${m.member}/${p.path}`]).r2_buckets || []).some((b) => b.binding === "CAPTURES"))).map((m) => m.member);

test("R13 each member that reads captured bytes is bound to the instance's CAPTURES bucket: the file scanner and the plane hold CAPTURES naming this copy's own captures bucket; control: a member stating no bucket is bound to none", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, scanner: true });
  const readers = readersOf(rel);
  assert.deepEqual(readers, [SCANNER], "the release states the file scanner as a reader of captured bytes");
  const w = await run({ slug: "own-bucket", rel });
  assert.equal(w.page.status("install"), "ok");
  assert.ok(w.buckets.has("bio-captures-own-bucket"), "the copy's captures bucket exists");
  for (const m of readers) {
    const name = `${m}-own-bucket`;
    assert.ok(w.acct.has(name), `${name} is installed`);
    assert.deepEqual(r2Of(w, name).filter((b) => b.name === "CAPTURES").map((b) => b.bucket_name), ["bio-captures-own-bucket"], `${name} reads this copy's captures`);
  }
  assert.deepEqual(r2Of(w, "own-bucket").find((b) => b.name === "CAPTURES")?.bucket_name, "bio-captures-own-bucket", "the plane too");
  /* Control: a member whose release states no bucket gets no R2 binding at all. */
  assert.deepEqual(r2Of(w, "pdf-worker-own-bucket"), []);
  restoreSigners();
});

test("R24 an install never shares another copy's buckets and never overwrites its fleet workers in the same account: a second copy installed beside the first creates its own two buckets and its own workers, binds its readers to its own captures, and writes nothing the first holds; control: an install under the slug the first copy holds is refused before anything is written", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, scanner: true });
  const first = await run({ slug: "copy-one", rel });
  assert.equal(first.page.status("install"), "ok");
  const firstState = Object.fromEntries(first.acct);
  const held = { pre: firstState, preBuckets: [...first.buckets], preClasses: Object.fromEntries(first.classes),
    preSources: Object.fromEntries(first.sources), preTags: Object.fromEntries(first.tags) };
  const second = await run({ slug: "copy-two", alongside: true, rel, ...held });
  assert.equal(second.page.status("install"), "ok");
  /* Its own buckets: two new ones, and every bucket of the first is still there. */
  assert.deepEqual([...second.buckets].filter((b) => !first.buckets.has(b)).sort(), ["bio-captures-copy-two", "bio-published-copy-two"]);
  for (const b of first.buckets) assert.ok(second.buckets.has(b), `${b} kept`);
  /* No bucket binding of the second copy names a bucket of the first. */
  const mine = [...second.acct.keys()].filter((k) => !(k in firstState) && k !== "bio-install-lock");
  assert.ok(mine.includes("copy-two") && mine.includes(`${SCANNER}-copy-two`), "the second copy's plane and members are its own workers");
  for (const k of mine) for (const b of r2Of(second, k)) assert.ok(!first.buckets.has(b.bucket_name), `${k} ${b.name} shares ${b.bucket_name}`);
  assert.equal(r2Of(second, `${SCANNER}-copy-two`).find((b) => b.name === "CAPTURES")?.bucket_name, "bio-captures-copy-two");
  /* The first copy's workers are exactly as they were, and nothing it holds was written. */
  for (const [k, v] of Object.entries(firstState)) if (k !== "bio-install-lock") assert.deepEqual(second.acct.get(k), v, `${k} unchanged`);
  assert.ok(!writes(second).some((c) => /copy-one/.test(c.u)), "nothing the first copy holds was written");
  /* Control: the first copy's own slug is refused before anything is created. */
  const clash = await run({ slug: "copy-one", alongside: true, rel, ...held });
  assert.equal(clash.page.status("fresh"), "no");
  assert.deepEqual(writes(clash).map((c) => `${c.method} ${c.u}`), []);
  for (const [k, v] of Object.entries(firstState)) if (k !== "bio-install-lock") assert.deepEqual(clash.acct.get(k), v, `${k} unchanged`);
  restoreSigners();
});
