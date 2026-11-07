/* control-plane (fix round 8, G119; K4814 (4), K4817; review2 D2; R-SEAM, R-ONE): HOW MANY CALLS TO THE OBJECT A FRAME OP COSTS, through the counting door (`wrap-entry.mjs`: every call of the Worker to the object,
   by route, on the answer's `x-wrap-calls`). Each call is a hop of 110-135 ms live whatever it does, and every one queues behind the object's synchronous work (P19), so the count is the floor of
   a frame read. The table is the plan's: `whoami` 1, `queue` 2, `groupidentity` 3 (the session read once; `doorwindow`, the protective limit of K1881, kept: `session`, `doorwindow`,
   `groupidentity`), `bootstrap` 4 for a member and for the administrator (session, doorwindow, bootstrap, bootstrapfacts: BOB ruled K4833 that the estimate of 3 preceded G118's split of the facts read), and `infolevel`, `assistantstate`, `accountsof` (the T53 read of a team's or member's AI accounts, in place of `accountreference` and `groupkeystate`, which op-grades R57 retired), `wizardsat` and
   `projectlist` 2. A signed-in member and the administrator. Red by name until `admission` (G119: one session read per request) has merged: today `groupidentity` makes 4 and `bootstrap` 4-5.
   `t51-hops.test.mjs` holds today's ceilings so no op gets worse; this file holds the targets. Counts only; no clock (R-CLOCK). */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeKit } from "./r8-kit.mjs";
import { readCalls, doCalls } from "./wrap-entry.mjs";

const kit = makeKit({ tag: "r8hops", counting: true });
after(() => kit.mf.dispose());

/* an op's own address fields, where it reads one: `accountsof` reads the team's list */
const QUERY = { accountsof: "&owner=group" };

/* op -> the most calls to the object it may make, for a member and for the administrator */
const TARGET = {
  whoami: { member: 1, admin: 1 },
  queue: { member: 2, admin: 2 },
  groupidentity: { member: 3, admin: 3 },
  bootstrap: { member: 4, admin: 4 },
  infolevel: { member: 2, admin: 2 },
  assistantstate: { member: 2, admin: 2 },
  accountsof: { member: 2, admin: 2 },
  wizardsat: { member: 2, admin: 2 },
  projectlist: { member: 2, admin: 2 },
};

async function measure(auth) {
  const seen = {};
  for (const op of Object.keys(TARGET)) {
    const res = await kit.plane(`/api/?op=${op}${QUERY[op] ?? ""}`, { headers: auth });
    await res.arrayBuffer();
    seen[op] = { status: res.status, calls: doCalls(readCalls(res)), routes: Object.keys(readCalls(res).do).join(",") };
  }
  return seen;
}

test("R8 (G119): a signed-in member's frame ops make no more calls to the object than the plan's table", { timeout: 600000 }, async () => {
  const ann = await kit.person("r8-hops-ann");
  const seen = await measure(ann);
  console.log("hops, member:", JSON.stringify(seen));
  const over = Object.entries(TARGET).filter(([op, t]) => seen[op].calls > t.member).map(([op, t]) => `${op}: ${seen[op].calls} (${seen[op].routes}), target ${t.member}`);
  assert.deepEqual(over, [], `calls to the object above the table: ${over.join("; ")}`);
});

test("R8 (G119): the administrator's frame ops make no more calls to the object than the plan's table", { timeout: 600000 }, async () => {
  const adm = await kit.founder();
  const seen = await measure(adm);
  console.log("hops, administrator:", JSON.stringify(seen));
  const over = Object.entries(TARGET).filter(([op, t]) => seen[op].calls > t.admin).map(([op, t]) => `${op}: ${seen[op].calls} (${seen[op].routes}), target ${t.admin}`);
  assert.deepEqual(over, [], `calls to the object above the table: ${over.join("; ")}`);
});

test("R8 control (G119): `doorwindow` stays (the protective limit), and the session is one call of the request, not three", { timeout: 600000 }, async () => {
  const ann = await kit.person("r8-hops-bea");
  const res = await kit.plane("/api/?op=groupidentity", { headers: ann });
  await res.arrayBuffer();
  const calls = readCalls(res);
  assert.equal(calls.do.doorwindow?.n, 1, `the window is read once: ${JSON.stringify(calls.do)}`);
  assert.equal(calls.do.session?.n, 1, `the session is read once for the request: ${JSON.stringify(calls.do)}`);
  assert.equal(calls.do.groupidentity?.n, 1);
});
