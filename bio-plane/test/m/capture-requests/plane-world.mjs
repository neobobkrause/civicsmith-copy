/* The running plane for `plane.test.mjs`, holding a passing test bar (B4, K2514). run-rules R19 as amended gates every
   run on its mode's test bar on Civicsmith's set, which holds no matter yet (N829), so in the plane as deployed no run
   opens and every request there would be refused with it. The plane is built in a Durable Object, where no module
   test's `deps.testSet` can be handed in (its modules are built by the plane's own wiring, each once per storage), so
   this stands in for that set the one way a running plane allows: `planeEntry()` copies `src/` to a scratch directory
   whose Civicsmith set holds one matter (as `test/m/ai-runs/world.mjs`'s `TEST_SET`), and adds an entry module that is
   the plane's own door and `Store`, the Store recording, once it is built, a passing result on that set for each part
   through ai-runs R75's `testBarRecord`. Nothing else differs from `src/`: the repository's other directories, which
   `src/` imports from (`docprofile`, `jurisdictions` and the like), are linked beside the copy, not copied. */
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { newKey, publish } from "../ai-catalogue/fixture.mjs";
import { baseDoc } from "../ai-accounts/catalogue.mjs";
import { DEVELOPMENT_VAR, DEVELOPMENT_KEY_VAR, DEVELOPMENT_KEY_MARK } from "../../../src/ai-catalogue/seed.mjs";

const PLANE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const REPO = join(PLANE_DIR, "..");
const EMPTY = "matters: Object.freeze([]),";
const ONE_MATTER = 'matters: Object.freeze([Object.freeze({ id: "m1" })]),';

/* F1 (base-red since PR 182): T53 moved the opener's account to `aiownadd` (ai-accounts R35, R61), and store-assembly R1 hands
   ai-accounts the object's own ai-catalogue, which fails closed (CATALOGUE_UNAVAILABLE, C-156.7) while it holds no verified
   list, and the release's seed lists no plan. So the plane holds a catalogue the one way a running development deployment
   does: its build trusts the deployment's own development catalogue key (ai-catalogue seed.mjs: `DEVELOPMENT_VAR` "1" and
   `DEVELOPMENT_KEY_VAR` its public line), and a payload signed by that key is loaded through the catalogue's own
   `loadSeed`. The payload is ai-accounts' test catalogue (`baseDoc`: `anthropic`'s member api plan, among others); the
   key is throwaway, generated here. A plane started without `PLANE_BINDINGS` trusts Bob's lines alone and holds none. */
const DEV = await newKey();
const DEV_LINE = DEV.line.replace(/ \S+$/, ` cr-plane${DEVELOPMENT_KEY_MARK}`);
const CATALOGUE_SEED = await publish(baseDoc(), { key: DEV });
const REGISTER = [{ type: "generic_chat", profiles: { "p-anthropic": 1, "p-freeco": 1, "p-civicsmith": 1 } }];
/** The bindings a plane holding the test catalogue is started with (merged into Miniflare's `bindings`). */
export const PLANE_BINDINGS = Object.freeze({ [DEVELOPMENT_VAR]: "1", [DEVELOPMENT_KEY_VAR]: DEV_LINE });

/* The entry: the plane's door and Store; the Store, after the plane's own construction and migration, holds a passing
   bar for each part on Civicsmith's set as this copy states it (append-only, so recorded only where none is held). */
const ENTRY = `import door from "./index.mjs";
import { Store as PlaneStore } from "./store.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { CIVICSMITH_TEST_SET } from "../run-rules/test-set.mjs";
import { aiCatalogueOf } from "../ai-catalogue/index.mjs";
const SEED = ${JSON.stringify(CATALOGUE_SEED)};
const REGISTER = ${JSON.stringify(REGISTER)};
const DEV_LINE = ${JSON.stringify(DEV_LINE)};
const PARTS = ["check", "investigate", "extract", "plan", "explore"];
export class Store extends PlaneStore {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const runs = aiRunsOf(ctx, env);
      const held = new Set(runs.testBarRecords().filter((r) => r.passed && r.set === CIVICSMITH_TEST_SET.id
        && r.set_version === CIVICSMITH_TEST_SET.version).map((r) => r.part));
      for (const part of PARTS.filter((p) => !held.has(p))) {
        const r = runs.testBarRecord({ part, set: CIVICSMITH_TEST_SET.id, set_version: CIVICSMITH_TEST_SET.version,
          false_alarm_rate: 0, passed: true, graded_by: "harness", at: "2026-07-01T00:00:00Z" });
        if (!r.ok) throw new Error("test bar " + part + ": " + JSON.stringify(r));
      }
      /* F1: the test catalogue, where the plane trusts its development key (PLANE_BINDINGS); a seed held answers NOT_NEWER */
      if (env.${DEVELOPMENT_KEY_VAR} === DEV_LINE) {
        const cat = aiCatalogueOf(ctx);
        await cat.ready;
        cat.registerAdapterTypes(REGISTER);
        const r = await cat.loadSeed({ ...SEED, at: "2026-10-01T00:00:00Z" });
        if (!r.ok && r.code !== "NOT_NEWER") throw new Error("catalogue seed: " + JSON.stringify(r));
      }
    });
  }
}
export default door;
`;

/** The scratch plane: `{ entry, dispose }`, `entry` the module path Miniflare runs, `dispose()` removing the copy. */
export function planeEntry() {
  const root = mkdtempSync(join(tmpdir(), "cr-plane-"));
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
  const entry = join(src, "plane", "test-world.mjs");
  writeFileSync(entry, ENTRY);
  return { entry, dispose: () => rmSync(root, { recursive: true, force: true }) };
}
