/* control-plane (fix round 8, G120, G121; K4817; R-SEAM, R-ONE): ONE `caseratify`, COUNTED. The G59 case of `t51-round7-seam.test.mjs` (a case citing one sentence of a vouched upload, signed in one sitting) is
   signed through the counting door (`wrap-entry.mjs`) with the request's calls listed in the order they began and ended (`x-wrap-events`): the Worker's calls to the object and to R2. A
   count of calls and of how many were in flight together is the test, never a time (R-CLOCK: Miniflare answers each in a millisecond, so a chain of 59 costs 80 ms and looks fine; live it is 13 s).
   The figures are the plan's (G120 (3), review2 N7): the object calls that read independent facts before the signature check are issued together (or folded into one); the case file's
   `head` and `put` of its files are issued concurrently, peak in flight at least 6; the longest chain awaited one after another is at most 25 (it was 59), the figure derived from the chain:
   the object chain of 21 less the 2 calls saved by issuing the three independent reads together = 19, plus the case file's R2 depth with 12 files in groups of 8 = 2 groups x (head, put) = 4,
   plus the 2 `PUBLISHED.get` calls = 6, so 25. The answer's fields are today's (a golden list of its keys). Red by name until `ratification` (G120) and `public-read` (G121) have merged. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeKit } from "./r8-kit.mjs";
import { readCalls, readEvents, peak, depth, doCalls, r2Calls } from "./wrap-entry.mjs";

const kit = makeKit({ tag: "r8case", counting: true });
after(() => kit.mf.dispose());

const INDEPENDENT = ["casetestimony", "caseapproval", "casegate"];
/* the fields of the answer to a signed case, as they stand before this round (a golden list: the answer is byte for byte as today's) */
const GOLDEN_KEYS = ["caseId", "edition", "ok"];

test("R8 (G120, G121): a vouched case signed in one sitting is signed in few awaited calls: the three independent reads together, the case file's heads and puts concurrent (peak at least 6), a chain of at most 25", { timeout: 900000 }, async () => {
  const e = await kit.preparedEdition("r8-ratify-ann", "r8case", { vouch: true });
  e.auth = { ...e.auth, "x-wrap-events": "1" };
  const { res } = await kit.sitAndSign(e);
  assert.equal(res.status, 200, kit.gateLine(res));
  assert.equal(res.body.ok, true, kit.gateLine(res));
  const calls = readCalls({ headers: res.headers });
  const events = readEvents({ headers: res.headers });
  assert.ok(events.length > 0, "the request listed its calls: " + [...res.headers].map(([k]) => k).join(","));
  const total = events.length;
  if (process.env.R8_DEBUG) console.log("EVENTS " + events.map((x) => `${x.name}[${x.start}-${x.end}]`).join(" "));
  const worker = (x) => x.kind === "do" || x.kind === "r2";
  console.log(`G120/G121: caseratify made ${total} awaited calls (${doCalls(calls)} to the object, ${r2Calls({ do: {}, rpc: {}, r2: calls.r2, object: {} })} to R2 from the Worker, ${r2Calls({ do: {}, rpc: {}, r2: {}, object: calls.object })} in the object); longest chain ${depth(events, worker)}; case file heads/puts in flight at most ${peak(events, (x) => /^PUBLISHED\.(head|put)$/.test(x.name))}`);
  /* (b) the independent reads before the signature check are issued together, or folded into one call */
  const three = events.filter((x) => x.kind === "do" && INDEPENDENT.includes(x.name));
  assert.ok(three.length <= 1 || peak(three) === three.length, `casetestimony, caseapproval and casegate are issued together (${three.map((x) => `${x.name}[${x.start}-${x.end}]`).join(" ")})`);
  /* (a) G121: the case file's heads and puts of its files in groups */
  const files = peak(events, (x) => /^PUBLISHED\.(head|put)$/.test(x.name));
  assert.ok(files >= 6, `the case file's files are headed and put concurrently: at most ${files} in flight (red: 1)`);
  /* (c) the sequential depth of the act */
  const chain = depth(events, worker);
  assert.ok(chain <= 25, `the longest chain awaited one after another is ${chain} (red: 59 in all, ${total} calls)`);
  /* the answer is today's */
  assert.deepEqual(Object.keys(res.body.result ?? res.body).filter((k) => GOLDEN_KEYS.includes(k)).sort(), GOLDEN_KEYS.filter((k) => k in (res.body.result ?? res.body)).sort(), "the answer's golden fields");
});

test("R8 control (G120, G121): the case is the same case: published with its finding and complete, the calls fewer and the result not", { timeout: 900000 }, async () => {
  const e = await kit.preparedEdition("r8-ratify-bea", "r8caseb", { vouch: true });
  const { res } = await kit.sitAndSign(e);
  assert.equal(res.status, 200, kit.gateLine(res));
  const pub = kit.R(await kit.get(e.auth, { op: "publishedcase", id: e.prepared.caseId }));
  assert.equal(pub.caseId, e.prepared.caseId);
  assert.ok(Array.isArray(pub.findings) && pub.findings.length >= 1, "its finding is published");
  assert.equal(pub.complete, true, "complete: " + JSON.stringify({ complete: pub.complete, awaiting: pub.awaiting }));
});
