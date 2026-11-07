// Copied from control-plane's suite (test/m/control-plane/r128-timing-desc-bytes.test.mjs) when control-plane-door-reading took this requirement by copy (5 Nov 2026); it proves the requirement at this module's interface.
/* control-plane R128 (BOB K4870, K4850): `stateTiming` takes an optional `desc`, and the door tells the bytes of each of the largest routes beside the sum. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeClock, clockedEnv, withClock } from "../../../src/control-plane/phase-clock.mjs";

const fixed = () => { let t = 1000; return () => (t += 1); };
const entries = (header) => (header || "").split(",").map((m) => m.trim());

test("R128 stateTiming desc: a token desc is written as the entry's desc beside its dur", () => {
  const c = makeClock(fixed());
  c.stateTiming("isolate", 12, "abc123");
  assert.ok(entries(c.header("op")).includes("isolate;dur=12;desc=abc123"), c.header("op"));
});

test("R128 stateTiming desc: a desc that is no token, or no string, is dropped and the entry stays without it, never thrown", () => {
  for (const bad of ["has space", "a;b", "x\"y", "", "z".repeat(49), 5, null, {}, "<s>"]) {
    const c = makeClock(fixed());
    assert.doesNotThrow(() => c.stateTiming("isolate", 12, bad));
    const list = entries(c.header("op"));
    assert.ok(list.includes("isolate;dur=12"), `${String(bad)}: ${c.header("op")}`);
    assert.equal(list.some((e) => e.includes("desc=")), false);
  }
});

test("R128 stateTiming desc control: no desc is as before", () => {
  const c = makeClock(fixed());
  c.stateTiming("isolate", 12);
  assert.ok(entries(c.header("op")).includes("isolate;dur=12"));
  assert.equal(c.header("op").includes("desc"), false);
});

/* an env whose STORE answers a body of a size for each route */
const sized = (sizes) => ({ STORE: { get: () => ({ fetch: async (input) => {
  const route = new URL(input).pathname.replace(/^\/+/, "").split("/")[0];
  return new Response("x".repeat(sizes[route] ?? 0), { headers: { "content-type": "text/plain" } });
} }) } });
async function drive(sizes, reads) {
  const clock = makeClock(fixed());
  const env = clockedEnv(sized(sizes), clock);
  await withClock(clock, async () => {
    const stub = env.STORE.get("id");
    for (const route of reads) await (await stub.fetch(`http://x/${route}`)).text();
  });
  return clock.header("op");
}

test("R128 per-route bytes: each route read to its end has `bytes-<route>;dur=<n>` of its exact bytes, and `bytes;dur` is still the sum", async () => {
  const header = await drive({ caseratify: 7000, projectlist: 300, whoami: 41 }, ["caseratify", "projectlist", "whoami"]);
  const list = entries(header);
  assert.ok(list.includes("bytes-caseratify;dur=7000"), header);
  assert.ok(list.includes("bytes-projectlist;dur=300"), header);
  assert.ok(list.includes("bytes-whoami;dur=41"), header);
  assert.ok(list.includes("bytes;dur=7341"), header);
  assert.ok(list.indexOf("bytes;dur=7341") < list.indexOf("bytes-caseratify;dur=7000"), "after the door's own entries");
});

test("R128 per-route bytes: a route read twice is summed, and at most five routes, the largest, are told", async () => {
  const sizes = { a: 10, b: 20, c: 30, d: 40, e: 50, f: 60, g: 70 };
  const header = await drive(sizes, ["a", "b", "c", "d", "e", "f", "g", "g"]);
  const per = entries(header).filter((e) => e.startsWith("bytes-"));
  assert.deepEqual(per, ["bytes-g;dur=140", "bytes-f;dur=60", "bytes-e;dur=50", "bytes-d;dur=40", "bytes-c;dur=30"]);
});

test("R128 per-route bytes control: a route whose body was never read has no entry", async () => {
  const clock = makeClock(fixed());
  const env = clockedEnv(sized({ read: 5, unread: 9 }), clock);
  await withClock(clock, async () => {
    const stub = env.STORE.get("id");
    await (await stub.fetch("http://x/read")).text();
    await stub.fetch("http://x/unread");
  });
  const list = entries(clock.header("op"));
  assert.ok(list.includes("bytes-read;dur=5"));
  assert.equal(list.some((e) => e.startsWith("bytes-unread")), false);
});
