/* bias R48: the group's own self-description (membership R110) offered as a declared bias's starting draft, at the
   module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, S, WHY } from "./world.mjs";
import { biasOf } from "../../../src/bias/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const A = "BIAS-2026-0001-a";
const DESC = { kinds: ["issue", "other"], otherKind: "A records clinic", focus: "The records office and its contracts.",
               purpose: "We exist to read what the office publishes and to say plainly what it shows." };

/* Everything this module and its neighbours hold: what a call that writes nothing must leave as it was. */
const tables = (w) => w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .map((r) => JSON.stringify(w.rows(`SELECT * FROM ${r.name}`))).join("\n");

/* The answer to a viewer who is not an active member, and to anyone while no description is held. */
const NONE = (r) => {
  assert.deepEqual({ ...r, stated: undefined }, { ok: true, description: null, offered: false, proposed: false, authored: false,
    statements: [], installed: false, adopted: false, writes: 0, stated: undefined });
  assert.match(r.stated, /no description of the team to start a declared bias from/);
};

async function described() {
  const w = world();
  await w.group("mo", "gone", "out");
  await w.membership.memberAdd({ memberId: "invitee", cover: "cover of invitee", role: "member", capabilities: null, by: "admin" });
  w.membership.memberSet({ memberId: "gone", status: "revoked", by: "admin" });
  return w;
}

test("R48: to an active member it answers the latest self-description (kinds, otherKind, focus, purpose, by, time), labelled as the group's own words and offered as a new bias set's opening text, proposed: true, authored: false, with no statement proposed", async () => {
  const w = await described();
  /* nothing held yet: description null, and it says there is nothing to start from */
  NONE(w.bias.descriptionDraft({ viewer: "member:mo" }));
  const first = w.membership.groupDescriptionSet({ ...DESC, by: "admin" });
  assert.equal(first.ok, true, JSON.stringify(first));
  w.tick();
  const last = w.membership.groupDescriptionSet({ kinds: ["community"], focus: "  The harbour board.  ", purpose: null,
                                                  visibility: "members", by: "second" });
  assert.equal(last.ok, true, JSON.stringify(last));
  for (const viewer of ["member:mo", "member:second", "member:admin", "admin"]) {
    const r = w.bias.descriptionDraft({ viewer });
    assert.deepEqual(r.description, { kinds: ["community"], otherKind: null, focus: "The harbour board.", purpose: null,
      by: "second", at: last.at }, `${viewer}: the latest record, never the history`);
    assert.deepEqual([r.ok, r.offered, r.proposed, r.authored, r.statements], [true, true, true, false, []], viewer);
    assert.equal(r.label, word("bias.label.group_wrote_itself"));
    assert.equal(r.offers, word("bias.opening_text_new"));
    assert.match(r.stated, /a member writes each statement, names its subject in the registry and justifies it/);
    assert.match(r.stated, /adopts it with a member's name on it/);
    assert.equal("history" in r, false, "only the latest record is offered");
  }
  /* each of the four texts and the kinds as written, with its author and time */
  w.tick();
  const full = w.membership.groupDescriptionSet({ ...DESC, by: "admin" });
  assert.deepEqual(w.bias.descriptionDraft({ viewer: "member:mo" }).description,
    { kinds: ["issue", "other"], otherKind: DESC.otherKind, focus: DESC.focus, purpose: DESC.purpose, by: "admin", at: full.at });
  /* the op map holds no arm for it: the service is the method, for its caller (no op was named) */
  assert.equal("biasdescriptiondraft" in w.ops(""), false);
});

test("R48: with no description held (none recorded, or the latest with no kind, focus or purpose) it answers description null and says there is nothing to start from", async () => {
  const w = await described();
  NONE(w.bias.descriptionDraft({ viewer: "member:mo" }));
  assert.equal(w.membership.groupDescriptionSet({ ...DESC, by: "admin" }).ok, true);
  assert.notEqual(w.bias.descriptionDraft({ viewer: "member:mo" }).description, null);
  /* a later record with nothing in it reads as none (membership R109): the group took its description back */
  assert.equal(w.membership.groupDescriptionSet({ kinds: [], by: "admin" }).ok, true);
  NONE(w.bias.descriptionDraft({ viewer: "member:mo" }));
});

test("R48: to any other viewer (the public, a machine credential, a member not active, an unclaimed founder, none) it answers exactly as if none were held, even while the description is public", async () => {
  const w = await described();
  assert.equal(w.membership.groupDescriptionSet({ ...DESC, visibility: "public", by: "admin" }).ok, true);
  assert.notEqual(w.membership.groupDescription({ viewer: "nobody" }).description, null, "the public may read it at membership");
  for (const viewer of [null, undefined, "", "nobody", "public", "class:ai", "class:member", "class:admin", "class:daemon",
                        "token:ai", "member:gone", "member:invitee", "member:never-was", "member:", 42, {}])
    NONE(w.bias.descriptionDraft({ viewer }));
  NONE(w.bias.descriptionDraft());
  NONE(w.bias.descriptionDraft(undefined));
  /* the founder is answered only while the instance is claimed */
  const u = world();
  assert.equal(u.membership.isAdministrator("admin"), false, "unclaimed");
  for (const viewer of ["admin", "member:admin"]) NONE(u.bias.descriptionDraft({ viewer }));
});

test("R48: it writes nothing, installs and adopts nothing (installed false, adopted false, writes 0), never changes a lens in force, and never throws", async () => {
  const w = await described();
  w.set(A, [S("s1")], "adopted");
  assert.equal(w.bias.biasAdopt({ reason: WHY, bundleId: A, author: "admin", identity: "member:admin", viewer: "admin" }).ok, true);
  assert.equal(w.membership.groupDescriptionSet({ ...DESC, by: "admin" }).ok, true);
  await new Promise((res) => setTimeout(res, 0));
  await w.bias.noticesDelivered();
  const told = [];
  w.bias.onLensChange("scheduler", () => told.push(1));
  const lens = w.bias.biasManifest({ viewer: "admin" });
  const fingerprint = w.bias.lensFingerprint();
  const before = tables(w);
  for (const viewer of ["member:mo", "admin", "nobody", "class:ai"]) {
    const r = w.bias.descriptionDraft({ viewer });
    assert.deepEqual([r.installed, r.adopted, r.writes, r.statements], [false, false, 0, []], viewer);
  }
  await new Promise((res) => setTimeout(res, 0));
  await w.bias.noticesDelivered();
  assert.equal(tables(w), before, "no row of any table was written");
  assert.deepEqual(told, [], "no lens notice");
  assert.equal(w.bias.lensFingerprint(), fingerprint);
  assert.deepEqual(w.bias.biasManifest({ viewer: "admin" }), lens, "the lens in force is unchanged");
  assert.equal(w.bias.biasManifest({ viewer: "admin" }).in_force, true);
  /* a set is still written only through R8's machine: the offer proposed no statement, so nothing is held for it */
  assert.equal(w.count("bias_statements"), 1);
  /* never throws: a membership that throws, or answers nonsense, and a failed read, answer as none */
  const healthy = { isAdministrator: () => true, positionalMember: (v) => (v.startsWith("member:") ? v.slice(7) : null), memberFacts: () => ({ status: "active" }),
                    groupDescription: () => ({ description: { ...DESC, by: "admin", at: "t" } }) };
  const down = () => { throw new Error("down"); };
  const over = (m) => {
    const x = world();
    return biasOf({ storage: { sql: x.sql, transactionSync: (fn) => fn() } },
      { record: x.record, membership: { ...healthy, ...m }, promotion: { registerStep() {}, onCommitted() {} }, entities: null });
  };
  for (const viewer of ["member:mo", "admin"]) assert.equal(over({}).descriptionDraft({ viewer }).offered, true, `control: ${viewer}`);
  for (const [broken, viewers] of [
    [{ isAdministrator: down }, ["admin", "member:admin"]],
    [{ positionalMember: down }, ["member:mo"]],
    [{ memberFacts: down }, ["member:mo"]],
    [{ groupDescription: down }, ["member:mo", "admin"]],
    [{ groupDescription: () => null }, ["member:mo", "admin"]],
    [{ groupDescription: () => ({ description: "a string" }) }, ["member:mo", "admin"]],
  ]) {
    const b = over(broken);
    for (const viewer of viewers) NONE(b.descriptionDraft({ viewer }));
  }
  w.sql.exec(`ALTER TABLE group_description RENAME TO gone`);
  NONE(w.bias.descriptionDraft({ viewer: "member:mo" }));
});

test("R48: R32 holds for it — the answer's own text names no place", async () => {
  const PLACE = /oakland|alameda|california|san francisco|berkeley/i;
  const w = await described();
  assert.ok(!PLACE.test(JSON.stringify(w.bias.descriptionDraft({ viewer: "member:mo" }))));
  w.membership.groupDescriptionSet({ kinds: ["catch-all"], by: "admin" });
  const r = w.bias.descriptionDraft({ viewer: "member:mo" });
  assert.ok(!PLACE.test(JSON.stringify({ ...r, description: null })));
});
