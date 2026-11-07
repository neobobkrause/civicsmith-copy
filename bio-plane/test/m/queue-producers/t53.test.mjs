/* T53 (DEC-462; K5456; K5478, K5480; DEC-471, DEC-475; K5571 (2)): R56, R57 the signing-key item, one for each member, listing
   each new key with the day it was added; R60 a stopped AI account, to whoever may clear it; R61 re-testing turned off, to the
   administrators of the paying account. credentials is real (world.mjs); ai-accounts and ai-use are their own real modules over
   their own test worlds (their `fixture.mjs`), reached through the one read this module calls, never a hand-built answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso, said } from "./world.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { world as accountsWorld } from "../ai-accounts/fixture.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";
import { standard } from "../ai-use/fixture.mjs";

const kind = (r, k) => r.items.filter((i) => i.kind === k);
const ids = (r, k = "signer-self-registered") => kind(r, k).map((i) => i.id).sort();
const H = 3600000;

function admins(zone = "UTC") {
  const w = world({ publishSchedule: { groupZone: () => zone } });
  w.member("ada", { role: "admin" }); w.member("cy", { role: "admin" }); w.member("alice"); w.member("bob");
  return w;
}

test("R56: one item for each member listing each new key with its added day, four options for two keys; one 'I know' removes that key from both administrators' items; the last clears it for all", () => {
  const w = admins();
  w.signer("AAAAKEYA", "alice", { comment: "laptop", added: iso(NOW - 2 * H) });
  w.signer("AAAAKEYB", "alice", { comment: "phone", added: iso(NOW - H) });
  const want = ["OBLIGATION::signer-self-registered::alice"];
  assert.deepEqual(ids(w.read("ada")), want);
  assert.deepEqual(ids(w.read("cy")), want, "one item for each of two administrators");
  const it = byId(w.read("ada"))[want[0]];
  assert.deepEqual(it.basis.keys, [{ key_b64: "AAAAKEYA", comment: "laptop", added: iso(NOW - 2 * H) },
                                   { key_b64: "AAAAKEYB", comment: "phone", added: iso(NOW - H) }], "earliest first, with their added");
  assert.equal(it.basis.keys_more, 0, "0 when none, never absent");
  assert.deepEqual(it.age, { state: "determined", since: iso(NOW - 2 * H), ms: 2 * H }, "aged from the earliest added");
  assert.deepEqual(it.options.map((o) => [o.id, o.key]), [["signerset", "AAAAKEYA"], ["signerknown", "AAAAKEYA"], ["signerset", "AAAAKEYB"], ["signerknown", "AAAAKEYB"]]);
  assert.deepEqual(ids(w.read("alice")), [], "not the member herself");
  assert.equal(w.credentials.signerKnown({ keyB64: "AAAAKEYA", viewer: "member:ada" }).ok, true);
  for (const who of ["ada", "cy"]) {
    const left = byId(w.read(who))[want[0]];
    assert.deepEqual(left.basis.keys.map((k) => k.key_b64), ["AAAAKEYB"], `${who}: the known key left, the other stays`);
    assert.deepEqual(left.options.map((o) => o.id), ["signerset", "signerknown"]);
  }
  assert.equal(w.credentials.signerKnown({ keyB64: "AAAAKEYB", viewer: "member:cy" }).ok, true);
  assert.deepEqual(ids(w.read("ada")), [], "the last clears it for all");
  assert.deepEqual(ids(w.read("cy")), []);
});

test("R56 control: a later key joins the same item; an administrator-registered key, a revoked key and the registrant's own feed raise nothing; two members make two items; the founder's key makes an item for the other administrators", () => {
  const w = admins();
  w.signer("AAAAKEYA", "alice", { added: iso(NOW - 2 * H) });
  const before = byId(w.read("ada"))["OBLIGATION::signer-self-registered::alice"];
  w.signer("AAAAKEYC", "alice", { added: iso(NOW - H) });
  const after = byId(w.read("ada"))["OBLIGATION::signer-self-registered::alice"];
  assert.equal(after.id, before.id, "same id");
  assert.deepEqual(after.basis.keys.map((k) => k.key_b64), ["AAAAKEYA", "AAAAKEYC"], "the later key joined it");
  w.signer("AAAAKEYD", "bob", { origin: "admin" });
  w.signer("AAAAKEYE", "bob", { status: "revoked" });
  assert.deepEqual(ids(w.read("ada")), ["OBLIGATION::signer-self-registered::alice"], "an administrator's registration and a revoked key raise nothing");
  w.signer("AAAAKEYF", "bob");
  assert.deepEqual(ids(w.read("ada")), ["OBLIGATION::signer-self-registered::alice", "OBLIGATION::signer-self-registered::bob"], "two members, two items");
  w.signer("AAAAKEYG", "ada");
  assert.deepEqual(ids(w.read("cy")), ["OBLIGATION::signer-self-registered::ada", "OBLIGATION::signer-self-registered::alice", "OBLIGATION::signer-self-registered::bob"]);
  assert.ok(!ids(w.read("ada")).includes("OBLIGATION::signer-self-registered::ada"), "an administrator's own keys are not told to her");
  assert.deepEqual(byId(w.read("cy"))["OBLIGATION::signer-self-registered::ada"].basis.raised_to, ["cy"]);
  w.run(`UPDATE signers SET known_by='cy' WHERE member_id='bob'`);
  assert.ok(!ids(w.read("ada")).includes("OBLIGATION::signer-self-registered::bob"), "all known: gone");
  w.signer("AAAAKEYH", "bob");
  assert.ok(ids(w.read("ada")).includes("OBLIGATION::signer-self-registered::bob"), "a key registered after all were known raises it again");
});

test("R56: 21 keys list 20, keys_more is 1 and the 21st has no option; after one of the 20 is known the 21st is listed and keys_more is 0", () => {
  const w = admins();
  const key = (n) => `AAAAKE${String(n).padStart(2, "0")}`;
  for (let n = 1; n <= 21; n += 1) w.signer(key(n), "alice", { added: iso(NOW - (30 - n) * H) });
  let it = byId(w.read("ada"))["OBLIGATION::signer-self-registered::alice"];
  assert.equal(it.basis.keys.length, 20);
  assert.equal(it.basis.keys_more, 1);
  assert.ok(!it.options.some((o) => o.key === key(21)), "the 21st has no option");
  assert.equal(it.options.length, 40);
  assert.equal(w.credentials.signerKnown({ keyB64: key(3), viewer: "member:ada" }).ok, true);
  it = byId(w.read("ada"))["OBLIGATION::signer-self-registered::alice"];
  assert.ok(it.basis.keys.some((k) => k.key_b64 === key(21)), "the 21st is listed");
  assert.equal(it.basis.keys_more, 0);
});

/* R57 (K5456; R43, R36): the summary states the member and how many new keys by key, `.summary` for one and `.other` for
   more; each key's line is the word list's `.key` filled with the local day it was added (`date.daymonth`), else `.key.undated`
   with no zone held, then `.key.comment` only when the key carries a comment. No sentence is composed here. */
const L = (k) => `queue.signer-self-registered.${k}`;
const dm = (d, m) => word("date.daymonth", { day: d, month: word(`date.month.${m}`) });

test("R57: a key added 23:30 local on the 4th, zone known, reads the 4th; the summary states one key, then two in its other form; with no zone held the line says so with no date", () => {
  /* 23:30 on the 4th of August in Los Angeles is 06:30 UTC on the 5th; NOW is in the same year */
  const added = "2026-08-05T06:30:00Z";
  const w = admins("America/Los_Angeles");
  w.member("sp", { role: "member", handle: "sparky" });
  w.signer("AAAAKEYA", "sp", { added, comment: "laptop" });
  let it = byId(w.read("ada"))["OBLIGATION::signer-self-registered::sp"];
  assert.deepEqual([it.summary_key, it.summary], [L("summary"), word(L("summary"), { member: "sparky" })], "one key: the one form");
  assert.deepEqual([it.lines[0].day, it.lines[0].text_key], ["2026-08-04", L("key")], "the 4th, the local day, never the UTC 5th");
  assert.equal(it.lines[0].text, `${word(L("key"), { date: dm(4, "august") })} ${word(L("key.comment"), { comment: "laptop" })}`);
  assert.ok(!it.lines[0].text.includes(dm(5, "august")), "never the UTC day");
  w.signer("AAAAKEYB", "sp", { added: iso(NOW) });
  it = byId(w.read("ada"))["OBLIGATION::signer-self-registered::sp"];
  assert.deepEqual([it.summary_key, it.summary], [L("summary.other"), word(L("summary.other"), { member: "sparky", count: 2 })], "two keys: the other form, the count a fill");
  assert.equal(it.lines.length, 2);
  const bare = admins(null);
  bare.signer("AAAAKEYA", "alice", { added, comment: "laptop" });
  const [undated] = byId(bare.read("ada"))["OBLIGATION::signer-self-registered::alice"].lines;
  assert.deepEqual([undated.day, undated.day_state, undated.text_key], [null, "undetermined", L("key.undated")], "no zone: no date");
  assert.equal(undated.text, `${word(L("key.undated"))} ${word(L("key.comment"), { comment: "laptop" })}`);
});

test("R57 control: a key with no comment reads the base line with no blank; no line holds an unfilled placeholder or a doubled space; the word is the list's 'added', not 'made'", () => {
  const w = admins("America/Los_Angeles");
  w.signer("AAAAKEYA", "alice", { added: "2026-08-05T06:30:00Z" });
  const [line] = byId(w.read("ada"))["OBLIGATION::signer-self-registered::alice"].lines;
  assert.deepEqual([line.comment, line.comment_key, line.text], [null, null, word(L("key"), { date: dm(4, "august") })], "the base line alone");
  assert.ok(!/\{[a-z_]+\}|  /.test(line.text), line.text);
});

test("R56, R57 (R43): a member the rows do not name reads the unnamed word, .summary.unnamed for one key and .summary.unnamed.other for two, the count a fill", () => {
  const signers = (n) => Array.from({ length: n }, (_, i) => ({ key_b64: `AAAAKEY${i}`, member_id: "", registered_by: "not recorded", comment: null,
    status: "active", origin: "self", added: iso(NOW - i * H) }));
  for (const n of [1, 2]) {
    const w = world({ credentials: { signerList: () => ({ ok: true, signers: signers(n) }) } });
    w.member("ada", { role: "admin" });
    const [it] = kind(w.read("ada"), "signer-self-registered");
    const key = `queue.signer-self-registered.summary.unnamed${n === 1 ? "" : ".other"}`;
    assert.deepEqual([it.summary_key, it.summary, it.fills.count, it.basis.keys.length],
      [key, word(key, { count: n }), n, n], String(n));
  }
});

test("R56 control: a key with no comment carries comment null, and no item text holds a sentence the word list does not", () => {
  const w = admins();
  w.signer("AAAAKEYA", "alice", { added: iso(NOW) });
  const it = byId(w.read("ada"))["OBLIGATION::signer-self-registered::alice"];
  assert.equal(it.lines[0].comment, null);
  assert.deepEqual([it.summary, it.detail], [word("queue.signer-self-registered.summary", { member: "alice" }), said("queue.signer-self-registered.detail")]);
});

/* ai-accounts' own world: a team gateway account, flagged by a call the platform's credits paid (its R45). */
async function stopped() {
  const aw = await accountsWorld().group("ann");
  aw.a.registerGatewayStore("fixture-root", { create: async () => "gw-1", put: async () => true, exists: async () => true });
  const t = await aw.a.accountSet({ owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "gateway", by: "admin" });
  await aw.a.gatewayKeyAttest({ account_id: t.account_id, by: "admin" });
  aw.a.accountSwitch({ account_id: t.account_id, on: true, by: "admin" });
  const flag = () => aw.a.gatewayServedCheck({ account_id: t.account_id, record: { gateway_id: "gw-1", own_key_served: false, platform_credits_used: true } });
  return { aw, account: t.account_id, flag };
}
const viaAccounts = (aw) => ({ aiAccounts: { creditsStopsOpen: (x) => aw.a.creditsStopsOpen(x) } });

test("R60: a credits-paid call makes one ai-credits-stop item for the team's administrators naming the account, time and cause; a second flagged call makes no second; aicreditsclear removes it", async () => {
  const { aw, account, flag } = await stopped();
  assert.equal(flag().flagged, true);
  const w = world(viaAccounts(aw));
  w.member("admin", { role: "admin" }); w.member("ann");
  const items = kind(w.read("admin"), "ai-credits-stop");
  assert.equal(items.length, 1);
  const [it] = items;
  const entry = aw.a.creditsStopsOpen({ viewer: "member:admin" })[0];
  assert.equal(it.id, `OBLIGATION::ai-credits-stop::${entry.key}`, "keyed by the entry's own key");
  assert.deepEqual([it.class, it.subject.id, it.basis.cause, it.summary_key, it.door], ["OBLIGATION", account, "credits", "screen.aiproviders.stands.credits", "aicreditsclear"]);
  assert.ok(it.summary.includes(account), "names the account");
  assert.ok(!("disposition" in it), "queue gives the disposition (its R12)");
  flag();
  assert.equal(kind(w.read("admin"), "ai-credits-stop").length, 1, "a second flagged call makes no second");
  assert.equal(aw.a.aiCreditsClear({ account_id: account, by: "admin" }).ok, true);
  assert.deepEqual(kind(w.read("admin"), "ai-credits-stop"), [], "cleared: gone");
});

test("R60 control: a viewer who may not clear it sees none; removing the account removes the item; an unflagged account has none; a read that throws is named ai-accounts in facts.failed", async () => {
  const { aw, account, flag } = await stopped();
  const w = world(viaAccounts(aw));
  w.member("admin", { role: "admin" }); w.member("ann");
  assert.deepEqual(kind(w.read("admin"), "ai-credits-stop"), [], "unflagged: none");
  flag();
  assert.deepEqual(kind(w.read("ann"), "ai-credits-stop"), [], "a member who may not clear it");
  assert.equal(kind(w.read("admin"), "ai-credits-stop").length, 1);
  assert.equal(aw.a.accountRemove({ account_id: account, by: "admin" }).ok, true);
  assert.deepEqual(kind(w.read("admin"), "ai-credits-stop"), [], "removed: gone");
  const bad = world({ aiAccounts: { creditsStopsOpen: () => { throw new Error("down"); } } });
  bad.member("admin", { role: "admin" });
  const r = bad.read("admin");
  assert.deepEqual(r.facts.failed.filter((f) => f.feed === "ai-credits-stop"), [{ feed: "ai-credits-stop", reason: "threw", read: "ai-accounts" }]);
});

test("R61: switching re-testing off makes one retesting-off item for each administrator of the paying account, naming who and when; switching off again makes no second; switching on removes it", async () => {
  const uw = await standard();
  const at = "2026-08-31T10:00:00Z";
  assert.equal(uw.u.retestSet({ owner: "group", on: false, by: "admin", at }).ok, true);
  const w = world({ aiUse: { retestingOff: (x) => uw.u.retestingOff(x) } });
  w.member("admin", { role: "admin" }); w.member("second", { role: "admin" }); w.member("ann");
  for (const who of ["admin", "second"]) {
    const items = kind(w.read(who), "retesting-off");
    assert.equal(items.length, 1, who);
    const [it] = items;
    const entry = uw.u.retestingOff({ viewer: `member:${who}` }).off[0];
    assert.equal(it.id, `OBLIGATION::retesting-off::${entry.key}`);
    assert.deepEqual([it.summary, it.summary_key, it.detail, it.door, it.basis.turned_off_by, it.basis.turned_off_at],
      [word("queue.retesting-off.summary"), "queue.retesting-off.summary", word("queue.retesting-off.summary"), "airetestset", entry.turned_off_by, at]);
    assert.equal(it.fills.who, word("member.founder.unnamed"), "who turned it off (the founder, by her word, R53), as a fill beside the word");
    assert.ok(it.fills.when.length > 0, "and when");
    assert.ok(!("disposition" in it), "queue gives the disposition (its R12)");
  }
  uw.u.retestSet({ owner: "group", on: false, by: "second", at: "2026-08-31T11:00:00Z" });
  assert.equal(kind(w.read("admin"), "retesting-off").length, 1, "off again: no second");
  uw.u.retestSet({ owner: "group", on: true, by: "admin" });
  assert.deepEqual(kind(w.read("admin"), "retesting-off"), [], "on: gone");
});

test("R61 control: a member who does not administer the account sees none; a read that throws is named ai-use in facts.failed", async () => {
  const uw = await standard();
  uw.u.retestSet({ owner: "group", on: false, by: "admin" });
  const w = world({ aiUse: { retestingOff: (x) => uw.u.retestingOff(x) } });
  w.member("admin", { role: "admin" }); w.member("bob");
  assert.deepEqual(kind(w.read("bob"), "retesting-off"), []);
  const bad = world({ aiUse: { retestingOff: () => { throw new Error("down"); } } });
  bad.member("admin", { role: "admin" });
  assert.deepEqual(bad.read("admin").facts.failed.filter((f) => f.feed === "retesting-off"), [{ feed: "retesting-off", reason: "threw", read: "ai-use" }]);
});
