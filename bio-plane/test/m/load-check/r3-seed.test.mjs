/* load-check R3: seedCopy builds a record of the named size through the product's own acts (the upload act alone),
 * within 10 % of the request in the database and in stored files apart, and returns what the gauge reports. */
import test from "node:test";
import assert from "node:assert/strict";
import { seedCopy, LoadRefusal } from "../../../src/load-check/index.mjs";
import { fixtureCopy } from "./fixture-copy.mjs";

const near = (got, want) => Math.abs(got - want) <= 0.1 * want;

async function seeds(mix, size) {
  {
    const copy = fixtureCopy();
    const seed = await seedCopy(copy, { ...size, mix }, { seed_id: `p3dev-load-r3-${mix}` });
    const g = await copy.door.gauge();
    assert.equal(seed.reached, true);
    assert.ok(near(seed.database_bytes, size.database_bytes), `database ${seed.database_bytes}`);
    assert.ok(near(seed.r2_bytes, size.r2_bytes), `r2 ${seed.r2_bytes}`);
    assert.equal(seed.database_bytes, g.database_bytes);
    assert.equal(seed.r2_bytes, g.r2_bytes);
    assert.equal(seed.rows, g.rows);
    assert.equal(seed.documents.length, g.documents);
    /* every byte came by the product's upload act, one request a document */
    assert.ok(copy.state.requests.every((q) => q.op === "captureupload"));
    assert.equal(copy.state.uploads, seed.documents.length);
    assert.equal(seed.mix, mix);
    assert.ok(seed.documents.some((d) => d.kind === mix));
    assert.equal(copy.seed, seed);
    assert.equal(seed.by, "load-check");
  }
}

test("R3 a text-heavy seed reaches the size within 10 % and equals the gauge", () => seeds("text", { database_bytes: 120000, r2_bytes: 240000 }));
test("R3 a scan-heavy seed reaches the size within 10 % and equals the gauge", () => seeds("scan", { database_bytes: 30000, r2_bytes: 600000 }));

test("R3 a copy of a wrong account or the shared copy is not seeded", async () => {
  const wrong = fixtureCopy({ account: "ffffffffffffffffffffffffffffffff" });
  await assert.rejects(seedCopy(wrong, { database_bytes: 1, r2_bytes: 1 }), (e) => e instanceof LoadRefusal && e.code === "ACCOUNT_NOT_PERMITTED");
  const shared = fixtureCopy({ shared: true });
  await assert.rejects(seedCopy(shared, { database_bytes: 1, r2_bytes: 1 }), (e) => e.code === "SHARED_COPY");
  assert.equal(wrong.state.requests.length + shared.state.requests.length + wrong.state.gauges + shared.state.gauges, 0);
});
