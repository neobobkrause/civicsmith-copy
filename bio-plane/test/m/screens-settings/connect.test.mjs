/* Settings › The assistant at the module's interface (R4, R5, R8, R9 over `owner: "member:<id>"`), over the world (store-request): the team's real
   store, a member and the founder signed in, and every state the page draws made by the owners' real acts (the team's key, a member's own key or
   sign-in, the keep-away, the disclosure, the model's counted calls). What the expectations name is read back from the owners' answers. The
   team's agent-worker (the runner that answers a sign-in, the model that answers an ask) is the platform's double (`seed-connect.mjs`). */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, ancestor, day, has, lacks, open, said, textOf } from "./kit.mjs";
import * as S from "./seed-connect.mjs";

const ops = (o) => [...new Set(acts(o.tree).map((b) => b.attrs["data-act"]))].sort();
const situations = (o) => all(o.tree, (e) => e.attrs["data-situation"]).map((e) => e.attrs["data-situation"]);
const page = (t, as = t.dev, table) => open("connect", { world: t.w, as, ...(table ? { table } : {}) });
const owner = (as) => "member:" + as.member;
const REASON = "We hold tips from city employees; none of it may go to an AI service.";
/** A limit as the screen says it, from the limit the owner answered (`amount`, `unit`, `period`). */
const limitSaid = (l) => said("screen.panel.amount", { amount: l.unit === "usd" ? "$" + Number(l.amount).toFixed(2) : Number(l.amount).toLocaleString("en"),
  unit: said("screen.panel.unit." + l.unit), period: said("screen.panel.period." + l.period) });
const DAY_LIMIT = { scope: "per_member", unit: "usd", period: "day", amount: 5 };
/** The team's key serving `dev`, with the daily allowance set and the notice read, after `n` counted calls. */
async function served(opts = {}, { calls = 1, limit = DAY_LIMIT, cost } = {}) {
  const t = await S.team({ testInstance: true, ...opts });
  if (cost !== undefined) t.worker.usage = { ...S.CALL, usage: { ...S.CALL.usage, total_cost_usd: cost } };
  await S.teamKey(t, limit ? [limit] : []);
  await S.disclose(t.dev);
  await t.dev.act("groupkeynoticeseen", { body: {} });
  await S.ask(t, t.dev, calls);
  return t;
}
const groupLimit = async (as) => (await as.read("aiusage")).payers.find((p) => p.whose === "group").limits.find((l) => l.scope === "per_member");

test("R4 the reads: assistantstate, aikeepawaystate, groupkeystate, groupkeynotice, disclosureof, accountreference, subscriptionsignin {step: state}, and the member's own account (owner member:<me>)", async () => {
  const t = await S.team();
  const a = await page(t);
  const me = owner(t.dev);
  const reads = a.p.all.map((r) => [r.op, r.query, r.body]);
  for (const want of [["assistantstate", {}, undefined], ["aikeepawaystate", {}, undefined], ["groupkeystate", {}, undefined], ["groupkeynotice", {}, undefined],
    ["disclosureof", { member: me }, undefined], ["accountreference", {}, undefined], ["subscriptionsignin", {}, { step: "state" }], ["bootstrap", {}, undefined],
    ["accountuses", { owner: me }, undefined], ["ailimits", { owner: me }, undefined], ["aiusage", { owner: me }, undefined], ["accounthistory", { owner: me }, undefined]])
    assert.ok(reads.some((r) => JSON.stringify(r) === JSON.stringify(want)), JSON.stringify(want));
  const f = await page(t, t.founder);
  assert.equal(t.founder.member, "admin");
  assert.deepEqual(f.p.requests.find((r) => r.op === "disclosureof").query, { member: "admin" }, "the founder's disclosure is recorded as `admin`");
});

test("R4 exactly one of four situations: the group's key serves (with the member's daily allowance), the member's own account, nothing yet, or the group keeps its material away", async () => {
  const tg = await S.team();
  await S.teamKey(tg);
  await S.disclose(tg.dev);
  const g = await page(tg);
  assert.deepEqual(situations(g), ["group"]);
  has(g, "screen.connect.group");
  assert.equal(all(g.tree, (e) => e.tag === "a" && e.attrs.href === "#connect-own").length, 0, "R49: the 'Need more?' link is retired; the connect part is drawn, closed");
  const to = await S.team();
  await S.ownKey(to.dev);
  const own = await page(to);
  assert.deepEqual(situations(own), ["own"]);
  has(own, "screen.connect.own.apikey");
  has(own, "screen.connect.own.since", { date: day((await to.dev.read("accountreference")).set_at) });
  assert.ok(!/sk-ant/.test(own.html), "what it is, never its key");
  const ts = await S.team();
  await S.signedIn(ts.dev);
  const sub = await page(ts);
  assert.deepEqual(situations(sub), ["own"]);
  has(sub, "screen.connect.own.subscription", { date: day((await ts.dev.read("accountreference")).subscription.since) });
  const tn = await S.team();
  const none = await page(tn);
  assert.deepEqual(situations(none), ["none"]);
  const tk = await S.team();
  await tk.founder.act("aikeepaway", { body: { on: true, reason: REASON } });
  const kept = await page(tk);
  assert.deepEqual(situations(kept), ["keptaway"]);
  has(kept, "screen.connect.keptaway", { by: tk.founder.handle, date: day((await tk.dev.read("assistantstate")).set_at) });
  assert.ok(kept.html.includes(REASON), "the reason in the administrator's words");
  has(kept, "screen.connect.keptaway.ask");
  assert.deepEqual(ops(kept), [], "and no act");
  // the rule of who pays, on every situation
  for (const o of [g, own, none, kept]) has(o, "ai.whopays");
});

test("R4 a keep-away that could not be read is not taken as off: the assistant is drawn kept away, with no act (instance-setup R53)", async () => {
  const t = await S.team();
  await S.teamKey(t);
  // the setting cannot be read: its table is gone from the record (the owner answers `on: null`, and the assistant off, unread)
  t.w.sql.exec("ALTER TABLE ai_keep_away RENAME TO ai_keep_away_lost");
  assert.equal((await t.dev.read("aikeepawaystate")).on, null);
  const a = await page(t);
  assert.deepEqual(situations(a), ["keptaway"]);
  has(a, "screen.connect.keptaway.unread");
  assert.deepEqual(ops(a), []);
  const none = await page(await S.team(), undefined, S.SILENT);
  assert.deepEqual(situations(none), []);
  assert.ok(all(none.tree, (e) => e.attrs["data-state"] === "failed").length >= 1, "drawn as could not read");
});

test("R5 the two notices, each outward, before the first question: groupkeynoticeseen on the group's key, disclosureshown before connecting one's own", async () => {
  const t = await S.team();
  await S.teamKey(t);
  const g = await page(t);
  for (const op of ["groupkeynoticeseen", "disclosureshown"]) {
    const b = acts(g.tree).find((x) => x.attrs["data-act"] === op);
    assert.ok(b, op);
    const n = ancestor(b, (e) => e.attrs.class === "mk-msg");
    assert.ok(n && textOf(n).includes(said("mark.outward.means")), `${op} carries mark.outward.means`);
    assert.equal(g.s.acts.find((x) => x.op === op).outward, true);
  }
  assert.ok(!ops(g).includes("subscriptionsignin") && !ops(g).includes("accountreferenceset"), "connecting waits on the disclosure");
  assert.equal((await t.dev.read("groupkeynotice")).due, true);
  assert.deepEqual((await g.press("groupkeynoticeseen")).sent[0].body, {});
  assert.equal((await t.dev.read("groupkeynotice")).due, false, "the notice is recorded as read");
  const d = await t.dev.read("disclosureof", { query: { member: owner(t.dev) } });
  assert.equal(d.shown, false);
  const r = await g.press("disclosureshown", { data: { version: d.version } });
  assert.deepEqual(r.sent[0].body, { member: owner(t.dev), version: d.version });
  assert.equal((await t.dev.read("disclosureof", { query: { member: owner(t.dev) } })).shown, true, "the disclosure is recorded as shown");
  const seen = await page(t);
  assert.ok(!ops(seen).includes("groupkeynoticeseen"), "once seen, not again");
});

test("R4, R5, R13 connecting, in DEC-156's order: the subscription (only while bootstrap's part_signin answers true), then an API key, then not now", async () => {
  const t = await S.team();
  await S.disclose(t.dev);
  const a = await page(t);
  // one choice first, the subscription preselected, then the other two in order (R30)
  const way = all(a.tree, (e) => e.attrs.id === "mc-way")[0];
  assert.deepEqual(all(way, (e) => e.tag === "option").map((o) => o.attrs.value), ["subscription", "apikey", "later"]);
  assert.equal(all(way, (e) => e.tag === "option" && "selected" in e.attrs)[0].attrs.value, "subscription");
  const order = acts(a.tree).map((b) => b.attrs["data-act"] + (b.attrs["data-step"] ? ":" + b.attrs["data-step"] : ""));
  assert.deepEqual(order, ["subscriptionsignin:start", "subscriptionsignin:code", "reauth"], "the password given beforehand comes last (the registry's reauth)");
  // (R13) the flat `part_signin` (instance-setup R82): `false` not installed, `null` could not be read; the API key either way. The platform's agent-worker
  // is not bound (false), or answers its version without saying whether its runner is bound (null)
  for (const [part, worker, key, fills] of [[false, false, "instance.part.signin.absent", {}],
    [null, S.agentWorker({ runner: undefined }), "instance.part.unknown", { part: said("screen.connect.signin.part") }]]) {
    const tp = await S.team({ worker });
    await S.disclose(tp.dev);
    assert.equal((await tp.dev.read("bootstrap")).part_signin, part);
    const o = await page(tp);
    assert.ok(!ops(o).includes("subscriptionsignin"), `R13: no sign-in while part_signin is ${part}`);
    has(o, key, fills);
    await o.choose("mc-way", "apikey");
    assert.ok(ops(o).includes("accountreferenceset"), "the API key either way");
  }
  // control: the T46 nested `parts` is no longer read: an agent-worker whose version carries it and no `runner` leaves the sign-in unread
  const to = await S.team({ worker: S.agentWorker({ runner: undefined, version: { parts: [{ part: "signin", present: true }] } }) });
  await S.disclose(to.dev);
  const old = await page(to);
  assert.ok(!ops(old).includes("subscriptionsignin"), "R13: parts' signin offers nothing");
  has(old, "instance.part.unknown", { part: said("screen.connect.signin.part") });
});

test("R30 while nothing serves the member, one choice is asked first (My Claude subscription, An API key, Not now), the subscription preselected, and only the chosen path's steps are drawn", async () => {
  const t = await S.team();
  await S.disclose(t.dev);
  const a = await page(t);
  const fieldIds = (o) => all(o.tree, (e) => e.tag === "input" && e.attrs.type === "password").map((e) => e.attrs.id);
  // the subscription path draws no key field (control)
  assert.deepEqual(fieldIds(a), ["mc-code0", "mc-reauth"]);
  has(a, "screen.connect.signin.heading");
  lacks(a, "screen.connect.apikey.heading");
  assert.deepEqual(all(all(a.tree, (e) => e.attrs.id === "mc-way")[0], (e) => e.tag === "option").map((o) => textOf(o)), ["screen.connect.way.subscription", "screen.connect.way.apikey", "screen.connect.way.later"].map((k) => said(k)));
  // choosing An API key draws only its field
  await a.choose("mc-way", "apikey");
  assert.deepEqual(fieldIds(a), ["mc-key0"]);
  has(a, "screen.connect.apikey.heading");
  lacks(a, "screen.connect.signin.heading");
  assert.deepEqual(ops(a), ["accountreferenceset"]);
  // Not now draws no step: no field and no act, only its note
  await a.choose("mc-way", "later");
  assert.deepEqual(fieldIds(a), []);
  assert.deepEqual(ops(a), []);
  has(a, "connect.notnow");
  lacks(a, "screen.connect.apikey.heading");
  lacks(a, "screen.connect.signin.heading");
  // back to the subscription
  await a.choose("mc-way", "subscription");
  assert.deepEqual(ops(a), ["reauth", "subscriptionsignin"]);
  // control: with the disclosure not yet read, no choice is asked
  const d = await page(await S.team());
  assert.equal(all(d.tree, (e) => e.attrs.id === "mc-way").length, 0);
  // control: a member the assistant already serves on their own account is asked nothing
  const to = await S.team();
  await S.ownKey(to.dev);
  const own = await page(to);
  assert.equal(all(own.tree, (e) => e.attrs.id === "mc-way").length, 0);
});

test("R5 the subscription sign-in: start, the address offered in a new browsing context (noopener noreferrer), then the code in the body only; connected draws the member's own account", async () => {
  const t = await S.connecting();
  const a = await page(t);
  const s = await a.press("subscriptionsignin", { data: { step: "start" } });
  assert.deepEqual([s.sent[0].query, s.sent[0].body], [{}, { step: "start" }]);
  const link = all(a.tree, (e) => e.tag === "a" && e.attrs.href === S.SIGNIN_ADDRESS)[0];
  assert.ok(link && link.attrs.target === "_blank" && link.attrs.rel === "noopener noreferrer");
  assert.deepEqual((await a.press("subscriptionsignin", { data: { step: "code" }, values: { "mc-code0": "" } })).sent, [], "no code, nothing sent");
  const CODE = "SENTINEL-CODE-1234";
  const c = await a.press("subscriptionsignin", { data: { step: "code" }, values: { "mc-code0": CODE } });
  assert.deepEqual([c.sent[0].query, c.sent[0].body], [{}, { step: "code", code: CODE }]);
  assert.deepEqual(situations(a), ["own"]);
  const held = (await t.dev.read("accountreference")).subscription;
  assert.equal(held.connected, true, "the sign-in is held");
  has(a, "screen.connect.own.subscription", { date: day(held.since) });
  assert.ok(!a.html.includes(CODE));
  assert.equal(a.p.all.filter((r) => JSON.stringify(r).includes(CODE)).length, 1, "sent once, never again");
  assert.equal(t.worker.sent.filter((x) => x.body.code === CODE).length, 1, "and reached the runner once");
});

/* agent-worker R84's SIGNIN_CODES as it exports them, and the door's own codes (control-plane R65): pinned here, since
   this module's tests import no layer-6 module (K3144 (7)). */
const SIGNIN_CODES = ["ATTEMPT_SUPERSEDED", "BAD_BODY", "BAD_CODE", "BAD_MEMBER", "BAD_REQUEST", "BAD_STEP", "NOT_THIS_MEMBER", "NO_SIGNIN_WAITING", "RUNNER_NOT_CONFIGURED", "RUNNER_NOT_STARTED", "RUNNER_SILENT", "SIGNIN_ADDRESS_UNEXPECTED", "SIGNIN_NOT_HELD", "SIGNIN_REFUSED", "SIGNIN_TOKEN_REFUSED", "SIGNIN_UNAVAILABLE", "SIGNOUT_FAILED"];
const DOOR_CODES = ["AI_KEPT_AWAY", "DISCLOSURE_DUE", "AGENT_WORKER_UNBOUND", "AGENT_WORKER_SILENT"];
/** A member ready to connect, whose sign-in meets `code`: a code the runner answers (an external answer), or one the door itself gives (the binding gone, the runner
 *  silent, the team keeping its material away, the disclosure lost), made after the page is drawn. Answers the team and the step to press. */
async function meets(code, runner = { detail: "the runner's detail", translation: "untranslated " + code, trace: "abcdef0123456789" }, o = {}) {
  const t = await S.connecting(o);
  if (!DOOR_CODES.includes(code)) t.worker.refuse(code, runner);
  return t;
}
async function pressed(t, code, CODE) {
  const a = await page(t);
  if (code === "AGENT_WORKER_UNBOUND") delete t.w.env.AGENT_WORKER;
  if (code === "AGENT_WORKER_SILENT") t.worker.signin = () => new Error("the runner is gone");
  if (code === "AI_KEPT_AWAY") await t.founder.act("aikeepaway", { body: { on: true, reason: REASON } });
  if (code === "DISCLOSURE_DUE") t.w.sql.exec("DELETE FROM assistant_disclosures");
  const before = a.text;
  await a.press("subscriptionsignin", { data: { step: code === "DISCLOSURE_DUE" ? "start" : "code" }, values: { "mc-code0": CODE } });
  return { a, before };
}

test("R5, R24 every subscriptionsignin refusal is drawn in words (refusal.<code> where words.json holds it, else this module's), {detail} filled, never the typed code; nothing else changes", async () => {
  const spec = (await page(await S.team())).s.acts.find((a) => a.op === "subscriptionsignin");
  for (const code of [...SIGNIN_CODES, ...DOOR_CODES]) {
    assert.ok(spec.refusals[code], `${code} has its words`);
    const CODE = "SENTINEL-TYPED-CODE";
    const { a, before } = await pressed(await meets(code), code, CODE);
    assert.ok(a.refused && a.refused.text && !a.refused.text.includes("untranslated"), `${code} in this module's or words.json's words`);
    assert.ok(!a.html.includes(CODE), `${code}: the typed code is never drawn`);
    assert.equal(a.text.replace(a.refused.text, "").replace(/\s+/g, " "), before.replace(/\s+/g, " "), `${code}: nothing else changes`);
  }
  const { a: r } = await pressed(await meets("SIGNIN_REFUSED", { detail: "invalid code" }), "SIGNIN_REFUSED", "x");
  assert.ok(r.refused.text.startsWith(said("refusal.SIGNIN_REFUSED", { detail: "invalid code" })), "the runner's detail shown");
});

test("R24 a refusal's reference is drawn beside its words (interface-shell R39) and kept nowhere in the browser", async () => {
  const t = await meets("SIGNIN_UNAVAILABLE", {}, { testInstance: true });
  const a = await page(t);
  await a.press("subscriptionsignin", { data: { step: "start" } });
  const ref = (await S.lastTrace(t)).slice(0, 8);
  assert.ok(a.refused.text.includes(ref), "the reference beside the words");
  assert.ok(![...a.b.store.values(), ...a.b.local.values()].some((v) => String(v).includes(ref)));
});

test("R24 Open Anthropic's sign-in page is disabled while a start is in flight, and pressable again once it answers or is refused", async () => {
  for (const answer of ["ok", "refused"]) {
    const t = await S.connecting();
    if (answer === "refused") t.worker.refuse("SIGNIN_UNAVAILABLE", {}, ["start"]);
    const a = await page(t);
    const start = () => all(a.tree, (e) => e.tag === "button" && e.attrs["data-act"] === "subscriptionsignin" && e.attrs["data-step"] === "start")[0];
    assert.equal(start().attrs.disabled, undefined);
    await a.press("subscriptionsignin", { data: { step: "start" } });
    assert.equal(start().attrs.disabled, undefined, `${answer}: pressable again`);
  }
  // while in flight it is drawn disabled: the runner has not answered
  const t = await S.connecting();
  const p = await page(t, t.dev, { subscriptionsignin: S.unanswered(t, t.dev, "start") });
  p.press("subscriptionsignin", { data: { step: "start" } });
  await p.b.settle(40); p.redraw();
  const s = all(p.tree, (e) => e.tag === "button" && e.attrs["data-act"] === "subscriptionsignin" && e.attrs["data-step"] === "start")[0];
  assert.ok(s.attrs.disabled !== undefined, "disabled while in flight");
});

test("R24 the state as the plane holds it: connected since when and until when; a failed state read is said, never not connected; refused at Anthropic draws connect again once; the code field says to copy the whole code", async () => {
  const ts = await S.team({ testInstance: true });
  await S.signedIn(ts.dev);
  const sub = await page(ts);
  const held = (await ts.dev.read("accountreference")).subscription;
  has(sub, "screen.connect.own.subscription", { date: day(held.since) });
  has(sub, "screen.connect.own.until", { date: day(held.valid_until) });
  const failed = await page(await S.team(), undefined, { subscriptionsignin: "none", accountreference: "none" });
  has(failed, "screen.connect.signin.statefailed");
  lacks(failed, "screen.connect.none");
  // Anthropic refuses the held sign-in on the member's next question: the token is dropped and the refusal recorded (signin-door R4)
  ts.worker.ask = () => ({ event: "answer", ok: false, reason: "SIGNIN_TOKEN_REFUSED", code: "SIGNIN_TOKEN_REFUSED" });
  await S.ask(ts, ts.dev);
  const gone = (await ts.dev.read("accountreference")).subscription;
  assert.equal(gone.connected, false);
  const refused = await page(ts);
  // R54: refused at Anthropic is an expired sign-in, said once, with the way to sign in again
  has(refused, "screen.connect.expired", { date: day(gone.refused_at) });
  assert.equal(refused.text.split(said("screen.connect.expired", { date: day(gone.refused_at) })).length, 2, "once");
  assert.ok(acts(refused.tree).some((b) => b.attrs["data-act"] === "subscriptionsignin"), "and the way to connect again");
  const tn = await S.team();
  await S.disclose(tn.dev);
  const none = await page(tn);
  has(none, "screen.connect.signin.whole");
});

test("R5, R76 an API key: accountreferenceset with the key in the body only, and no member (the door stamps whose it is, ai-accounts R35), never drawn again", async () => {
  const t = await S.connecting();
  const a = await page(t);
  await a.choose("mc-way", "apikey");
  // a blank key on the fresh page sends nothing; once a key is held the set is no longer offered (R5)
  assert.deepEqual((await a.press("accountreferenceset", { values: { "mc-key0": " " } })).sent, []);
  const KEY = "sk-ant-api03-SENTINEL-OWN";
  const r = await a.press("accountreferenceset", { values: { "mc-key0": KEY } });
  assert.deepEqual([r.sent[0].query, r.sent[0].body], [{}, { kind: "apikey", secret: KEY }]);
  assert.equal(r.sent[0].headers.Authorization, "Bearer " + t.dev.token, "it is set for the signed-in member: by her session, not by a field of the body");
  assert.ok(!a.html.includes(KEY));
  assert.equal(a.p.all.filter((x) => JSON.stringify(x).includes(KEY)).length, 1, "sent once, never again");
});

/* Proved by the world, red until ai-accounts' route reads the `member` the door stamps (reported): the act the page sends names no member (R76), and the
   team's record refuses it NOT_YOUR_ACCOUNT, for `aiAccountsOps` reads the account's member from the body alone. */
test("R5, R76 the key the page sends is held by the team's record for the member who sent it: the reference is read again and draws her own account", async () => {
  const t = await S.connecting();
  const a = await page(t);
  await a.choose("mc-way", "apikey");
  const r = await a.press("accountreferenceset", { values: { "mc-key0": "sk-ant-api03-SENTINEL-HELD" } });
  assert.equal(a.refused, null, "nothing refuses it");
  assert.equal((await t.dev.read("accountreference")).held, true, "the team's record holds her key");
  assert.ok(r.sent.some((x) => x.op === "accountreference"), "the reference is read again");
  assert.deepEqual(situations(a), ["own"]);
});

test("R5 disconnect: a subscription by subscriptiondisconnect, an API key by accountreferenceremove; R9 the member's own account in its parts", async () => {
  const ts = await S.team();
  await S.signedIn(ts.dev);
  const sub = await page(ts);
  assert.deepEqual(ops(sub), ["accountusesset", "ailimitset", "subscriptiondisconnect"]);
  assert.deepEqual((await sub.press("subscriptiondisconnect")).sent[0].body, {});
  assert.equal((await ts.dev.read("accountreference")).subscription.connected, false, "the sign-in is dropped");
  assert.ok(ts.worker.sent.some((x) => x.body.step === "signout"), "and the runner is told to sign out");
  const t = await S.team();
  await S.ownKey(t.dev);
  const own = await page(t);
  assert.deepEqual(ops(own), ["accountreferenceremove", "accountusesset", "ailimitset"]);
  const rm = await own.press("accountreferenceremove");
  assert.deepEqual(rm.sent[0].body, {}, "R76: no member, the door stamps it");
  assert.equal(rm.sent[0].headers.Authorization, "Bearer " + t.dev.token, "removed for the signed-in member");
  // the member's own account: what it may do (one style of checkbox, saved by one act), a limit, her use; no exploring (group level only), no changes (the team's)
  const tk = await S.team();
  await S.ownKey(tk.dev);
  const o = await page(tk);
  for (const k of ["screen.connect.part.uses", "screen.connect.part.limit", "screen.connect.part.use"]) has(o, k);
  assert.ok(!all(o.tree, (e) => /explore/.test(e.attrs.id || "")).length, "no exploring for a member's own account");
  const boxes = all(o.tree, (e) => e.tag === "input" && e.attrs.type === "checkbox" && /^mu-/.test(e.attrs.id));
  assert.deepEqual(boxes.map((b) => b.attrs.id).sort(), ["ask", "draft", "run", "enquire", "read", "transcribe", "account", "suggestions", "standing"].map((u) => "mu-" + u).sort());
  const uses = (await tk.dev.read("accountuses", { query: { owner: owner(tk.dev) } })).uses;
  for (const b of boxes) assert.equal(b.attrs.checked !== undefined, uses[b.attrs.id.slice(3)] === true, `${b.attrs.id} is checked as the account holds it`);
  assert.equal(boxes.find((b) => b.attrs.id === "mu-standing").attrs.checked, undefined, "unasked uses: off to start");
  assert.equal(boxes.find((b) => b.attrs.id === "mu-ask").attrs.checked !== undefined, true);
  // one act saves what changed: the first change is its request, the others follow it
  const r = await o.press("accountusesset", { data: { own: "1" }, values: { "mu-ask": false, "mu-standing": true } });
  assert.deepEqual(r.sent.map((x) => [x.op, x.body]).slice(0, 2), [["accountusesset", { owner: owner(tk.dev), switch: "ask", on: false }], ["accountusesset", { owner: owner(tk.dev), switch: "standing", on: true }]]);
  const changed = (await tk.dev.read("accountuses", { query: { owner: owner(tk.dev) } })).uses;
  assert.deepEqual([changed.ask, changed.standing], [false, true], "both switches are saved");
  await o.press("accountusesset", { data: { own: "1" }, values: { "mu-ask": true, "mu-standing": false } });
  const back = (await tk.dev.read("accountuses", { query: { owner: owner(tk.dev) } })).uses;
  assert.deepEqual([back.ask, back.standing], [true, false], "and saved again");
  const lim = await o.press("ailimitset", { data: { remove: "" }, values: { "aio-scope": "overall", "aio-amount": "50000", "aio-unit": "tokens", "aio-period": "day" } });
  assert.deepEqual(lim.sent[0].body, { owner: owner(tk.dev), scope: "overall", unit: "tokens", period: "day", amount: 50000 });
  const held = (await tk.dev.read("ailimits", { query: { owner: owner(tk.dev) } })).limits;
  assert.ok(held.some((l) => l.scope === "overall" && l.unit === "tokens" && l.period === "day" && l.amount === 50000), "the limit is held");
  has(o, "screen.panel.usage.own");
  lacks(o, "screen.panel.usage.group");
  // R37: her own page names no change by "you" or by anyone: the changes are the team's page's
  lacks(o, "screen.panel.changes.heading");
});

/* Proved by the world, red until ai-accounts' route reads the `member` the door stamps (reported): as the set above is refused, so is the removal. */
test("R5, R76 the key the page removes is removed from the team's record, and the reference is read again", async () => {
  const t = await S.team();
  await S.ownKey(t.dev);
  const own = await page(t);
  const rm = await own.press("accountreferenceremove");
  assert.equal(own.refused, null, "nothing refuses it");
  assert.equal((await t.dev.read("accountreference")).held, false, "her key is removed from the team's record");
  assert.ok(rm.sent.some((x) => x.op === "accountreference"), "the reference is read again");
});

test("R5 the group's key serving a member: no settings of the group's account are offered, and no account panel", async () => {
  const t = await served();
  const g = await page(t);
  assert.ok(!ops(g).includes("ailimitset") && !ops(g).includes("accountusesset"));
  // (R37, DEC-262) the per-member limit is read: its sentence is drawn, without what was used or the suggestions, which are not answered
  has(g, "screen.connect.grouplimits", { limit: limitSaid(await groupLimit(t.dev)) });
});

/* R37 (T49; D30 m): every sentence `connect` draws is read by key with every fill filled from its read; none is drawn with an
   empty or default fill. The answers a fill is read from: `subscription.plan` and `.since`, `accountreference.last4`, a limit's `used`
   and the group key's `suggestions`; without them the situation is drawn by the words whose fills the reads give. */
const placeholder = (o) => /\{\w+\}/.test(o.html) || /undefined|NaN|null/.test(o.text);

test("R37 the group's key: the allowance and the limits are drawn with their fills; what was used and the suggestions only when answered, never with an empty one", async () => {
  const t = await served();
  const limit = limitSaid(await groupLimit(t.dev));
  const plain = await page(t);
  assert.ok(!placeholder(plain), "no unfilled fill, no undefined");
  has(plain, "screen.connect.group.allowance", { limit });
  assert.ok(!/You have used/.test(plain.text) && !/Suggestions:/.test(plain.text), "nothing used or suggested is said while it is not answered");
  // the real `aiusage` answers no `used`: the reads that do are the table's (reported)
  const used = S.CALL.usage.total_cost_usd, dollars = "$" + used.toFixed(2);
  await t.founder.act("groupkeynoticeseen", { body: {} });
  await S.ask(t, t.founder);   // the founder is served by the team's key too
  const answered = (as) => ({ aiusage: S.withUsed(t, as, used) });
  // R50: what was used and the suggestions are an owner's: a member who does not administer is drawn neither
  const asMember = await page(t, t.dev, answered(t.dev));
  has(asMember, "screen.connect.group.allowance", { limit });
  lacks(asMember, "screen.connect.group.allowance.used", { used: dollars, when: said("ai.usage.today") });
  lacks(asMember, "screen.connect.grouplimits.used", { used: dollars });
  lacks(asMember, "screen.connect.grouplimits.suggestions", { suggestions: said("screen.panel.off") });
  const suggestions = (await t.founder.read("groupkeystate")).suggestions;
  assert.equal(suggestions, false, "the administrator's read answers the suggestions switch");
  const full = await page(t, t.founder, answered(t.founder));
  has(full, "screen.connect.group.allowance", { limit });
  has(full, "screen.connect.group.allowance.used", { used: dollars, when: said("ai.usage.today") });
  has(full, "screen.connect.grouplimits", { limit });
  has(full, "screen.connect.grouplimits.used", { used: dollars });
  has(full, "screen.connect.grouplimits.suggestions", { suggestions: said(suggestions ? "screen.panel.on" : "screen.panel.off") });
  assert.ok(!placeholder(full));
  // at the limit, by its period alone
  const tr = await served({}, { cost: 6 });
  const l = await groupLimit(tr.dev);
  assert.equal(l.reached, true, "the team's record says the limit is reached");
  const reached = await page(tr);
  has(reached, "screen.connect.group.allowance.reached", { period: said("screen.panel.period." + l.period) });
  assert.ok(!reached.text.includes(said("screen.connect.group.allowance", { limit: limitSaid(l) })), "at the limit only that is said");
});

test("R37 the member's own account: the day it was signed in, else nothing invented; the changes name the member by handle, never \"you\"", async () => {
  const ts = await S.team();
  await S.signedIn(ts.dev);
  const sub = await page(ts);
  const held = (await ts.dev.read("accountreference")).subscription;
  has(sub, "screen.connect.own.subscription", { date: day(held.since) });
  has(sub, "screen.connect.own.until", { date: day(held.valid_until) });
  assert.ok(!placeholder(sub));
  // control: a subscription with no day it began draws no sentence with a blank date (a row with its day blank: no act leaves one)
  ts.w.sql.exec("UPDATE subscription_connections SET since = ''");
  const noSince = await page(ts);
  assert.equal((await ts.dev.read("accountreference")).subscription.since, "");
  assert.ok(!placeholder(noSince));
  const tk = await S.team();
  await S.ownKey(tk.dev);
  const key = await page(tk);
  has(key, "screen.connect.own.apikey");
  assert.ok(!placeholder(key));
  // her own page draws no changes (the team's page does, naming the member by handle, never "you")
  assert.ok(!/\byou held\b/i.test(key.text) && !key.text.includes(said("screen.panel.changes.heading")));
});

test("R38 beside the code: the sign-in's refusals by their keys under connect.ifnot, each with its reference (refusal.reference); the typed code is never drawn", async () => {
  const a = await page(await S.connecting());
  const list = all(a.tree, (e) => e.attrs["data-list"] === "ifnot")[0];
  assert.ok(list, "the listing is drawn");
  assert.ok(textOf(list).includes(said("connect.ifnot")));
  for (const k of ["refusal.NO_SIGNIN_WAITING", "refusal.SIGNIN_UNAVAILABLE", "refusal.SIGNIN_ADDRESS_UNEXPECTED", "refusal.AGENT_WORKER_UNBOUND", "instance.part.signin.absent"])
    assert.ok(textOf(list).includes(said(k)), k);
  assert.ok(textOf(list).includes(said("refusal.SIGNIN_REFUSED", { detail: "invalid_grant" })));
  assert.ok(textOf(list).includes(said("screen.connect.refusal.reference", { example: said("refusal.reference", { ref: "7f3a91c2" }) })), "and what a reference is");
  // the live refusal: its key's words, with its reference, and nothing typed
  for (const code of ["NO_SIGNIN_WAITING", "SIGNIN_UNAVAILABLE", "SIGNIN_ADDRESS_UNEXPECTED", "AGENT_WORKER_UNBOUND", "SIGNIN_REFUSED"]) {
    const t = await meets(code, { detail: "invalid_grant" }, { testInstance: true });
    const { a: o } = await pressed(t, code, "SENTINEL-TYPED-CODE");
    assert.ok(o.refused.text.startsWith(said("refusal." + code, { detail: "invalid_grant" })), `${code}: its key's words`);
    assert.ok(o.refused.text.includes(said("refusal.reference", { ref: (await S.lastTrace(t)).slice(0, 8) })), `${code}: its reference`);
    assert.ok(!o.html.includes("SENTINEL-TYPED-CODE"), `${code}: the typed code is never drawn`);
  }
  // control: a refusal that carries no runner detail still fills its detail from the refusal's own code
  const { a: nd } = await pressed(await meets("SIGNIN_REFUSED", {}), "SIGNIN_REFUSED", "x");
  assert.ok(!placeholder(nd) && nd.refused.text.startsWith(said("refusal.SIGNIN_REFUSED", { detail: "SIGNIN_REFUSED" })));
});

test("R30 R36 (K3347) connect gains no pointer to the group key and no API-key preselection; the subscription stays preselected; reauth sends the password, none sends nothing", async () => {
  const t = await S.team();
  await S.disclose(t.founder);
  const a = await page(t, t.founder);
  assert.equal(all(all(a.tree, (e) => e.attrs.id === "mc-way")[0], (e) => e.tag === "option" && "selected" in e.attrs)[0].attrs.value, "subscription");
  assert.ok(!a.html.includes("/app/members"), "no pointer to Members' group key");
  assert.deepEqual((await a.press("reauth", { values: { "mc-reauth": "" } })).sent, [], "no password, nothing sent");
  const r = await a.press("reauth", { values: { "mc-reauth": t.founder.password } });
  assert.deepEqual([r.sent[0].op, r.sent[0].body], ["reauth", { password: t.founder.password }]);
  assert.ok(!a.html.includes(t.founder.password), "the password is never drawn again");
});

/* R49 (T50; N1158; DEC-283): connect in every state — the card, then the parts that open and close */
const parts = (o) => all(o.tree, (e) => e.tag === "details" && /\bcs-part\b/.test(e.attrs.class || ""));
const titles = (o) => parts(o).map((d) => textOf(all(d, (h) => h.attrs.class === "t")[0]));
const say = (...keys) => keys.map((k) => said(k));

test("R49 the team's key serves her: the optional line, one card, then the notice (needed first, open), her allowance, her use and connecting her own (closed); her share as a meter", async () => {
  // she used 80% of her daily allowance: the model counted a call at four fifths of it
  const t = await served({}, { cost: 4 });
  // the notice due again with her use counted: no act leaves it so (a notice once read stays read), the row is taken out of the record
  t.w.sql.exec("DELETE FROM group_key_notices");
  assert.equal((await t.dev.read("groupkeynotice")).due, true);
  const l = await groupLimit(t.dev);
  // the real `aiusage` answers no `used` for a limit (reported): the reads that do are the table's
  const g = await page(t, t.dev, { aiusage: S.withUsed(t, t.dev, 4) });
  has(g, "screen.connect.optional");
  assert.deepEqual(situations(g), ["group"]);
  assert.deepEqual(titles(g), say("screen.connect.notice.heading", "screen.connect.part.allowance", "screen.connect.part.use", "screen.connect.own.heading"));
  const [first, ...rest] = parts(g);
  assert.ok(first.attrs.open !== undefined && first.attrs["data-state"] === "needed", "needed first, open");
  assert.ok(textOf(first).includes(said("screen.setup.state.needed")));
  assert.ok(rest.every((d) => d.attrs.open === undefined), "the others closed");
  has(g, "screen.connect.group.allowance", { limit: limitSaid(l) });
  const meter = all(g.tree, (e) => /\bmk-meter\b/.test(e.attrs.class || ""))[0];
  const pct = Math.round(100 * 4 / l.amount);
  assert.ok(meter && textOf(meter).includes(pct + "%") && meter.attrs["data-near"] === "1", "her share of the daily allowance as a meter, near its limit");
  has(g, "ai.whopays");
  // control: once the notice is seen it is not drawn again, and no part is empty
  await t.dev.act("groupkeynoticeseen", { body: {} });
  const seen = await page(t);
  assert.ok(!titles(seen).includes(said("screen.connect.notice.heading")));
  assert.ok(parts(seen).every((d) => textOf(all(d, (b) => b.attrs.class === "body")[0]).trim() !== ""), "a part is never drawn empty");
});

test("R49 her own API key serves her: the card, then what the assistant may do (checkboxes: everyday apart from without being asked), a limit with its words, her use and Disconnect", async () => {
  const t = await S.team();
  await S.ownKey(t.dev);
  const o = await page(t);
  assert.deepEqual(situations(o), ["own"]);
  assert.deepEqual(titles(o), say("screen.connect.part.uses", "screen.connect.part.limit", "screen.connect.part.use", "screen.connect.disconnect.heading"));
  assert.ok(parts(o)[0].attrs.open !== undefined && parts(o).slice(1).every((d) => d.attrs.open === undefined), "the first open");
  has(o, "screen.connect.own.apikey");
  has(o, "screen.connect.part.limit.why.apikey");
  lacks(o, "screen.connect.part.limit.why.subscription");
  for (const k of ["screen.connect.uses.everyday", "screen.connect.uses.unasked", "screen.connect.uses.unasked.help", "screen.connect.limit.binds"]) has(o, k);
  const uses = parts(o)[0];
  const every = all(uses, (e) => e.attrs.id === "mu-every")[0], unasked = all(uses, (e) => e.attrs.id === "mu-unasked")[0];
  assert.deepEqual(all(every, (e) => e.tag === "input").map((e) => e.attrs.id), ["ask", "draft", "run", "enquire", "read", "transcribe", "account"].map((u) => "mu-" + u));
  assert.deepEqual(all(unasked, (e) => e.tag === "input").map((e) => e.attrs.id), ["mu-suggestions", "mu-standing"]);
  for (const u of ["ask", "standing"]) assert.ok(textOf(uses).includes(said(`ai.use.${u}.name`)) && textOf(uses).includes(said(`ai.use.${u}.means`)), u);
  assert.equal(all(every, (e) => e.attrs["data-mark"]).length + all(unasked, (e) => e.attrs["data-mark"]).length, 0, "no weight mark on any switch");
  // an API key may limit in dollars; a limit is the member's own
  const units = all(all(o.tree, (e) => e.attrs.id === "aio-unit")[0], (e) => e.tag === "option").map((x) => x.attrs.value);
  assert.ok(units.includes("usd"));
});

test("R49 her subscription serves her: the card with the connected tag and the day Anthropic stops accepting the sign-in; a limit only in tokens or calls; Disconnect", async () => {
  const t = await S.team();
  await S.signedIn(t.dev);
  const o = await page(t);
  const held = (await t.dev.read("accountreference")).subscription;
  assert.deepEqual(situations(o), ["own"]);
  has(o, "screen.connect.own.subscription", { date: day(held.since) });
  has(o, "screen.connect.connected");
  has(o, "screen.connect.own.until", { date: day(held.valid_until) });
  has(o, "screen.connect.own.until.again");
  has(o, "screen.connect.part.limit.why.subscription");
  lacks(o, "screen.connect.part.limit.why.apikey");
  const units = all(all(o.tree, (e) => e.attrs.id === "aio-unit")[0], (e) => e.tag === "option").map((x) => x.attrs.value);
  assert.deepEqual(units, ["tokens", "calls"]);
  assert.deepEqual(titles(o).at(-1), said("screen.connect.disconnect.heading"));
  assert.ok(acts(o.tree).some((b) => b.attrs["data-act"] === "subscriptiondisconnect" && textOf(b).startsWith(said("screen.connect.disconnect.subscription"))));
});

test("R49 a team that does not pay (nothing serves her yet) and a team keeping its material away: before you connect (needed first), connect; or one card and no act", async () => {
  const none = await page(await S.team());
  assert.deepEqual(situations(none), ["none"]);
  has(none, "screen.connect.none");
  assert.deepEqual(titles(none), say("screen.connect.part.before"));
  assert.equal(parts(none)[0].attrs["data-state"], "needed");
  // the disclosure read, the choice is asked
  const t = await S.team();
  await S.disclose(t.dev);
  const read = await page(t);
  assert.deepEqual(titles(read), say("screen.connect.own.heading"));
  const tk = await S.team();
  await tk.founder.act("aikeepaway", { body: { on: true, reason: REASON } });
  const kept = await page(tk);
  assert.deepEqual([situations(kept), parts(kept).length, ops(kept)], [["keptaway"], 0, []]);
});

/* R50 (T50; N1154): a code being exchanged */
test("R50 a code being exchanged: working is said beside the button, which is not pressed again; the code is sent once", async () => {
  const t = await S.connecting();
  const a = await page(t, t.dev, { subscriptionsignin: S.unanswered(t, t.dev, "code") });
  const btn = () => all(a.tree, (e) => e.tag === "button" && e.attrs["data-act"] === "subscriptionsignin" && e.attrs["data-step"] === "code")[0];
  assert.equal(btn().attrs.disabled, undefined);
  lacks(a, "shell.working");
  a.press("subscriptionsignin", { data: { step: "code" }, values: { "mc-code0": "SENTINEL-FIRST" } });
  await a.b.settle(60); a.redraw();
  has(a, "shell.working");
  assert.ok(btn().attrs.disabled !== undefined, "busy");
  await a.press("subscriptionsignin", { data: { step: "code" }, values: { "mc-code0": "SENTINEL-SECOND" } });
  assert.deepEqual(a.p.requests.filter((x) => x.body && x.body.step === "code").map((x) => x.body.code), ["SENTINEL-FIRST"], "the second press sends nothing");
});

test("R50 the refusal of the exchange is the outcome drawn, the page is no longer working, and the button can be pressed again", async () => {
  const t = await meets("NO_SIGNIN_WAITING", {});
  const { a } = await pressed(t, "NO_SIGNIN_WAITING", "SENTINEL-1");
  assert.ok(a.refused.text.startsWith(said("refusal.NO_SIGNIN_WAITING", {})));
  lacks(a, "shell.working");
  const btn = all(a.tree, (e) => e.tag === "button" && e.attrs["data-step"] === "code")[0];
  assert.equal(btn.attrs.disabled, undefined);
});

/* R54 (T50; DEC-314): an expired sign-in on Connect */
test("R54 a sign-in that has expired draws its date, what it means, the state and what to do, and the act to sign in again once; the connected tag is gone", async () => {
  const t = await S.team();
  await S.signedIn(t.dev);
  // the day Anthropic stops accepting it has passed: the team's record is told the day (a sign-in is held for a day or more from now, and the clock
  // a world moves is not the one the record stamps with, so no act brings the day about)
  const lapsedOn = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 19) + "Z";
  t.w.sql.exec("UPDATE subscription_connections SET valid_until = ?", lapsedOn);
  assert.equal((await t.dev.read("accountreference")).subscription.valid_until, lapsedOn);
  const o = await page(t);
  assert.deepEqual(situations(o), ["expired"]);
  has(o, "screen.connect.expired", { date: day(lapsedOn) });
  for (const k of ["screen.connect.expired.means", "screen.connect.expired.state", "screen.connect.expired.next"]) has(o, k);
  lacks(o, "screen.connect.connected");
  const starts = acts(o.tree).filter((b) => b.attrs["data-act"] === "subscriptionsignin" && b.attrs["data-step"] === "start");
  assert.equal(starts.length, 1, "the act to sign in again, once");
  assert.equal(situations(o).length, 1);
  // control: a sign-in still held is not expired
  const th = await S.team();
  await S.signedIn(th.dev);
  const held = await page(th);
  lacks(held, "screen.connect.expired.state");
  assert.deepEqual(situations(held), ["own"]);
  // the connection check belongs to the remote proof (R41, R53: agent-runner R38) and is not drawn here, for a team-key member or an API key's
  const tg = await S.team();
  await S.teamKey(tg);
  await S.disclose(tg.dev);
  lacks(await page(tg), "screen.connect.check");
  const to = await S.team();
  await S.ownKey(to.dev);
  lacks(await page(to), "screen.connect.check");
});
