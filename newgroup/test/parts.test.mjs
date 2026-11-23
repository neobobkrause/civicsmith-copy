/* installer R61: every part comes from the release's own signed fleet statement, read as the release writes it. The two parts the
 * installer reads beside a member's bundle, `container.json` and `worker.json`, are made here by the release assembly's own
 * writers (`bundler`'s `containerDescriptor` and `workerPart`), and the installer's readers (re-exported here, R80) take them
 * as written; a field the assembly adds for others (R27's `packages`) changes nothing the installer reads. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { containerDescriptor as writeContainer, workerPart } from "../../bio-plane/scripts/fleet-bundle.mjs";
import { containerDescriptor, workerDescriptor } from "../src/index.mjs";

const DIGEST = "sha256:" + "a".repeat(64);
const runner = {
  dir: "runner", name: "runner", abs: "/nowhere",
  bundle: { entry: "src/index.mjs", outfile: "dist/runner.bundled.mjs", manifest: "dist/runner.bundle.json" },
  marker: { kind: "container", class_name: "Runner", image: { repository: "docker.io/civicos/runner", digest: DIGEST },
    max_instances: 3, bind: [{ member: "alpha-worker", binding: "RUNNER" }] },
};
const want = { class_name: "Runner", image: `docker.io/civicos/runner@${DIGEST}`, max_instances: 3,
  bind: [{ member: "alpha-worker", binding: "RUNNER" }] };

test("R61: a container.json part as the release writes it is read by the installer as written, with or without the packages it lists for others", () => {
  for (const packages of [null, [{ name: "tini", version: "0.19.0" }]]) {
    const w = writeContainer(runner, ["alpha-worker"], { packages });
    assert.ok(w && "bytes" in w, JSON.stringify(w));
    assert.deepEqual(containerDescriptor(w.bytes), { ok: true, d: want });
  }
});

test("R61 (control): a container part that names no class is refused by the installer in words, never installed", () => {
  const r = containerDescriptor(Buffer.from(JSON.stringify({ ...want, class_name: "" })));
  assert.equal(r.ok, false);
  assert.equal(typeof r.why, "string");
  assert.ok(r.why.length > 0);
});

test("R61: a worker.json part as the release writes it (each bucket by its role, the crons as stated) is read by the installer as written", () => {
  const w = workerPart({ r2_buckets: [{ binding: "CAPTURES", bucket_name: "bio-captures" }, { binding: "PUBLISHED", bucket_name: "bio-published" }],
    triggers: { crons: ["17 4 * * *"] } });
  assert.ok(w && "part" in w && w.part, JSON.stringify(w));
  assert.deepEqual(workerDescriptor(w.part.bytes), { ok: true, d: w.part.descriptor });
});

test("R61 (control): a worker part naming a bucket by a role the installer does not know is refused in words", () => {
  const r = workerDescriptor(Buffer.from(JSON.stringify({ r2_buckets: [{ binding: "ARCHIVE", bucket: "my-archive" }], crons: [] })));
  assert.equal(r.ok, false);
  assert.equal(typeof r.why, "string");
});
