/* The REAL plane for section R of `harness.test.mjs` (REC-100), holding a passing test bar (T41 B6, K2520). run-rules
   R19 as amended gates every run on its mode's test bar on Civicsmith's set, which holds no matter yet (N829), so in
   the plane as deployed no run opens: the fixture's `op=airunopen` answered AI_RUN_MODE_NOT_DEPLOYED (C-109.1), every
   tick found no run, and REC100-0 read the log empty. The plane runs in a Durable Object, where no module test's
   `deps.testSet` can be handed in, so this stands in for that set the one way a running plane allows, as
   capture-requests' `plane-world.mjs` and ai-runs' `world.mjs` do: `planeEntry()` copies `bio-plane/src/` to a
   scratch directory whose Civicsmith set holds one matter, and adds an entry module that is the plane's own door and
   `Store`, the Store recording, once built, a passing result on that set for each part through ai-runs R75's
   `testBarRecord`. Nothing else differs from `src/`: the repository's other directories are linked beside the copy.
   T53 (BOB's ruling, 4 Nov; ai-accounts R40, R63; store-assembly R1): an account act reads the signed list the copy holds,
   so a plane holding none answers aiaccountadd and aiownadd CATALOGUE_UNAVAILABLE and no run has an account. The plane is
   made a test instance (`CIVICSMITH_TEST_INSTANCE` equal to `INSTANCE_NAME`, `TEST_ENV` below, which also admits the bar
   path under run-rules PR 72), and the copy's class hands store-assembly the one thing its constructor hands none of,
   `catalogueKeys`: the throwaway key of ai-catalogue's published fixture, which store-assembly honours on a test instance
   alone. The Store then seeds, through the catalogue's own `loadSeed`, the list ai-accounts' published fixture
   (`baseDoc`) signs with that key, signed here when the test runs, never stored. */
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { KEY, publish } from "../../bio-plane/test/m/ai-catalogue/fixture.mjs";
import { baseDoc, PLANS, HOSTS } from "../../bio-plane/test/m/ai-accounts/catalogue.mjs";

const PLANE_DIR = fileURLToPath(new URL("../../bio-plane", import.meta.url));
const REPO = join(PLANE_DIR, "..");
const EMPTY = "matters: Object.freeze([]),";
const ONE_MATTER = 'matters: Object.freeze([Object.freeze({ id: "m1" })]),';
/* the plane class's one assembly call, and the same call handing `catalogueKeys` from the test plane's own binding */
const ASSEMBLE = "assembleStore(ctx, env, { deliver: deliverOwedRender })";
const ASSEMBLE_TEST = "assembleStore(ctx, env, { deliver: deliverOwedRender, catalogueKeys: JSON.parse(env.TEST_CATALOGUE_KEYS) })";
/** The test plane's instance name; `CIVICSMITH_TEST_INSTANCE` equal to it makes it a test instance (signin-door, ai-runs
    R78, store-assembly R1). */
export const TEST_INSTANCE_NAME = "aw-rec100";
export const TEST_ENV = Object.freeze({ INSTANCE_NAME: TEST_INSTANCE_NAME, CIVICSMITH_TEST_INSTANCE: TEST_INSTANCE_NAME });
/** The catalogue's plan, provider and host a member's own API account is of (ai-accounts' published fixture). */
export const MEMBER_PLAN = Object.freeze({ provider: PLANS.provider, plan: PLANS.memberApi, host: HOSTS.main });

const ENTRY = `import door from "./index.mjs";
import { Store as PlaneStore } from "./store.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { CIVICSMITH_TEST_SET } from "../run-rules/test-set.mjs";
import { aiCatalogueOf } from "../ai-catalogue/index.mjs";
const PARTS = ["check", "investigate", "extract", "plan", "explore"];
export class Store extends PlaneStore {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      /* T53: the list the test key signs, seeded once through the catalogue's own channel; the adapter types are the
         list's own entries' (R38: registered at start, in memory, so at every construction) */
      const seed = JSON.parse(env.TEST_CATALOGUE_SEED);
      const cat = aiCatalogueOf(ctx);
      await cat.ready;
      const types = {};
      for (const e of JSON.parse(seed.body).entries)
        types[e.adapter_type] = { ...(types[e.adapter_type] || {}), [e.profile.id]: e.profile.min_version };
      cat.registerAdapterTypes(Object.entries(types).map(([type, profiles]) => ({ type, profiles })));
      const loaded = await cat.loadSeed(seed);
      if (!loaded.ok) throw new Error("catalogue seed: " + JSON.stringify(loaded));
      const runs = aiRunsOf(ctx, env);
      const held = new Set(runs.testBarRecords().filter((r) => r.passed && r.set === CIVICSMITH_TEST_SET.id
        && r.set_version === CIVICSMITH_TEST_SET.version).map((r) => r.part));
      for (const part of PARTS.filter((p) => !held.has(p))) {
        const r = runs.testBarRecord({ part, set: CIVICSMITH_TEST_SET.id, set_version: CIVICSMITH_TEST_SET.version,
          false_alarm_rate: 0, passed: true, graded_by: "harness", at: "2026-07-01T00:00:00Z" });
        if (!r.ok) throw new Error("test bar " + part + ": " + JSON.stringify(r));
      }
    });
  }
}
export default door;
`;

/** The scratch plane: `{ path, script, bindings, dispose }`, `path` and `script` the entry module Miniflare runs,
    `bindings` what the plane Worker must be given beside its own (the test instance, the catalogue's key and its signed
    list), `dispose()` removing the copy. */
export async function planeEntry() {
  const pub = await publish(baseDoc());
  const root = mkdtempSync(join(tmpdir(), "aw-plane-"));
  for (const name of readdirSync(REPO)) if (name !== "bio-plane") symlinkSync(join(REPO, name), join(root, name));
  const plane = join(root, "bio-plane");
  mkdirSync(plane);
  for (const name of readdirSync(PLANE_DIR)) if (name !== "src") symlinkSync(join(PLANE_DIR, name), join(plane, name));
  const src = join(plane, "src");
  cpSync(join(PLANE_DIR, "src"), src, { recursive: true });
  const setPath = join(src, "run-rules", "test-set.mjs");
  const text = readFileSync(setPath, "utf8");
  if (text.split(EMPTY).length !== 2) throw new Error("plane-world: Civicsmith's test set no longer reads as one empty set");
  writeFileSync(setPath, text.replace(EMPTY, ONE_MATTER));
  const storePath = join(src, "plane", "store.mjs");
  const store = readFileSync(storePath, "utf8");
  if (store.split(ASSEMBLE).length !== 2) throw new Error("plane-world: the plane class no longer makes one assembly call as read");
  writeFileSync(storePath, store.replace(ASSEMBLE, ASSEMBLE_TEST));
  const path = join(src, "plane", "test-world.mjs");
  writeFileSync(path, ENTRY);
  const bindings = { ...TEST_ENV, TEST_CATALOGUE_KEYS: JSON.stringify([KEY.line]),
    TEST_CATALOGUE_SEED: JSON.stringify({ ...pub, at: "2026-10-01T00:00:00Z" }) };
  return { path, script: ENTRY, bindings, dispose: () => rmSync(root, { recursive: true, force: true }) };
}
