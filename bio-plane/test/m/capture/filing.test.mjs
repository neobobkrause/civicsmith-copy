/* capture R115, R116: filing a captured document. `titleOf` names it by one rule; `promoteDocument` composes it into an
 * Information bundle at `collected`, writing only through the `promote` step the caller hands in `cs`. Both are tested at
 * this module's interface (`filing.mjs`), with a recording `cs`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { titleOf, promoteDocument } from "../../../src/capture/filing.mjs";

const NOW = Date.parse("2026-11-25T10:20:30.456Z");
const hex = (t) => createHash("sha256").update(Buffer.from(String(t), "utf8")).digest("hex");
const utf8 = (t) => Buffer.byteLength(String(t), "utf8");

/* titleOf's `cs`: words by key, each call recorded; `date` marks what it formats. */
function wordsCs({ untitledWeb = "{site} on {date}", untitled = "Untitled capture" } = {}) {
  const asked = [];
  return {
    asked,
    now: () => NOW,
    date: (iso) => `<${iso}>`,
    w(key, fills) {
      asked.push({ key, fills });
      if (key === "document.untitled.web") return untitledWeb.replace("{site}", fills.site).replace("{date}", fills.date.html);
      if (key === "screen.held.untitled") return untitled;
      return key;
    },
  };
}

test("R115: its own title comes first, the reading's before the document's, white space folded", () => {
  const cs = wordsCs();
  const doc = { title: "The document's title", capture: { file_name: "minutes.pdf" } };
  assert.equal(titleOf(cs, { reading: { title: "  Council\n  minutes\t3 March " }, doc, address: "https://c.example/m.pdf" }),
    "Council minutes 3 March");
  assert.equal(titleOf(cs, { reading: {}, doc, address: "https://c.example/m.pdf" }), "The document's title");
  assert.equal(titleOf(cs, { reading: { title: "   " }, doc, address: "https://c.example/m.pdf" }), "The document's title");
  assert.deepEqual(cs.asked, [], "no word is read when the document names itself");
});

test("R115: else its file name: an upload's own, then the name the source states, then the name the member stated", () => {
  const cs = wordsCs();
  const address = "https://c.example/files/download";
  /* an upload's own file name wins over a stated one */
  assert.equal(titleOf(cs, { fileName: " street.png ", doc: { capture: { file_name: "other.png" } }, address }), "street.png");
  /* a name the source states that differs from the address's last segment */
  assert.equal(titleOf(cs, { doc: { capture: { file_name: "Budget 2026.pdf" } }, address }), "Budget 2026.pdf");
  /* a name equal to the last segment is the source's when the response kept a content-disposition header */
  const disposed = { capture: { file_name: "download", transport: { http_headers: [["Content-Disposition", "attachment; filename=download"]] } } };
  assert.equal(titleOf(cs, { doc: disposed, address }), "download");
  /* else the name the member stated with an upload */
  assert.equal(titleOf(cs, { doc: { name_stated: { text: "photo of the notice" } }, address }), "photo of the notice");
});

test("R115: an address's last segment is never taken as a name", () => {
  const cs = wordsCs();
  /* acquisition answers `file_name` as the last segment when the source states none: with no content-disposition it is the address's */
  const address = "https://www.c.example/agendas/agenda%20item%207.pdf";
  const doc = { capture: { file_name: "agenda item 7.pdf", transport: { http_headers: [["content-type", "application/pdf"]] } } };
  assert.equal(titleOf(cs, { doc, address }), "www.c.example on <2026-11-25T10:20:30Z>");
  /* the stated name is passed over for the member's own words, never for the segment */
  assert.equal(titleOf(cs, { doc: { ...doc, name_stated: { text: "Agenda" } }, address }), "Agenda");
});

test("R115: else its host and the day captured; with no host, the untitled words", () => {
  const cs = wordsCs({ untitledWeb: "A page from {site}, {date} &amp; &lt;kept&gt;", untitled: "Untitled &quot;capture&quot;" });
  assert.equal(titleOf(cs, { doc: {}, address: "https://news.example/a/b/" }),
    "A page from news.example, <2026-11-25T10:20:30Z> & <kept>", "plain text: the word's entities are decoded");
  assert.deepEqual(cs.asked[0], { key: "document.untitled.web", fills: { site: "news.example", date: { html: "<2026-11-25T10:20:30Z>" } } });
  assert.equal(titleOf(cs, { doc: {}, address: "not an address" }), 'Untitled "capture"');
  assert.equal(titleOf(cs, { address: "" }), 'Untitled "capture"', "no document handed is no name of its own");
  assert.equal(cs.asked.at(-1).key, "screen.held.untitled");
  /* the day is the clock's; with no `now` handed, the wall clock's */
  const { now, ...noClock } = wordsCs();
  const today = new Date().toISOString().slice(0, 10);
  assert.match(titleOf(noClock, { doc: {}, address: "https://x.example/" }), new RegExp(`^x\\.example on <${today}T`));
});

test("R115: every arm is cut at 200 characters", () => {
  const long = "word ".repeat(80);
  const cut = long.replace(/\s+/g, " ").trim().slice(0, 200);
  assert.equal(cut.length, 200);
  assert.equal(titleOf(wordsCs(), { reading: { title: long }, address: "https://c.example/" }), cut);
  assert.equal(titleOf(wordsCs(), { fileName: long, address: "https://c.example/" }), cut);
  assert.equal(titleOf(wordsCs(), { doc: { name_stated: { text: long } }, address: "https://c.example/" }), cut);
  assert.equal(titleOf(wordsCs({ untitledWeb: "x".repeat(250) }), { address: "https://c.example/" }).length, 200);
  assert.equal(titleOf(wordsCs({ untitled: "y".repeat(250) }), { address: "" }).length, 200);
  assert.equal(titleOf(wordsCs(), { reading: { title: "z".repeat(200) }, address: "" }), "z".repeat(200), "200 is kept whole");
});

/* promoteDocument's `cs`: each op recorded with what it was sent; `allocid` and `promote` answer as scripted. */
function recordingCs({ minted = { ok: true, id: "INFO-2026-0007" }, promoted = { ok: true, bundleId: null, reading_pending: false } } = {}) {
  const calls = [];
  return {
    calls,
    now: () => NOW,
    digest: async (t) => hex(t),
    async call(op, req) {
      calls.push({ op, req });
      if (op === "allocid") return typeof minted === "function" ? minted(req) : minted;
      if (op === "promote") return typeof promoted === "function" ? promoted(req) : promoted;
      throw new Error(`unexpected op ${op}`);
    },
  };
}
const SHA = "a".repeat(64), ATT = "c".repeat(64);
const oneDoc = (extra = {}) => ({ file: `snapshots/${SHA}.pdf`, locator: "https://c.example/m.pdf",
  capture: { sha256: SHA, bytes: 5120, encoding: "binary" }, reading: { title: "Minutes" }, text_units: [{ text: "Item 1" }], ...extra });
const fm = (text, key) => { const m = text.match(new RegExp(`^${key}: (.*)$`, "m")); return m ? m[1] : undefined; };

test("R116: a one-part document is composed as an Information bundle at collected under a minted id", async () => {
  const cs = recordingCs();
  const doc = oneDoc({ attestations: [{ file: `attestations/${ATT}.tsr`, sha256: ATT, bytes: 900 }] });
  const filed = await promoteDocument(cs, { doc, title: "Council Minutes: 3 March!", locator: "https://c.example/m.pdf", project: "PRJ-2026-0001-roads" });
  assert.deepEqual(filed, { bundleId: "INFO-2026-0007-council-minutes-3-march", readingPending: false });

  assert.deepEqual(cs.calls.map((c) => c.op), ["allocid", "promote"]);
  assert.deepEqual(cs.calls[0].req, { query: { prefix: "INFO", year: "2026" } });
  const body = cs.calls[1].req.body;
  assert.equal(body.bundleId, "INFO-2026-0007-council-minutes-3-march");
  assert.equal(body.base, null);
  assert.match(body.snapKey, /^20261125T102030Z_[0-9a-f]{8}$/);
  assert.deepEqual(body.meta, { object_type: "information", title: "Council Minutes: 3 March!", current_state: "collected",
    created: "2026-11-25T10:20:30Z", last_updated: "2026-11-25T10:20:30Z" });

  const byPath = new Map(body.files.map((f) => [f.path, f]));
  assert.deepEqual([...byPath.keys()], ["bundle.md", "data/provenance.json", "data/dataset.json", doc.file, `attestations/${ATT}.tsr`]);
  for (const p of ["bundle.md", "data/provenance.json", "data/dataset.json"]) {
    const f = byPath.get(p);
    assert.equal(f.sha256, hex(f.text), `${p}'s digest is of its text`);
    assert.equal(f.bytes, utf8(f.text), `${p}'s bytes are its UTF-8 length`);
  }
  const dataset = byPath.get("data/dataset.json").text;
  assert.equal(dataset, `{"documents":[{"bytes":5120,"locator":"https://c.example/m.pdf","sha256":"${SHA}"}]}`, "canonical: keys sorted, no space");
  const md = byPath.get("bundle.md").text;
  assert.equal(fm(md, "id"), body.bundleId);
  assert.equal(fm(md, "schema"), "information@2");
  assert.equal(fm(md, "object_type"), "information");
  assert.equal(fm(md, "current_state"), "collected");
  assert.equal(fm(md, "title"), JSON.stringify("Council Minutes: 3 March!"));
  assert.equal(fm(md, "project"), "PRJ-2026-0001-roads");
  assert.equal(fm(md, "content_hash"), `sha256:${hex(dataset)}`);
  assert.match(md, /^source:\n {2}locator: "https:\/\/c\.example\/m\.pdf"$/m);
  assert.deepEqual(JSON.parse(byPath.get("data/provenance.json").text), { documents: [doc] }, "the document whole, its reading kept");
  assert.deepEqual(byPath.get(doc.file), { path: doc.file, blobSha: SHA, sha256: SHA, bytes: 5120 });
  assert.deepEqual(byPath.get(`attestations/${ATT}.tsr`), { path: `attestations/${ATT}.tsr`, blobSha: ATT, sha256: ATT, bytes: 900 });

  assert.deepEqual(body.register, [{ sha256: SHA, path: doc.file, encoding: "binary", bytes: 5120 },
                                   { sha256: ATT, path: `attestations/${ATT}.tsr`, encoding: "binary", bytes: 900 }]);
});

test("R116: no project, no project line; the slug is cut at 40 and begins and ends with a letter or digit", async () => {
  const cs = recordingCs();
  const filed = await promoteDocument(cs, { doc: oneDoc(), title: "--- An extremely long title, for the slug: it is cut here-and not later ---" });
  const slug = filed.bundleId.slice("INFO-2026-0007-".length);
  assert.equal(slug, "an-extremely-long-title-for-the-slug-it");
  assert.ok(slug.length <= 40 && /^[a-z0-9].*[a-z0-9]$/.test(slug));
  const md = cs.calls[1].req.body.files[0].text;
  assert.equal(fm(md, "project"), undefined);

  const none = recordingCs();
  assert.equal((await promoteDocument(none, { doc: oneDoc(), title: "!!!" })).bundleId, "INFO-2026-0007", "a title with no letter or digit adds no slug");
  /* the title is cut at 200 characters as filed */
  const long = recordingCs();
  await promoteDocument(long, { doc: oneDoc(), title: "t".repeat(250) });
  assert.equal(long.calls[1].req.body.meta.title, "t".repeat(200));
});

test("R116: a multipart document is one register row carrying its parts in order; a part's digest is never a row", async () => {
  const cs = recordingCs({ promoted: { ok: true, reading_pending: true } });
  const P1 = "1".repeat(64), P2 = "2".repeat(64);
  const doc = oneDoc({ file: `snapshots/${SHA}.bin`, capture: { sha256: SHA, bytes: 20_000_000, encoding: "binary" },
    parts: [{ file: `snapshots/${P1}.part`, sha256: P1, bytes: 16_777_216 }, { file: `snapshots/${P2}.part`, sha256: P2, bytes: 3_222_784 }] });
  const filed = await promoteDocument(cs, { doc, title: "Big file", locator: doc.locator });
  assert.deepEqual(filed, { bundleId: "INFO-2026-0007-big-file", readingPending: true }, "readingPending is the promotion's reading_pending");
  const body = cs.calls[1].req.body;
  assert.deepEqual(body.files.slice(3), [{ path: `snapshots/${P1}.part`, blobSha: P1, sha256: P1, bytes: 16_777_216 },
                                         { path: `snapshots/${P2}.part`, blobSha: P2, sha256: P2, bytes: 3_222_784 }], "each part's file");
  assert.deepEqual(body.register, [{ sha256: SHA, path: doc.file, encoding: "binary", bytes: 20_000_000,
    parts: [{ sha256: P1, path: `snapshots/${P1}.part`, bytes: 16_777_216 }, { sha256: P2, path: `snapshots/${P2}.part`, bytes: 3_222_784 }] }]);

  /* one part that is not the whole is still the whole's row with its part; one part that is the whole is a plain row */
  const single = recordingCs();
  await promoteDocument(single, { doc: oneDoc({ parts: [{ file: `snapshots/${P1}.part`, sha256: P1, bytes: 10 }] }), title: "x" });
  assert.deepEqual(single.calls[1].req.body.register[0].parts, [{ sha256: P1, path: `snapshots/${P1}.part`, bytes: 10 }]);
  const same = recordingCs();
  await promoteDocument(same, { doc: oneDoc({ parts: [{ file: `snapshots/${SHA}.pdf`, sha256: SHA, bytes: 5120 }] }), title: "x" });
  assert.deepEqual(same.calls[1].req.body.register, [{ sha256: SHA, path: `snapshots/${SHA}.pdf`, encoding: "binary", bytes: 5120 }]);
});

test("R116: a document over 1,048,576 bytes less 65,536 is filed without its reading and text units", async () => {
  const BOUND = 1048576 - 65536;
  /* two-byte characters: under the bound in code units, over it in UTF-8 bytes */
  const cs = recordingCs();
  const doc = oneDoc({ reading: { title: "Minutes", text: "é".repeat(Math.ceil(BOUND / 2) + 10) }, text_units: [{ text: "é" }],
    text_units_over_bound: false, text_units_skipped: 0 });
  const filed = await promoteDocument(cs, { doc, title: "Minutes" });
  assert.deepEqual(filed, { bundleId: "INFO-2026-0007-minutes", readingPending: false, readingDropped: true });
  const prov = cs.calls[1].req.body.files.find((f) => f.path === "data/provenance.json");
  const kept = JSON.parse(prov.text).documents[0];
  for (const k of ["reading", "text_units", "text_units_over_bound", "text_units_skipped"]) assert.equal(k in kept, false, `${k} is dropped`);
  assert.equal(kept.capture.sha256, SHA, "the rest of the document is kept");
  assert.ok(prov.bytes <= BOUND);

  /* control: a document under the bound keeps its reading, and says nothing of a drop */
  const under = recordingCs();
  const small = await promoteDocument(under, { doc: oneDoc({ reading: { text: "e".repeat(BOUND - 5000) } }), title: "Minutes" });
  assert.equal("readingDropped" in small, false);
  assert.ok("reading" in JSON.parse(under.calls[1].req.body.files[1].text).documents[0]);
});

test("R116: a refused mint or promotion is answered as refused, with the refusing answer", async () => {
  const refusal = { ok: false, reason: "ALLOC_REFUSED", code: "ALLOC_REFUSED", translation: "No id." };
  const noId = recordingCs({ minted: refusal });
  assert.deepEqual(await promoteDocument(noId, { doc: oneDoc(), title: "x" }), { refused: refusal });
  assert.deepEqual(noId.calls.map((c) => c.op), ["allocid"], "nothing is promoted without an id");
  assert.deepEqual(await promoteDocument(recordingCs({ minted: null }), { doc: oneDoc(), title: "x" }), { refused: {} }, "no answer is {}");
  assert.deepEqual(await promoteDocument(recordingCs({ minted: { ok: true, id: 7 } }), { doc: oneDoc(), title: "x" }), { refused: { ok: true, id: 7 } });
  /* an envelope's `result` is read as the answer */
  const wrapped = recordingCs({ minted: { result: { ok: true, id: "INFO-2026-0009" } }, promoted: { result: { ok: true, bundleId: "INFO-2026-0009-x" } } });
  assert.deepEqual(await promoteDocument(wrapped, { doc: oneDoc(), title: "x" }), { bundleId: "INFO-2026-0009-x", readingPending: false });

  const said = { ok: false, reason: "ENTRY_REQUIREMENTS", status: 409 };
  assert.deepEqual(await promoteDocument(recordingCs({ promoted: said }), { doc: oneDoc(), title: "x" }), { refused: said });
  assert.deepEqual(await promoteDocument(recordingCs({ promoted: () => undefined }), { doc: oneDoc(), title: "x" }), { refused: {} });
});

test("R115, R116: each function imports nothing and runs from its own source alone, as a page carries it", async () => {
  const alone = (fn) => new Function(`return (${fn.toString()})`)();
  const cs = wordsCs();
  assert.equal(alone(titleOf)(cs, { doc: {}, address: "https://c.example/" }), titleOf(cs, { doc: {}, address: "https://c.example/" }));
  const a = recordingCs(), b = recordingCs();
  const left = await alone(promoteDocument)(a, { doc: oneDoc(), title: "Minutes", locator: "https://c.example/m.pdf" });
  const right = await promoteDocument(b, { doc: oneDoc(), title: "Minutes", locator: "https://c.example/m.pdf" });
  assert.deepEqual(left, right);
  const strip = (body) => ({ ...body, snapKey: body.snapKey.split("_")[0] });
  assert.deepEqual(strip(a.calls[1].req.body), strip(b.calls[1].req.body));
});
