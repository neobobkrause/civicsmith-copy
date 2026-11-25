/* T42 (T42-4; N831; K2442, K2480), ported from credentials' t42 (T48-10; split map §6), at the interface:
   `accountUsesOf({owner})`, an in-plane read of one account's uses for a caller that does not own it (ai-use R3, R6,
   R9): answered as R15 (was credentials R60) answers the account's owners, without a viewer and without `keptAway`; a
   malformed owner answered `held: false`; a store that cannot be read answered `unreadable: true`, never a default;
   never a key or its digest; reached by no route (R17, was credentials R62). Every assertion has a negative control
   (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { world } from "./fixture.mjs";

const DEFAULTS = { ask: true, draft: true, run: true, standing: false, explore: "no", enquire: true, read: true, transcribe: true,
                   account: true, suggestions: false };
const KEYS = { ann: "sk-ant-T42-ann-SENTINEL-41d2", project: "sk-ant-T42-project-SENTINEL-9a0e", group: "sk-ant-T42-group-SENTINEL-c37b" };
const digest = (k) => createHash("sha256").update(k).digest("hex");
const noKeptAway = (r) => { const { keptAway, ...rest } = r; return rest; };

/* ann owns P (hidden) with bob joined, and holds her own reference; cy owns S alone, connected through her
   subscription; dee owns D (hidden) with no account; eve holds nothing; second an administrator; the founder claimed.
   P holds a project key with `explore` at `ask`; the group key is held with `standing` on; cy's sign-in has `read`
   off; material limits are set on the group and on P, so R15's answer carries `keptAway` R17's must not. */
async function usesWorld() {
  const w = await world().group("ann", "bob", "cy", "dee", "eve");
  w.project("P", "ann");
  assert.equal(w.join("P", "ann", "bob").ok, true);
  w.project("S", "cy");
  w.project("D", "dee");
  await w.signin("cy");
  assert.equal((await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: KEYS.ann, by: "ann" })).ok, true);
  assert.equal((await w.c.projectKeySet({ project: "P", key: KEYS.project, by: "ann" })).ok, true);
  assert.equal((await w.c.groupKeySet({ key: KEYS.group, by: "admin" })).ok, true);
  for (const [owner, sw, on, by] of [["project:P", "explore", "ask", "ann"], ["group", "standing", true, "admin"],
                                     ["member:cy", "read", false, "cy"]])
    assert.equal(w.c.accountUsesSet({ owner, switch: sw, on, by }).ok, true, `${owner} ${sw}`);
  w.c.aiKeepAwaySet({ on: true, uses: ["explore"], reason: "not yet", by: "admin" });
  w.c.projectAiKeepAwaySet({ project: "P", on: true, uses: ["read"], reason: "sealed papers", by: "ann" });
  return w;
}

/* Each owner with the viewer R15 answers it to. */
const OWNED = [["group", "admin"], ["project:P", "ann"], ["project:S", "cy"], ["project:D", "dee"], ["member:ann", "ann"],
               ["member:cy", "cy"], ["member:eve", "eve"]];

test("R17 (was credentials R62): accountUsesOf answers each account's uses exactly as R15 answers them to its owners, for group, project:<id> and member:<id> (with accounts), without keptAway", async () => {
  const w = await usesWorld();
  for (const [owner, viewer] of OWNED) {
    const r60 = w.c.accountUses({ owner, viewer });
    assert.equal(r60.ok, true, `${owner}: R15 answers its owner`);
    assert.ok(Array.isArray(r60.keptAway), `${owner}: R15 carries keptAway`);
    const r62 = w.c.accountUsesOf({ owner });
    assert.deepEqual(r62, noKeptAway(r60), owner);
    assert.equal("keptAway" in r62, false, `${owner}: no keptAway`);
    assert.equal("unreadable" in r62, false, owner);
  }
  /* the values themselves, so the equality is not of two empty answers */
  assert.deepEqual(w.c.accountUsesOf({ owner: "group" }), { ok: true, owner: "group", held: true, uses: { ...DEFAULTS, standing: true } });
  assert.deepEqual(w.c.accountUsesOf({ owner: "project:P" }),
    { ok: true, owner: "project:P", held: true, kind: "apikey", uses: { ...DEFAULTS, explore: "ask" } });
  assert.deepEqual(w.c.accountUsesOf({ owner: "project:D" }), { ok: true, owner: "project:D", held: false, kind: null, uses: null });
  assert.deepEqual(w.c.accountUsesOf({ owner: "member:ann" }), { ok: true, owner: "member:ann", held: true, uses: DEFAULTS,
    accounts: { reference: { held: true, uses: DEFAULTS }, signin: { held: false, uses: null } } });
  assert.deepEqual(w.c.accountUsesOf({ owner: "member:cy" }), { ok: true, owner: "member:cy", held: true, uses: { ...DEFAULTS, read: false },
    accounts: { reference: { held: false, uses: null }, signin: { held: true, uses: { ...DEFAULTS, read: false } } } });
  assert.deepEqual(w.c.accountUsesOf({ owner: "member:eve" }), { ok: true, owner: "member:eve", held: false, uses: null,
    accounts: { reference: { held: false, uses: null }, signin: { held: false, uses: null } } });
  /* it follows a change as R15 does */
  w.c.accountUsesSet({ owner: "project:P", switch: "explore", on: "yes", by: "ann" });
  assert.equal(w.c.accountUsesOf({ owner: "project:P" }).uses?.explore, "yes");
  assert.deepEqual(w.c.accountUsesOf({ owner: "project:P" }), noKeptAway(w.c.accountUses({ owner: "project:P", viewer: "ann" })));
  /* the group key before any act on it: held false, its defaults, as R15 */
  const fresh = await world().group();
  assert.deepEqual(fresh.c.accountUsesOf({ owner: "group" }), noKeptAway(fresh.c.accountUses({ owner: "group", viewer: "admin" })));
  assert.deepEqual(fresh.c.accountUsesOf({ owner: "group" }), { ok: true, owner: "group", held: false, uses: DEFAULTS });
  /* negative control: different accounts answer differently, so the comparison distinguishes them */
  assert.notDeepEqual(w.c.accountUsesOf({ owner: "project:P" }).uses, w.c.accountUsesOf({ owner: "group" }).uses);
  assert.notDeepEqual(noKeptAway(w.c.accountUses({ owner: "member:cy", viewer: "cy" })), w.c.accountUsesOf({ owner: "member:ann" }));
});

test("R17 (was credentials R62): accountUsesOf takes no viewer: it answers where R15 refuses every caller but the owners, including a hidden project the founder cannot see, and a viewer passed changes nothing", async () => {
  const w = await usesWorld();
  /* negative control: R15 refuses these callers */
  assert.equal(w.c.accountUses({ owner: "project:P", viewer: "admin" }).ok, false, "the founder cannot see hidden P");
  assert.equal(w.c.accountUses({ owner: "project:P", viewer: "eve" }).ok, false);
  assert.equal(w.c.accountUses({ owner: "member:ann", viewer: "admin" }).ok, false);
  assert.equal(w.c.accountUses({ owner: "group", viewer: "ann" }).ok, false);
  assert.equal(w.c.accountUses({ owner: "group", viewer: null }).ok, false);
  /* R17 answers each with no viewer at all */
  for (const [owner, viewer] of OWNED) {
    const r62 = w.c.accountUsesOf({ owner });
    assert.deepEqual(r62, noKeptAway(w.c.accountUses({ owner, viewer })), owner);
    assert.equal(r62.ok, true, owner);
    /* a viewer passed is not read: neither a stranger nor a machine changes the answer */
    for (const v of ["eve", "class:ai", "admin"]) assert.deepEqual(w.c.accountUsesOf({ owner, viewer: v }), r62, `${owner} ${v}`);
  }
  assert.equal(w.c.accountUsesOf({ owner: "project:P" }).held, true, "the hidden project's account is read");
  assert.deepEqual(w.c.accountUsesOf(), { ok: true, owner: null, held: false, uses: null }, "called with nothing");
});

test("R17 (was credentials R62): an owner not spelled as R14's (group, project:<id>, member:<id>) is answered held: false, uses: null", async () => {
  const w = await usesWorld();
  for (const owner of [null, undefined, "", "organisation", "Group", "group ", "project", "project:", "member", "member:",
                       "ann", "member:member:ann", "member:class:ai", "class:ai", 42, {}, ["group"]]) {
    const r = w.c.accountUsesOf({ owner });
    assert.deepEqual(r, { ok: true, owner: typeof owner === "string" ? owner : null, held: false, uses: null }, JSON.stringify(owner));
  }
  /* negative control: the well-spelled owners nearest them are read, held or not */
  assert.equal(w.c.accountUsesOf({ owner: "group" }).held, true);
  assert.equal(w.c.accountUsesOf({ owner: "member:ann" }).held, true);
  assert.ok("accounts" in w.c.accountUsesOf({ owner: "member:nobody" }), "a well-spelled member is read, holding none");
  assert.equal(w.c.accountUsesOf({ owner: "project:nowhere" }).kind, null, "a well-spelled project is read, holding none");
});

test("R17 (was credentials R62): when the account cannot be read it answers held: null, uses: null, unreadable: true, never a default value, and never throws", async () => {
  for (const [owner, table] of [["group", "group_key"], ["project:P", "project_accounts"], ["member:ann", "account_references"],
                                ["member:cy", "subscription_connections"]]) {
    const w = await usesWorld();
    /* negative control: readable before the store breaks */
    const before = w.c.accountUsesOf({ owner });
    assert.equal(before.held, true, owner);
    assert.equal("unreadable" in before, false, owner);
    w.sql.exec(`DROP TABLE ${table}`);
    let r;
    assert.doesNotThrow(() => { r = w.c.accountUsesOf({ owner }); }, owner);
    assert.deepEqual(r, { ok: true, owner, held: null, uses: null, unreadable: true }, owner);
  }
  /* the group key with no row reads its defaults (R15); with no table it reads none: no switch is on */
  const w = await world().group();
  assert.deepEqual(w.c.accountUsesOf({ owner: "group" }).uses, DEFAULTS);
  w.sql.exec(`DROP TABLE group_key`);
  assert.equal(w.c.accountUsesOf({ owner: "group" }).uses, null);
  /* a malformed owner is answered as malformed, store or no store */
  assert.deepEqual(w.c.accountUsesOf({ owner: "organisation" }), { ok: true, owner: "organisation", held: false, uses: null });
});

test("R17 (was credentials R62): accountUsesOf never carries a key or a digest of one, and writes nothing", async () => {
  const w = await usesWorld();
  const before = w.snapshot();
  const said = JSON.stringify([...OWNED.map(([owner]) => w.c.accountUsesOf({ owner })),
                               w.c.accountUsesOf({ owner: "member:bob" }), w.c.accountUsesOf({ owner: "nonsense" })]);
  const sealed = JSON.stringify(w.rows(`SELECT sealed, iv FROM group_key UNION ALL SELECT sealed, iv FROM project_accounts`));
  /* negative control: the sentinels are in the store, sealed, and the test can find a sentinel where one is */
  assert.ok(sealed.length > 20 && !sealed.includes(KEYS.group));
  assert.ok(JSON.stringify({ k: KEYS.ann }).includes(KEYS.ann));
  for (const k of Object.values(KEYS)) {
    assert.ok(!said.includes(k), k);
    assert.ok(!said.includes(digest(k)), `${k}'s digest`);
  }
  for (const r of w.rows(`SELECT sealed, iv FROM group_key UNION ALL SELECT sealed, iv FROM project_accounts UNION ALL SELECT sealed, iv FROM account_references`))
    for (const v of [r.sealed, r.iv]) if (typeof v === "string" && v.length > 8) assert.ok(!said.includes(v), "a sealed value");
  assert.ok(!/sealed|"iv"|"key"|secret/.test(said), "no key field of any kind");
  assert.equal(w.snapshot(), before, "it writes nothing");
});

test("R17 (was credentials R62): no route reaches accountUsesOf: the ops map serves no accountusesof, while R15's accountuses is routed", async () => {
  const w = await usesWorld();
  const ops = w.ops("owner=project:P&viewer=ann");
  /* negative control: R15's read is routed */
  assert.equal(typeof ops.accountuses, "function");
  assert.equal(ops.accountuses().ok, true);
  for (const name of Object.keys(ops)) assert.ok(!/usesof/i.test(name), name);
  assert.equal(ops.accountusesof, undefined);
  assert.equal(Object.hasOwn(ops, "accountUsesOf"), false);
});

test("R17 R27 (was credentials R62, R16) (K2620) a revoked member's member:<id> is answered held: false, uses: null, as R15 refuses every viewer for it, though the reference survives R27; a live member's account still answers held", async () => {
  const w = await usesWorld();
  await w.enrol("fay");
  assert.equal((await w.c.accountReferenceSet({ member: "fay", kind: "apikey", secret: "sk-ant-T42-fay-SENTINEL", by: "fay" })).ok, true);
  /* negative control: before her revocation fay's account answers held, as R15 answers her */
  assert.equal(w.c.accountUsesOf({ owner: "member:fay" }).held, true);
  assert.deepEqual(w.c.accountUsesOf({ owner: "member:fay" }), noKeptAway(w.c.accountUses({ owner: "member:fay", viewer: "fay" })));
  assert.equal(w.m.memberSet({ memberId: "fay", status: "revoked", by: "admin" }).ok, true);
  /* the reference survives R27 (its reach unchanged), and R15 now refuses fay herself */
  assert.ok(w.row(`SELECT member_id FROM account_references WHERE member_id='fay'`), "the reference is kept");
  assert.equal(w.c.accountUses({ owner: "member:fay", viewer: "fay" }).ok, false);
  const before = w.snapshot();
  const r = w.c.accountUsesOf({ owner: "member:fay" });
  assert.deepEqual(r, { ok: true, owner: "member:fay", held: false, uses: null,
    accounts: { reference: { held: false, uses: null }, signin: { held: false, uses: null } } });
  assert.ok(!JSON.stringify(r).includes("sk-ant-T42-fay-SENTINEL"));
  assert.equal(w.snapshot(), before, "it writes nothing");
  /* negative control: a live member's account still answers held */
  assert.equal(w.c.accountUsesOf({ owner: "member:ann" }).held, true);
  assert.deepEqual(w.c.accountUsesOf({ owner: "member:ann" }).uses, DEFAULTS);
  /* a roster that cannot be read is no answer of "not revoked": it fails closed */
  w.m.memberFacts = () => { throw new Error("roster unreadable"); };
  assert.deepEqual(w.c.accountUsesOf({ owner: "member:ann" }), { ok: true, owner: "member:ann", held: null, uses: null, unreadable: true });
  assert.equal(w.c.accountUsesOf({ owner: "group" }).held, true, "the team's account asks no roster");
});
