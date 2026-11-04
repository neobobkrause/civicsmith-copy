/* R154 (T53; K5562, K5563): the two names `member-roster` added at T53, `adminProposalCancel` (its R89) and
   `adminRemovals` (its R85), are delegates of Membership, and `membershipOps` answers their ops `adminproposalcancel`
   and `adminremovals` beside the others. Over one store the delegate and the module behind it answer the same: a read
   equal, a write read back by the module, a refusal byte for byte. Refusals are compared by value, never by sentence. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { Membership } from "../../../src/membership/index.mjs";
import * as roster from "../../../src/member-roster/index.mjs";

const NAMES = ["adminProposalCancel", "adminRemovals"];

/* The founder, two more administrators and an ordinary member, over one store. */
async function team() {
  const w = await world().group("ann");
  const third = await w.enrol("third", "admin");
  assert.equal(third.ok, true, JSON.stringify(third));
  return w;
}

test("R154 adminProposalCancel and adminRemovals are delegates of Membership, its own functions, not member-roster's borrowed", () => {
  for (const name of NAMES) {
    assert.equal(typeof roster.Members.prototype[name], "function", `${name} is a public name of Members`);
    assert.equal(typeof Membership.prototype[name], "function", name);
    assert.notEqual(Membership.prototype[name], roster.Members.prototype[name], `${name} is not borrowed`);
    assert.equal(Object.hasOwn(Membership.prototype, name), true, `${name} is Membership's own`);
  }
});

test("R154 over one store adminRemovals through the delegate reads what member-roster reads, before and after a removal", async () => {
  const w = await team();
  const m = w.m, r = w.m.members;
  const asks = [[{ by: "ann" }], [{ by: "admin" }], [{ by: "admin", limit: 1 }], [{ by: "nobody" }], [{ by: null }], [{}], []];
  for (const args of asks) assert.deepEqual(m.adminRemovals(...args), r.adminRemovals(...args), `empty ${JSON.stringify(args)}`);
  assert.deepEqual(m.adminRemovals({ by: "ann" }), { ok: true, removals: [], limit: 200, truncated: false });
  /* a removal by the module is read through the delegate */
  assert.equal(r.adminRemove({ memberId: "third", by: "admin", reason: "gone" }).ok, true);
  const read = m.adminRemovals({ by: "ann" });
  assert.deepEqual(read.removals.map((x) => [x.target, x.how, x.deciders, x.reasons]), [["third", "founder", ["admin"], ["gone"]]]);
  for (const args of asks) assert.deepEqual(m.adminRemovals(...args), r.adminRemovals(...args), `after ${JSON.stringify(args)}`);
  /* control: a caller who may not read is answered the module's empty page, not the removal */
  assert.deepEqual(m.adminRemovals({ by: "third" }), { ok: true, removals: [] });
});

test("R154 over one store adminProposalCancel's refusals are member-roster's byte for byte, and its write is read back by the module", async () => {
  const w = await team();
  const m = w.m, r = w.m.members;
  const p = await m.memberAdd({ memberId: "cee", cover: "c", role: "admin", by: "second" });
  assert.equal(p.reason, "CONSENSUS_REQUIRED");
  /* each refusal in R89's order, through both, byte for byte */
  const refusals = [
    [{ memberId: "cee", by: "ann" }, "NOT_AN_ADMIN"], [{ memberId: "cee", by: null }, "NOT_AN_ADMIN"],
    [{ memberId: "nobody", by: "second" }, "NO_SUCH_MEMBER"], [{ memberId: "ann", by: "second" }, "NO_WAITING_PROPOSAL"],
    [{ memberId: "cee", by: "third" }, "NOT_YOUR_PROPOSAL"],
  ];
  for (const [args, code] of refusals) {
    const a = m.adminProposalCancel(args), b = r.adminProposalCancel(args);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${code} ${JSON.stringify(args)}`);
    assert.equal(a.code, code);
  }
  assert.deepEqual(r.memberFacts("cee").status, "proposed", "a refusal writes nothing");
  /* the proposer cancels through the delegate; the module reads it back */
  const done = m.adminProposalCancel({ memberId: "cee", by: "second" });
  assert.deepEqual([done.ok, done.memberId, done.status, done.proposal, done.by], [true, "cee", "revoked", "cancelled", "second"]);
  assert.equal(r.memberFacts("cee").status, "revoked");
  assert.deepEqual(r.endorsementsOwed({ by: "admin" }), []);
  /* a repeat through the delegate is the module's refusal of the cancelled proposal, byte for byte */
  assert.equal(JSON.stringify(m.adminProposalCancel({ memberId: "cee", by: "second" })),
               JSON.stringify(r.adminProposalCancel({ memberId: "cee", by: "second" })));
  assert.equal(m.adminProposalCancel({ memberId: "cee", by: "second" }).code, "NO_WAITING_PROPOSAL");
});

test("R154 membershipOps answers adminproposalcancel and adminremovals beside its own ops, as member-roster's ops answer", async () => {
  const w = await team();
  const ops = w.ops("by=admin&viewer=admin");
  for (const name of ["adminproposalcancel", "adminremovals", "projectinvite", "memberlist"]) assert.equal(typeof ops[name], "function", name);
  /* adminremovals: the stamp's reader, and a limit from the query */
  assert.equal(w.m.adminRemove({ memberId: "third", by: "admin", reason: "gone" }).ok, true);
  const rosterRead = (q) => roster.membersOps(w.m, new URL(`http://x/?${q}`), null, {}).adminremovals();
  for (const q of ["by=ann", "by=admin&limit=1", "by=nobody", ""])
    assert.deepEqual(await w.ops(q).adminremovals(), await rosterRead(q), q);
  assert.deepEqual((await w.ops("by=ann").adminremovals()).removals.map((x) => x.target), ["third"]);
  /* adminproposalcancel: a refusal as the module's op gives it, then the proposer's cancel read back */
  await w.m.memberAdd({ memberId: "dee", cover: "c", role: "admin", by: "second" });
  const refusedHere = await w.ops("by=ann", { memberId: "dee" }).adminproposalcancel();
  const refusedThere = await roster.membersOps(w.m, new URL("http://x/?by=ann"), { memberId: "dee" }, {}).adminproposalcancel();
  assert.equal(JSON.stringify(refusedHere), JSON.stringify(refusedThere));
  assert.equal(refusedHere.code, "NOT_AN_ADMIN");
  /* the stamp wins over a caller's own `by` in the body (D-136) */
  assert.equal((await w.ops("by=ann", { memberId: "dee", by: "second" }).adminproposalcancel()).code, "NOT_AN_ADMIN");
  const done = await w.ops("by=second", { memberId: "dee" }).adminproposalcancel();
  assert.deepEqual([done.ok, done.proposal], [true, "cancelled"]);
  assert.equal(w.m.members.memberFacts("dee").status, "revoked");
});
