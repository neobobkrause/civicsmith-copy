/* member-upload R117 (T53; N824; C9 (2); `acquisition` R136): a message's attachments are filed as its members by the container-member job. The seam: the
   `member` rows `emailCapture` registers inside its filing are run, each as the job runs it, through `acquisition`'s real `fileMember` over the same record and
   evidence store, and each attachment is filed as a capture of its own. At the module's interface: capture's fixture (record-core, the evidence bucket,
   provenance's stated contract), `mail-reader`'s real reading of generated messages, and test-support's job registrar. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bucket, sha } from "../capture/fixture.mjs";
import { fileMember } from "../../../src/acquisition/index.mjs";
// fixtures-contract: store-assembly job-registrar
import { jobRegistrarStub } from "../../job-registrar-stub.mjs";
import { withAttachments, attachmentPart, eml, STANDARD } from "../mail-reader/fixtures.mjs";

const te = new TextEncoder();
const STATEMENT = "forwarded to the team address by the clerk's office on Tuesday";
const AT = "2026-10-28T12:00:00Z";
const PDF = te.encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
const CSV = te.encode("a,b\n1,2\n3,4\n");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89]);

const setup = () => {
  const b = bucket();
  const f = fresh({ evidence: b, env: { INSTANCE_NAME: "inst", VERSION: "9.9.9" } });
  const j = jobRegistrarStub();
  // fixtures-contract: store-assembly job-registrar
  f.c.registerJob = j.registerJob;
  f.c.armJobs = j.armJobs;
  /* the store the job hands `fileMember`: the same record, evidence store and provenance the filing wrote to, and the same registrar */
  const store = { core: f.core, provenance: f.c.provenance, env: { INSTANCE_NAME: "inst", VERSION: "9.9.9" }, registerJob: j.registerJob };
  /* the member job: each queued `member` row run once through `fileMember`, as the row's detail names it */
  const runMembers = async (by) => {
    const out = [];
    for (const row of j.rows().filter((x) => x.kind === "member")) {
      const d = row.detail;
      out.push(await fileMember(store, { container: d.container, container_kind: d.container_kind, index: d.index, by, cls: "member", member: true, project: d.project, within: d.within }));
    }
    return out;
  };
  return { ...f, b, j, store, runMembers };
};

test("R117: an email with a PDF, a CSV and an inline image registers three `member` rows, and the member job files three members, each held under its own digest with its own reading row, the receipt naming the message", async () => {
  const w = setup();
  const bytes = withAttachments([
    attachmentPart("agenda.pdf", "application/pdf", PDF),
    attachmentPart("rows.csv", "text/csv", CSV),
    attachmentPart("seal.png", "image/png", PNG, { inline: true, cid: "seal@x" }),
  ]);
  const r = await w.c.emailCapture({ bytes, statement: STATEMENT, by: "member:ann", at: AT });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const msha = sha(bytes);
  assert.equal(w.j.rows().filter((x) => x.kind === "member").length, 3);
  const out = await w.runMembers("member:ann");
  assert.deepEqual(out.map((x) => [x.ok, x.outcome]), [[true, "filed"], [true, "filed"], [true, "filed"]], JSON.stringify(out.map((x) => x.reason || x.code)));
  assert.deepEqual(out.map((x) => x.sha256).sort(), [sha(PDF), sha(CSV), sha(PNG)].sort());
  for (const [i, x] of out.entries()) {
    assert.equal(x.document.capture.method, "emailed-attachment");
    assert.deepEqual([x.document.capture.actor_class, x.document.capture.actor], ["member", "member:ann"]);
    assert.equal(x.document.container.message_sha256, msha);
    assert.equal(x.document.locator, `email:${msha}!${x.index}`);
    assert.ok(w.b.held.has(`bio/captures/${x.sha256}`), `attachment ${i} is held under its own digest`);
  }
  assert.equal(out.find((x) => x.document.container.name_stated === "seal.png").document.container.index, 2, "an inline image the body refers to is also an attachment");
  /* each member is read separately: one reading row of its own, beside the message's */
  assert.deepEqual(w.j.rows().filter((x) => x.kind === "reading").map((x) => x.sha).sort(), [msha, sha(PDF), sha(CSV), sha(PNG)].sort());
  /* each attachment's receipt is the message's route, `email-attachment`, never a fetch */
  for (const x of out) {
    const rows = w.c.provenance.receiptsOfCapture({ captureSha: x.sha256 }).rows;
    assert.deepEqual(rows.map((y) => [y.address, y.via]), [[`email:${msha}!${x.index}`, "email-attachment"]]);
  }
  /* a second run of the same rows files nothing again */
  const again = await w.runMembers("member:ann");
  assert.deepEqual(again.map((x) => x.outcome), ["already_held", "already_held", "already_held"]);
});

test("R117: an attachment refused by its kind is not filed and gets its state, while the message and the other attachments are filed; control: a message with no attachment registers no `member` row", async () => {
  const w = setup();
  const EXE = (() => { const b = new Uint8Array(512); b[0] = 0x4d; b[1] = 0x5a; b[60] = 0x80; b.set(te.encode("PE\0\0"), 0x80); return b; })();
  const bytes = withAttachments([attachmentPart("agenda.pdf", "application/pdf", PDF), attachmentPart("tool.exe", "application/octet-stream", EXE), attachmentPart("rows.csv", "text/csv", CSV)]);
  const r = await w.c.emailCapture({ bytes, statement: STATEMENT, by: "member:ann", at: AT });
  assert.equal(r.ok, true);
  const out = await w.runMembers("member:ann");
  const byName = Object.fromEntries(out.map((x) => [x.index, x]));
  assert.deepEqual([byName[0].outcome, byName[1].outcome, byName[2].outcome], ["filed", "not_filed", "filed"]);
  assert.equal(byName[1].code, "FILE_TYPE_REFUSED");
  assert.equal(w.b.held.has(`bio/captures/${sha(EXE)}`), false, "a refused attachment is not stored");
  assert.ok(w.b.held.has(`bio/captures/${sha(bytes)}`), "the message itself is filed");
  const c = setup();
  const plain = eml([...STANDARD], "Please find the request below.\r\n");
  assert.equal((await c.c.emailCapture({ bytes: plain, statement: STATEMENT, by: "member:ann", at: AT })).ok, true);
  assert.equal(c.j.rows().filter((x) => x.kind === "member").length, 0);
});

/* What R117 states and this module's code does not yet do (the mark stays): */
test.todo("R117: a filed attachment is graded as its message, received and never fetched: capture R76's gradeNoteOf answers null for a capture whose only receipt is `email-attachment` (today RECEIVED_VIAS, capture/index.mjs:108, lists doorbell, upload and email only, so it answers the acquire note)");
test.todo("R117: in the assembled store the `member` rows emailCapture registers are run by the container-member job (store-jobs R24, was store-assembly R102), so an attachment is never `waiting` for ever");
test.todo("R120: on PLATFORM's study driver, three uploaders with reading running, every acceptance within the Add budget; control: one uploader alone");
