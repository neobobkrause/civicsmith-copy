/* C94 (fix round 2), queue-producers' part: a member is named by handle, the founder included, and the founder never by her id.
   `#memberName` serves R14's key, R33's author and R46-R48's `who`; R44's inviter reads through it. The founder's id is `admin`; her
   handle is the one she holds (member-roster R144); a founder with none is `member.founder.unnamed`'s word, never `admin`. Any other
   member with no handle is named by her id as R46 states (the word list holds no key for her: the job's QUESTION). Every sentence is
   checked against `word`'s key (K3810). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, NOW, iso } from "./world.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const claim = (w, handle = null) => {
  w.run(`INSERT INTO credentials (role, salt, hash, iterations, updated) VALUES ('admin','s','h',1,?)`, iso(NOW));
  if (handle) assert.equal(w.membership.founderHandleSet({ handle, by: "admin" }).ok, true);
};
const kind = (r, k) => r.items.filter((i) => i.kind === k);

test("R14, R53 (C94): a key the founder registered names her by her handle; with no handle held, by member.founder.unnamed's word; never admin", () => {
  const w = world();
  w.member("ada", { role: "admin", handle: "ada" });
  claim(w, "sparky");
  w.signer("KEY-F", "admin", { comment: "my laptop" });
  const [it] = kind(w.read("ada"), "signer-self-registered");
  assert.equal(it.summary, word("queue.signer-self-registered.summary", { member: "sparky" }));
  assert.doesNotMatch(it.summary, /\badmin\b/);
  const bare = world();
  bare.member("ada", { role: "admin", handle: "ada" });
  claim(bare);
  bare.signer("KEY-F", "admin", { comment: "my laptop" });
  const [none] = kind(bare.read("ada"), "signer-self-registered");
  assert.equal(none.summary, word("queue.signer-self-registered.summary", { member: word("member.founder.unnamed") }));
  assert.doesNotMatch(none.summary, /\badmin\b/i);
});

test("R14, R53 (C94): control: an ordinary member's handle is named as itself, and one with no handle keeps R46's fallback, her id", () => {
  const w = world();
  w.member("ada", { role: "admin", handle: "ada" }); w.member("m-q81xz02", { handle: null }); w.member("bo", { handle: "bobby" });
  w.signer("KEY-1", "bo", { comment: "c" }); w.signer("KEY-2", "m-q81xz02", { comment: "c" });
  const by = Object.fromEntries(kind(w.read("ada"), "signer-self-registered").map((i) => [i.basis.keys[0].key_b64, i]));   /* R56: one item for each member */
  assert.equal(by["KEY-1"].summary, word("queue.signer-self-registered.summary", { member: "bobby" }));
  assert.equal(by["KEY-2"].summary, word("queue.signer-self-registered.summary", { member: "m-q81xz02" }));
});

test("R33, R53 (C94): a wizard version the founder submitted names her by her handle, or by the founder word, never admin", () => {
  const sub = (author) => ({ script: "WIZ-a", version: 1, owner: "olga", name: "File", author, submitted_at: iso(NOW - 1000), project: null });
  const page = (entries) => ({ ok: true, cursor: null, truncated: false, entries });
  const w = world({ wizardScripts: { submittedFor: () => page([sub("admin")]) } });
  w.member("olga", { role: "admin", handle: "olga" });
  claim(w, "sparky");
  const [it] = kind(w.read("olga"), "wizard-approval-requested");
  assert.equal(it.summary, word("queue.wizard-approval-requested.summary", { author: "sparky", name: "File" }));
  const bare = world({ wizardScripts: { submittedFor: () => page([sub("admin")]) } });
  bare.member("olga", { role: "admin", handle: "olga" });
  claim(bare);
  assert.equal(kind(bare.read("olga"), "wizard-approval-requested")[0].summary,
    word("queue.wizard-approval-requested.summary", { author: word("member.founder.unnamed"), name: "File" }));
});

test("R48, R53 (C94): an expertise the founder declared names her by the founder word while she holds no handle, never admin; by her handle once she holds one; control: a member with no handle keeps her id", () => {
  const draw = (setup) => {
    const w = world();
    w.member("ada", { role: "admin", handle: "ada" });
    claim(w);
    setup(w);
    return kind(w.read("ada", "member:ada"), "expertise-confirmation-owed");
  };
  const [bare] = draw((w) => assert.equal(w.membership.expertiseDeclare({ memberId: "admin", label: "CPA" }).ok, true));
  assert.doesNotMatch(bare.summary, /\badmin\b/i);
  assert.match(bare.summary, new RegExp(word("member.founder.unnamed")), "the founder word names her");
  assert.deepEqual(bare.fills, {}, "no handle, so no `who` fill (B7)");
  const [held] = draw((w) => { assert.equal(w.membership.founderHandleSet({ handle: "sparky", by: "admin" }).ok, true);
    assert.equal(w.membership.expertiseDeclare({ memberId: "admin", label: "CPA" }).ok, true); });
  assert.match(held.summary, /sparky/); assert.doesNotMatch(held.summary, /\badmin\b/i);
  assert.deepEqual(held.fills, { who: "sparky" });
  const [other] = draw((w) => { w.member("m-k3p9", { handle: null }); assert.equal(w.membership.expertiseDeclare({ memberId: "m-k3p9", label: "CPA" }).ok, true); });
  assert.match(other.summary, /m-k3p9/, "control: only the founder's id is withheld; R46's fallback stands for another member");
});
