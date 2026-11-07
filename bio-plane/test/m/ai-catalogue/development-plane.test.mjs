/* ai-catalogue F3 (coordinator 17:24, the scheduler ruling): a test or development plane holds a signed catalogue with
 * plans, so a member can connect an account through it. The store is the real assembled one (store-assembly's own
 * fixture: `assembleStore` over a Durable Object storage at the platform's shape, every module real), started with the
 * variables a development deployment holds, made by `makeDevelopmentKey` as `dev-key.mjs` hands them; no catalogue,
 * key or adapter type is handed in by the test. Through the store's door, `aiownadd` with plan `api` connects. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage, assembleStore, disclosed } from "../store-assembly/fixture.mjs";
import { makeDevelopmentKey } from "../../../src/ai-catalogue/dev-key.mjs";
import { aiCatalogueOf, DEVELOPMENT_VAR, DEVELOPMENT_KEY_VAR, SEED_SIGNATURE_VAR, DEVELOPMENT_PROVIDER, DEVELOPMENT_PLAN,
  DEVELOPMENT_ADAPTERS } from "../../../src/ai-catalogue/index.mjs";

const BASE = { CIVICSMITH_TEST_INSTANCE: "p3dev-f3", INSTANCE_NAME: "p3dev-f3", STORE: { idFromName: (n) => n },
  ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-ai-catalogue-f3-test" };

async function devVars() {
  const k = await makeDevelopmentKey();
  return { [DEVELOPMENT_VAR]: "1", [DEVELOPMENT_KEY_VAR]: k.line, [SEED_SIGNATURE_VAR]: k.armored };
}

/* The assembled store over a fresh storage with `env`, a member `ann` who has seen the disclosure, and its door. */
async function plane(env) {
  const st = storage();
  const s = assembleStore(st.ctx, env);
  for (const p of st.blocked) await p;
  await aiCatalogueOf(st.ctx).ready;
  for (const [id, role] of [["ada", "admin"], ["ann", "member"]])
    st.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                             VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
  await disclosed(st.ctx);
  const door = async (path, body) => {
    const r = await s.dispatch(new Request(`http://do/${path}`, { method: "POST", body: JSON.stringify(body) }));
    const b = await r.json();
    return b.result ?? b;
  };
  const own = () => door("aiownadd?by=member:ann&viewer=member:ann",
    { provider: DEVELOPMENT_PROVIDER, plan: DEVELOPMENT_PLAN, means: "sealed", secret: "sk-p3dev-f3-0123456789abcdef" });
  return { ctx: st.ctx, own };
}

test("F3 through the store: on a development plane (makeDevelopmentKey's variables) aiownadd with plan api connects, its entries those of the development seed", async () => {
  const x = await plane({ ...BASE, ...(await devVars()) });
  const cat = aiCatalogueOf(x.ctx);
  assert.deepEqual([cat.catalogueState({}).state, cat.catalogueState({}).source], ["current", "seed"]);
  const r = await x.own();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.provider, r.plan, r.owner], [DEVELOPMENT_PROVIDER, DEVELOPMENT_PLAN, "member:ann"]);
  assert.ok(Array.isArray(r.entries) && r.entries.length > 0, JSON.stringify(r));
  /* the adapter types the development seed brings are its own profiles' (R38), registered in memory, nothing else */
  const profiles = Object.fromEntries(DEVELOPMENT_ADAPTERS.flatMap((t) => Object.keys(t.profiles).map((p) => [p, t.type])));
  for (const id of r.entries) {
    const e = cat.entryOf(id);
    assert.equal(e.needs_newer_release, false, id);
    assert.equal(profiles[e.profile.id], e.adapter_type, id);
  }
});

test("F3 control: the same store without the development variable holds no catalogue, registers nothing, and aiownadd connects nothing", async () => {
  const vars = await devVars();
  delete vars[DEVELOPMENT_VAR];
  const x = await plane({ ...BASE, ...vars });
  assert.equal(aiCatalogueOf(x.ctx).catalogueState({}).state, "unavailable");
  const r = await x.own();
  assert.notEqual(r.ok, true, JSON.stringify(r));
  assert.equal(r.reason, "CATALOGUE_UNAVAILABLE", JSON.stringify(r));
});

test("F3 control: a development seed handed with a signature that does not verify registers no adapter type", async () => {
  const vars = await devVars();
  const other = await makeDevelopmentKey();
  const x = await plane({ ...BASE, ...vars, [SEED_SIGNATURE_VAR]: other.armored });
  const cat = aiCatalogueOf(x.ctx);
  assert.equal(cat.catalogueState({}).state, "unavailable");
  assert.deepEqual(cat.registerAdapterTypes([]).types, []);
});
