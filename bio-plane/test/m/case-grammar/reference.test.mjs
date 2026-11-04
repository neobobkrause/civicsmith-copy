/* case-grammar at its interface: R10, the project reference a case carries (`working_on`, DEC-111): the notice-id shape
   (record-core R6's, K1115, K1119), the one writer and the one reading, a `/5` document with and without it, and a
   malformed value, with their negative controls. Driven on the bytes alone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, idPattern } from "../../../src/record-grammar/index.mjs";
import { WORKING_ON_KEY, NOTICE_REFERENCE_PATTERN, isNoticeReference, workingOnLines, workingOnOf,
         CASE_DOCUMENT_FORMAT, caseDocumentStatesMemberBlocks, caseDocumentRequiresDisclosures,
         caseDocumentRequiresV4Disclosures, caseDocumentRequiresTensionSection, whatChangedBlockLines,
         lensBlockLines, caseDocumentBlocks, captureBlockLines, sourceBlockLines } from "../../../src/case-grammar/index.mjs";
import { doc } from "./helpers.mjs";

const V5 = "bio-case-document/5";
const OLDER = ["bio-case-document/4", "bio-case-document/3", "bio-case-document/2", "bio-case-document/1", null];
const fmOf = (text) => parseFrontmatter(text).data;
const NOTICE = "NOTE-2026-0007-parks-budget";

/* The shape, spelled a second way (record-core R6, as signatures R38 states it; S0-12): an upper-case prefix, a
   four-digit year, a counter of four or more digits (record-grammar's id table), and an optional tail of hyphen-joined, non-empty words of lower-case letters and digits. */
const shapeHolds = (s) => {
  if (typeof s !== "string") return false;
  const parts = s.split("-");
  if (parts.length < 3) return false;
  const [prefix, year, number, ...tail] = parts;
  const all = (w, ok) => w.length > 0 && [...w].every(ok);
  const upper = (c) => c >= "A" && c <= "Z";
  const digit = (c) => c >= "0" && c <= "9";
  const lower = (c) => (c >= "a" && c <= "z") || digit(c);
  return all(prefix, upper) && year.length === 4 && all(year, digit) && number.length >= 4 && all(number, digit)
    && tail.every((w) => all(w, lower));
};

test("R10 isNoticeReference is record-core R6's opaque-id shape exactly, its counter four or more digits as record-grammar's id table reads it: any upper-case prefix, the tail optional, and nothing else", () => {
  assert.equal(NOTICE_REFERENCE_PATTERN.source, "^[A-Z]+-\\d{4}-\\d{4,}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$");
  /* the counter is the id table's, the network notice's own row: whatever it admits, a notice reference admits */
  const counter = idPattern("NOTE");
  for (const n of ["0001", "9999", "10000", "123456789"]) {
    assert.equal(counter.test(`NOTE-2026-${n}`), true, n);
    assert.equal(isNoticeReference(`NOTE-2026-${n}`), true, `${n}: a counter of four or more digits`);
    assert.equal(isNoticeReference(`NOTE-2026-${n}-tail`), true);
  }
  /* a signed case document carrying a four-digit id still passes */
  assert.equal(workingOnOf(fmOf(doc(V5, workingOnLines("NOTE-2026-0007")))), "NOTE-2026-0007");
  assert.equal(workingOnOf(fmOf(doc(V5, workingOnLines("NOTE-2026-10007-parks")))), "NOTE-2026-10007-parks");
  for (const ok of ["NOTE-2026-0001", "NOTE-2026-00001", "NOTE-2026-10000-x", "A-0000-9999", "NOTICE-2026-0001-x", NOTICE, "INQ-1999-0042-a1-b2-c3", "ZZZZZZZZ-2026-0001-9"])
    assert.equal(isNoticeReference(ok), true, ok);
  for (const bad of ["", "NOTE", "NOTE-2026", "note-2026-0001", "N0TE-2026-0001", "NOTE-26-0001", "NOTE-20260-0001",
                     "NOTE-2026-001", "NOTE-2026-1", "NOTE-2026-0001-", "NOTE-2026-0001--x", "NOTE-2026-0001-X",
                     "NOTE-2026-0001-a_b", "NOTE-2026-0001-a.b", "-2026-0001", " NOTE-2026-0001", "NOTE-2026-0001 ",
                     "NOTE-2026-0001\n", "\nNOTE-2026-0001", "NOTE-2026-0001-a\nb", "NOTE_2026_0001", "NOTÉ-2026-0001",
                     "NOTE-٢٠٢٦-0001", "\"NOTE-2026-0001\""])
    assert.equal(isNoticeReference(bad), false, JSON.stringify(bad));
  for (const odd of [null, undefined, 7, 20260001, true, {}, [], ["NOTE-2026-0001"], { toString: () => "NOTE-2026-0001" },
                     new String("NOTE-2026-0001"), Symbol("x")])
    assert.equal(isNoticeReference(odd), false, "only a string is a notice reference");
  /* the whole shape, against its second spelling, over every string of up to five characters from an alphabet that
     reaches each of its arms, and over random longer strings shaped like ids */
  const alpha = ["A", "Z", "a", "z", "0", "9", "-", " "];
  let strings = [""];
  for (let n = 0; n < 5; n++) strings = strings.flatMap((s) => alpha.map((c) => s + c));
  for (const s of strings) assert.equal(isNoticeReference(s), shapeHolds(s), JSON.stringify(s));
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const pick = (chars, max) => Array.from({ length: rnd(max + 1) }, () => chars[rnd(chars.length)]).join("");
  for (let i = 0; i < 20000; i++) {
    const s = [pick("ABNZa0-", 4), pick("0129a-", 5), pick("0189A-", 6), ...Array.from({ length: rnd(3) }, () => pick("az09A-_", 3))]
      .join("-");
    assert.equal(isNoticeReference(s), shapeHolds(s), JSON.stringify(s));
  }
});

test("R10 a /5 document with a well-formed working_on reads it back as its project reference, written as one line and nothing else about the notice", () => {
  assert.equal(WORKING_ON_KEY, "working_on");
  assert.deepEqual(workingOnLines(NOTICE), [`working_on: "${NOTICE}"`], "the one line; nothing else about the notice");
  const text = doc(V5, workingOnLines(NOTICE));
  const fm = fmOf(text);
  assert.equal(parseFrontmatter(text).findings.length, 0, "the grammar reads the line");
  assert.equal(workingOnOf(fm), NOTICE);
  assert.equal(CASE_DOCUMENT_FORMAT, "bio-case-document/10", "the format written today states everything /5 states");
  assert.equal(workingOnOf(fmOf(doc("bio-case-document/6", workingOnLines(NOTICE)))), NOTICE, "an optional field of /6");
  assert.equal(workingOnOf(fmOf(doc("bio-case-document/7", workingOnLines(NOTICE)))), NOTICE, "an optional field of /7 too");
  assert.equal(workingOnOf(fmOf(doc(CASE_DOCUMENT_FORMAT, workingOnLines(NOTICE)))), NOTICE, "and of /8");
  assert.deepEqual([caseDocumentStatesMemberBlocks(fm), caseDocumentRequiresDisclosures(fm),
                    caseDocumentRequiresV4Disclosures(fm), caseDocumentRequiresTensionSection(fm)], [true, true, true, true],
                   "the /5 predicates hold as they did");
  /* beside every other /5 block, each block reads back as before and the reference is read once */
  const full = doc(V5, [...whatChangedBlockLines({ statement: "s", began_as: "member" }), ...workingOnLines(NOTICE),
                        ...captureBlockLines([]), ...sourceBlockLines([]), ...lensBlockLines([])]);
  assert.equal(workingOnOf(fmOf(full)), NOTICE);
  assert.deepEqual(caseDocumentBlocks(full), { captures: [], sources: [], detail: null });
  /* the reading is pure: the same answer twice, the front matter untouched */
  const before = JSON.stringify(fm);
  assert.equal(workingOnOf(fm), workingOnOf(fm));
  assert.equal(JSON.stringify(fm), before);
  /* written unquoted by another hand, the same id reads back the same */
  assert.equal(workingOnOf(fmOf(doc(V5, [`working_on: ${NOTICE}`]))), NOTICE);
});

test("R10 negative controls: a /5 document without working_on names no notice; nor does an older format, odd input, or a malformed value; never throws", () => {
  assert.deepEqual(workingOnLines(null), [], "no notice: no line");
  assert.deepEqual(workingOnLines(undefined), []);
  assert.equal(workingOnOf(fmOf(doc(V5))), null, "a /5 document without it names no notice");
  assert.equal(workingOnOf(fmOf(doc(V5, workingOnLines(null)))), null);
  for (const format of OLDER)
    assert.equal(workingOnOf(fmOf(doc(format, workingOnLines(NOTICE)))), null, `format ${format}: not a field of it`);
  for (const odd of [null, undefined, 7, "x", {}, [], { format: V5 }, { format: V5, working_on: null },
                     { get format() { throw new Error("boom"); } },
                     { format: V5, get working_on() { throw new Error("boom"); } }])
    assert.equal(workingOnOf(odd), null);
  /* a malformed value present in the document is not a notice reference, by the one reading */
  for (const bad of ["note-2026-0001", "NOTE-2026-0001-", "", "null", "NOTE-2026-1", 7]) {
    const fm = fmOf(doc(V5, [`working_on: ${typeof bad === "string" ? `"${bad}"` : bad}`]));
    assert.equal(WORKING_ON_KEY in fm, true, "present");
    assert.equal(isNoticeReference(fm[WORKING_ON_KEY]), false, JSON.stringify(bad));
    assert.equal(workingOnOf(fm), null, JSON.stringify(bad));
  }
});

test("R30 workingOnOf is the one reading of working_on: the notice id for every format from /5 whose value is a notice reference, null for none, for a value that is not one, and for any earlier format", () => {
  const FROM5 = [V5, "bio-case-document/6", "bio-case-document/7", "bio-case-document/8", "bio-case-document/9", CASE_DOCUMENT_FORMAT];
  for (const format of FROM5) {
    assert.equal(caseDocumentRequiresTensionSection({ format }), true, format);
    assert.equal(workingOnOf(fmOf(doc(format, workingOnLines(NOTICE)))), NOTICE, format);
    assert.equal(workingOnOf(fmOf(doc(format))), null, `${format}: none carried`);
  }
  /* control: a /4 document carrying a well-formed working_on answers null, as every format the predicate does not hold for */
  for (const format of [...OLDER, "bio-case-document/11", "Bio-case-document/7"]) {
    assert.equal(caseDocumentRequiresTensionSection({ format }), false);
    assert.equal(workingOnOf(fmOf(doc(format, workingOnLines(NOTICE)))), null, String(format));
  }
  /* control: a malformed value answers null, on every format that states the field */
  for (const format of FROM5)
    for (const bad of ["note-2026-0001", " NOTE-2026-0001", "NOTE-2026-1", "NOTE-2026-0001-X", ""])
      assert.equal(workingOnOf(fmOf(doc(format, workingOnLines(bad)))), null, `${format} ${JSON.stringify(bad)}`);
  /* the one reading: over any value it answers exactly the value when the shape holds, else null */
  for (const v of [NOTICE, "NOTE-2026-10007-parks", "x", 7, null, ["NOTE-2026-0001"], { id: NOTICE }])
    assert.equal(workingOnOf({ format: CASE_DOCUMENT_FORMAT, [WORKING_ON_KEY]: v }), isNoticeReference(v) ? v : null, JSON.stringify(v));
  for (const odd of [null, undefined, 7, "x", [], { get format() { throw new Error("boom"); } }])
    assert.doesNotThrow(() => workingOnOf(odd));
});

test("R30 workingOnLines writes the line folded onto one line, as handed, never trimmed or corrected, and none for null", () => {
  assert.deepEqual(workingOnLines(null), []);
  assert.deepEqual(workingOnLines(undefined), []);
  assert.deepEqual(workingOnLines(NOTICE), [`${WORKING_ON_KEY}: "${NOTICE}"`]);
  for (const [handed, read] of [["  NOTE-2026-0001  ", "  NOTE-2026-0001  "], ["NOTE-2026-0001\r\nx", "NOTE-2026-0001 x"],
                                ["a\nb\rc", "a b c"], ["note-2026-0001", "note-2026-0001"], [7, "7"]]) {
    const lines = workingOnLines(handed);
    assert.equal(lines.length, 1, JSON.stringify(handed));
    assert.equal(fmOf(doc(CASE_DOCUMENT_FORMAT, lines))[WORKING_ON_KEY], read, `${JSON.stringify(handed)}: as handed, on one line`);
  }
  /* a well-formed id written and read through the one reading on the current format */
  assert.equal(workingOnOf(fmOf(doc(CASE_DOCUMENT_FORMAT, workingOnLines(NOTICE)))), NOTICE);
});

test("R10 the writer writes a malformed value as handed, never trimmed or corrected, so ratification R38's refusal finds it by the one reading", () => {
  for (const bad of [" NOTE-2026-0001 ", "note-2026-0001", "NOTE-2026-0001\nINQ-2026-0002", 'NOTE-2026-"0001"', "a\\b", 7, true, ""]) {
    const lines = workingOnLines(bad);
    assert.equal(lines.length, 1, JSON.stringify(bad));
    const text = doc(V5, lines);
    const fm = fmOf(text);
    assert.equal(parseFrontmatter(text).findings.length, 0, "one front-matter line");
    assert.equal(WORKING_ON_KEY in fm, true);
    assert.equal(isNoticeReference(fm[WORKING_ON_KEY]), false, `${JSON.stringify(bad)} stays malformed`);
    assert.equal(workingOnOf(fm), null);
  }
  assert.equal(fmOf(doc(V5, workingOnLines(" NOTE-2026-0001 "))).working_on, " NOTE-2026-0001 ", "never trimmed");
  assert.equal(fmOf(doc(V5, workingOnLines("A\nB"))).working_on, "A B", "folded onto one line");
});
