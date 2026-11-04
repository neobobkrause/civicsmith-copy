/* case-grammar at its interface, T45 (N888; CASE-CARRIAGE #9 J1; K2767): R27, `caseDocumentBlocks`, the one reading of
   R1's `captures:`, `capture_accounts:` and `sources:` blocks, and R28, `sourceRowsStanding`, the `sources:` rows that no
   longer hold, its non-list edge failing closed. Each clause has its test and the controls the requirement names (K874).
   Driven on the bytes alone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as CG from "../../../src/case-grammar/index.mjs";
import { doc, sha, NOW, V } from "./helpers.mjs";

const CAP = sha("the knocked bytes");
const CAP2 = sha("more knocked bytes");
const F = "INQ-2026-0001";
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const FROM5 = ["bio-case-document/5", "bio-case-document/6", "bio-case-document/7", CG.CASE_DOCUMENT_FORMAT, CG.CASE_DOCUMENT_FORMAT_V9];
const BEFORE5 = ["bio-case-document/4", "bio-case-document/3", "bio-case-document/2", "bio-case-document/1", null,
                 "bio-case-document/11x", "Bio-case-document/7"];

/* ===== R27 ===== */

test("R27 the two sentences are exported verbatim", () => {
  assert.equal(sha(CG.BLOCKS_PREDATE_SENTENCE), "6fceeeacc08c96e1c8ea3126db4e05e7c1f0b0abe013bc3f3b273d1a812aa1d7", "the bytes are pinned");
  assert.equal(sha(CG.BLOCK_UNREADABLE_SENTENCE), "a6cc0545d19b82a519cb528173361519612954ed9b6b39678aaf985ef6a10e93", "the bytes are pinned");
});

test("R27 before /5: a document R1's caseDocumentRequiresTensionSection does not hold for answers captures and sources null with the predate sentence, whatever blocks it carries", () => {
  const blocks = [...CG.captureBlockLines([{ capture: CAP, member: F, grade: "B" }]), ...CG.sourceBlockLines([{ capture: CAP, stated: "x", basis: null }])];
  for (const format of BEFORE5) {
    assert.equal(CG.caseDocumentRequiresTensionSection({ format }), false);
    assert.deepEqual(CG.caseDocumentBlocks(doc(format, blocks)), { captures: null, sources: null, detail: CG.BLOCKS_PREDATE_SENTENCE }, String(format));
  }
  /* control: a /4 document answers both null with the predate sentence, never an empty list */
  assert.deepEqual(CG.caseDocumentBlocks(doc("bio-case-document/4", ["captures: []", "sources: []"])),
                   { captures: null, sources: null, detail: CG.BLOCKS_PREDATE_SENTENCE });
  for (const format of FROM5) assert.equal(CG.caseDocumentBlocks(doc(format, blocks)).detail, null, format);
});

test("R27 captures: one entry per object row with every field, a value written null or absent reading null, the three booleans from a boolean or its string, else null", () => {
  for (const format of FROM5) {
    const text = doc(format, ["captures:",
      `  - capture: "${CAP}"`, `    member: "${F}"`, '    grade: "B"', '    grade_basis: "fetched"', "    co_attested: true",
      `    timestamp_at: "${NOW}"`, '    co_archive: "https://archive.example/x"', '    late: "false"', '    self_attested_only: "true"',
      `  - capture: "${CAP2}"`, "    member: null", '    grade: "null"', "    co_attested: maybe", "    late: 1", "    self_attested_only: false",
      "sources: []"]);
    const b = CG.caseDocumentBlocks(text);
    assert.deepEqual(b.captures, [
      { capture: CAP, member: F, grade: "B", grade_basis: "fetched", co_attested: true, timestamp_at: NOW,
        co_archive: "https://archive.example/x", late: false, self_attested_only: true, accounts: [] },
      { capture: CAP2, member: null, grade: null, grade_basis: null, co_attested: null, timestamp_at: null, co_archive: null,
        late: null, self_attested_only: false, accounts: [] }], format);
    assert.equal(b.detail, null);
  }
  /* rows that are not objects are not entries */
  assert.deepEqual(CG.caseDocumentBlocks(doc(CG.CASE_DOCUMENT_FORMAT, ["captures:", "  - x", `  - capture: "${CAP}"`, "sources: []"])).captures
    .map((c) => c.capture), [CAP]);
});

test("R27 accounts: every capture_accounts: row naming the capture, in order, as {by, at, text, signature}, decoded from base64; an undecodable value reads null", () => {
  const SIG = "-----BEGIN SSH SIGNATURE-----\nU1NIU0lH\n-----END SSH SIGNATURE-----";
  const text = doc(CG.CASE_DOCUMENT_FORMAT, ["captures:", `  - capture: "${CAP}"`, `  - capture: "${CAP2}"`,
    "capture_accounts:",
    `  - capture: "${CAP}"`, `    by: "${V("olive")}"`, `    at: "${NOW}"`, `    text_b64: "${b64("first, é")}"`, `    signature_b64: "${b64(SIG)}"`,
    `  - capture: "${CAP2}"`, `    by: "${V("heron")}"`, "    at: null", `    text_b64: "${b64("theirs")}"`, "    signature_b64: null",
    `  - capture: "${CAP}"`, "    by: null", `    text_b64: "!!!not base64"`, '    signature_b64: "/w=="',
    `  - capture: "${CAP}"`, `    text_b64: "${b64("third")}"`, "    signature_b64: 7",
    "  - by: nobody", "sources: []"]);
  const [one, two] = CG.caseDocumentBlocks(text).captures;
  assert.deepEqual(one.accounts, [
    { by: V("olive"), at: NOW, text: "first, é", signature: SIG },
    { by: null, at: null, text: null, signature: null },
    { by: null, at: null, text: "third", signature: null }], "in order; undecodable base64, bytes that are not UTF-8, and a number read null");
  assert.deepEqual(two.accounts, [{ by: V("heron"), at: null, text: "theirs", signature: null }], "only the rows naming that capture");
  /* control: an undecodable account reads null text, never what a lenient decoder would make of it */
  assert.equal(Buffer.from("!!!not base64", "base64").length > 0, true, "Node's decoder would answer bytes");
  /* round trip with R1's line builder: every text, a line break, quotes and unicode, byte for byte */
  const HARD = "It's \"exact\" \\ here\nsecond line — é";
  const back = CG.caseDocumentBlocks(doc(CG.CASE_DOCUMENT_FORMAT, [...CG.captureBlockLines([{ capture: CAP, accounts: [
    { by: V("olive"), at: NOW, text: HARD, signature: SIG }, { by: V("olive"), at: NOW, text: "x", signature: "y" }] }]), "sources: []"]));
  assert.deepEqual(back.captures[0].accounts, [{ by: V("olive"), at: NOW, text: HARD, signature: SIG }, { by: V("olive"), at: NOW, text: "x", signature: "y" }]);
});

test("R27 acknowledgement: a row stating acknowledgement_reason or acknowledged_by also carries {reason, acknowledged_by, at, sentence}; any other row carries none", () => {
  const b = CG.caseDocumentBlocks(doc(CG.CASE_DOCUMENT_FORMAT, ["captures:",
    `  - capture: "${CAP}"`, '    acknowledgement_reason: "no public copy"', '    acknowledged_at: "2026-09-01"', '    sentence: "S."',
    `  - capture: "${CAP2}"`, `    acknowledged_by: "${V("olive")}"`,
    `  - capture: "${CAP}"`, '    acknowledged_at: "2026-09-01"', '    sentence: "S."',
    "sources: []"])).captures;
  assert.deepEqual(b[0].acknowledgement, { reason: "no public copy", acknowledged_by: null, at: "2026-09-01", sentence: "S." });
  assert.deepEqual(b[1].acknowledgement, { reason: null, acknowledged_by: V("olive"), at: null, sentence: null });
  assert.equal("acknowledgement" in b[2], false, "a row stating neither field carries no acknowledgement, whatever else it states");
});

test("R27 sources: null when the block is not a list, else one {capture, stated, basis} per object row; detail null only when both are lists", () => {
  const rows = [{ capture: CAP, stated: "attribute employer: the water board", basis: "consent" },
                { capture: CAP2, stated: CG.unnamedSourceStatement({ capture: CAP2, received: NOW }), basis: null }];
  const caps = CG.captureBlockLines([{ capture: CAP }]);
  const ok = CG.caseDocumentBlocks(doc(CG.CASE_DOCUMENT_FORMAT, [...caps, ...CG.sourceBlockLines(rows)]));
  assert.deepEqual([ok.sources, ok.detail], [rows, null]);
  /* control: a /7 document with no sources: list answers sources null and the unreadable sentence */
  for (const lines of [[], ["sources: none"], ['sources: "x"'], ["sources:", "  key: value"]]) {
    const b = CG.caseDocumentBlocks(doc(CG.CASE_DOCUMENT_FORMAT, [...caps, ...lines]));
    assert.deepEqual([b.sources, b.detail], [null, CG.BLOCK_UNREADABLE_SENTENCE], JSON.stringify(lines));
    assert.equal(b.captures.length, 1, "the other block is still read");
  }
  /* and captures not a list, beside a list of sources */
  const noCaps = CG.caseDocumentBlocks(doc(CG.CASE_DOCUMENT_FORMAT, ["captures: none", ...CG.sourceBlockLines(rows)]));
  assert.deepEqual([noCaps.captures, noCaps.sources, noCaps.detail], [null, rows, CG.BLOCK_UNREADABLE_SENTENCE]);
  const neither = CG.caseDocumentBlocks(doc(CG.CASE_DOCUMENT_FORMAT));
  assert.deepEqual(neither, { captures: null, sources: null, detail: CG.BLOCK_UNREADABLE_SENTENCE });
  assert.deepEqual(CG.caseDocumentBlocks(doc(CG.CASE_DOCUMENT_FORMAT, ["captures: []", "sources: []"])), { captures: [], sources: [], detail: null });
  assert.deepEqual(CG.caseDocumentBlocks(doc(CG.CASE_DOCUMENT_FORMAT, ["captures: []", "sources:", "  - x", `  - capture: "${CAP}"`])).sources,
                   [{ capture: CAP, stated: null, basis: null }], "object rows only, an unwritten field null");
});

test("R27 a text that cannot be parsed answers both null with the unreadable sentence; it is pure and never throws", () => {
  for (const odd of [{ toString() { throw new Error("boom"); } }])
    assert.deepEqual(CG.caseDocumentBlocks(odd), { captures: null, sources: null, detail: CG.BLOCK_UNREADABLE_SENTENCE });
  for (const odd of [null, undefined, 7, "", "not a document", {}, [], "---\n", "---\nformat: bio-case-document/7\n---\n"])
    assert.doesNotThrow(() => CG.caseDocumentBlocks(odd));
  const text = doc(CG.CASE_DOCUMENT_FORMAT, [...CG.captureBlockLines([{ capture: CAP, accounts: [{ by: "a", text: "t", signature: "s" }] }]), ...CG.sourceBlockLines([])]);
  assert.deepEqual(CG.caseDocumentBlocks(text), CG.caseDocumentBlocks(text), "the same answer twice");
});

test("R27 round trip with R1's line builders, on every format that states the blocks", () => {
  const caps = [{ capture: CAP, member: F, grade: "A", grade_basis: 'fetched, "quoted"', co_attested: true, timestamp_at: NOW,
                  co_archive: null, late: false, self_attested_only: true,
                  acknowledgement: { reason: "r", acknowledged_by: V("olive"), at: NOW, sentence: "S." },
                  accounts: [{ by: V("olive"), at: NOW, text: "t\nu", signature: "s" }] },
                { capture: CAP2, member: F, grade: null, grade_basis: null, co_attested: false, timestamp_at: null, co_archive: "c",
                  late: true, self_attested_only: false }];
  const sources = [{ capture: CAP, stated: "name: Pat", basis: "consent" }, { capture: CAP2, stated: "s", basis: null }];
  for (const format of FROM5) {
    const b = CG.caseDocumentBlocks(doc(format, [...CG.captureBlockLines(caps), ...CG.sourceBlockLines(sources)]));
    assert.deepEqual(b, { captures: [{ ...caps[0], grade_basis: "fetched, 'quoted'" }, { ...caps[1], accounts: [] }], sources, detail: null }, format);
  }
});

/* ===== R28 ===== */

const ENTRY = { kind: "attribute", attribute: "employer", value: "the water board", basis: "consent" };
const ELSEWHERE = { kind: "name", value: "Pat", basis: "public_elsewhere" };
const answers = { [CAP]: { entries: [ENTRY, ELSEWHERE], received: NOW }, [CAP2]: { entries: [], received: NOW } };
const counted = (map = answers) => { const asked = []; return { asked, publishable: (c) => { asked.push(c); return map[c] ?? null; } }; };
const withheld = (capture, received = NOW) => CG.unnamedSourceStatement({ capture, received });

test("R28 a row holds when publishable answered, its stated is a string, and either basis is null and stated (folded) is the unnamed statement, or basis is a SOURCE_BASES word an answered entry has and spells", () => {
  assert.deepEqual([...CG.SOURCE_BASES], ["consent", "public_elsewhere"]);
  const holding = [{ capture: CAP, stated: CG.sourceStatement(ENTRY), basis: "consent" },
                   { capture: CAP, stated: CG.sourceStatement(ELSEWHERE), basis: "public_elsewhere" },
                   { capture: CAP2, stated: withheld(CAP2), basis: null },
                   { capture: CAP2, stated: `  ${withheld(CAP2)}\n`, basis: null }];
  const { publishable } = counted();
  assert.deepEqual(CG.sourceRowsStanding(holding, publishable), [], "every row holds; the withheld statement compared folded by fmSafe");
  /* stated compared folded both ways for a named entry too */
  assert.deepEqual(CG.sourceRowsStanding([{ capture: CAP, stated: `${CG.sourceStatement(ENTRY)}\n`, basis: "consent" }], publishable), []);
});

test("R28 every other row is answered, as {capture, stated, basis} in input order: a basis no answered entry has, a spelling no entry gives, a basis outside SOURCE_BASES, a stated that is not a string", () => {
  const { publishable } = counted();
  const rows = [{ capture: CAP, stated: CG.sourceStatement(ENTRY), basis: "public_elsewhere" },
                { capture: CAP, stated: "name: Pat", basis: "consent" },
                { capture: CAP, stated: CG.sourceStatement(ENTRY), basis: "rumour" },
                { capture: CAP, stated: CG.sourceStatement(ENTRY), basis: "consent" },
                { capture: CAP, stated: 7, basis: "consent" },
                { capture: CAP2, stated: null, basis: null }];
  assert.deepEqual(CG.sourceRowsStanding(rows, publishable), [rows[0], rows[1], rows[2],
    { capture: CAP, stated: null, basis: "consent" }, { capture: CAP2, stated: null, basis: null }]);
});

test("R28 controls: a stated row whose publishableAt entry was withdrawn is answered; a withheld row with a different received is answered", () => {
  const rows = [{ capture: CAP, stated: CG.sourceStatement(ENTRY), basis: "consent" }, { capture: CAP2, stated: withheld(CAP2), basis: null }];
  assert.deepEqual(CG.sourceRowsStanding(rows, counted().publishable), [], "both hold at the commit");
  const withdrawn = { ...answers, [CAP]: { entries: [ELSEWHERE], received: NOW } };
  assert.deepEqual(CG.sourceRowsStanding(rows, counted(withdrawn).publishable), [rows[0]], "the entry withdrawn: the row no longer holds");
  const later = { ...answers, [CAP2]: { entries: [], received: "2026-10-01T00:00:00Z" } };
  assert.deepEqual(CG.sourceRowsStanding(rows, counted(later).publishable), [rows[1]], "another receipt: the withheld row no longer holds");
  assert.deepEqual(CG.sourceRowsStanding([{ capture: CAP2, stated: withheld(CAP2, "2020-01-01T00:00:00Z"), basis: null }], counted().publishable).length, 1);
});

test("R28 publishable is called at most once per distinct capture, never for a row whose capture is not a string, which does not hold; null, or a throw, holds no row of that capture", () => {
  const { asked, publishable } = counted();
  const rows = [{ capture: CAP, stated: CG.sourceStatement(ENTRY), basis: "consent" }, { capture: CAP, stated: "x", basis: "consent" },
                { capture: CAP2, stated: withheld(CAP2), basis: null }, { capture: CAP, stated: CG.sourceStatement(ENTRY), basis: "consent" },
                { capture: 7, stated: "x", basis: null }, { capture: null, stated: "x", basis: null }, { stated: "x", basis: null }, null, 7];
  const out = CG.sourceRowsStanding(rows, publishable);
  assert.deepEqual(asked, [CAP, CAP2], "once per distinct capture, in the order first met; never for a capture that is not a string");
  assert.deepEqual(out, [rows[1], { capture: null, stated: "x", basis: null }, { capture: null, stated: "x", basis: null },
                         { capture: null, stated: "x", basis: null }, { capture: null, stated: null, basis: null }, { capture: null, stated: null, basis: null }]);
  /* control: publishable throwing makes that capture's rows fail, and nothing throws */
  const good = [{ capture: CAP, stated: CG.sourceStatement(ENTRY), basis: "consent" }, { capture: CAP2, stated: withheld(CAP2), basis: null }];
  const throwsOn = (c) => { if (c === CAP) throw new Error("boom"); return answers[c]; };
  assert.deepEqual(CG.sourceRowsStanding(good, throwsOn), [good[0]], "only the capture whose read threw");
  assert.deepEqual(CG.sourceRowsStanding(good, () => { throw new Error("boom"); }), good);
  assert.deepEqual(CG.sourceRowsStanding(good, () => null), good, "no source behind the capture: no row holds, the withheld one included");
  assert.deepEqual(CG.sourceRowsStanding(good, "not a function"), good);
});

test("R28 fail closed: an answer whose entries is not a list (truthy or not), or an answer that is not an object, holds no row of that capture, and the function never throws", () => {
  const good = [{ capture: CAP, stated: CG.sourceStatement(ENTRY), basis: "consent" }, { capture: CAP, stated: withheld(CAP), basis: null }];
  /* control: entries "x" answers the row and does not throw */
  for (const entries of ["x", { 0: ENTRY, length: 1 }, 7, true, null, undefined, { some: () => true }]) {
    const publishable = () => ({ entries, received: NOW });
    assert.doesNotThrow(() => CG.sourceRowsStanding(good, publishable), JSON.stringify(entries));
    assert.deepEqual(CG.sourceRowsStanding(good, publishable), good, `entries ${JSON.stringify(entries)}`);
  }
  for (const answer of [7, "x", true, [ENTRY]])
    assert.deepEqual(CG.sourceRowsStanding(good, () => answer), good, JSON.stringify(answer));
  /* a list answer holds as before */
  assert.deepEqual(CG.sourceRowsStanding(good, () => ({ entries: [ENTRY], received: NOW })), []);
  /* entries and rows that throw when read hold nothing and never throw */
  const hostile = { entries: [{ get basis() { throw new Error("boom"); } }], received: NOW };
  assert.deepEqual(CG.sourceRowsStanding([good[0]], () => hostile), [good[0]]);
  const hostileRow = { get capture() { throw new Error("boom"); } };
  assert.doesNotThrow(() => CG.sourceRowsStanding([hostileRow, good[0]], () => ({ entries: [ENTRY], received: NOW })));
  assert.deepEqual(CG.sourceRowsStanding([hostileRow, good[0]], () => ({ entries: [ENTRY], received: NOW })), [{ capture: null, stated: null, basis: null }]);
});

test("R28 rows that are not a list answer []; it is pure: the same answer twice, its arguments untouched", () => {
  for (const odd of [null, undefined, 7, "x", {}, { length: 1, 0: { capture: CAP } }]) assert.deepEqual(CG.sourceRowsStanding(odd, counted().publishable), []);
  const rows = [{ capture: CAP, stated: "x", basis: "consent" }];
  const before = JSON.stringify(rows);
  assert.deepEqual(CG.sourceRowsStanding(rows, counted().publishable), CG.sourceRowsStanding(rows, counted().publishable));
  assert.equal(JSON.stringify(rows), before);
  assert.notEqual(CG.sourceRowsStanding(rows, counted().publishable)[0], rows[0], "an answered row is a new object");
});
