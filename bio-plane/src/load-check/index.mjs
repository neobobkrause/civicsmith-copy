/* load-check: the per-level load test's driver (build/requirements/load-check.md R1-R7).
 *
 * A test tool, not product: it uses op-declarations, runtime-limits and test-support only, never journey-check, and
 * nothing in a team's copy imports it (R7). It loads only a scratch copy in the permitted account that it seeded
 * itself, within its caps, and writes no credential anywhere.
 *
 *   const copy = { name, address, account, credentials, door: httpDoor({ address, gauge_op }) };
 *   await seedCopy(copy, { database_bytes, r2_bytes, mix: "text" });
 *   const result = await runProfile(copy, profile, [5, 10, 15, 25, 40, 60]);
 *   report([result], { commit, date, pm: { 1: "P-M9" } });
 */
export { PERMITTED_ACCOUNT, MEMBER_CAP, RATE_CAP, LoadRefusal, guardCopy, clip } from "./guard.mjs";
export { runProfile, itemsOf, FAIL_SHARE } from "./run.mjs";
export { seedCopy, DENSITIES, STRESS_PAGES, partsFor } from "./seed.mjs";
export { report, ceilingOf, CEILING_FACTOR } from "./report.mjs";
export { httpDoor } from "./door.mjs";
