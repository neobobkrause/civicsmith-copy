/* case-grammar at its interface: R1, the formats and their predicates, and the `/5` blocks and tension section they
   gate, written and read back; R6, what an older or unreadable document leaves undetermined. Copied from publication's
   `casedoc`, `sources` and `tensions` suites' R20 arms (K651) and driven on the bytes alone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V5, CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3, CASE_DOCUMENT_FORMAT_V2,
         CASE_DOCUMENT_FORMAT_LEGACY, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMATS_ACCEPTED, caseDocumentStatesMemberBlocks,
         caseDocumentRequiresDisclosures, caseDocumentRequiresV4Disclosures, caseDocumentRequiresTensionSection,
         caseDocumentRequiresMaterials, caseDocumentBlocks, captureBlockLines, sourceBlockLines, sourceStatement, unnamedSourceStatement,
         sourceRowsStanding, CAPTURE_FIELDS, ACKNOWLEDGEMENT_FIELDS, SOURCE_FIELDS, SOURCE_BASES,
         BLOCKS_PREDATE_SENTENCE, BLOCK_UNREADABLE_SENTENCE, NOT_RECORDED_STATED, caseTensionsOf, disclosedCandidates,
         TENSION_STATE_WORDS, TENSION_HIGHLIGHT_SENTENCE, TENSION_DEPTH_SENTENCE, TENSIONS_PREDATE_SENTENCE,
         TENSIONS_UNREADABLE_SENTENCE, SENTENCES as PINNED } from "../../../src/case-grammar/index.mjs";
import { doc, tensionLines, sha, NOW, V } from "./helpers.mjs";

const PREDICATES = [caseDocumentStatesMemberBlocks, caseDocumentRequiresDisclosures, caseDocumentRequiresV4Disclosures,
                    caseDocumentRequiresTensionSection, caseDocumentRequiresMaterials];
const ODD = [null, undefined, 7, "x", {}, [], { format: null }, { format: "bio-case-document/5 " },
             { get format() { throw new Error("boom"); } }];

test("R1 R33 R35 the formats: /10 is written (R35), /10–/1 accepted as written, /8 and /7 identical in fields to /6 under every predicate, pure and never throwing", () => {
  assert.equal(CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  assert.equal(CASE_DOCUMENT_FORMAT_V7, "bio-case-document/7");
  assert.deepEqual([CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V5, CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3,
                    CASE_DOCUMENT_FORMAT_V2, CASE_DOCUMENT_FORMAT_LEGACY],
                   ["bio-case-document/6", "bio-case-document/5", "bio-case-document/4", "bio-case-document/3",
                    "bio-case-document/2", "bio-case-document/1"]);
  assert.equal(CASE_DOCUMENT_FORMAT_V9, "bio-case-document/9");
  assert.deepEqual([...CASE_DOCUMENT_FORMATS_ACCEPTED], ["bio-case-document/10", "bio-case-document/9", "bio-case-document/8", "bio-case-document/7", "bio-case-document/6",
    "bio-case-document/5", "bio-case-document/4", "bio-case-document/3", "bio-case-document/2", "bio-case-document/1"]);
  assert.equal(Object.isFrozen(CASE_DOCUMENT_FORMATS_ACCEPTED), true);
  const f = (v) => ({ format: `bio-case-document/${v}` });
  const vs = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 0];
  assert.deepEqual(vs.map((v) => caseDocumentStatesMemberBlocks(f(v))), [true, true, true, true, true, true, true, true, true, false, false, false]);
  assert.deepEqual(vs.map((v) => caseDocumentRequiresDisclosures(f(v))), [true, true, true, true, true, true, true, true, false, false, false, false]);
  assert.deepEqual(vs.map((v) => caseDocumentRequiresV4Disclosures(f(v))), [true, true, true, true, true, true, true, false, false, false, false, false]);
  assert.deepEqual(vs.map((v) => caseDocumentRequiresTensionSection(f(v))), [true, true, true, true, true, true, false, false, false, false, false, false],
                   "the other predicates hold for /6 to /10 as they hold for /5");
  assert.deepEqual(vs.map((v) => caseDocumentRequiresMaterials(f(v))), [true, true, true, true, true, false, false, false, false, false, false, false],
                   "the method and materials blocks are required of /6 to /10 only");
  /* DEC-124, R33: /7 and /8 are identical in fields to /6: every predicate answers the same for all three */
  for (const pred of PREDICATES) { assert.equal(pred(f(7)), pred(f(6)), pred.name); assert.equal(pred(f(8)), pred(f(6)), pred.name); assert.equal(pred(f(9)), pred(f(6)), pred.name); assert.equal(pred(f(10)), pred(f(6)), pred.name); }
  for (const odd of [...ODD, { format: "bio-case-document/6 " }, { format: "bio-case-document/7 " }, { format: "bio-case-document/8 " }, { format: "bio-case-document/9 " }, { format: "bio-case-document/10 " },
                     { format: "Bio-case-document/8" }])
    for (const pred of PREDICATES) assert.equal(pred(odd), false);
  /* pure: the same answer twice, and the argument untouched */
  for (const v of [10, 9, 8, 7, 6, 5]) {
    const fm = f(v);
    for (const pred of PREDICATES) assert.equal(pred(fm), pred(fm));
    assert.deepEqual(fm, { format: `bio-case-document/${v}` });
  }
});

const CAP = sha("the knocked bytes");
const CAP2 = sha("more knocked bytes");
const F = "INQ-2026-0001";
const SIGNATURE = "-----BEGIN SSH SIGNATURE-----\nU1NIU0lH\nAAAA=\n-----END SSH SIGNATURE-----";
const captureRow = (over = {}) => ({ capture: CAP, member: F, grade: "B", grade_basis: "a knock held under its digest",
  co_attested: false, timestamp_at: null, co_archive: null, late: false, self_attested_only: true,
  acknowledgement: { reason: "the knocker's bytes, no public copy", acknowledged_by: V("olive"), at: NOW,
                     sentence: "Without co-attestation an outsider can verify the copy has not changed since capture." },
  accounts: [{ by: V("olive"), at: NOW, text: "I pulled it from the doorbell.\nThat evening.", signature: SIGNATURE }],
  ...over });
const withBlocks = ({ captures, sources }, format = CASE_DOCUMENT_FORMAT) =>
  doc(format, [...(captures ? captureBlockLines(captures) : []), ...(sources ? sourceBlockLines(sources) : [])]);

test("R1 the /5 blocks: written by the line builders, read back exactly by caseDocumentBlocks, the accounts byte for byte", () => {
  assert.deepEqual([...CAPTURE_FIELDS], ["capture", "member", "grade", "grade_basis", "co_attested", "timestamp_at",
                                         "co_archive", "late", "self_attested_only"]);
  assert.deepEqual([...ACKNOWLEDGEMENT_FIELDS], ["acknowledgement_reason", "acknowledged_by", "acknowledged_at", "sentence"]);
  assert.deepEqual([...SOURCE_FIELDS], ["capture", "stated", "basis"]);
  assert.deepEqual([...SOURCE_BASES], ["consent", "public_elsewhere"]);
  const plain = { capture: CAP2, member: F, grade: "A", grade_basis: 'fetched, "quoted"\nbasis', co_attested: true,
                  timestamp_at: NOW, co_archive: "https://archive.example/x", late: true, self_attested_only: false };
  const sources = [{ capture: CAP, stated: "attribute employer: the water board", basis: "consent" },
                   { capture: CAP2, stated: unnamedSourceStatement({ capture: CAP2, received: NOW }), basis: null }];
  const text = withBlocks({ captures: [captureRow(), plain], sources });
  /* the written lines: acknowledgement flattened into its four fields, accounts as base64 of the exact bytes */
  assert.match(text, /\n {4}acknowledgement_reason: "the knocker's bytes, no public copy"\n/);
  assert.match(text, /\ncapture_accounts:\n {2}- capture: "[0-9a-f]{64}"\n {4}by: "member:olive"\n/);
  assert.equal(text.includes("I pulled it"), false, "an account's text is written as base64, never raw");
  const b = caseDocumentBlocks(text);
  assert.equal(b.detail, null);
  const { acknowledgement, accounts, ...first } = b.captures[0];
  const { acknowledgement: ack0, accounts: acc0, ...want } = captureRow();
  assert.deepEqual(first, want);
  assert.deepEqual(acknowledgement, ack0, "read back as acknowledgement: {reason, acknowledged_by, at, sentence}");
  assert.deepEqual(accounts, acc0, "an account's text and signature are the exact bytes, so the signature still verifies");
  assert.deepEqual(b.captures[1], { ...plain, grade_basis: "fetched, 'quoted' basis", accounts: [] },
                   "a value is written on one line, quotes made apostrophes; an unacknowledged capture has no acknowledgement");
  assert.deepEqual(b.sources, sources);
  /* the builders write every field of a row, and empty blocks as empty lists */
  assert.deepEqual(captureBlockLines([]), ["captures: []", "capture_accounts: []"]);
  assert.deepEqual(sourceBlockLines([]), ["sources: []"]);
  assert.deepEqual(captureBlockLines([null, 7]), ["captures: []", "capture_accounts: []"], "a row that is not an object is not written");
  assert.deepEqual(caseDocumentBlocks(withBlocks({ captures: [], sources: [] })), { captures: [], sources: [], detail: null });
});

test("R1 R6 blocks before /5 answer null with the sentence that the format predates them; a /5 document without a block is undetermined, never empty; never throws", () => {
  for (const format of [CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3, CASE_DOCUMENT_FORMAT_V2, CASE_DOCUMENT_FORMAT_LEGACY, null])
    assert.deepEqual(caseDocumentBlocks(withBlocks({ captures: [captureRow()], sources: [] }, format)),
                     { captures: null, sources: null, detail: BLOCKS_PREDATE_SENTENCE }, `format ${format}`);
  const noSources = caseDocumentBlocks(withBlocks({ captures: [] }));
  assert.deepEqual([noSources.captures, noSources.sources, noSources.detail], [[], null, BLOCK_UNREADABLE_SENTENCE]);
  const noCaptures = caseDocumentBlocks(withBlocks({ sources: [] }));
  assert.deepEqual([noCaptures.captures, noCaptures.sources, noCaptures.detail], [null, [], BLOCK_UNREADABLE_SENTENCE]);
  for (const odd of [null, undefined, 7, "", "---\n", "not front matter", {}, "---\nformat: bio-case-document/5\n---\n",
                     { toString() { throw new Error("boom"); } }])
    assert.doesNotThrow(() => caseDocumentBlocks(odd));
  assert.equal(caseDocumentBlocks("---\nformat: bio-case-document/5\n---\n").detail, BLOCK_UNREADABLE_SENTENCE);
});

test("R1 sourceStatement is the one spelling of an entry the public may be told, and unnamedSourceStatement the one for none, Withheld with its reason", () => {
  assert.equal(sourceStatement({ kind: "attribute", attribute: "employer", value: "the water board", how: "self" }),
               "attribute employer: the water board");
  assert.equal(sourceStatement({ kind: "name", recorded: false, how: "self" }, CASE_DOCUMENT_FORMAT_V7), `name: ${NOT_RECORDED_STATED}`,
               "a /7 document spells the sentence in its frozen words");
  assert.equal(NOT_RECORDED_STATED, "known to the group, not recorded");
  assert.equal(sourceStatement({ kind: "pseudonym_link", to: "SRC-2026-0002", how: "self" }),
               "pseudonym_link: the same person as SRC-2026-0002");
  assert.equal(sourceStatement({ kind: "pseudonym_link", how: "self" }), "pseudonym_link: the same person as another source");
  assert.equal(sourceStatement({ kind: "name", value: "Pat", how: "hostile", claim: "claimed by a blog" }),
               "name: Pat (claimed by a blog)");
  assert.equal(sourceStatement({ kind: "name", value: "Pat", how: "self", claim: "ignored" }), "name: Pat");
  assert.equal(sourceStatement({ kind: "name", value: 'A "B"\nC' }), "name: A 'B' C");
  for (const odd of [null, undefined, {}, { kind: "" }, "name", 7]) assert.equal(sourceStatement(odd), null);
  /* K1315 (8): the one spelling is case-authoring R37's "Withheld", with its reason */
  assert.equal(unnamedSourceStatement({ capture: CAP, received: NOW }), "Withheld: the source has not consented to being "
    + `named, and no public record names them; received as ${CAP} at ${NOW}`);
  assert.equal(unnamedSourceStatement(), "Withheld: the source has not consented to being named, and no public record "
    + "names them; received as an undetermined digest at an undetermined time");
  assert.equal(unnamedSourceStatement(null), unnamedSourceStatement());
});

test("R1 sourceRowsStanding answers exactly the sources: rows no answered entry or unnamed statement still holds", () => {
  const entry = { kind: "attribute", attribute: "employer", value: "the water board", basis: "consent" };
  const pub = { [CAP]: { entries: [entry], received: NOW }, [CAP2]: { entries: [], received: NOW } };
  const publishable = (c) => pub[c] ?? null;
  const good = [{ capture: CAP, stated: sourceStatement(entry), basis: "consent" },
                { capture: CAP2, stated: unnamedSourceStatement({ capture: CAP2, received: NOW }), basis: null }];
  assert.deepEqual(sourceRowsStanding(good, publishable), []);
  const bad = [{ capture: CAP, stated: sourceStatement(entry), basis: "public_elsewhere" },
               { capture: CAP, stated: "name: Pat", basis: "consent" },
               { capture: CAP, stated: sourceStatement(entry), basis: "rumour" },
               { capture: CAP2, stated: unnamedSourceStatement({ capture: CAP2, received: "2026-01-01T00:00:00Z" }), basis: null },
               { capture: "no-such-capture", stated: "x", basis: null }];
  assert.deepEqual(sourceRowsStanding(bad, publishable), bad);
  assert.deepEqual(sourceRowsStanding(good, () => { throw new Error("boom"); }), good, "a throwing read holds nothing, and never throws");
  assert.deepEqual(sourceRowsStanding(null, publishable), []);
});

const side = (p, x) => ({ [`${p}_kind`]: "claim", [`${p}_text`]: `${x} says so`, [`${p}_source`]: `SRC-${x}`,
                          [`${p}_date`]: "2026-09-01", [`${p}_doctype`]: "minutes", [`${p}_capture`]: null });
const G = "INQ-2026-0002";
const SECRET = "THE-HIDDEN-RECORD";
const ACK = { acknowledged_by: V("olive"), acknowledged_at: "2026-09-29T00:00:00Z" };
const ROWS = [
  { candidate: "c-open", finding: F, state: "open", kind: null, unseen_other_side: false, depth: 1, ...ACK,
    words: "We know.", explanation: null, ...side("a", "A1"), ...side("b", "B1") },
  { candidate: "c-expl", finding: F, state: "explained_not_shown", kind: null, unseen_other_side: false, depth: 1, ...ACK,
    words: null, explanation: "Different dates.", ...side("a", "A2"), ...side("b", "B2") },
  { candidate: "c-up", finding: F, state: "taken_up", kind: null, unseen_other_side: false, depth: 1, ...ACK,
    words: null, explanation: null, ...side("a", "A3"), ...side("b", "B3") },
  { candidate: "c-irr", finding: F, state: "resolved", kind: "irreconcilable", unseen_other_side: false, depth: 1, ...ACK,
    words: null, explanation: null, ...side("a", "A4"), ...side("b", "B4") },
  { candidate: "c-hid", finding: G, state: "open", kind: "irreconcilable", unseen_other_side: true, depth: 1, ...ACK,
    words: "Disclosed as asked.", explanation: SECRET, ...side("side", "S5"), ...side("b", SECRET), highlight: "anything" },
];
const SENTENCES = [
  { target: F, candidate: "c-open", template: "in_tension", sentence: "In tension, not yet resolved: A1 against B1." },
  { target: F, candidate: "c-expl", template: "explained", sentence: "Explained, not yet shown: A2 against B2." },
  { target: G, candidate: "c-hid", template: "unseen", sentence: "Rests on a side in conflict with a record not shown: S5." },
];
const withTensions = (t, format = CASE_DOCUMENT_FORMAT) => doc(format, t ? tensionLines(t) : []);

test("R1 a /5 document's tension section round-trips: each disclosed contradiction with its finding, both sides, its state in words, the explanation, who acknowledged it and when, depth 1 with its sentence", () => {
  assert.equal(sha(JSON.stringify({ ...TENSION_STATE_WORDS })), "85a10b2060f655f39778707068f368edef3f81ac5028066f618ac684de61d469", "the state words' bytes are pinned");
  const r = caseTensionsOf(withTensions({ rows: ROWS, sentences: SENTENCES }));
  assert.equal(r.detail, null);
  assert.deepEqual(r.tensions.map((x) => x.candidate), ["c-open", "c-expl", "c-up", "c-irr", "c-hid"]);
  assert.deepEqual(r.tensions.slice(0, 4).map((x) => x.state), [TENSION_STATE_WORDS.open, TENSION_STATE_WORDS.explained_not_shown,
                                                               TENSION_STATE_WORDS.taken_up, TENSION_STATE_WORDS.irreconcilable]);
  const open = r.tensions[0];
  assert.deepEqual([open.finding, open.depth, open.depth_stated, open.acknowledged_by, open.acknowledged_at, open.highlighted],
                   [F, 1, TENSION_DEPTH_SENTENCE, V("olive"), "2026-09-29T00:00:00Z", false]);
  assert.deepEqual(open.sides.a, { kind: "claim", text: "A1 says so", source: "SRC-A1", date: "2026-09-01", doctype: "minutes", capture: null });
  assert.equal(open.sides.b.text, "B1 says so");
  assert.deepEqual(open.owner_words, { text: "We know.", by: PINNED.caseOwner });
  assert.equal(r.tensions[1].owner_words, null);
  assert.equal(r.tensions[1].explanation, "Different dates.");
  assert.equal(r.tensions[3].kind, "irreconcilable");
  assert.deepEqual(r.members[F].map((s) => [s.candidate, s.template, s.highlighted]),
                   [["c-open", "in_tension", false], ["c-expl", "explained", false]]);
  assert.match(r.members[F][0].sentence, /^In tension, not yet resolved/);
  assert.equal(r.depth, TENSION_DEPTH_SENTENCE);
  assert.equal(caseTensionsOf(withTensions({ rows: ROWS, depth: "one level, as we read it" })).depth, "one level, as we read it");
  assert.deepEqual([...disclosedCandidates(withTensions({ rows: ROWS }))], ["c-open", "c-expl", "c-up", "c-irr", "c-hid"]);
});

test("R1 DEC-85 a disclosed contradiction with a side the publisher could not see is highlighted, counted, and answers nothing of the unseen record", () => {
  const r = caseTensionsOf(withTensions({ rows: ROWS, sentences: SENTENCES }));
  const hid = r.tensions.find((x) => x.candidate === "c-hid");
  assert.deepEqual([hid.unseen_other_side, hid.highlighted, hid.sentence, hid.state], [true, true, TENSION_HIGHLIGHT_SENTENCE, "open"]);
  assert.equal(sha(TENSION_HIGHLIGHT_SENTENCE), "506dc7c6fc8c5d024920c6392147ddb8823a8d904196e8bd1755d9361ab31424", "the sentence's bytes are pinned");
  assert.deepEqual(hid.side, { kind: "claim", text: "S5 says so", source: "SRC-S5", date: "2026-09-01", doctype: "minutes", capture: null });
  assert.equal(r.highlighted, 1);
  for (const k of ["sides", "explanation", "kind", "b", "a"]) assert.equal(k in hid, false, `no ${k}`);
  assert.equal(JSON.stringify(r).includes(SECRET), false, "the unseen record's text, source and explanation never reach the answer");
  assert.deepEqual(r.members[G].map((s) => [s.candidate, s.template, s.highlighted]), [["c-hid", "unseen", true]]);
});

test("R1 R6 K499 before /5 the tensions are null with the sentence that the format predates them; a /5 document with no readable section is undetermined, never empty; unread legs as stated", () => {
  for (const format of [CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3, CASE_DOCUMENT_FORMAT_V2, CASE_DOCUMENT_FORMAT_LEGACY])
    assert.deepEqual(caseTensionsOf(withTensions({ rows: ROWS }, format)),
                     { tensions: null, highlighted: null, depth: null, members: {}, unread: null, detail: TENSIONS_PREDATE_SENTENCE });
  assert.deepEqual(caseTensionsOf(withTensions(null)),
                   { tensions: null, highlighted: null, depth: null, members: {}, unread: null, detail: TENSIONS_UNREADABLE_SENTENCE });
  const none = caseTensionsOf(withTensions({ rows: [], sentences: [] }));
  assert.deepEqual([none.tensions, none.highlighted, none.members, none.detail], [[], 0, {}, null]);
  assert.equal(caseTensionsOf(null).tensions, null);
  assert.equal(caseTensionsOf("not a document").detail, TENSIONS_PREDATE_SENTENCE);
  assert.doesNotThrow(() => caseTensionsOf({ toString() { throw new Error("boom"); } }));
  assert.deepEqual(caseTensionsOf(withTensions({ rows: ROWS, unread: [{ target: F, legs: 2 }] })).unread, [{ member: F, legs: 2 }]);
  assert.deepEqual(caseTensionsOf(withTensions({ rows: [], unread: [] })).unread, []);
  assert.equal(caseTensionsOf(withTensions({ rows: ROWS })).unread, null, "a document silent about unread legs states null");
  assert.equal(disclosedCandidates(withTensions({ rows: ROWS }, CASE_DOCUMENT_FORMAT_V4)).size, 0);
});
