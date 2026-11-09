/* F2 (walk p3dev-l1; coordinator ruling, 5 Nov): deploy-fleet.mjs's rollout check polled https://<name>.<sub>.workers.dev/version
 * for every member, so a member deployed with `workers_dev: false` (agent-worker: reachable only through the plane's service
 * binding) could never confirm and always reported ROLLOUT NOT CONFIRMED. Such a member is now reported as not reachable
 * from here by design, and is not polled. Driven as p3dev.test.mjs drives the script: a fixture repository over the
 * stubbed account (`stubfetch.mjs`) and the fake wrangler. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonc } from "../../../scripts/jsonc.mjs";
import { makeRepo, run, rm, VERSION } from "./repo.mjs";

const ACCT = "20b533579290b9b93168345edd3b7f72";
const SLUG = "p3dev-l1";
const repo = () => makeRepo({ members: { "alpha-worker": { account: ACCT } },
  plane: { config: { services: [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }] } } });
const deploy = (root, stub) => run(root, ".", ["bio-plane/scripts/deploy-fleet.mjs", "alpha-worker", "--instance", SLUG, "--test-instance"],
  { env: { CF_TOKEN: "t", CF_ACCT: ACCT, CIVICSMITH_TEST_INSTANCE: SLUG }, stub });
const setWorkersDev = (root, value) => {
  const p = join(root, "alpha-worker", "wrangler.jsonc");
  const cfg = parseJsonc(readFileSync(p, "utf8"), p);
  if (value === undefined) delete cfg.workers_dev; else cfg.workers_dev = value;
  writeFileSync(p, JSON.stringify(cfg));
};
const workersDevCalls = (r) => r.calls.filter((c) => new URL(c.url).host.endsWith(".workers.dev"));
const STUB = { subdomain: "sub", scripts: { [SLUG]: { settings: {} } } };

test("F2: a member deployed with workers_dev: false is never polled at a workers.dev address, and its rollout is reported not reachable by design", async () => {
  const root = await repo();
  try {
    setWorkersDev(root, false);
    const r = deploy(root, STUB);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.wrangler.length, 1, "the member was deployed");
    assert.equal(JSON.parse(r.wrangler[0].config).workers_dev, false, "the generated config keeps workers_dev: false");
    assert.match(r.stdout, /rollout: alpha-worker is deployed with workers_dev: false: it is reachable only through the plane's service binding/);
    assert.match(r.stdout, /not reachable from here by design and is not polled/);
    assert.doesNotMatch(r.stdout, /ROLLOUT NOT CONFIRMED/);
    assert.deepEqual(workersDevCalls(r), [], "no request to any workers.dev address");
  } finally { rm(root); }
});

test("F2 control: a member with a workers.dev address is still polled, and confirmed when it serves the declared VERSION", async () => {
  const root = await repo();
  try {
    for (const value of [undefined, true]) {
      setWorkersDev(root, value);
      const r = deploy(root, { ...STUB, serving: { [`alpha-worker-${SLUG}`]: JSON.stringify({ version: VERSION }) } });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, new RegExp(`rollout: alpha-worker serving ${VERSION.replace(/\./g, "\\.")}`));
      assert.doesNotMatch(r.stdout, /not reachable from here by design/);
      assert.ok(workersDevCalls(r).some((c) => c.url === `https://alpha-worker-${SLUG}.sub.workers.dev/version`), JSON.stringify(r.calls));
    }
  } finally { rm(root); }
});
