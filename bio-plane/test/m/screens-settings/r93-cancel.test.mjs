/* R93 (3) (T53; K5563; `member-roster` R89): on a `proposed` administrator's panel `adminproposalcancel` is drawn for the founder
   and for the administrator who proposed it (`invited_by`), and for no one else; it sends `{memberId}`, asks no reason, and the
   roster and `recovery` are read again. The team is `seed-members`' `team()`: rosa proposed kim, whom the founder and lu are still
   to endorse. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, open, panelOf, SCREENS } from "./kit.mjs";
import { team, reauth, rosterOf } from "./seed-members.mjs";

const btn = (n, op) => acts(n).filter((b) => b.attrs["data-act"] === op);
const status = async (as, id) => (await as.read("memberlist")).members.find((m) => m.member_id === id);

test("R93 (3) the founder and the proposer are drawn Cancel on a waiting proposal, which posts adminproposalcancel {memberId}, no reason, and reads the roster and recovery again", async () => {
  const t = await team();
  assert.equal((await status(t.founder, "kim")).invited_by, "rosa", "rosa proposed kim");
  for (const as of [t.founder, t.rosa]) {
    const a = await open("members", { world: t.w, as });
    assert.equal(btn(panelOf(a.tree, "kim"), "adminproposalcancel").length, 1, `${as.handle || "the founder"} is drawn Cancel on kim's panel`);
    assert.equal(btn(a.tree, "adminproposalcancel").length, 1, "on no other row");
  }
  // what the screen sends: `{memberId}`, by POST, with no reason asked (the owner's answer through the plane waits on
  // `surface-declarations` R14, which stamps `by` for the act; this module's part is what it draws and sends)
  await reauth(t.rosa);
  const a = await open("members", { world: t.w, as: t.rosa });
  const r = await a.press("adminproposalcancel", { data: { member: "kim" }, reason: null });
  assert.equal(r.asked, false, "no reason is asked");
  assert.deepEqual([r.sent[0].op, r.sent[0].body, r.sent[0].method], ["adminproposalcancel", { memberId: "kim" }, "POST"]);
  // after it, the roster and the recovery step are read again (the screen's reads `roster` and `recovery`)
  const members = SCREENS.find((s) => s.id === "members"), spec = members.acts.find((x) => x.op === "adminproposalcancel");
  const reads = members.reads({ me: await t.founder.read("whoami") });
  assert.deepEqual(spec.rereads, ["roster", "recovery"]);
  assert.deepEqual([reads.roster.op, reads.recovery.op], ["memberlist", "adminrecoverystep"]);
});

test("R93 (3) control: an administrator who did not propose is drawn Endorse and no Cancel; a member who does not administer neither; a proposal no longer waiting draws neither", async () => {
  const t = await team();
  const lu = await open("members", { world: t.w, as: t.lu });
  assert.equal(btn(panelOf(lu.tree, "kim"), "adminendorse").length, 1, "lu is drawn Endorse");
  assert.equal(btn(lu.tree, "adminproposalcancel").length, 0, "and no Cancel");
  const dev = await open("members", { world: t.w, as: t.dev });
  assert.equal(btn(dev.tree, "adminproposalcancel").length + btn(dev.tree, "adminendorse").length, 0);
  // kim's proposal withdrawn (`member-roster` R89: the row reads `revoked`, `invitation: "withdrawn"`): neither act is drawn on it
  const rows = (await t.founder.read("memberlist")).members.map((m) => (m.member_id === "kim" ? { ...m, status: "revoked", invitation: "withdrawn" } : m));
  const gone = await open("members", { world: t.w, as: t.founder, table: rosterOf(rows) });
  assert.equal(btn(gone.tree, "adminproposalcancel").length + btn(panelOf(gone.tree, "kim"), "adminendorse").length, 0);
});
