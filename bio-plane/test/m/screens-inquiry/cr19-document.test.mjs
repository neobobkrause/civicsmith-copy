/* screens-inquiry CR-19 (T51, the L11 completion round), the `document` screen: R81 (the second "Read it" tab, the comparison with the
 * revision a question cites, promotion R59's `capture_sha`) and R82 (the original-file card, its kind from the format the reading names
 * and its size from `bytes`, extraction R77), over a fake plane on interface-shell's served page. Every expectation is a word read by
 * key (`word`, `says`); sizes and kinds are the words the kit draws, never copied. The browser act `revisioncompare` sends nothing. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok } from "../interface-shell/harness.mjs";
import { createHash } from "node:crypto";
import { open, main, says, word, P, Q, D, SHA, INQUIRY_REFS, inquiryMd, READING, storeWorld } from "./fixtures.mjs";

const at = "/app/document/" + D;
const readingWith = (o) => ok(READING(o));
const SHA_NONE = "9".repeat(64);
const hex = (t) => createHash("sha256").update(t).digest("hex");
const bytesOf = (t) => new TextEncoder().encode(t).length;
/** A copy held by the real acts and revised twice, each revision by a file of its own (`captureupload`, then `promote` on the revision before),
 *  so promotion's `bundlehistory` answers three revisions, each naming the capture its own snapshot holds (promotion R58, R59). The captures
 *  and the revision numbers are read back from that answer, never typed. */
async function revisedCopy() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute"] });
  const { bundle } = await world.recipes.hold(ann, "Minutes", "The council met on Monday.");
  for (const [i, text] of ["Minutes, revised.", "Minutes, final."].entries()) {
    const up = await world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: "Minutes", name: "Minutes" })}`,
      init: { method: "POST", headers: { "content-type": "text/plain" }, body: new TextEncoder().encode(text) } }, ann);
    const doc = up.json.result.document;
    const head = (await ann.read("bundlehistory", { query: { bundle } })).revisions[0];
    const image = await ann.read("image", { query: { id: bundle } });
    const md = image["bundle.md"] + `\nRevision ${i + 2}.\n`;
    const prov = JSON.stringify({ documents: [doc] }, null, 1);
    const dataset = JSON.stringify({ documents: [{ bytes: doc.capture.bytes, locator: doc.locator || "upload", sha256: doc.capture.sha256 }] });
    const files = [{ path: "bundle.md", text: md, bytes: bytesOf(md), sha256: hex(md) }, { path: "data/provenance.json", text: prov, bytes: bytesOf(prov), sha256: hex(prov) },
      { path: "data/dataset.json", text: dataset, bytes: bytesOf(dataset), sha256: hex(dataset) }, { path: doc.file, blobSha: doc.capture.sha256, sha256: doc.capture.sha256, bytes: doc.capture.bytes },
      ...head.files.filter((f) => f.path.startsWith("snapshots/")).map((f) => ({ path: f.path, blobSha: f.sha256, sha256: f.sha256, bytes: f.bytes }))];
    await ann.act("promote", { body: { bundleId: bundle, base: head.sha256, snapKey: "revision-" + (i + 2), meta: { object_type: "information", title: "Minutes", current_state: "collected" },
      files, register: [{ sha256: doc.capture.sha256, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }] } });
  }
  const revisions = (await ann.read("bundlehistory", { query: { bundle } })).revisions;
  const [current, mid] = revisions;
  const { door, session } = world.boot(ann);
  return { bundle, door, session, revisions, current, mid, image: await ann.read("image", { query: { id: bundle } }) };
}
/* the question's basis leg on the copy, pinned to a capture (`extent_capture`) or named by a content row alone (`content_id`) */
const questionWithLeg = (copy, leg) => inquiryMd(P, INQUIRY_REFS, { legs: [{ target: D, role: "supports", grade: "B", extent_page: 2 }] })
  .replace("    extent_page: 2", `    extent_page: 2\n    ${leg}`).replaceAll(D, copy.bundle);
/** The copy's page, its question's bundle as given (the question the copy's backlinks name), and the copy's history (`bundlehistory`), read by the world's door. */
const citing = (copy, questionMd) => open("/app/document/" + copy.bundle, { images: { [copy.bundle]: copy.image, [Q]: { "bundle.md": questionMd } }, boot: { door: copy.door, session: copy.session },
  plane: { backlinks: ok({ ok: true, target: copy.bundle, backlinks: [{ from: Q, from_type: "inquiry", from_title: "Seven days?", rel: "cites" }] }), reading: readingWith() } });
const tabs = (p) => main(p).querySelectorAll('input[type="radio"][name="document-read-tab"]');
const tabOf = (p, value) => main(p).querySelector(`input[type="radio"][name="document-read-tab"][value="${value}"]`);
const writes = (p) => p.requests.filter((r) => r.method === "POST" && r.op !== "subscriptionsignin" && r.op !== "aipathready");

/* ---- R81: the second tab, where a question cites an earlier revision of this copy ---- */

test("R81 a question cites an earlier revision: the document draws the compare tab beside By page; choosing it draws the cited revision beside the current copy by the browser act, and sends nothing", async () => {
  const copy = await revisedCopy();
  assert.equal(copy.revisions.length, 3, "three revisions, by the real acts");
  const p = await citing(copy, questionWithLeg(copy, `extent_capture: ${copy.mid.capture_sha}`));
  assert.equal(tabs(p).length, 2, "two tabs");
  assert.ok(says(main(p), "document.read.tab.page") && says(main(p), "document.read.tab.compare"), "each by its key");
  assert.equal(main(p).querySelector('[data-compare="revisions"]'), null, "no comparison until the tab is chosen");
  tabOf(p, "page").checked = false;
  tabOf(p, "compare").checked = true;
  p.fire(tabOf(p, "compare"), "change");
  await p.settle();
  const act = main(p).querySelector('button[data-act="revisioncompare"][data-a]');
  assert.ok(act, "the compare tab's own act, carrying the pair");
  assert.equal(act.getAttribute("data-a"), String(copy.mid.seq), "the revision the question cites");
  assert.equal(act.getAttribute("data-b"), String(copy.current.seq), "the current copy");
  const before = p.requests.length;
  await p.click(act);
  await p.settle();
  assert.equal(p.requests.length, before, "a browser act sends nothing and reads nothing");
  const panel = main(p).querySelector('[data-compare="revisions"]');
  assert.ok(panel, "the comparison is drawn");
  const [left, right] = panel.querySelectorAll("div");
  assert.ok(says(left, "screen.document.revision.title", { n: String(copy.mid.seq) }) && says(right, "screen.document.revision.title", { n: String(copy.current.seq) }), "the cited revision, then the current copy");
  assert.equal(writes(p).length, 0, "no write");
});

test("R81 control: a question citing the current copy, a capture no revision lists, or a content row alone, draws one tab; a document no question cites draws one tab", async () => {
  const copy = await revisedCopy();
  for (const leg of [`extent_capture: ${copy.current.capture_sha}`, `extent_capture: ${SHA_NONE}`, "content_id: CON-17"]) {
    const p = await citing(copy, questionWithLeg(copy, leg));
    assert.equal(tabs(p).length, 1, `one tab for ${leg}`);
    assert.equal(tabOf(p, "compare"), null, `no compare tab for ${leg}`);
  }
  const none = await citing(copy, inquiryMd(P, INQUIRY_REFS).replaceAll(D, copy.bundle));
  assert.equal(tabs(none).length, 1, "a question that cites nothing: one tab");
  assert.equal(tabOf(none, "compare"), null);
});

/* ---- R82: the original-file card: its kind from the format the reading names, its size from `bytes` ---- */

test("R82 the original-file card draws the kind of the format the reading names and the size from its bytes: 48,000 bytes is 47 KB", async () => {
  const p = await open(at, { plane: { reading: readingWith({ bytes: 48000, content_type: "application/pdf", reading: { content_type: "application/pdf", text_container: "pdf", found: true, text_chars: 624 } }) } });
  const card = main(p).querySelector('[data-card="original"]');
  assert.ok(card, "the card is drawn where the reading states its bytes");
  assert.ok(says(card, "document.read.original.card", { kind: word("document.kind.pdf"), size: word("size.kb", { n: "47" }) }), "the kind by its key, the size in KB");
});

test("R82 a format with no row draws the undetermined kind; a plain-text capture the registry leaves undetermined draws the plain-text kind; under 1 KB and over 1 MB draw their size words", async () => {
  const none = await open(at, { plane: { reading: readingWith({ bytes: 800, content_type: "application/x-rtf", reading: { content_type: "application/x-rtf", text_container: "rtf", found: true } }) } });
  assert.ok(says(main(none).querySelector('[data-card="original"]'), "document.read.original.card", { kind: word("document.kind.undetermined"), size: word("size.small") }),
    "a format with no row, and less than 1 KB");
  const txt = await open(at, { plane: { reading: readingWith({ bytes: 3145728, content_type: "text/plain", reading: { found: true } }) } });
  const card = main(txt).querySelector('[data-card="original"]');
  assert.ok(says(card, "document.read.original.card", { kind: word("document.kind.text"), size: word("size.mb", { n: "3.0" }) }), "a text/plain capture, 3.0 MB");
});

test("R82 control: no bytes, no card, and no size guessed", async () => {
  const p = await open(at, { plane: { reading: readingWith() } });
  assert.equal(main(p).querySelector('[data-card="original"]'), null, "no bytes, no card");
  assert.ok(!says(main(p), "size.small") && !says(main(p), "document.read.original.card", { kind: word("document.kind.pdf"), size: word("size.small") }), "no size is drawn");
});

/* ---- R83: the card's kind from the format the extraction states (K4127), the reading's `text_container` only when none is stated ---- */

test("R83 the card names the kind from the stated format: a reading stating format pdf draws the PDF kind, and a stated format wins over its text_container", async () => {
  const p = await open(at, { plane: { reading: readingWith({ bytes: 48000, format: "pdf", reading: { found: true, text_container: "docx" } }) } });
  const card = main(p).querySelector('[data-card="original"]');
  assert.equal(card.textContent.trim(), word("document.read.original.card", { kind: word("document.kind.pdf"), size: word("size.kb", { n: "47" }) }),
    "the kind of the stated format, the size in KB; text_container is not read when a format is stated");
});

test("R83 control: a stated id with no row draws the undetermined kind, exactly; a reading stating no format falls back to its text_container", async () => {
  const unknown = await open(at, { plane: { reading: readingWith({ bytes: 48000, format: "zzz-unregistered", reading: { found: true } }) } });
  assert.equal(main(unknown).querySelector('[data-card="original"]').textContent.trim(),
    word("document.read.original.card", { kind: word("document.kind.undetermined"), size: word("size.kb", { n: "47" }) }), "an id with no row");
  const fallback = await open(at, { plane: { reading: readingWith({ bytes: 48000, reading: { found: true, text_container: "pdf" } }) } });
  assert.equal(main(fallback).querySelector('[data-card="original"]').textContent.trim(),
    word("document.read.original.card", { kind: word("document.kind.pdf"), size: word("size.kb", { n: "47" }) }), "no format stated: text_container");
});
