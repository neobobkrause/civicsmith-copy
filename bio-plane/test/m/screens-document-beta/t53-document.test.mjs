/* screens-document-beta (T53): the Document page in the beta, on interface-shell's served page over screens-inquiry's plane (its fixtures: the real world's
 * reads, the reading in the shape `op=reading` answers it). R61: each state the page draws says it by its own row; R74: the question control's sentence agrees with
 * it, and a cite says which way it bears, with the question and a link to the passage. The cite's answer is the real `citation` service's (its fixture). Every
 * expectation is a word read by key (R44); no test holds a sentence's English. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, boot } from "../interface-shell/harness.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { world, V } from "../citation/fixture.mjs";
import { open, main, fill, press, says, word, plane, READING, SCREENS, D, SHA, Q } from "../screens-inquiry/fixtures.mjs";

process.env.TZ = "UTC";
const at = "/app/document/" + D;
const text = (el) => String(el && el.textContent || "");
const reading = (o) => ({ plane: { reading: ok(READING(o)) } });

/* ---- R61 ---- */
test("R61: a reading with one page that has no text draws `screen.document.text.partial.one`; two such pages draw `.text.partial`", async () => {
  const one = main(await open(at, reading({ unread_pages: [7] })));
  assert.ok(says(one, "screen.document.text.partial.one", { pages: "8" }), "one page: its own row");
  assert.ok(!says(one, "screen.document.text.partial", { pages: "8" }), "never the plural stand-in");
  const two = main(await open(at, reading({ unread_pages: [7, 8] })));
  assert.ok(says(two, "screen.document.text.partial", { pages: "8–9" }), "control: two pages draw the plural row");
});

test("R61: a text still being read draws `screen.document.reading.beingread`, never the loading stand-in", async () => {
  const m = main(await open(at, reading({ more: true })));
  assert.ok(says(m, "screen.document.reading.beingread"), "its own row");
  const facts = m.querySelector('[data-text-state="reading"]');
  assert.ok(facts && !text(facts).includes(word("state.loading")), "the head's fact is not 'loading'");
});

test("R61: a reading cut by its cursor draws `screen.document.reading.firstn` with its figures and the `document.read.more` control, apart from the page bar's next", async () => {
  const m = main(await open(at, reading({ next: "c1", units_total: 9 })));
  assert.ok(says(m, "screen.document.reading.firstn", { n: "2", m: "9" }), "Showing 2 of 9 passages");
  const more = m.querySelector('[data-reading="more"]');
  assert.ok(more && says(more, "document.read.more"), "the more control is 'More passages'");
  assert.ok(!says(more, "document.read.next"), "never the page bar's 'Next page'");
});

test("R61: a kind not read draws `screen.document.unsupported.<kind>` (`ico`); a kind the beta reads draws no such row", async () => {
  const stated = (kind) => reading({ text_units: [], unread_pages: [], reading: { content_type: "generic", found: false, failure: "final", reason: "UNSUPPORTED_FORMAT", kind, basis: "held" } });
  const ico = main(await open(at, stated("ico")));
  assert.ok(says(ico, "screen.document.unsupported.ico"), "ico: its row");
  const rtf = main(await open(at, stated("rtf")));
  assert.ok(!says(rtf, "screen.document.unsupported.ico"), "rtf: not the ico row");
  assert.ok(!hasWord("screen.document.unsupported.rtf"), "and no unsupported row is held for a kind the beta reads (DEC-467)");
  /* control: a sentence the reading stored is drawn as stored */
  const BASIS = "the reading's own sentence, stored with it";
  const m = main(await open(at, reading({ text_units: [], unread_pages: [], reading: { content_type: "generic", found: false, failure: "final", reason: "SOMETHING_ELSE", basis: BASIS } })));
  assert.ok(text(m).includes(BASIS), "control: a stored reading sentence is drawn as stored");
});

/* ---- R74 ---- */
const heldFor = (questions) => ok({ ok: true, held: [{ bundle_id: D, capture: { sha256: SHA, grade: { grade: "B", route: "fetched", determined: true } },
  captured_for: { questions, withheld: null } }] });

test("R74: with no capture question the sentence over the control says 'Choose a question'; with one it says 'Set to the question this document was captured for' and that question is chosen", async () => {
  const none = main(await open(at, { plane: { heldcaptures: heldFor([]) } }));
  const helpNone = none.querySelector("[data-cite-help]");
  assert.equal(helpNone && helpNone.getAttribute("data-cite-help"), "choose");
  assert.ok(says(helpNone, "screen.document.cite.choose") && !says(none, "screen.document.cite.question.help"), "the choosing sentence, not the set one");
  const p = await open(at, { plane: { heldcaptures: heldFor([{ question: Q, title: "Seven days?", asker: "mai" }]) } });
  const help = main(p).querySelector("[data-cite-help]");
  assert.equal(help && help.getAttribute("data-cite-help"), "set");
  assert.ok(says(help, "screen.document.cite.question.help"), "the set sentence");
  assert.equal(p.doc.getElementById("document-cite-question").value, Q, "and that question chosen");
});

const ANN = { viewer: V("ann"), owner: "o", author: "member:ann", identity: V("ann") };
/** the real citation service's answer to a first cite, in the role asked */
async function citeAnswer(role) {
  const w = world();
  w.info(D); w.inquiry("INQ-2026-0001");
  const h = await w.select([D]);
  return w.cit.cite({ project: "INQ-2026-0001", handle: h, ...ANN, role });
}

test("R74: after a 'cuts against' cite the line says 'Cuts against' with the question and a link to the passage; after a 'supports' cite, 'Supports'", async () => {
  for (const [role, key, other] of [["cuts_against", "screen.question.against.head", "screen.question.supports.head"], ["supports", "screen.question.supports.head", "screen.question.against.head"]]) {
    const answer = await citeAnswer(role);
    assert.deepEqual(answer.cited, [D], "the real cite cited");
    const p = await boot({ screens: SCREENS, plane: plane({ plane: { cite: ok({ ...answer, inquiry: Q }) } }), path: at });
    await p.settle();
    fill(p, { "document-cite-question": Q, "document-cite-role": role });
    await press(p, "cite");
    assert.equal(p.byOp("cite")[0].body.role, role, "the role sent is the one chosen");
    const line = main(p).querySelector("[data-cite-done=cited]");
    assert.ok(line, "the line is drawn");
    assert.equal(line.getAttribute("data-cite-role"), role);
    const bold = line.querySelectorAll("b").map((b) => text(b));
    assert.ok(bold.includes(word(key)) && !bold.includes(word(other)), `it says ${role}`);
    assert.ok(line.querySelector('a[href*="/app/question/"]'), "with the question");
    const link = line.querySelector('a[href^="#document-passage-"]');
    assert.ok(link, "and a link to the passage");
    assert.ok(main(p).querySelector("#" + link.getAttribute("href").slice(1)), "which is the passage drawn on the page");
    /* control: the options list is unchanged */
    assert.deepEqual(p.doc.getElementById("document-cite-role").querySelectorAll("option").map((o) => o.getAttribute("value")), ["supports", "cuts_against"], "control: the role's options are unchanged");
  }
});

/* ---- R62, R72: the parts the reading states today; the rest are owed (below) ---- */
test("R62 (part): a kind kept and not read (`held_unread`) draws the held sentence with its plain kind; a locked file draws the password sentence", async () => {
  const held = main(await open(at, reading({ text_units: [], unread_pages: [], reading: { content_type: "generic", found: false },
    held_unread: { name: "visio", kind_key: "file.kind.visio", text: word("file.kind.visio") } })));
  assert.ok(says(held, "screen.document.held.kind", { kind: word("file.kind.visio") }), "Visio: kept whole, not read yet");
  const locked = main(await open(at, reading({ text_units: [], unread_pages: [], reading: { content_type: "application/pdf", found: false, failure: "final", reason: "PASSWORD_REQUIRED", basis: "x" } })));
  assert.ok(says(locked, "screen.document.encrypted"), "needs a password");
  const read = main(await open(at));
  assert.ok(!says(read, "screen.document.encrypted") && !read.querySelector('[data-reading="heldkind"]'), "control: a read PDF draws neither");
});

test("R72 (part): a reading whose reader measured clarity draws how many words were hard to make out, and marks their pages; one with no measure draws none", async () => {
  const m = main(await open(at, reading({ words_read: 4000, words_total: 4000, unclear_words: { count: 7, positions: [{ page: 2, count: 7 }] } })));
  assert.ok(says(m, "screen.document.text.unsure", { unsure: "7" }), "the sentence with 7");
  const marks = m.querySelectorAll("[data-unsure]");
  assert.equal(marks.length, 1, "the passage on the page that holds them is marked");
  assert.equal(marks[0].getAttribute("data-unsure"), "7");
  assert.ok(marks[0].getAttribute("data-tip").includes(word("screen.document.text.unsure.tip_why")), "with the card");
  const plain = main(await open(at, reading({ words_read: 4000, words_total: 4000 })));
  assert.ok(!says(plain, "screen.document.text.unsure", { unsure: "7" }) && plain.querySelectorAll("[data-unsure]").length === 0, "control: no measure, no sentence, no mark");
});

/* ---- owed: each waits on a provider this module does not hold ---- */
test.todo("R58: the door 'A source' for listed members (waits on a route for sources' `sourceLinksFor`, sources R23)");
test.todo("R59: typed words cited with their label and grade (waits on cite of a typing's handle and the cite picker offering typings)");
test.todo("R60: 'Follow from here' on the document (waits on interface-shell R139 `cs.follow` and the `followfrom` op)");
test.todo("R62: the macro, page-of-a-TIFF and converted-copy sentences (waits on the reading stating macros, a page's place in a multi-page file and a converted original)");
test.todo("R63: a photograph's safe picture, when and where, and what was left out (waits on a read that carries image-cover's `facts` and `left_out` to the page)");
test.todo("R64: the 'Interpreted' fact row (waits on an op for extraction's `interpretationOf`)");
test.todo("R65: 'Interpret parts of this for {investigation}' (waits on the `interpretmark` op, owed in the registry)");
test.todo("R66: the part chooser (waits on `interpretmark`)");
test.todo("R67: citing or opening a part says it was interpreted (waits on `interpretationOf`)");
test.todo("R68: the margin bars of what is interpreted (waits on `interpretationOf`)");
test.todo("R69: the document's chips on the ceiling scale (waits on interface-shell R140)");
test.todo("R70: the shared document picker (waits on interface-shell R138)");
test.todo("R71: `heldcaptures` leaves the first wave as the shared picker's read on open (waits on interface-shell R138, and the re-timing on Seed A)");
test.todo("R72: each hard word underlined dotted (waits on the reading stating each word's position; it states a count per page)");
test.todo("R73: the five stored strings replaced by the member's sentences (waits on the design's rows, owed)");
test.todo("R75: 'Go to Home' on a bare document (waits on interface-shell's unavailable page, which draws the screen's place)");
