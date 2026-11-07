/* screens-intake-rounds: the parts the intake screens draw for the T53 lines, at this module's interface, read through setup-words' real
 * word table (`word`, which refuses a key the table does not hold, so every key a part reads is proved to be a row). Tests assert keys
 * and read the expected text from the table, never copy a sentence (K3810). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import * as PARTS from "../../../src/screens-intake-rounds/index.mjs";
import { leftOutLine, mailboxCountLine, stepLine, readRefusedLine, uploadTooLargeLine, finishLine, addressHeldLine, previewCutLine,
  safeViewPagesLine, sizeWords, PART_KEYS } from "../../../src/screens-intake-rounds/index.mjs";

/* the kit's word reader is setup-words' own; `esc` is the language's */
const cs = Object.freeze({ w: word, esc: (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`) });
const list = (xs) => new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(xs);

test("R81 a photo whose left_out holds a thumbnail and a maker note draws both phrases by key, in the left-out sentence", () => {
  const got = leftOutLine(cs, [{ kind: "thumbnail", count: 1, bytes: 5120 }, { kind: "maker_note", count: 1, bytes: 900 }]);
  assert.equal(got, word("screen.photo.dropped", { what: list([word("screen.photo.dropped.thumbnail"), word("screen.photo.dropped.maker_note")]) }));
});

test("R81 every kind of the closed set is read by its own key, each named once", () => {
  const all = ["thumbnail", "maker_note", "profile", "extra_picture", "after_end", "xmp", "credentials", "other_metadata", "unreadable"];
  const got = leftOutLine(cs, [...all, "xmp"].map((kind) => ({ kind, count: 1, bytes: 1 })));
  assert.equal(got, word("screen.photo.dropped", { what: list(all.map((k) => word("screen.photo.dropped." + k))) }));
});

test("R81 control: a kind outside the closed set is never drawn, nor the camera's make or serial; none of the set left out draws nothing", () => {
  assert.equal(leftOutLine(cs, [{ kind: "make" }, { kind: "serial_number" }, { kind: "something_new" }, null, 7, "owner"]), "");
  assert.equal(leftOutLine(cs, [{ kind: "camera_serial" }, { kind: "xmp" }]), word("screen.photo.dropped", { what: word("screen.photo.dropped.xmp") }));
  for (const none of [undefined, null, [], {}, "thumbnail"]) assert.equal(leftOutLine(cs, none), "");
});

test("R82 (its count line) a mailbox of five messages, three read, one kept not read, one refused, draws the counts by key; an archive that is not a mailbox draws none", () => {
  assert.equal(mailboxCountLine(cs, { n: 5, read: 3, held: 1, refused: 1 }), word("screen.archive.mailbox.count", { n: "5", read: "3", held: "1", refused: "1" }));
  for (const none of [undefined, null, {}, { n: 5 }, { n: 5, read: 3, held: 1, refused: -1 }, { n: "5", read: 3, held: 1, refused: 1 }]) assert.equal(mailboxCountLine(cs, none), "");
});

test("R78 (its parts) each step is drawn by its own key; a step with no row of its own draws nothing", () => {
  assert.equal(stepLine(cs, { step: "fetching" }), word("screen.capture.read.fetching"));
  assert.equal(stepLine(cs, "reading"), word("screen.capture.read.reading"));
  assert.equal(stepLine(cs, { step: "about", minutes: 4 }), word("screen.capture.read.about", { minutes: "4" }));
  assert.equal(stepLine(cs, { step: "about", minutes: 1 }), word("screen.capture.read.about.one"));
  assert.equal(stepLine(cs, { step: "hashing" }), word("screen.capture.file.parts.hashing"));
  assert.equal(stepLine(cs, { step: "sending", n: 2, m: 7 }), word("screen.capture.file.parts.sending", { n: "2", m: "7" }));
  for (const none of [{ step: "queued" }, { step: "waiting" }, { step: "about" }, { step: "about", minutes: 0 }, { step: "sending", n: 8, m: 7 }, null]) assert.equal(stepLine(cs, none), "");
});

test("R78 (its parts) the reading's refusals are drawn by code with their figures, a size in MB; a figure missing draws nothing", () => {
  assert.equal(readRefusedLine(cs, { code: "ENCRYPTED" }), word("screen.capture.read.refused.ENCRYPTED"));
  assert.equal(readRefusedLine(cs, { code: "TOO_LARGE", size: 18_069_786, bound: 10 * 1048576 }),
    word("screen.capture.read.refused.TOO_LARGE", { size: word("size.mb", { n: "17" }), bound: word("size.mb", { n: "10" }) }));
  assert.equal(readRefusedLine(cs, { code: "STRUCTURE_OVER_BOUND", part: "Sheet1", bound: 1048576 }),
    word("screen.capture.read.refused.STRUCTURE_OVER_BOUND", { part: "Sheet1", bound: "1048576" }));
  assert.equal(readRefusedLine(cs, { code: "ENCODING_UNSUPPORTED", name: "EBCDIC" }), word("screen.capture.read.refused.ENCODING_UNSUPPORTED", { name: "EBCDIC" }));
  for (const none of [{ code: "TOO_LARGE", size: 5 }, { code: "STRUCTURE_OVER_BOUND", bound: 3 }, { code: "ENCODING_UNSUPPORTED" }, { code: "OTHER" }, null])
    assert.equal(readRefusedLine(cs, none), "");
});

test("R78 (its parts) a size over the upload ceiling is drawn in MB; sizes are never a byte count", () => {
  assert.equal(uploadTooLargeLine(cs, { size: 120 * 1048576, bound: 100 * 1048576 }),
    word("screen.capture.refusal.upload.TOO_LARGE.figures", { size: word("size.mb", { n: "120" }), bound: word("size.mb", { n: "100" }) }));
  assert.equal(uploadTooLargeLine(cs, { size: 5 }), "");
  assert.equal(sizeWords(cs, 300), word("size.small"));
  assert.equal(sizeWords(cs, 52_428_800), word("size.mb", { n: "50" }));
  assert.equal(sizeWords(cs, 3 * 1073741824), word("size.gb", { n: "3" }));
});

test("R78 (its parts) finishing a capture and an address already held draw their own keys", () => {
  assert.equal(finishLine(cs, { state: "pending" }), word("screen.capture.finish.pending"));
  assert.equal(finishLine(cs, { state: "files" }), word("screen.capture.finish.files"));
  assert.equal(finishLine(cs, { state: "done", title: "Minutes <draft>" }), word("screen.capture.finish.done", { title: cs.esc("Minutes <draft>") }));
  assert.equal(finishLine(cs, { state: "done" }), "");
  assert.equal(addressHeldLine(cs, { read: true }), word("screen.capture.address.reading.done"));
  assert.equal(addressHeldLine(cs, { read: false }), word("screen.capture.address.reading.pending"));
  assert.equal(addressHeldLine(cs, {}), "");
});

test("R79 (its parts) a preview cut at row 200 of 5,000 draws the cut sentence; a long document's safe view says how much it shows; neither when not cut", () => {
  assert.equal(previewCutLine(cs, { shown: 200, total: 5000 }), word("screen.capture.preview.cut", { shown: "200", total: "5,000" }));
  assert.equal(safeViewPagesLine(cs, { pages: 500, source_pages: 812 }), word("file-safety.index.safe_view_first_pages", { pages: "500", source_pages: "812" }));
  assert.equal(previewCutLine(cs, { shown: 5000, total: 5000 }), "");
  assert.equal(safeViewPagesLine(cs, { pages: 12, source_pages: 12 }), "");
});

test("the parts are self-contained (interface-shell R21 (1)), and every key a part names is a row of the table", () => {
  for (const [name, f] of Object.entries(PARTS)) {
    if (typeof f !== "function") continue;
    /* composed alone from its own text, it still runs: it names nothing of this module */
    const alone = new Function("return (" + f.toString() + ")")();
    assert.equal(typeof alone(cs, null), "string", name);
    assert.ok(PART_KEYS[name], `${name} lists its keys`);
  }
  for (const keys of Object.values(PART_KEYS)) for (const k of keys) assert.ok(hasWord(k), k);
});

/* The marks below stay open, each naming what it waits on (BOB ruling (b), 7 Nov). The through-the-screen tests of what screens-intake now draws are in
   screen.test.mjs; R92 is met there. */
test.todo("R72 the add screen states the limit for each kind before a file is added (a read op serving acquisition's limitsByKind to the screen is owed; screens-intake draws it)");
test.todo("R74 (a)'s link opens the registers screen with the project's filter (the registers screen and its route are owed; the link /app/registers/<key>?project= is screens-intake's guess)");
test.todo("R75 'A source' for listed members; the others are told how the file came (sourceLinksFor; the doorbell row is BOB's)");
test.todo("R76 a source's page opened by address by an unlisted viewer draws 'Nothing is here' (sourceLinksFor)");
test.todo("R77 open-file shows a photograph's safe picture and what the file says (screens-intake: the picture and the file-says lines)");
test.todo("R78 Add draws its own words for each state (screens-intake: finish, address held, fetch done with no project and about.one still draw stand-ins)");
test.todo("R79 a preview says where it was cut and can show more; a long document's safe view says how much (the next-rows op; screens-intake F4: safeViewPagesLine)");
test.todo("R80 Add says what happens to each kind of file (screens-intake: the kept-not-read and refused sentences and the folded list)");
test.todo("R82 the archive screen states a mailbox's messages and a member file's parent (archivelist's counts; the From {parent} row; screens-intake F3)");
test.todo("R83 the Held list draws a document's chip on the ceiling scale (interface-shell-t53 R140)");
test.todo("R84 heldcaptures leaves Add's first wave (screens-intake; PLATFORM's Seed A timing)");
test.todo("R85 a document from any source can be vouched, read and cited from the screens (plane answers; screens-intake)");
test.todo("R86 a held capture can be found the day after (screens-intake: held's project filter, the confirmation link)");
test.todo("R87 one archive, one account of it, on both screens (screens-intake: held and archive)");
test.todo("R88 a refusal of setting aside says what to do (screens-intake: the MACHINE_CANNOT_SET_ASIDE next-step row)");
test.todo("R89 a testimony filed from a project is shown under that project (capture's filing; screens-intake)");
test.todo("R90 a record that is not yours is not called damaged (interface-shell R35; screens-intake)");
test.todo("R91 at 390 no word breaks and a row has no empty square (screens-intake's layout)");
test.todo("R93 the doorbell's receipt is in view and the form is clean after a send (screens-publish's doorbell)");
test.todo("R94 after a failed upload or promote the Add door says whether the file was kept, and offers a retry (capture R96, R120; interface-shell R144)");
