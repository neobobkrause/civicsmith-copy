/* capture F1 (5 Nov 2026; coordinator ruling for member-upload R117) over R76: a capture whose only receipt is an attachment a member brought in by email
   (provenance's EMAIL_ATTACHMENT_VIA, its R84) was received, never fetched, so gradeNoteOf answers no acquire note for it; at the module's interface, over
   the fixture's provenance (`recordReceipt`, `receiptsOfCapture`, `registerHolds` as provenance answers). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, sha } from "./fixture.mjs";
import { ACQUIRE_GRADE_NOTE } from "../../../src/capture/index.mjs";
import { EMAIL_ATTACHMENT_VIA } from "../../../src/provenance/index.mjs";

const T = "2026-11-05T12:00:00Z";
const received = (f, captureSha, via, address) =>
  f.c.provenance.recordReceipt({ address, addressNorm: address, captureSha, retrieved: T, via, retrievalLocator: address });

test("F1 R76: a capture whose only receipt is via email-attachment answers note null; one with a fetched receipt beside it answers the acquire note", async () => {
  const f = fresh({});
  const msg = sha("the message she forwarded"), att = sha("the attachment it carried"), both = sha("an attachment also fetched");
  received(f, att, EMAIL_ATTACHMENT_VIA, `email:${msg}!0`);
  assert.deepEqual(await f.c.gradeNoteOf({ captureSha: att }), { captureSha: att, note: null }, "received by email attachment, never fetched");
  /* control: the same route beside a fetched receipt is not every receipt received, so the note stands */
  received(f, both, EMAIL_ATTACHMENT_VIA, `email:${msg}!1`);
  received(f, both, "direct", "https://a.example/agenda.pdf");
  assert.equal((await f.c.gradeNoteOf({ captureSha: both })).note, ACQUIRE_GRADE_NOTE, "a fetched receipt keeps the acquire note");
});
