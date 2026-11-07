/* screens-intake-rounds: the parts the intake screens draw for the T53 lines, at this module's interface, read through setup-words' real
 * word table (`word`, which refuses a key the table does not hold, so every key a part reads is proved to be a row). Tests assert keys
 * and read the expected text from the table, never copy a sentence (K3810). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import * as PARTS from "../../../src/screens-intake-rounds/index.mjs";
import { leftOutLine, mailboxCountLine, stepLine, readRefusedLine, uploadTooLargeLine, finishLine, addressHeldLine, previewCutLine,
  safeViewPagesLine, sizeWords, partsCancelledLine, limitsSection, registerOfAddress, tooLargeLines, PART_KEYS } from "../../../src/screens-intake-rounds/index.mjs";
import { limitsByKind } from "../../../src/acquisition/index.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { world as registersWorld, V } from "../registers/fixture.mjs";

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
  assert.equal(stepLine(cs, { step: "queued" }), word("screen.capture.read.queued"));
  for (const none of [{ step: "waiting" }, { step: "about" }, { step: "about", minutes: 0 }, { step: "sending", n: 8, m: 7 }, null]) assert.equal(stepLine(cs, none), "");
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

test("R79 (its part) cancelling a parted upload draws the canceled line once the abort is answered; nothing before", () => {
  assert.equal(partsCancelledLine(cs, { ok: true }), word("screen.capture.file.parts.cancelled"));
  for (const none of [undefined, null, {}, { ok: false, code: "NOT_FOUND" }]) assert.equal(partsCancelledLine(cs, none), "");
});

/* R72's figures come from acquisition's real limitsByKind (R135), the figures READ_BOUNDS enforces */
const mb = (n) => word("size.mb", { n: String(Math.round(n / 1048576)) });
const gbOrMb = (n) => (n < 1073741824 ? mb(n) : word("size.gb", { n: String(Math.round(n / 107374182.4) / 10) }));
const rowsOf = (html) => [...html.matchAll(/<li data-limit-kind="([a-z]+)">(.*?)<\/li>/g)].map((m) => [m[1], m[2]]);

test("R72 (its part) 'What can be added' draws four rows, one per kind, each with the answer's one figure, before any file is chosen", () => {
  const answer = limitsByKind();
  const html = limitsSection(cs, answer);
  assert.ok(html.includes(word("screen.capture.limits.heading")));
  const k = Object.fromEntries(answer.kinds.map((x) => [x.kind, x]));
  assert.deepEqual(rowsOf(html), [
    ["document", word("screen.capture.limits.document", { size: gbOrMb(k.document.bytes), pages: k.document.pages.toLocaleString("en-US") })],
    ["sheet", word("screen.capture.limits.sheet", { size: gbOrMb(k.sheet.bytes), rows: k.sheet.rows.toLocaleString("en-US") })],
    ["image", word("screen.capture.limits.image", { size: gbOrMb(k.image.bytes) })],
    ["archive", word("screen.capture.limits.archive", { size: gbOrMb(k.archive.bytes) })],
  ]);
  assert.equal(html.includes(word("screen.capture.limits.background")), answer.kinds.some((x) => x.how_long === "background"));
});

test("R72 (its part) a changed answer changes the sentence; the figure drawn for a kind equals the bound R73 refuses at", () => {
  const bounds = { "spreadsheet/bytes": 20 * 1048576, "spreadsheet/rows": 250000 };
  const changed = limitsByKind({ read: (k, n) => bounds[`${k}/${n}`] ?? boundOf(k, n) });
  const sheet = rowsOf(limitsSection(cs, changed)).find(([k]) => k === "sheet")[1];
  assert.equal(sheet, word("screen.capture.limits.sheet", { size: mb(20 * 1048576), rows: "250,000" }));
  /* the same figure the refusal names */
  const bound = changed.kinds.find((x) => x.kind === "sheet").bytes;
  assert.ok(tooLargeLines(cs, { size: 60 * 1048576, bound }, {}).includes(mb(bound)));
  assert.ok(sheet.includes(mb(bound)));
});

test("R72 control (its part): no row draws two figures for one limit; a kind missing its figure is not drawn; no answer draws nothing", () => {
  const html = limitsSection(cs, limitsByKind());
  for (const [, line] of rowsOf(html)) assert.equal((line.match(/\d+(?:[.,]\d+)* (?:MB|GB|KB)/g) || []).length, 1, line);
  const answer = limitsByKind();
  const noPages = { kinds: answer.kinds.map((x) => (x.kind === "document" ? { ...x, pages: undefined } : x)) };
  assert.deepEqual(rowsOf(limitsSection(cs, noPages)).map(([k]) => k), ["sheet", "image", "archive"]);
  for (const none of [undefined, null, {}, { kinds: [] }, { kinds: [{ kind: "image" }] }]) assert.equal(limitsSection(cs, none), "");
});

test("R73 (its part) a 60 MB sheet draws its size, the 50 MB limit, 'Nothing was added or read.' and R74's own part; a 120 MB PDF its size and 100 MB", () => {
  const sheet = tooLargeLines(cs, { size: 60 * 1048576, bound: 50 * 1048576 }, {});
  assert.ok(sheet.includes(word("screen.capture.refusal.upload.TOO_LARGE.figures", { size: mb(60 * 1048576), bound: mb(50 * 1048576) })));
  assert.ok(sheet.includes(word("screen.capture.refusal.toolarge.nothing_read")));
  assert.ok(sheet.includes(word("screen.capture.refusal.toolarge.part")));
  const pdf = tooLargeLines(cs, { size: 120 * 1048576, bound: 100 * 1048576 }, {});
  assert.ok(pdf.includes(word("screen.capture.refusal.upload.TOO_LARGE.figures", { size: mb(120 * 1048576), bound: mb(100 * 1048576) })));
  /* never drawn with a hole */
  for (const none of [undefined, {}, { size: 5 }, { bound: 5 }]) assert.equal(tooLargeLines(cs, none, {}), "");
});

test("R74 (its part) an address a known register lists as its source draws (a) and (b), the link carrying the register and project; an upload draws (b) only", async () => {
  const w = registersWorld();
  const list = w.registers.registerList({ viewer: V("bob") });
  const town = list.known.find((k) => k.url);
  assert.ok(town, "the test profile lists a register with a source address");
  const u = new URL(town.url);
  /* matched mechanically: host case and a trailing slash do not matter, a fragment is ignored */
  const same = `${u.protocol}//${u.host.toUpperCase()}${u.pathname}/${u.search}#top`;
  assert.equal(registerOfAddress(list, same), town.key);
  const refusal = { size: 60 * 1048576, bound: 50 * 1048576 };
  const a = tooLargeLines(cs, refusal, { register: registerOfAddress(list, town.url), project: "P-7" });
  const link = a.match(/<p data-way="register"><a class="cs-ref" href="([^"]+)"/);
  assert.ok(link, "way (a) is drawn as a link");
  assert.equal(link[1], `/app/registers/${encodeURIComponent(town.key)}?project=P-7`);
  assert.ok(a.includes(word("screen.capture.refusal.toolarge.register")) && a.includes(word("screen.capture.refusal.toolarge.part")));
  const b = tooLargeLines(cs, refusal, { register: registerOfAddress(list, null) });
  assert.ok(!b.includes('data-way="register"') && b.includes(word("screen.capture.refusal.toolarge.part")));
});

test("R74 control (its part): an address no register lists, or one only like it, draws no register way; no way offers 'the first part' of a file", () => {
  const list = registersWorld().registers.registerList({ viewer: V("bob") });
  const town = list.known.find((k) => k.url);
  const u = new URL(town.url);
  assert.equal(registerOfAddress(list, `${u.protocol}//${u.host}${u.pathname}x`), null);
  assert.equal(registerOfAddress(list, `${u.protocol}//other.example${u.pathname}`), null);
  assert.equal(registerOfAddress(list, "not an address"), null);
  assert.equal(registerOfAddress(null, town.url), null);
  const html = tooLargeLines(cs, { size: 60 * 1048576, bound: 50 * 1048576 }, {});
  assert.deepEqual([...html.matchAll(/data-way="([a-z]+)"/g)].map((m) => m[1]), ["part"]);
});

test("the parts are self-contained (interface-shell R21 (1)), and every key a part names is a row of the table", () => {
  for (const [name, f] of Object.entries(PARTS)) {
    if (typeof f !== "function") continue;
    /* composed alone from its own text, it still runs: it names nothing of this module */
    const alone = new Function("return (" + f.toString() + ")")();
    /* the one helper that draws nothing (R74's match) answers a register key or null, and reads no words */
    if (name === "registerOfAddress") { assert.equal(alone(null, null), null); continue; }
    assert.equal(typeof alone(cs, null), "string", name);
    assert.ok(PART_KEYS[name], `${name} lists its keys`);
  }
  for (const keys of Object.values(PART_KEYS)) for (const k of keys) assert.ok(hasWord(k), k);
});

test.todo("R72 the add screen states the limit for each kind before a file is added (the part above; capture's hook and a read serving limitsByKind are owed)");
test.todo("R73 a file over its limit is refused with its size, the limit and a way in, never half-read (the part above; capture's hook is owed)");
test.todo("R74 the ways in after a refusal: a register by filter, else the member's own part (the parts above; capture's hook and the registers screen are owed)");
test.todo("R75 'A source' for listed members; the others are told how the file came (sourceLinksFor; the doorbell row is BOB's)");
test.todo("R76 a source's page opened by address by an unlisted viewer draws 'Nothing is here'");
test.todo("R77 open-file shows a photograph's safe picture and what the file says");
test.todo("R78 Add draws its own words for each state, in capture.mjs (the parts above, the queued row included; capture's hook is owed)");
test.todo("R79 a preview says where it was cut and can show more; a parted upload can be canceled (the parts above; the next-rows op and capture's hook are owed)");
test.todo("R80 Add says what happens to each kind of file (the kept and refused sentences' rows are owed)");
test.todo("R82 the archive screen states a mailbox's messages and a member file's parent (archive's hook and the parent row are owed)");
test.todo("R83 the Held list draws a document's chip on the ceiling scale (interface-shell-t53 R140)");
test.todo("R84 heldcaptures leaves Add's first wave");
test.todo("R85 a document from any source can be vouched, read and cited from the screens");
test.todo("R86 a held capture can be found the day after");
test.todo("R87 one archive, one account of it, on both screens");
test.todo("R88 a refusal of setting aside says what to do");
test.todo("R89 a testimony filed from a project is shown under that project");
test.todo("R90 a record that is not yours is not called damaged");
test.todo("R91 at 390 no word breaks and a row has no empty square");
test.todo("R92 an inbox row says which knock it is, links what it became, and explains each state");
test.todo("R93 the doorbell's receipt is in view and the form is clean after a send");
test.todo("R94 after a failed upload or promote the Add door says whether the file was kept, and offers a retry (capture R96, R120)");
