/* agent-model (T53) — what the module reads from `ai-catalogue`'s entries: capabilities (R30), the estimate of a task
 * (R34), the cost of a turn (R13), the entry an account serves a role with (R55) and whether an entry serves a need
 * (R1). Catalogue: `ai-catalogue`'s own, seeded through its code. A role's need is `agent-harness`'s `needOf` (its R20). */
import { test } from "node:test";
import assert from "node:assert/strict";

import { world, req, account, ENTRIES, genAnswer } from "./provider-world.mjs";

const GEN = ENTRIES.generic.entry_id;

test("R30 an entry with image_input OPEN answers null and a request without an image is accepted, one with an image refused image_input; an unknown entry is ENTRY_UNKNOWN; it makes no call; control: an entry stating image_input true accepts it", async () => {
  const w = await world([{ status: 200, body: genAnswer({ text: "ok" }) }, { status: 200, body: genAnswer({ text: "ok" }) }]);
  const open = ENTRIES.openimage.entry_id;
  const caps = await w.p.capabilities(open);
  assert.equal(caps.image_input, null);
  for (const k of ["tools", "parallel_tools", "schema_output", "schema_with_tools", "image_input", "streaming", "session", "caching", "batch",
    "effort_set", "effort_default", "effort_classes", "context_window", "max_output", "image_max_bytes", "zero_retention", "lifecycle"])
    assert.ok(k in caps, k);
  assert.equal(caps.context_window, 150000, "the effective context, else the stated");
  assert.equal(caps.image_max_bytes, null, "OPEN is null, never zero");
  assert.ok((await w.p.turn(req(open))).result);
  const img = [{ role: "user", content: [{ type: "image", media_type: "image/png", data: "AA==" }] }];
  assert.equal((await w.p.turn(req(open, { messages: img }))).refused.control, "image_input");
  assert.deepEqual(await w.p.capabilities("no-such-entry"), { refused: { type: "ENTRY_UNKNOWN" } });
  assert.equal(w.fake.requests.length, 1);
  assert.ok((await w.p.turn(req(GEN, { messages: img }))).result);
});

test("R34 an entry with a measured range answers it scaled by count; a priced entry without a measurement answers price_only with nulls; one with neither answers not_known, not 0; control: the unpriced entry's low and high are null", async () => {
  const w = await world([]);
  assert.deepEqual(await w.p.estimate({ entry_id: ENTRIES.measured.entry_id, task: { kind: "ask", count: 3 } }),
    { low: 0.02 * 3, high: 0.05 * 3, unit: "usd", basis: "measured" });
  assert.deepEqual(await w.p.estimate({ entry_id: ENTRIES.measured.entry_id, task: { kind: "ask" } }), { low: 0.02, high: 0.05, unit: "usd", basis: "measured" });
  assert.deepEqual(await w.p.estimate({ entry_id: GEN, task: { kind: "ask" } }), { low: null, high: null, unit: "usd_per_million_tokens", basis: "price_only" });
  const none = await w.p.estimate({ entry_id: ENTRIES.unpriced.entry_id, task: { kind: "ask" } });
  assert.deepEqual(none, { low: null, high: null, unit: null, basis: "not_known" });
  assert.deepEqual(await w.p.estimate({ entry_id: "no-such", task: { kind: "ask" } }), none);
  assert.equal(w.fake.requests.length, 0);
});

test("R13 an entry with prices yields the product as cost_estimated with price_date; a null cache figure is priced at the highest rate, never zero; an unpriced entry yields null; reasoning follows the profile's reasoning_billing; control: all figures stated gives the plain sum", async () => {
  const usage = { prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 2 } };
  const w = await world([{ status: 200, body: genAnswer({ text: "a", usage }) }, { status: 200, body: genAnswer({ text: "b" }) },
    { status: 200, body: genAnswer({ text: "c", usage }) }]);
  /* the cheap entry's rates: input 0.1, output 0.2, cache_read 0.01, cache_write null (priced at the highest) */
  const cheap = ENTRIES.cheap.entry_id;
  const a = await w.p.turn(req(cheap));
  assert.equal(a.usage.cache_creation_input_tokens, null);
  const bytes = Buffer.byteLength(JSON.stringify(w.fake.requests[0].body));
  const stated = (10 * 0.1 + 5 * 0.2 + 2 * 0.01) / 1e6;
  const bound = (Math.max(0, bytes - 12) * 0.2) / 1e6;
  assert.ok(Math.abs(a.usage.cost_estimated.amount - (stated + bound)) < 1e-12);
  assert.equal(a.usage.cost_estimated.price_date, "2026-10-01");
  assert.ok(a.usage.cost_estimated.amount > stated, "the unstated figure is priced, not taken as zero");
  const b = await w.p.turn(req(ENTRIES.unpriced.entry_id));
  assert.equal(b.usage.cost_estimated, null);
  const { costEstimated } = await import("../src/provider/catalogue.mjs");
  const entry = w.cat.entryOf(cheap);
  const full = { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40, reasoning_tokens: 5 };
  const inOut = costEstimated(full, { entry, profile: { reasoning_billing: "in_output" } });
  assert.ok(Math.abs(inOut.amount - (10 * 0.1 + 20 * 0.2 + 30 * 0.01 + 40 * 0.2) / 1e6) < 1e-15);
  assert.ok(!inOut.estimate_open);
  const open = costEstimated(full, { entry, profile: { reasoning_billing: { open: true } } });
  assert.ok(open.estimate_open && open.amount > inOut.amount);
  assert.equal(costEstimated(full, { entry, plan: { price_basis: { basis: "subscription" } } }), null);
});

const harness = await import("../../agent-harness/src/harness.mjs").catch(() => null);
const needOf = harness && typeof harness.needOf === "function" ? harness.needOf : null;
const t = needOf ? test : test.todo;

t("R1 over an entry lacking image input, serves(fake, needOf(\"transcribe\")) answers lacks naming image_input and serves(fake, needOf(\"ask\")) ok; control: an entry with image input serves transcribe", async () => {
  const w = await world([]);
  assert.deepEqual(await w.p.serves(ENTRIES.noimage.entry_id, needOf("transcribe")), { ok: false, lacks: ["image_input"] });
  assert.deepEqual(await w.p.serves(ENTRIES.noimage.entry_id, needOf("ask")), { ok: true });
  assert.deepEqual(await w.p.serves(GEN, needOf("transcribe")), { ok: true });
});

t("R55 over an account with a cheap and a dear entry, a low need picks the cheap one and a standard need the head; an entry lacking image_input is passed over for transcribe; control: with no entry serving the need, UNSUPPORTED_CONTROL names it", async () => {
  const w = await world([]);
  const acct = account({ entries: [GEN, ENTRIES.cheap.entry_id, ENTRIES.noimage.entry_id], entry_id: GEN });
  const low = { ...needOf("subsession"), cost: "low" };
  assert.deepEqual(await w.p.entryFor(acct, "subsession", low), { entry_id: ENTRIES.cheap.entry_id });
  assert.deepEqual(await w.p.entryFor(acct, "ask", needOf("ask")), { entry_id: GEN });
  const noHead = account({ entries: [ENTRIES.noimage.entry_id, GEN], entry_id: ENTRIES.noimage.entry_id });
  assert.deepEqual(await w.p.entryFor(noHead, "transcribe", needOf("transcribe")), { entry_id: GEN });
  const lacking = account({ entries: [ENTRIES.noimage.entry_id], entry_id: ENTRIES.noimage.entry_id });
  assert.deepEqual(await w.p.entryFor(lacking, "transcribe", needOf("transcribe")), { refused: { type: "UNSUPPORTED_CONTROL", control: "image_input" } });
  assert.deepEqual(await w.p.entryFor(account({ entries: [] }), "ask", needOf("ask")), { refused: { type: "NO_ENTRY_OFFERED" } });
  assert.equal(w.fake.requests.length, 0);
});

t("R1 a scan of the module's source and tests finds no claude-, opus- or sonnet- string (waits on agent-worker and agent-steps leaving MODEL_FOR_MODE and SUBSESSION_MODEL)");
