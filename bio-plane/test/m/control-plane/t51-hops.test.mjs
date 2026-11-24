/* control-plane R121 (fix round 5, E10; K4354, K4530): HOW MANY CALLS TO THE OBJECT AN OP COSTS, through the real plane. Every call is a `do-<route>` metric
   in the answer's `Server-Timing` (one for each distinct route), and each costs 110-125 ms whatever it does (P11). The plan's targets are `whoami` 1,
   `projectlist` 1, `groupidentity` 2, `bootstrap` 2; folding the session read and the door's window into the op's own call needs the object to judge
   the caller itself (admission, store-door and plane: asked of BOB, J25 Q1 (b)). Until that has merged the CEILINGS below hold today's measured counts, so no op gets
   worse, and the targets are named beside them. The object's own time (E10 (i)) is told as `in-<route>` when the object states it (plane, merge 11): red by
   name until plane has merged. */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
const ADM = "adm-hops-0123456789abcdef", PASSWORD = "the founder's long password, hops", ORIGIN = "https://group.example";
const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
  modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-hops-0123456789abcdef", PROBE_TOKEN: "prb-hops-0123456789abcdef", VERSION: "4.7.5",
              INSTANCE_NAME: "hops-town", KNOCK_FINGERPRINT_KEY: "hops-fingerprint-key", GOVERNOR_APPETITE_PER_MIN: "600000" },
});
after(() => mf.dispose());
const plane = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);

const CEILING = { whoami: 1, projectlist: 2, groupidentity: 3, bootstrap: 4, queue: 2 };
const TARGET = { whoami: 1, projectlist: 1, groupidentity: 2, bootstrap: 2 };

async function signedIn() {
  await (await plane("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) })).arrayBuffer();
  const signed = await (await plane("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
  assert.equal(signed.ok, true);
  return { authorization: `Bearer ${signed.result.token}` };
}
const metricsOf = (res) => (res.headers.get("server-timing") || "").split(",").map((m) => m.trim().split(";")[0]).filter(Boolean);

test("R121 E10: an op's calls to the object, counted in Server-Timing, are within today's ceiling (and the targets are named)", async () => {
  const auth = await signedIn();
  const seen = {};
  for (const op of Object.keys(CEILING)) {
    const res = await plane(`/api/?op=${op}`, { headers: auth });
    await res.arrayBuffer();
    assert.equal(res.status, 200, op);
    seen[op] = metricsOf(res).filter((m) => m.startsWith("do-")).length;
    assert.ok(seen[op] <= CEILING[op], `${op}: ${seen[op]} calls to the object, ceiling ${CEILING[op]} (target ${TARGET[op] ?? "n/a"})`);
  }
  console.log("hop counts", JSON.stringify(seen), "targets", JSON.stringify(TARGET));
});

test("R121 E10 (i) (red by name until plane R-timing has merged): the object's own time is told as `in-<route>` beside `do-<route>`", async () => {
  const auth = await signedIn();
  const res = await plane("/api/?op=projectlist", { headers: auth });
  await res.arrayBuffer();
  const m = metricsOf(res);
  assert.ok(m.includes("in-projectlist"), `the object states its own time: ${res.headers.get("server-timing")}`);
});
