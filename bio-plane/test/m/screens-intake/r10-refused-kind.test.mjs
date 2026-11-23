/* screens-intake fix round 10, cause R36 (G7; walk A7; R64): `UNSUPPORTED_FORMAT {kind}` is drawn as the sentence reading-pipeline holds for that kind
 * (`reading-pipeline.index.unsupported_<kind>`), not as the stand-in "picture unread" with the raw kind beside it. The page is the served `capture` screen over the
 * REAL plane (`realplane.mjs`): a GIF is uploaded and what the plane stores for it is what `op=reading` answers. The local plane leaves a TIFF's reading unstored (the
 * live one stores it `UNSUPPORTED_FORMAT`; why they differ is not established, K4428), so every kind is also tried at the part's interface over the word table. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { main, text, says, idle, word, hasWord } from "./page.mjs";
import { realPlane } from "./realplane.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";

const plane = realPlane("r10kind");
after(() => plane.dispose());
/* the owner's keys, by kind (a held row of reading-pipeline, code-origin until the layer close regenerates the list) */
const unsupported = (kind) => `reading-pipeline.index.unsupported_${kind}`;
const KINDS = ["rtf", "email", "legacy_word", "legacy_excel", "legacy_powerpoint", "legacy_office", "tiff", "gif", "webp", "heic", "avif", "bmp", "jp2", "ico"];

test("R64 R36 (the real plane) a GIF the plane stored as UNSUPPORTED_FORMAT is drawn as reading-pipeline's own sentence for GIF, with no stand-in sentence and no raw kind", async () => {
  const auth = await plane.founder();
  const p = await plane.uploaded(auth, { kind: "gif", seed: "r10-gif", size: { pages: 1, lines: 2 } }, "scan.gif");
  await plane.ticksUntil(p, () => main(p).querySelector('[data-reading="refused"]'));
  const line = main(p).querySelector('[data-reading="refused"]');
  assert.ok(line, "a refused reading line: " + text(p).slice(-300));
  assert.ok(line.textContent.includes(word(unsupported("gif"))), "the owner's sentence for the kind: " + line.textContent);
  assert.ok(!line.textContent.includes(word("capture.picture.unread")), "not the stand-in 'picture unread' sentence");
  assert.equal(line.querySelectorAll(".mk-data").length, 0, "and no raw kind span");
});

test("R64 R36 every kind reading-pipeline names has its own sentence, drawn from the word table; the screen lists its keys", () => {
  const capture = SCREENS.find((s) => s.id === "capture");
  assert.ok(capture, "the capture screen is registered");
  const keys = capture.words;
  const cs = { w: (k, v) => (hasWord(k) ? word(k, v) : k), esc: (x) => String(x) };
  const seen = new Set();
  for (const kind of KINDS) {
    const key = unsupported(kind);
    assert.ok(hasWord(key) && keys.includes(key), key);
    const html = CAPTURE_SCREEN.parts.readRefusalHtml(cs, { reason: "UNSUPPORTED_FORMAT", kind });
    assert.equal(html, word(key), kind);
    seen.add(html);
  }
  assert.equal(seen.size, KINDS.length, "each kind its own sentence");
});

test("R64 R36 control: a kind with no sentence of its own is the general one with the kind filled; a refusal naming no kind is 'could not be read'", () => {
  const cs = { w: (k, v) => (hasWord(k) ? word(k, v) : k), esc: (x) => String(x) };
  assert.equal(CAPTURE_SCREEN.parts.readRefusalHtml(cs, { reason: "UNSUPPORTED_FORMAT", kind: "mkv" }), word(unsupported("kind"), { kind: "mkv" }));
  assert.equal(CAPTURE_SCREEN.parts.readRefusalHtml(cs, { reason: "UNSUPPORTED_FORMAT" }), word("shell.unread"));
});
