/* stewards R24–R26 (T53; N1110; DEC-255, DEC-270; K5507, K5530): a public listing's withdrawal carries the listing rule's
   part and the rule text's version; reinstating keeps the history; the steward is given what to tell the team, and the
   service tells no one. Driven at the Worker's interface, as requirements.test.mjs. */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { W, worker, makeEnv, call, report, signIn, ADDRESS, clock, T0 } from "./fixture.mjs";
import { esc, tellGroupSentence, TELL_GROUP, TELL_GROUP_KEY, RULE_PART_WORDS } from "../src/ui.mjs";

const DAY = 86400e3;
let clk = null;
afterEach(() => { clk?.reset(); clk = null; });
const decide = (env, cookie, body) => call(env, "/steward/decide", { method: "POST", body, cookie });
const reinstate = (env, cookie, body) => call(env, "/steward/reinstate", { method: "POST", body, cookie });
const decisionsIn = (env) => env.STORE.db.prepare("SELECT COUNT(*) AS n FROM decisions").get().n;
const withdrawalsIn = (env) => env.STORE.db.prepare("SELECT COUNT(*) AS n FROM withdrawals").get().n;
const detail = async (env, cookie, ref) => (await call(env, `/steward/report/${ref}`, { cookie })).data;
const listing = (item, rule_part) => ({ service: "public_listing", item, ...(rule_part === undefined ? {} : { rule_part }) });

test("R24: a public listing's withdrawal takes a rule part from RULE_PARTS and stores the part and the rule text's version; refusals after R12's, writing nothing; never public", async () => {
  assert.deepEqual([...W.RULE_PARTS], ["1", "2", "3", "4"]);
  assert.ok(Object.isFrozen(W.RULE_PARTS));
  const env = makeEnv();
  const s = await signIn(env);
  const ref = (await report(env)).data.ref;

  /* refusals, each writing nothing; R12's earlier refusals come first */
  const refused = async (body, code, status = 400) => {
    const before = [decisionsIn(env), withdrawalsIn(env)];
    const r = await decide(env, s.cookie, body);
    assert.equal(r.status, status, code);
    assert.equal(r.data.code, code);
    assert.deepEqual([decisionsIn(env), withdrawalsIn(env)], before, `${code} writes nothing`);
  };
  await refused({ ref, decision: "withdraw", reason: "", withdraw: listing("l-1") }, "NO_REASON");
  await refused({ ref, decision: "withdraw", reason: "r", withdraw: { service: "public_listing", item: "", rule_part: "9" } }, "WITHDRAW_TARGET_INVALID");
  await refused({ ref, decision: "withdraw", reason: "r", withdraw: listing("l-1") }, "RULE_PART_REQUIRED");
  await refused({ ref, decision: "withdraw", reason: "r", withdraw: listing("l-1", "") }, "RULE_PART_REQUIRED");
  for (const bad of ["5", 5, "0", "views", "conclusions", "whom it holds to account", "2 ", ["2"]])
    await refused({ ref, decision: "withdraw", reason: "r", withdraw: listing("l-1", bad) }, "RULE_PART_UNKNOWN");
  for (const service of ["template_library", "shared_profile"])
    await refused({ ref, decision: "withdraw", reason: "r", withdraw: { service, item: "t-1", rule_part: "1" } }, "RULE_PART_NOT_APPLICABLE");

  /* accepted: part 2 with a reason, stored with part, version, steward and time */
  clk = clock(T0);
  const ok = await decide(env, s.cookie, { ref, decision: "withdraw", reason: "It names itself as the city's office.", withdraw: listing("l-1", "2") });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.rule_part, "2");
  assert.equal(ok.data.rule_text_version, "2026-10-15");
  const d = (await detail(env, s.cookie, ref)).decisions.at(-1);
  assert.equal(d.decision, "withdraw");
  assert.equal(d.service, "public_listing");
  assert.equal(d.rule_part, "2");
  assert.equal(d.rule_text_version, "2026-10-15");
  assert.equal(d.reason, "It names itself as the city's office.");
  assert.equal(d.steward, "Alice Steward");
  assert.equal(d.at, T0);
  /* a part as its whole number is the same part */
  const ref3 = (await report(env, {}, { ip: "203.0.113.3" })).data.ref;
  assert.equal((await decide(env, s.cookie, { ref: ref3, decision: "withdraw", reason: "r", withdraw: listing("l-3", 4) })).data.rule_part, "4");

  /* a later change of the configured date alters no earlier decision */
  env.LISTING_RULE_TEXT_VERSION = "2027-01-02";
  const ref2 = (await report(env, {}, { ip: "203.0.113.2" })).data.ref;
  const later = await decide(env, s.cookie, { ref: ref2, decision: "withdraw", reason: "spam", withdraw: listing("l-2", "1") });
  assert.equal(later.data.rule_text_version, "2027-01-02");
  assert.equal((await detail(env, s.cookie, ref)).decisions.at(-1).rule_text_version, "2026-10-15");

  /* the version unset: a listing cannot be withdrawn, nothing written */
  delete env.LISTING_RULE_TEXT_VERSION;
  const ref4 = (await report(env, {}, { ip: "203.0.113.4" })).data.ref;
  await refused({ ref: ref4, decision: "withdraw", reason: "r", withdraw: listing("l-4", "1") }, "RULE_TEXT_VERSION_UNSET", 503);
  env.LISTING_RULE_TEXT_VERSION = "2026-10-15";

  /* never public: the register shows {service, item, since, kind}, neither part nor reason */
  const pub = await call(env, "/withdrawals");
  for (const row of pub.data) assert.deepEqual(Object.keys(row).sort(), ["item", "kind", "service", "since"]);
  assert.ok(pub.data.some((r) => r.item === "l-1" && r.service === "public_listing" && r.kind === "harassment"));
  const steward = (await call(env, "/steward/withdrawals", { cookie: s.cookie })).data;
  for (const row of steward.register) assert.ok(!("rule_part" in row) && !("reason" in row));
  const outside = [pub.text, (await call(env, "/withdrawals", { json: false })).text, (await call(env, "/", { json: false })).text,
    (await call(env, "/guide", { json: false })).text, JSON.stringify(steward), ...env.sent.map((m) => m.raw)];
  for (const t of outside) {
    assert.ok(!t.includes("city&#39;s office") && !t.includes("city's office"), "the reason is never outside the steward's report page");
    assert.ok(!t.includes(esc(RULE_PART_WORDS[2])) && !t.includes(RULE_PART_WORDS[2]), "the part is never outside the steward's report page");
    assert.doesNotMatch(t, /rule_part|rule_text_version/);
  }

  /* control: the other two services' withdrawals answer as before, with no part */
  for (const service of ["shared_profile", "template_library"]) {
    const w = await decide(env, s.cookie, { ref, decision: "withdraw", reason: "r", withdraw: { service, item: "x-1" } });
    assert.equal(w.status, 200);
    assert.equal(w.data.already, false);
    assert.ok(!("rule_part" in w.data));
  }
});

test("R25: reinstating a listing ends the withdrawal and leaves the register; the history keeps the part for R15's period; a new request can be withdrawn again with a new part", async () => {
  clk = clock(T0);
  const env = makeEnv();
  let s = await signIn(env);
  const ref = (await report(env, { contact: null })).data.ref;
  assert.equal((await decide(env, s.cookie, { ref, decision: "withdraw", reason: "pretends to be the council", withdraw: listing("l-9", "2") })).status, 200);
  assert.ok((await call(env, "/withdrawals")).data.some((r) => r.item === "l-9"));

  clk.tick(DAY);
  s = await signIn(env); /* a session lasts 12 hours (R8) */
  const back = await reinstate(env, s.cookie, { service: "public_listing", item: "l-9", reason: "renamed itself" });
  assert.equal(back.status, 200);
  assert.ok(!(await call(env, "/withdrawals")).data.some((r) => r.item === "l-9"), "the register drops the item");
  const hist = (await detail(env, s.cookie, ref)).decisions;
  const w = hist.find((d) => d.decision === "withdraw");
  assert.equal(w.rule_part, "2");
  assert.equal(w.reason, "pretends to be the council");
  assert.equal(hist.at(-1).decision, "reinstate");
  assert.equal(hist.at(-1).reason, "renamed itself");

  /* kept until REPORT_RETENTION_DAYS (365) after the reinstatement */
  clk.tick(364 * DAY);
  await worker.scheduled({}, env);
  s = await signIn(env);
  assert.equal((await detail(env, s.cookie, ref)).decisions.find((d) => d.decision === "withdraw").rule_part, "2");

  /* a second request after reinstatement: withdrawn again with a new part, the past decision binding nothing */
  const ref2 = (await report(env, {}, { ip: "203.0.113.9" })).data.ref;
  const again = await decide(env, s.cookie, { ref: ref2, decision: "withdraw", reason: "unlawful", withdraw: listing("l-9", "3") });
  assert.equal(again.status, 200);
  assert.equal(again.data.already, false);
  assert.equal(again.data.rule_part, "3");
  assert.ok((await call(env, "/withdrawals")).data.some((r) => r.item === "l-9"));

  /* control: reinstating an item not withdrawn */
  const none = await reinstate(env, s.cookie, { service: "public_listing", item: "never", reason: "r" });
  assert.equal(none.status, 400);
  assert.equal(none.data.code, "NOT_WITHDRAWN");
});

test("R26: the steward's page for a withdrawn listing gives the sentence by key with the part and reason; no contact, a note; the service mails no one but the stewards", async () => {
  const env = makeEnv();
  const s = await signIn(env);
  const withContact = (await report(env, { contact: "admins@team.example" })).data.ref;
  const noContact = (await report(env, { contact: null }, { ip: "203.0.113.7" })).data.ref;
  const reason = "It posts the home address of a <private> person.";
  await decide(env, s.cookie, { ref: withContact, decision: "withdraw", reason, withdraw: listing("l-7", "4") });
  await decide(env, s.cookie, { ref: noContact, decision: "withdraw", reason: "spam", withdraw: listing("l-8", "1") });

  const page = (await call(env, `/steward/report/${withContact}`, { cookie: s.cookie, json: false })).text;
  assert.ok(page.includes(`data-word="${TELL_GROUP_KEY}"`), "the sentence is the key's");
  const sentence = esc(tellGroupSentence({ rule_part: "4", reason }));
  assert.ok(page.includes(sentence), "the ready sentence with part and reason");
  assert.ok(sentence.includes(esc(reason)) && sentence.includes(esc(RULE_PART_WORDS[4])) && sentence.includes("4"));
  assert.ok(page.includes(esc(TELL_GROUP.send("admins@team.example"))));
  assert.ok(!page.includes(esc(TELL_GROUP.noContact)));

  const bare = (await call(env, `/steward/report/${noContact}`, { cookie: s.cookie, json: false })).text;
  assert.ok(bare.includes(esc(tellGroupSentence({ rule_part: "1", reason: "spam" }))));
  assert.ok(bare.includes(esc(TELL_GROUP.noContact)), "no contact given: the steward is told so, and that no public status line exists");

  /* nothing public about it */
  for (const p of ["/", "/guide", "/withdrawals"]) for (const json of [true, false]) {
    const t = (await call(env, p, { json })).text;
    assert.ok(!t.includes(esc(TELL_GROUP.noContact)) && !t.includes(TELL_GROUP.noContact));
    assert.ok(!t.includes(TELL_GROUP_KEY));
  }
  /* a dismissal or another service's withdrawal carries no such sentence */
  const other = (await report(env, {}, { ip: "203.0.113.8" })).data.ref;
  await decide(env, s.cookie, { ref: other, decision: "withdraw", reason: "r", withdraw: { service: "template_library", item: "t-1" } });
  assert.ok(!(await call(env, `/steward/report/${other}`, { cookie: s.cookie, json: false })).text.includes(TELL_GROUP_KEY));

  /* the mail binding: one message to STEWARDS_ADDRESS per accepted report (R14's control), none to anyone else */
  assert.equal(env.sent.length, 3);
  for (const m of env.sent) assert.equal(m.to, ADDRESS);
});
