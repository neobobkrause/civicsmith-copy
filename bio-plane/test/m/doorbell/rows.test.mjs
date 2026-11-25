/* doorbell R21 (K2609; T43, N851): the refusal rows this module answers with, in its own table
   (`src/doorbell/checks.mjs`): C-85.1–C-85.5 and C-118.2, .3, .4 and .7, each code, number and translation as the
   requirement states and as `capture` held them, defined there alone, and each raiser answering through its row. With a
   negative control for each C-85 refusal (K874): the case just inside the bound is admitted. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bucket } from "./fixture.mjs";
import { DOORBELL_CHECKS, KNOCK_CHECKS } from "../../../src/doorbell/checks.mjs";
import * as CAPTURE from "../../../src/capture/checks.mjs";
import { knockEnvelopeTooLarge, knockPayloadTooLarge, knockEmpty, knockerSecretWeak, knockOp, KNOCK } from "../../../src/doorbell/door.mjs";
import { EXPECT } from "./expect.mjs";

/* C-118's four rows and C-85's five, each translation as the product's row reads it (expect.mjs, K3810) */
const CHECK = { NO_SUCH_KNOCK: "C-118.2", KNOCKER_SECRET_WEAK: "C-118.3", KNOCK_DISCARDED: "C-118.4", RESOLVE_NO_REASON: "C-118.7",
  RATE_IP: "C-85.1", RATE_GLOBAL: "C-85.2", KNOCK_ENVELOPE_TOO_LARGE: "C-85.3", KNOCK_PAYLOAD_TOO_LARGE: "C-85.4", KNOCK_EMPTY: "C-85.5" };
const C118 = Object.fromEntries(["NO_SUCH_KNOCK", "KNOCKER_SECRET_WEAK", "KNOCK_DISCARDED", "RESOLVE_NO_REASON"].map((code) => [code, [CHECK[code], EXPECT[code]]]));
const C85 = Object.fromEntries(["RATE_IP", "RATE_GLOBAL", "KNOCK_ENVELOPE_TOO_LARGE", "KNOCK_PAYLOAD_TOO_LARGE", "KNOCK_EMPTY"].map((code) => [code, [CHECK[code], EXPECT[code]]]));

test("R21 (K2609, N851): the table holds C-85.1–.5 and C-118.2, .3, .4, .7 and nothing else, each code, number and translation as capture held them, defined in this module's file alone", () => {
  assert.deepEqual(Object.keys(DOORBELL_CHECKS).sort(), Object.keys(C118).sort(), "the four C-118 rows, no other");
  assert.deepEqual(Object.keys(KNOCK_CHECKS).sort(), Object.keys(C85).sort(), "the five C-85 rows, no other");
  for (const [table, want] of [[DOORBELL_CHECKS, C118], [KNOCK_CHECKS, C85]])
    for (const [code, [check, translation]] of Object.entries(want))
      assert.deepEqual([table[code].check, table[code].translation], [check, translation], `${code}: its number and translation`);
  for (const r of Object.values(DOORBELL_CHECKS)) assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(DOORBELL_CHECKS));
  assert.ok(!Object.isFrozen(KNOCK_CHECKS), "C-85 is not frozen: R9's missing row fails loud, and its test removes a row");
  /* defined here alone: no row, and neither table, is another module's object (capture's while it keeps its copy) */
  assert.notEqual(KNOCK_CHECKS, CAPTURE.KNOCK_CHECKS, "C-85's table is this module's own object");
  for (const code of Object.keys(C118)) assert.notEqual(DOORBELL_CHECKS[code], CAPTURE.CAPTURE_CHECKS[code], `${code}: this module's own row`);
  for (const code of Object.keys(C85)) assert.notEqual(KNOCK_CHECKS[code], CAPTURE.KNOCK_CHECKS?.[code], `${code}: this module's own row`);
  /* C-118's other rows stay capture's: none of them is this module's */
  for (const code of Object.keys(CAPTURE.CAPTURE_CHECKS).filter((code) => !(code in C118)))
    assert.equal(DOORBELL_CHECKS[code], undefined, `${code} stays capture's`);
  /* every check id once across this module's table */
  const ids = [...Object.values(DOORBELL_CHECKS), ...Object.values(KNOCK_CHECKS)].map((r) => r.check);
  assert.equal(new Set(ids).size, 9);
});

test("R21 (K2627, K2629): each row's where names this module's code that raises it, the function and DEC-49 region the map's §2 names", () => {
  /* each `where` names this module's raiser, the function and DEC-49 region the map's §2 names */
  assert.deepEqual(Object.fromEntries([...Object.entries(DOORBELL_CHECKS), ...Object.entries(KNOCK_CHECKS)].map(([k, r]) => [k, r.where])), {
    NO_SUCH_KNOCK: "src/doorbell/index.mjs #noSuchKnock > is-knock-held",
    KNOCKER_SECRET_WEAK: "src/doorbell/door.mjs knockerSecretWeak > is-knocker-secret-strong",
    KNOCK_DISCARDED: "src/doorbell/index.mjs pullKnock > is-knock-pullable",
    RESOLVE_NO_REASON: "src/doorbell/index.mjs inboxResolve > is-resolve-reasoned",
    RATE_IP: "src/doorbell/index.mjs #knockRateRefusal > is-knock-rate",
    RATE_GLOBAL: "src/doorbell/index.mjs #knockRateRefusal > is-knock-rate",
    KNOCK_ENVELOPE_TOO_LARGE: "src/doorbell/door.mjs knockEnvelopeTooLarge > is-knock-envelope-too-large",
    KNOCK_PAYLOAD_TOO_LARGE: "src/doorbell/door.mjs knockPayloadTooLarge > is-knock-payload-too-large",
    KNOCK_EMPTY: "src/doorbell/door.mjs knockEmpty > is-knock-empty",
  });
});

test("R21 R4 R5 R6 R7 R8: each of this module's raisers answers with its row's code, check and translation, read from the row at the refusal", async () => {
  assert.deepEqual([knockEnvelopeTooLarge().code, knockEnvelopeTooLarge().check, knockEnvelopeTooLarge().translation],
                   ["KNOCK_ENVELOPE_TOO_LARGE", "C-85.3", KNOCK_CHECKS.KNOCK_ENVELOPE_TOO_LARGE.translation]);
  assert.deepEqual([knockPayloadTooLarge(5, true).code, knockPayloadTooLarge(5, true).check], ["KNOCK_PAYLOAD_TOO_LARGE", "C-85.4"]);
  assert.deepEqual([knockEmpty().code, knockEmpty().check], ["KNOCK_EMPTY", "C-85.5"]);
  assert.deepEqual([knockerSecretWeak().code, knockerSecretWeak().check, knockerSecretWeak().translation],
                   ["KNOCKER_SECRET_WEAK", "C-118.3", C118.KNOCKER_SECRET_WEAK[1]]);
  const { c } = fresh({ evidence: bucket() });
  const none = c.inboxGet("KNOCK-none");
  assert.deepEqual([none.code, none.check, none.translation], ["NO_SUCH_KNOCK", "C-118.2", C118.NO_SUCH_KNOCK[1]]);
  const k = await c.knock({ content: "x", sourceAddress: "1.1.1.1" });
  const noReason = c.inboxResolve({ knockId: k.knockId, status: "discarded", by: "m1" });
  assert.deepEqual([noReason.code, noReason.check, noReason.translation], ["RESOLVE_NO_REASON", "C-118.7", C118.RESOLVE_NO_REASON[1]]);
  c.inboxResolve({ knockId: k.knockId, status: "discarded", by: "m1", reason: "spam" });
  const disc = await c.pullKnock({ knockId: k.knockId, by: "m1" });
  assert.deepEqual([disc.code, disc.check, disc.translation], ["KNOCK_DISCARDED", "C-118.4", C118.KNOCK_DISCARDED[1]]);
  /* a row changed at the refusal is the row answered (never a copy taken earlier) */
  const saved = KNOCK_CHECKS.KNOCK_EMPTY;
  try {
    KNOCK_CHECKS.KNOCK_EMPTY = { ...saved, translation: "changed translation" };
    assert.equal(knockEmpty().translation, "changed translation");
  } finally { KNOCK_CHECKS.KNOCK_EMPTY = saved; }
});

/* K874: a negative control for each C-85 refusal by name: the case just inside its bound is admitted. */
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const helpers = { json, requiredArgument: (op, argument, shape, error) => ({ reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape, error }),
  // fixtures-contract: answer-envelope door-helpers
  storeSilent: (op) => json({ ok: false, reason: "STORE_DID_NOT_ANSWER", op }, 502),
  doAnswer: async (res) => { let out = null; try { out = await (await res).json(); } catch { out = null; }
    return out && out.ok === true ? { answered: true, result: out.result } : { answered: false, result: undefined }; } };
const { doorbellOps } = await import("../../../src/doorbell/index.mjs");
const stubOf = (c) => ({ async fetch(req) { const url = new URL(req.url); const body = req.method === "POST" ? JSON.parse(await req.text() || "null") : null;
  return json({ ok: true, result: await doorbellOps(c, url, body)[url.pathname.slice(1)]() }); } });
const send = async (f, raw) => { const r = await knockOp(new Request("https://p/?op=knock", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.1" }, body: raw }),
  f.c.env, stubOf(f.c), helpers); return { status: r.status, body: await r.json() }; };

test("R4 R5 R6 R7 R8 (K874): each C-85 refusal's negative control: the knock just inside its bound is admitted", async () => {
  const t0 = 4000 * KNOCK.windowMs;
  /* R4: the fifth from one source admitted, the sixth refused */
  const a = fresh({ evidence: bucket() });
  for (let i = 0; i < 4; i++) await a.c.knock({ content: `a${i}`, sourceAddress: "1.1.1.1", now: t0 });
  assert.equal((await a.c.knock({ content: "a4", sourceAddress: "1.1.1.1", now: t0 })).ok, true);
  assert.equal((await a.c.knock({ content: "a5", sourceAddress: "1.1.1.1", now: t0 })).reason, "RATE_IP");
  /* R5: the tenth to the instance admitted, the eleventh refused */
  const g = fresh({ evidence: bucket() });
  for (let i = 0; i < 9; i++) await g.c.knock({ content: `g${i}`, sourceAddress: `2.2.2.${i}`, now: t0 });
  assert.equal((await g.c.knock({ content: "g9", sourceAddress: "2.2.2.9", now: t0 })).ok, true);
  assert.equal((await g.c.knock({ content: "g10", sourceAddress: "2.2.3.0", now: t0 })).reason, "RATE_GLOBAL");
  /* R6: a request body of exactly the base64 length of the cap plus 4 KiB is read; one byte more is refused before it is parsed */
  const e = fresh({ evidence: bucket() });
  const envelope = (n) => { const head = '{"contentText":"', tail = '"}'; return head + "x".repeat(n - head.length - tail.length) + tail; };
  assert.equal((await send(e, envelope(KNOCK.maxEnvelope))).body.reason, "KNOCK_PAYLOAD_TOO_LARGE", "read: the payload is judged, not the envelope");
  assert.equal((await send(e, envelope(KNOCK.maxEnvelope + 1))).body.reason, "KNOCK_ENVELOPE_TOO_LARGE");
  /* R7: content of exactly the cap is admitted, one byte more refused, for each cap */
  const p = fresh({ evidence: bucket() });
  assert.equal((await send(p, JSON.stringify({ contentText: "x".repeat(KNOCK.maxBytes) }))).status, 200);
  assert.equal((await send(p, JSON.stringify({ contentText: "x".repeat(KNOCK.maxBytes + 1) }))).body.reason, "KNOCK_PAYLOAD_TOO_LARGE");
  const inline = fresh();
  assert.equal((await send(inline, JSON.stringify({ contentText: "x".repeat(KNOCK.maxInline) }))).status, 200);
  assert.equal((await send(inline, JSON.stringify({ contentText: "x".repeat(KNOCK.maxInline + 1) }))).body.reason, "KNOCK_PAYLOAD_TOO_LARGE");
  /* R8: one byte is admitted, none refused */
  const m = fresh({ evidence: bucket() });
  assert.equal((await send(m, JSON.stringify({ contentB64: Buffer.from([0]).toString("base64") }))).status, 200);
  assert.equal((await send(m, JSON.stringify({ contentB64: "" }))).body.reason, "KNOCK_EMPTY");
});
