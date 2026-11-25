/* The fixtures ai-accounts publishes (`fixtures.mjs`), each called here and its real answer checked: a user's test takes
   the answer from the fixture, and this is what shows the fixture's answer is the module's own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_ACCOUNT_CHECKS } from "../../../src/ai-accounts/index.mjs";
import { SIGNIN_TOKEN } from "./fixture.mjs";
import * as fx from "./fixtures.mjs";

const refusal = (code, extra = {}) => ({ ok: false, reason: code, code, check: AI_ACCOUNT_CHECKS[code].check,
  translation: AI_ACCOUNT_CHECKS[code].translation, ...extra });
const withoutDetail = (r) => { const { detail, ...rest } = r; assert.equal(typeof detail, "string", "a refusal says what happened"); return rest; };

test("R7 (fixture accountForRefused): a member with no account is refused NO_ACCOUNT, the whole refusal with its check and translation (the brief said C-29.1; the check table holds C-29.20)", async () => {
  const r = await fx.accountForRefused({ member: "ann" });
  assert.equal(r.check, "C-29.20");
  assert.deepEqual(withoutDetail(r), refusal("NO_ACCOUNT", { member: "ann" }));
});

test("R7 (fixture accountForResult): a member whose API key was set is served by it, {ok, kind, level, key}", async () => {
  assert.deepEqual(await fx.accountForResult({ member: "ann", key: "sk-ann-1" }), { ok: true, kind: "apikey", level: "member", key: "sk-ann-1" });
  assert.deepEqual(await fx.accountForResult({ member: "bob", key: "sk-bob" , act: { kind: "run", member: "bob" } }),
    { ok: true, kind: "apikey", level: "member", key: "sk-bob" });
});

test("R2 R18 R19 (fixture accountReference): the member's own read of their account over a group without and with a connected subscription", async () => {
  const { without, with: connected } = await fx.accountReference({ member: "ann" });
  assert.equal(without.ok, true);
  assert.equal(without.held, false);
  assert.deepEqual(without.subscription, { connected: false, since: null, held: false, uses: null });
  assert.equal(connected.ok, true);
  assert.equal(connected.held, false, "no API key reference is held");
  assert.equal(connected.subscription.connected, true);
  assert.equal(connected.subscription.held, true);
  assert.equal(typeof connected.subscription.since, "string");
  assert.deepEqual(Object.keys(connected.subscription.uses ?? {}).slice(0, 3), ["ask", "draft", "run"]);
  assert.ok(!JSON.stringify([without, connected]).includes(SIGNIN_TOKEN("ann")), "never the token");
});

test("R7 R3 (fixture accountsServing): a real ai-accounts serves the member's referenced key for accountFor, the member and key as given", async () => {
  const s = await fx.accountsServing({ member: "cy", key: "sk-cy-secret" });
  assert.deepEqual(await s.accountFor({ member: "cy", act: { kind: "ask", member: "cy" } }), { ok: true, kind: "apikey", level: "member", key: "sk-cy-secret" });
  assert.deepEqual(await s.accounts.accountFor({ member: "cy", act: { kind: "draft", member: "cy" } }), { ok: true, kind: "apikey", level: "member", key: "sk-cy-secret" });
  assert.equal(withoutDetail(await s.accountFor({ member: "other", act: { kind: "ask", member: "other" } })).code, "NO_ACCOUNT", "another member holds none");
});

test("R20 R21 (fixture keepAwaySet): an administrator's set answers {ok, on, reason, set_by, set_at, uses}", async () => {
  const r = await fx.keepAwaySet({ on: true, uses: ["ask", "run"], reason: "Sealed.", by: "second" });
  assert.deepEqual([r.ok, r.on, r.reason, r.set_by, r.uses], [true, true, "Sealed.", "second", ["ask", "run"]]);
  assert.match(r.set_at, /^\d{4}-\d\d-\d\dT/);
  const off = await fx.keepAwaySet({ on: false, reason: null });
  assert.deepEqual([off.ok, off.on, off.reason, off.set_by], [true, false, null, "admin"]);
});

test("R21 (fixture keepAwayState): the state after a set is kept with who and when, and on a fresh account it is off", async () => {
  const { kept, off } = await fx.keepAwayState({ reason: "Sealed.", by: "second" });
  assert.deepEqual([kept.on, kept.reason, kept.set_by], [true, "Sealed.", "second"]);
  assert.match(kept.set_at, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(off, { on: false, reason: null, set_by: null, set_at: null, uses: off.uses });
  assert.ok(Array.isArray(off.uses) && off.uses.length > 0, "off covers every use");
});

test("R21 R34 (fixture keepAwayUnreadable): a state whose read throws is {on: null, reason: null, set_by: null, set_at: null, uses: null}", async () => {
  assert.deepEqual(await fx.keepAwayUnreadable(), { on: null, reason: null, set_by: null, set_at: null, uses: null });
});

test("R7 R20 R21 (fixture keptAwayGroup): the group's limit refuses aiKeptAway and accountFor alike, AI_KEPT_AWAY (C-29.31) with keep_away {reason, set_by, set_at}", async () => {
  const k = await fx.keptAwayGroup({ reason: "A confidentiality order.", by: "second" });
  assert.equal(k.aiKeptAway.check, "C-29.31");
  assert.deepEqual(withoutDetail(k.aiKeptAway), refusal("AI_KEPT_AWAY", { keep_away: k.aiKeptAway.keep_away }));
  assert.deepEqual([k.aiKeptAway.keep_away.reason, k.aiKeptAway.keep_away.set_by], ["A confidentiality order.", "second"]);
  assert.match(k.aiKeptAway.keep_away.set_at, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(k.accountFor, k.aiKeptAway, "the one refusal through the one site");
});

test("R22 (fixture keptAwayProject): a project's limit refuses aiKeptAway({project}) and an act naming it, PROJECT_AI_KEPT_AWAY (C-29.38) with keep_away", async () => {
  const k = await fx.keptAwayProject({ member: "ann", project: "P", reason: "A sealed case." });
  assert.equal(k.aiKeptAway.check, "C-29.38");
  assert.deepEqual(withoutDetail(k.aiKeptAway), refusal("PROJECT_AI_KEPT_AWAY", { project: "P", use: "ask", keep_away: k.aiKeptAway.keep_away }));
  assert.deepEqual([k.aiKeptAway.keep_away.reason, k.aiKeptAway.keep_away.set_by], ["A sealed case.", "ann"]);
  assert.match(k.aiKeptAway.keep_away.set_at, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(k.accountFor, k.aiKeptAway);
});

test("R34 R7 (fixture keptAwayUnreadable): an unreadable setting refuses AI_KEPT_AWAY with keep_away's three null and a detail saying so, from aiKeptAway and accountFor", async () => {
  const k = await fx.keptAwayUnreadable();
  assert.deepEqual(withoutDetail(k.aiKeptAway), refusal("AI_KEPT_AWAY", { keep_away: { reason: null, set_by: null, set_at: null } }));
  assert.match(k.aiKeptAway.detail, /could not be read/);
  assert.deepEqual(k.accountFor, k.aiKeptAway);
});

test("R7 (fixture noAccount): accountFor for a member with no reference and no sign-in is NO_ACCOUNT carrying the member", async () => {
  const r = await fx.noAccount({ member: "bob" });
  assert.deepEqual(withoutDetail(r), refusal("NO_ACCOUNT", { member: "bob" }));
});

test("R18 (fixture subscriptionDisconnect): a connected subscription's disconnection answers {ok: true, disconnected: true}", async () => {
  assert.deepEqual(await fx.subscriptionDisconnect({ member: "ann" }), { ok: true, disconnected: true });
});

test("R11 (fixture switchedOff): an account whose switch for the use is off refuses AI_USE_SWITCHED_OFF {whose, use}, never moving on, for the member's own and the group's", async () => {
  const own = await fx.switchedOff({ whose: "own", use: "ask" });
  assert.deepEqual(withoutDetail(own), refusal("AI_USE_SWITCHED_OFF", { whose: "own", use: "ask" }));
  const group = await fx.switchedOff({ whose: "group", use: "draft" });
  assert.deepEqual(withoutDetail(group), refusal("AI_USE_SWITCHED_OFF", { whose: "group", use: "draft" }));
});

test("R19 (fixture tokenMalformedHold): a token of the wrong length or kind is SUBSCRIPTION_TOKEN_MALFORMED (C-29.45); the well-formed control is held", async () => {
  const h = await fx.tokenMalformedHold({ member: "ann" });
  for (const r of [h.tooShort, h.notAString]) {
    assert.equal(r.check, "C-29.45");
    assert.deepEqual(withoutDetail(r), refusal("SUBSCRIPTION_TOKEN_MALFORMED"));
  }
  assert.equal(h.held.ok, true);
});
