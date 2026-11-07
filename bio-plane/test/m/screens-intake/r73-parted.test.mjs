/* screens-intake attempt 4 (screens-intake-rounds' found mark, PR 888, 7 Nov): R73, R74 (DEC-500) on the parted path. A 120 MB PDF is past the page's own figure, so it
 * goes in parts at once; the owner's real `captureuploadbegin` refuses it `TOO_LARGE` with its size and the PDF kind's limit (`capture` R119, the figure
 * `format-registry` quotes; the test reads it from the owner's own answer, never types it). The refusal is drawn exactly as a one-request upload's: the size and the limit, "Nothing was added or read.", then R74 (b)'s way in. Entered by pressing
 * the act over the real served page and the real store; nothing here is scripted. Words by key (R26). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, main, fill, press, idle, word } from "./page.mjs";

const MIB = 1048576;
const SIZE = 120 * MIB;
const FILLED = (file) => ({ "ci-file": file, "ci-how-made": true, "ci-where": "City hall", "ci-what": "The packet." });
const patterned = (size) => { const b = Buffer.alloc(size, 7); for (let i = 0; i < size; i += 4096) b.writeUInt32LE((i / 4096) >>> 0, i); return b; };
async function drive(p, until, rounds = 3000) {
  for (let i = 0; i < rounds && !until(); i++) { await p.clock.tick(1); await idle(p); }
  await idle(p);
}
const failedLine = (p) => main(p).querySelector('[data-parted="failed"]');

test("R73 R74 (DEC-500) a 120 MB PDF sent in parts and refused by the real begin is drawn with its size and the 100 MB limit, 'Nothing was added or read.' and the member's own part; nothing is sent, aborted or filed", async () => {
  const t = await members({ mai: ["contribute", "create_projects"] });
  /* the owner's own answer to a begin of this file: its refusal and figures, which the screen must draw */
  const asked = await t.mai.act("captureuploadbegin", { body: { sha256: "0".repeat(64), bytes: SIZE, statement: "How you got it: I made it", name: "packet.pdf", type: "application/pdf" } })
    .then((a) => ({ answer: { json: a } }), (e) => e);
  const real = (asked.answer && asked.answer.json && (asked.answer.json.result || asked.answer.json)) || {};
  assert.equal(real.ok, false);
  assert.equal(real.reason, "TOO_LARGE", "the real begin refuses a 120 MB PDF");
  assert.equal(real.size, SIZE);
  assert.equal(real.bound, 100 * MIB, "the PDF limit R72 shows (100 MB)");
  const file = new File([patterned(SIZE)], "packet.pdf", { type: "application/pdf" });
  const p = await openWorld("/app/capture/file", { world: t.world, as: t.mai });
  fill(p, FILLED(file));
  await press(p, "captureupload");
  await drive(p, () => failedLine(p) !== null);
  assert.equal(p.byOp("captureupload").length, 0, "past the page's figure: nothing is sent in one request");
  assert.equal(p.byOp("captureuploadbegin").length, 1, "the real begin was asked");
  const line = failedLine(p);
  assert.ok(line, "the refusal is drawn under the act row");
  const said = line.textContent;
  assert.ok(said.includes(word("screen.capture.refusal.toolarge.size", { size: word("size.mb", { n: (SIZE / MIB).toFixed(1) }), bound: word("size.mb", { n: (real.bound / MIB).toFixed(1) }) })), said);
  assert.ok(said.includes(word("screen.capture.refusal.toolarge.nothing_read")), "nothing was added or read");
  assert.ok(said.includes(word("screen.capture.refusal.toolarge.part")), "R74 (b): the member's own part");
  assert.ok(!said.includes(word("screen.capture.refusal.toolarge.register")), "R74 (a) is for an address a register lists, never an upload");
  assert.ok(!said.includes(word("refusal.TOO_LARGE")), "not the bare address sentence");
  assert.equal(p.byOp("captureuploadpart").length, 0, "no part sent");
  assert.equal(p.byOp("captureuploadabort").length, 0, "nothing begun, so nothing aborted");
  assert.equal(p.byOp("promote").length, 0, "nothing filed");
});
