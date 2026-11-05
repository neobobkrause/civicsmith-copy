/* mail-door R5 (and R3's and R6's controls after a bring-in): a waiting message filed through capture's real
   `emailCapture` (capture R116) with her statement. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, addressFor, plain, sha, T0 } from "./fixture.mjs";
import { MAIL_CHECKS } from "../../../src/mail-door/checks.mjs";
import { DECLARED_OPS, mailDoorOps } from "../../../src/mail-door/index.mjs";
import { declaredOpHolds } from "../../declared-ops.mjs";


async function waiting(text = "a message") {
  const env = fresh();
  const to = await addressFor(env.d, "ann");
  const bytes = plain(text);
  const r = await env.d.receiveMail({ raw: bytes, envelope_to: to, now: T0 });
  return { ...env, to, bytes, id: r.id };
}

test("R5 before capture is asked: the member-session fence, then NO_SUCH_MAIL for another member's message, each writing nothing", async () => {
  const { d, id, everything, b, bytes } = await waiting();
  const before = everything();
  assert.equal((await d.mailBringIn({ id, statement: "mine", by: "token:member" })).reason, "MEMBER_SESSION_REQUIRED");
  const other = await d.mailBringIn({ id, statement: "mine", by: "member:bo" });
  assert.deepEqual([other.reason, other.check], ["NO_SUCH_MAIL", MAIL_CHECKS.NO_SUCH_MAIL.check]);
  assert.equal((await d.mailBringIn({ id: "MAIL-none", statement: "mine", by: "member:ann" })).reason, "NO_SUCH_MAIL");
  assert.deepEqual(everything(), before);
  assert.ok(b.held.has(`bio/mail/${sha(bytes)}`), "the bytes stay after a refused bring-in");
});

test("R5 a bring-in files one capture whose digest equals the raw bytes' (headers included), its receipt carrying the statement; the row reads brought_in", async () => {
  const { d, id, bytes, cap, b } = await waiting();
  const r = await d.mailBringIn({ id, statement: "forwarded to me by the clerk's office", by: "member:ann" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.capture.sha256, sha(bytes));
  assert.ok(cap.provenance.receipts.some((x) => x.captureSha === sha(bytes)));
  const row = d.mailWaiting({ viewer: "member:ann" }).mail[0];
  assert.deepEqual([row.status, row.capture.sha256], ["brought_in", sha(bytes)]);
  /* control: the bytes are gone from the private key after a successful bring-in */
  assert.equal(b.held.has(`bio/mail/${sha(bytes)}`), false);
});

test("R5 a blank statement is refused MAIL_NO_STATEMENT (capture's C-118.12, relayed) and the row still waits; a second bring-in answers MAIL_ALREADY_IN", async () => {
  const { d, id, b, bytes } = await waiting();
  for (const statement of [undefined, "", "   ", "x".repeat(2001)]) {
    const r = await d.mailBringIn({ id, statement, by: "member:ann" });
    assert.deepEqual([r.ok, r.reason, r.check], [false, "MAIL_NO_STATEMENT", "C-118.12"], JSON.stringify(statement));
  }
  assert.equal(d.mailWaiting({ viewer: "member:ann" }).mail[0].status, "waiting");
  assert.ok(b.held.has(`bio/mail/${sha(bytes)}`));
  const first = await d.mailBringIn({ id, statement: "mine", by: "member:ann" });
  assert.equal(first.ok, true);
  const again = await d.mailBringIn({ id, statement: "mine", by: "member:ann" });
  assert.deepEqual([again.reason, again.check, again.existed, again.capture.sha256], ["MAIL_ALREADY_IN", MAIL_CHECKS.MAIL_ALREADY_IN.check, true, sha(bytes)]);
});

test("R3 control: after bring-in the row reads brought_in and the list still shows it, with its capture; R6's clearing never removes it", async () => {
  const { d, id } = await waiting();
  await d.mailBringIn({ id, statement: "mine", by: "member:ann" });
  const r = await d.clearWaitingMail({ now: T0 + 40 * 86400000 });
  assert.equal(r.cleared, 0);
  const row = d.mailWaiting({ viewer: "member:ann" }).mail[0];
  assert.deepEqual([row.id, row.status, row.days_left], [id, "brought_in", null]);
  assert.equal((await d.mailDelete({ id, by: "member:ann" })).reason, "MAIL_ALREADY_IN");
});

test("R12 mail-door declares mailbringin, held at the door: its requires alone raise no refusal naming a field, each missing one is refused naming it", async () => {
  const call = async (given) => {
    const { d, id } = await waiting();
    const fields = "id" in given ? { ...given, id } : given;
    const q = new URLSearchParams({ op: "mailbringin", viewer: "member:ann", by: "member:ann" });
    return await mailDoorOps(d, new URL("http://x/?" + q), fields).mailbringin();
  };
  await declaredOpHolds({ op: "mailbringin", declaration: DECLARED_OPS.mailbringin, call,
    refusedNaming: (a, field) => !!a && ((field === "id" && a.reason === "NO_SUCH_MAIL") || (field === "statement" && a.reason === "MAIL_NO_STATEMENT")),
    values: { statement: "forwarded to me" }, same: (x, y) => x && y && x.ok === y.ok && x.reason === y.reason });
});

/* F1 (surface-declarations R17, BOB's grade, PR 418): mailbringin is graded as captureupload is, read from its owner's
   declaration (store-assembly), not copied: weight undetermined, never reasoned. */
test("F1 mailbringin is declared with captureupload's grade, undetermined", async () => {
  const { DECLARED_OPS: OWNER_DECLARED } = await import("../../../src/store-assembly/owner-ops.mjs");
  assert.equal(DECLARED_OPS.mailbringin.weight, OWNER_DECLARED.captureupload.weight);
  assert.equal(DECLARED_OPS.mailbringin.weight, "undetermined");
});
