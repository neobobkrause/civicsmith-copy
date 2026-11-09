/* ai-catalogue F4 (coordinator 17:24, the screens-ai ruling; screens-ai R1, R3, R4, R10): the screens' reads of the catalogue,
 * declared and served by this module. Each op is answered through the store's one catalogue (`aiCatalogueOf(ctx)` over the
 * store's storage, as the assembly builds it), handed the request the door hands an owner's map, `http://do/<op>?...`.
 * The made-up provider's payload, every answer the module's own; no other module's answer is built here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aiCatalogueOps, CATALOGUE_DECLARED_OPS, aiCatalogueOf, DEVELOPMENT_VAR, DEVELOPMENT_KEY_VAR, SEED_SIGNATURE_VAR,
  DEVELOPMENT_PLAN } from "../../../src/ai-catalogue/index.mjs";
import { makeDevelopmentKey } from "../../../src/ai-catalogue/dev-key.mjs";
import { storage, assembleStore } from "../store-assembly/fixture.mjs";
import { OPEN, met, entry, plan, payload, publish, adv, advisory, pull, world, seeded, AT, PARTS, ev } from "./fixture.mjs";

const PIN = { BIO_NOW_MS: String(Date.parse(AT)) };
/* the door's request to the owner's map: the op as the path, the query as given */
const call = async (cat, op, query = "", body = null) => {
  const ops = aiCatalogueOps(cat, new URL(`http://do/${op}${query ? `?${query}` : ""}`), body);
  assert.equal(typeof ops[op], "function", `${op} is served`);
  return ops[op]();
};

/* ===================================================================== F4: the declarations */

test("F4 aicatalogueread and airesultsread are declared beside the map: reads in a member's or an administrator's session, writing nothing", () => {
  assert.deepEqual(Object.keys(CATALOGUE_DECLARED_OPS).sort(), ["aicatalogueread", "airesultsread"]);
  for (const [op, row] of Object.entries(CATALOGUE_DECLARED_OPS)) {
    assert.deepEqual([...row.classes].sort(), ["admin", "member"], op);
    assert.deepEqual([...row.machineClasses], [], `${op}: no machine credential`);
    assert.equal(row.mutating, false, op);
    assert.equal(row.weight, "read", op);
    assert.equal(typeof row.description, "string", op);
  }
  /* control: the map serves exactly the declared ops */
  assert.deepEqual(Object.keys(aiCatalogueOps(null, new URL("http://do/x"), null)).sort(), Object.keys(CATALOGUE_DECLARED_OPS).sort());
});

/* ===================================================================== F4: aicatalogueread (screens-ai R1, R3, R4) */

const twoProviders = () => payload({ providers: [{ id: "fakeco", name: "Name of fakeco", kind: "direct" }, { id: "otherco", name: "Name of otherco", kind: "direct" }],
  plans: [plan(), plan("otherco-api", { provider: "otherco" })],
  entries: [entry("fake-one"), entry("fake-two", { checks: { ...entry("x").checks, P3: { answer: "OPEN" }, P7: met("not_met") } }),
    entry("other-one", { provider: "otherco", host: "otherco", plan_ids: ["otherco-api"] })] });

test("F4 aicatalogueread answers the providers, the plans by provider, and the entries, through the store's catalogue", async () => {
  const { cat } = await seeded(twoProviders(), { env: PIN });
  const r = await call(cat, "aicatalogueread");
  assert.equal(r.ok, true);
  assert.deepEqual(r.providers, [{ id: "fakeco", name: "Name of fakeco", kind: "direct" }, { id: "otherco", name: "Name of otherco", kind: "direct" }]);
  assert.deepEqual(r.plans.map((g) => [g.provider, g.plans.map((p) => p.plan_id)]), [["fakeco", ["fakeco-api"]], ["otherco", ["otherco-api"]]]);
  assert.deepEqual(r.plans[0].plans[0].listing, { state: "listed", reason: null, since_seq: 1 });
  assert.deepEqual(r.entries.map((e) => [e.provider, e.entry_id]), [["fakeco", "fake-one"], ["fakeco", "fake-two"], ["otherco", "other-one"]]);
  assert.deepEqual(r.parts, PARTS);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.entries[0].checks));
});

test("F4 aicatalogueread answers each check with its grade, source and date (R1, R11), OPEN with none", async () => {
  const { cat } = await seeded(twoProviders(), { env: PIN });
  const r = await call(cat, "aicatalogueread");
  const one = r.entries.find((e) => e.entry_id === "fake-one");
  const q = ev("STATED", { page: "https://fake.example/terms", quote: "fixture quote" });
  assert.deepEqual(one.checks.P1, { answer: "met", grade: q.grade, source: q.source, date: q.date, page: q.page, quote: q.quote });
  assert.deepEqual(Object.keys(one.checks), ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
  const two = r.entries.find((e) => e.entry_id === "fake-two");
  assert.deepEqual(two.checks.P3, { answer: "OPEN", grade: null, source: null, date: null, page: null, quote: null });
  assert.equal(two.checks.P7.answer, "not_met");
  /* the shown answers (R13) and the verdict per part with its grade (R14) */
  assert.equal(one.shown.terms_permit_use.answer, "met");
  assert.equal(one.shown.breach_notification.answer, "OPEN");
  assert.deepEqual([one.gate.ask.verdict, one.gate.ask.grade], ["passes", "REPRODUCED"]);
});

test("F4 aicatalogueread answers, per part, whether each entry is offered under the checks in force and why not (R30, R31)", async () => {
  const { cat } = await seeded(twoProviders(), { env: PIN });
  const none = await call(cat, "aicatalogueread");
  assert.equal(none.entries.find((e) => e.entry_id === "fake-two").offered.ask.offered, true, "OPEN restricts nothing (R2)");
  const r = await call(cat, "aicatalogueread", "checks=P3,P7");
  const two = r.entries.find((e) => e.entry_id === "fake-two");
  assert.deepEqual(two.offered.ask, { offered: false, reasons: [{ code: "CHECK_OPEN", check: "P3" }, { code: "CHECK_NOT_MET", check: "P7" }] });
  assert.equal(r.entries.find((e) => e.entry_id === "fake-one").offered.ask.offered, true);
  /* the same answer as the closed list's (R30) */
  assert.deepEqual(cat.entriesFor({ part: "ask", checksInForce: ["P3", "P7"], at: AT }).entries.map((e) => e.entry_id), ["fake-one", "other-one"]);
  /* control: a check outside P1–P7 is refused CHECK_UNKNOWN */
  const bad = await call(cat, "aicatalogueread", "checks=terms_permit_use");
  assert.deepEqual([bad.ok, bad.code, bad.check_id], [false, "CHECK_UNKNOWN", "terms_permit_use"]);
});

test("F4 aicatalogueread answers the listing state with the reason the advisory gave, and a payload's own state with none", async () => {
  const { cat } = await seeded(twoProviders(), { env: PIN });
  await pull(cat, null, { advisories: [await advisory(adv(2, { entry_id: "fake-two" }, "watch", { reason: "canary_drift" }))] });
  const r = await call(cat, "aicatalogueread");
  const two = r.entries.find((e) => e.entry_id === "fake-two");
  assert.deepEqual([two.state, two.watch, two.listing], ["watch", true, { state: "watch", reason: "canary_drift", since_seq: 2 }]);
  /* control: an entry no advisory moved carries the payload's state and no reason */
  assert.deepEqual(r.entries.find((e) => e.entry_id === "fake-one").listing, { state: "listed", reason: null, since_seq: 1 });
});

test("F4 aicatalogueread answers whether the copy is stale (R32, R40); a copy that checked today is current", async () => {
  const { cat } = await seeded(twoProviders(), { env: PIN });
  const now = await call(cat, "aicatalogueread");
  assert.deepEqual([now.catalogue.state, now.catalogue.word, now.catalogue.source], ["current", "ai.catalogue.state.current", "seed"]);
  const later = await world({ db: (await seeded(twoProviders(), { env: PIN })).db, env: { BIO_NOW_MS: String(Date.parse("2026-11-01T00:00:00Z")) } });
  const stale = await call(later.cat, "aicatalogueread");
  assert.deepEqual([stale.catalogue.state, stale.catalogue.word], ["stale", "ai.catalogue.state.stale"]);
  assert.equal(stale.entries.length, 3, "offers are unchanged while stale (R40)");
});

test("F4 control: with no verified catalogue held, aicatalogueread answers unavailable and no entry, never throwing", async () => {
  const { cat } = await world({ env: PIN });
  const r = await call(cat, "aicatalogueread");
  assert.deepEqual([r.ok, r.catalogue.state, r.providers, r.plans, r.entries], [true, "unavailable", [], [], []]);
});

/* ===================================================================== F4: airesultsread (screens-ai R10) */

const lib = (row_id, subject_id, tested_at, over = {}) => ({ row_id, subject_id, suiteVersions: { bank: "b1" },
  parts: { ask: { verdict: "passes", limits: [] } }, speed: OPEN, task_cost: OPEN, tested_by: "team", tested_at,
  grade: "REPORTED", repeated_by_civicsmith: false, ...over });
const TESTED = { subject_id: "fake-unlisted", display_name: "Fake Unlisted", provider_name: "Fake Co", host_name: "Fake Host",
  model: "fake-unlisted-model", version: "1", developer: { name: "Fake Co", jurisdiction: "ZZ" } };
const comb = (over = {}) => ({ subject_id: "fake-one", part: "ask", as_of: "2026-09-30", window: { from: "2026-04-01", to: "2026-09-30" },
  results: { total: 1, reproduced: 0, reported: 1 }, left_out: 0, groups: {}, verdict: "passes", limits: [], speed: OPEN,
  task_cost: OPEN, suiteVersions: { bank: "b1" }, confirmed: false, ...over });
const results = () => payload({ tested: [TESTED], combined: [comb()], library: [
  lib("r-seven", "fake-one", "2026-03-01"),
  lib("r-draft", "fake-one", "2026-09-01", { parts: { draft: { verdict: "not_suitable", limits: [] } } }),
  lib("r-own", "fake-one", "2026-09-10", { tested_by: "civicsmith", grade: "REPRODUCED" }),
  lib("r-unlisted", "fake-unlisted", "2026-09-15"),
] });

test("F4 airesultsread answers every tested AI, listed or not, with its active rows, their grades and the combined records", async () => {
  const { cat } = await seeded(results(), { env: PIN });
  const r = await call(cat, "airesultsread");
  assert.equal(r.ok, true);
  assert.deepEqual(r.subjects.map((s) => [s.subject_id, s.display_name, s.on_list]),
    [["fake-one", "Fake fake-one", "listed"], ["fake-unlisted", "Fake Unlisted", "not_listed"]]);
  assert.deepEqual(r.rows.map((x) => [x.row_id, x.tested_by, x.grade, x.confirmed]),
    [["r-draft", "team", "REPORTED", false], ["r-own", "civicsmith", "REPRODUCED", true], ["r-unlisted", "team", "REPORTED", false]]);
  assert.ok(!r.rows.some((x) => x.row_id === "r-seven"), "a row past the active window is never returned (R45)");
  assert.deepEqual(r.combined.map((c) => [c.subject_id, c.part, c.confirmed]), [["fake-one", "ask", false]]);
  assert.equal(r.catalogue.state, "current");
});

test("F4 airesultsread filters by subject_id and part, as the query names them", async () => {
  const { cat } = await seeded(results(), { env: PIN });
  const one = await call(cat, "airesultsread", "subject_id=fake-unlisted");
  assert.deepEqual([one.rows.map((x) => x.row_id), one.subjects.map((s) => s.subject_id), one.combined], [["r-unlisted"], ["fake-unlisted"], []]);
  const draft = await call(cat, "airesultsread", "part=draft");
  assert.deepEqual(draft.rows.map((x) => x.row_id), ["r-draft"]);
  /* control: an unknown subject answers empty lists */
  const nobody = await call(cat, "airesultsread", "subject_id=nobody");
  assert.deepEqual([nobody.rows, nobody.combined, nobody.subjects], [[], [], []]);
});

/* ===================================================================== F4: through the assembled store's own catalogue */

test("F4 through the assembled store: the store's one catalogue, seeded from a development deployment's variables, answers both ops", async () => {
  const k = await makeDevelopmentKey();
  const st = storage();
  assembleStore(st.ctx, { CIVICSMITH_TEST_INSTANCE: "p3dev-f4", INSTANCE_NAME: "p3dev-f4", STORE: { idFromName: (n) => n },
    ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-ai-catalogue-f4-test",
    [DEVELOPMENT_VAR]: "1", [DEVELOPMENT_KEY_VAR]: k.line, [SEED_SIGNATURE_VAR]: k.armored });
  for (const p of st.blocked) await p;
  const cat = aiCatalogueOf(st.ctx);
  const r = await call(cat, "aicatalogueread");
  assert.equal(r.catalogue.state, "current");
  assert.ok(r.plans.some((g) => g.plans.some((p) => p.plan_id === DEVELOPMENT_PLAN)), "the development seed's plan is read");
  assert.ok(r.entries.length > 0);
  const res = await call(cat, "airesultsread");
  assert.equal(res.ok, true);
  assert.ok(Array.isArray(res.rows) && Array.isArray(res.combined));
});
