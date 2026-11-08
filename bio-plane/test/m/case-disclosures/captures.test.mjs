/* case-disclosures: each document's grade and co-attestation and the owner's acknowledgement (R2, R3), what may be said
   of a source (R4), a named member's capture unchanged (R11), and a failed source read stated, never filled (R18), at
   this module's interface: `restingCaptures`, `captureFacts`, `selfAttestedJudged`, `sourcesStated`, `withheldOf`,
   `disclosureBlocks`' captures and `captureBodyLines`. Ported from case-authoring's `preflight` and `carries` arms
   (N529). Over the real provenance, attestation, capture and sources modules. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, T0, sha } from "./fixture.mjs";
import { CASE_DISCLOSURE_CHECKS, SELF_ATTESTED_SENTENCE, captureBodyLines } from "../../../src/case-disclosures/index.mjs";
import { unnamedSourceStatement, sourceStatement } from "../../../src/publication/index.mjs";
import { ARCHIVE_VIA, ARCHIVE_CAPTURE_GRADE, REWRITTEN_REPLAY_GRADE } from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { sourceOfReads } from "../sources/fixtures.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b", DOC3 = "INFO-2026-0003-c";
const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-q", Q4 = "INQ-2026-0004-d";
const CO_ATTESTED = { attestations: [{ kind: "rfc3161", service: "tsa.example", file: "snapshots/timestamp-abc.tsr",
                                       sha256: "d".repeat(64) }],
                      co_archive: { service: "archive.example", locator: "https://archive.example/web/x" } };
const REASON = "the site refuses the archive's crawler";
const AT = "2026-09-28T01:00:00Z";

function refused(r, code) {
  assert.equal(r.ok, false, JSON.stringify(r).slice(0, 400));
  assert.deepEqual([r.reason, r.code, r.check, r.translation],
    [code, code, CASE_DISCLOSURE_CHECKS[code].check, CASE_DISCLOSURE_CHECKS[code].translation]);
}
const graded = (w, id, extra = {}, o = {}) => w.doc(id, extra, { receipt: true, ...o });
/* Q rests on a co-attested Grade B document (DOC) and on a Grade B one that is not (DOC2); Q2 rests on DOC2 too. */
function setup(opts) {
  const w = world(opts);
  for (const m of ["alice", "bo"]) w.member(m);
  const a = graded(w, DOC, CO_ATTESTED), b = graded(w, DOC2);
  w.finding(Q, [{ target: DOC }, { target: DOC2 }]);
  w.finding(Q2, [{ target: DOC2 }]);
  return { w, a, b };
}
/* R2's whole judgment as `publishCase` asks it. */
function judge(w, members, selfAttested, supporting = []) {
  const resting = w.cd.restingCaptures(w.prepared(members));
  const facts = new Map([...new Set(resting.map((r) => r.capture))].map((s) => [s, w.cd.captureFacts(s)]));
  return { resting, facts, j: w.cd.selfAttestedJudged(resting, facts, w.roles(members, supporting), selfAttested) };
}
const lateRow = (w, capture, seq, o) => w.st.sql.exec(`INSERT INTO late_attestations (capture_sha, seq, kind, service, ok, at,
  by, outcome) VALUES (?, ?, ?, ?, ?, ?, 'alice', ?)`, capture, seq, o.kind, o.service, o.ok ? 1 : 0, o.at,
  JSON.stringify({ late: true, proves: word("capture.text.proves_bytes_existed", { at: String(o.at) }), ...o }));
const account = (w, capture, text = "I saved it myself.", signature = "SIG-of-alice-7f3") => w.st.sql.exec(`INSERT INTO
  capture_accounts (capture_sha, seq, by, text, signature, key_b64, at) VALUES (?, 1, 'alice', ?, ?, 'AAAA', ?)`,
  capture, text, signature, "2026-09-27T12:00:00Z");

test("R2: restingCaptures answers [{member, capture}] one level deep — a document leg's content-row capture, else every capture its target registers; an inquiry leg none — in member order, then leg order, each pair once", () => {
  const { w, a, b } = setup();
  assert.deepEqual(w.cd.restingCaptures(w.prepared([Q, Q2])), [{ member: Q, capture: a }, { member: Q, capture: b }, { member: Q2, capture: b }]);
  const c = graded(w, DOC3, CO_ATTESTED);
  const cid = sha("a passage of DOC3");
  w.content(cid, c, DOC3);
  w.finding(Q4, [{ target: DOC3, content_id: cid }, { target: Q }, { target: DOC3 }]);
  assert.deepEqual(w.cd.restingCaptures(w.prepared([Q4])), [{ member: Q4, capture: c }],
    "Q's own documents are Q's to state; DOC3 once");
  /* a content row whose capture is not one the document registers still names that capture */
  const d = sha("another capture");
  w.content(sha("p2"), d, DOC3);
  w.finding("INQ-2026-0005-e", [{ target: DOC3, content_id: sha("p2") }, { target: DOC }]);
  assert.deepEqual(w.cd.restingCaptures(w.prepared(["INQ-2026-0005-e"])), [{ member: "INQ-2026-0005-e", capture: d },
                                                                         { member: "INQ-2026-0005-e", capture: a }]);
  assert.deepEqual(w.cd.restingCaptures([]), []);
});

test("R2: captureFacts states the capture's grade (provenance.captureGrade), co_attested only with both a timestamp and a co-archive (attestation.attestationsOf), and its signed accounts (capture.captureAccountsOf)", () => {
  const { w, a, b } = setup();
  account(w, a);
  const fa = w.cd.captureFacts(a), g = w.prov.captureGrade(a);
  assert.deepEqual(fa, { capture: a, grade: g.grade, grade_basis: g.basis, grade_why: g.why, co_attested: true, missing: [],
    timestamp_at: fa.timestamp_at, co_archive: "https://archive.example/web/x", late: false, timestamp_late: false, late_words: null,
    accounts_read: [{ by: "alice", at: "2026-09-27T12:00:00Z", text: "I saved it myself.", signature: "SIG-of-alice-7f3" }] });
  assert.equal(fa.grade, "B");
  assert.deepEqual([w.cd.captureFacts(b).co_attested, w.cd.captureFacts(b).timestamp_at, w.cd.captureFacts(b).co_archive], [false, null, null]);
  /* a timestamp alone or a co-archive alone is not co-attested */
  const ts = graded(w, DOC3, { attestations: CO_ATTESTED.attestations });
  assert.deepEqual([w.cd.captureFacts(ts).co_attested, w.cd.captureFacts(ts).co_archive], [false, null]);
  /* what the attestation instance handed in answers is what is stated */
  const asked = [];
  const none = { attestationsOf: (s) => { asked.push(s); return { ok: true, sha256: s, registered: true, attestations: [], note: "" }; } };
  const n = setup({ deps: { attestation: none } });
  assert.equal(n.w.cd.captureFacts(n.a).co_attested, false);
  assert.deepEqual(asked, [n.a]);
  /* no recorded route earns no letter */
  const w3 = world(); w3.member("alice");
  const u = w3.doc(DOC);
  assert.deepEqual([w3.cd.captureFacts(u).grade, w3.cd.captureFacts(u).grade_basis], [null, "CAPTURE_ROUTE_UNRECORDED"]);
});

test("R2: a timestamp or co-archive obtained late (capture.lateAttestationsOf) counts, stated late; a late co-archive whose replay holds other bytes, or a failed attempt, does not", () => {
  const { w, b } = setup();
  lateRow(w, b, 1, { kind: "timestamp", service: "tsa.example", ok: true, at: "2026-09-28T00:00:00Z" });
  lateRow(w, b, 2, { kind: "co_archive", service: "archive.example", ok: true, at: "2026-09-28T00:01:00Z",
                     archived_locator: "https://archive.example/web/late", matches: false });
  assert.equal(w.cd.captureFacts(b).co_attested, false);
  lateRow(w, b, 3, { kind: "co_archive", service: "archive.example", ok: false, at: "2026-09-28T00:02:00Z" });
  assert.equal(w.cd.captureFacts(b).co_attested, false);
  lateRow(w, b, 4, { kind: "co_archive", service: "archive.example", ok: true, at: "2026-09-28T00:03:00Z",
                     archived_locator: "https://archive.example/web/late2", matches: true });
  const f = w.cd.captureFacts(b);
  assert.deepEqual([f.co_attested, f.late, f.timestamp_at, f.co_archive], [true, true, "2026-09-28T00:00:00Z", "https://archive.example/web/late2"]);
});

test("R2 (C40): after reattest the pre-flight counts a late timestamp as the attempt it is, marked late with when it proves the bytes existed, and says the co-archive is still missing; controls: no attempt misses both, a failed late attempt counts nothing, a timestamp made at capture is not late", () => {
  const { w, a, b } = setup();
  const none = w.cd.captureFacts(b);
  assert.deepEqual([none.missing, none.timestamp_late, none.late_words], [["timestamp", "co_archive"], false, null]);
  lateRow(w, b, 1, { kind: "timestamp", service: "tsa.example", ok: false, at: "2026-09-28T00:00:00Z" });
  const failed = w.cd.captureFacts(b);
  assert.deepEqual([failed.missing, failed.timestamp_late, failed.late_words, failed.timestamp_at], [["timestamp", "co_archive"], false, null, null]);
  lateRow(w, b, 2, { kind: "timestamp", service: "tsa.example", ok: true, at: "2026-09-28T00:05:00Z" });
  const f = w.cd.captureFacts(b);
  assert.deepEqual([f.co_attested, f.missing, f.timestamp_at, f.co_archive, f.timestamp_late, f.late],
    [false, ["co_archive"], "2026-09-28T00:05:00Z", null, true, true]);
  assert.equal(f.late_words, localize("case-disclosures.index.late_proves", "late: proves the bytes existed by {at}, not at capture", { at: "2026-09-28T00:05:00Z" }));
  /* the gate and the rows the pre-flight lists carry the same marks */
  const { j } = judge(w, [Q], []);
  const u = j.refusals[0].unacknowledged[0];
  assert.deepEqual([u.capture, u.missing, u.timestamp_at, u.timestamp_late, u.late_words], [b, ["co_archive"], f.timestamp_at, true, f.late_words]);
  const rows = w.cd.disclosureBlocks({ resting: w.cd.restingCaptures(w.prepared([Q])), facts: new Map() }).captures;
  const row = rows.find((r) => r.capture === b);
  assert.deepEqual([row.missing, row.timestamp_at, row.timestamp_late, row.late_words], [["co_archive"], f.timestamp_at, true, f.late_words]);
  const atCapture = w.cd.captureFacts(a);
  assert.deepEqual([atCapture.timestamp_late, atCapture.late_words, atCapture.late], [false, null, false]);
});

test("R2, R23: captureFacts never throws — a failed grade, attestation, late or account read states less, never more", () => {
  const boom = () => { throw new Error("down"); };
  const w = world({ deps: { provenance: { captureGrade: boom }, attestation: { attestationsOf: boom },
                            capture: { lateAttestationsOf: boom, captureAccountsOf: boom } } });
  assert.deepEqual(w.cd.captureFacts("e".repeat(64)), { capture: "e".repeat(64), grade: null, grade_basis: null, grade_why: null,
    co_attested: false, missing: ["timestamp", "co_archive"], timestamp_at: null, co_archive: null, late: false, timestamp_late: false, late_words: null, accounts_read: [] });
});

test("R2 (C-120.4): a load-bearing Grade B capture not co-attested and not listed is CO_ATTESTATION_UNACKNOWLEDGED, naming each with its members; listed with a reason, nothing refuses; a supporting member's needs none — the case is never refused because a capture is not co-attested", () => {
  const { w, b } = setup();
  const before = w.snapshot();
  const { j } = judge(w, [Q], null);
  assert.equal(j.refusals.length, 1);
  refused(j.refusals[0], "CO_ATTESTATION_UNACKNOWLEDGED");
  assert.deepEqual(j.refusals[0].unacknowledged, [{ capture: b, members: [Q], grade: "B", timestamp_at: null, co_archive: null, missing: ["timestamp", "co_archive"], timestamp_late: false, late_words: null }]);
  assert.ok(j.refusals[0].detail.includes(b), "the document is named");
  assert.deepEqual(w.snapshot(), before, "nothing written");
  const ok = judge(w, [Q], [{ capture: b, reason: REASON }]).j;
  assert.deepEqual([ok.refusals, [...ok.byCapture.values()]], [[], [{ capture: b, ord: 0, reason: REASON }]]);
  /* both members name it: the refusal lists both */
  assert.deepEqual(judge(w, [Q, Q2], null).j.refusals[0].unacknowledged[0].members, [Q, Q2]);
  /* a capture only a supporting member rests on is stated, not asked */
  const c = graded(w, DOC3, CO_ATTESTED);
  w.finding("INQ-2026-0003-c", [{ target: DOC3 }]);
  assert.deepEqual(judge(w, ["INQ-2026-0003-c", Q2], null, [Q2]).j.refusals, []);
  void c;
});

/* BD-18 (provenance R85, CR2-6): a raw `id_` replay of the publisher's response is the ceiling "via archive"; any other
   replay is rewritten, one rank below, reference only. R2 states provenance's letter and why as they are. */
const RAW_REPLAY = `https://web.archive.org/web/20240102030405id_/https://example.org/${DOC3}`;
const REWRITTEN = `https://web.archive.org/web/20240102030405/https://example.org/${DOC3}`;
function archived(locator) {
  const w = world(); w.member("alice");
  const c = w.doc(DOC3);
  w.prov.recordReceipt({ address: `https://example.org/${DOC3}`, addressNorm: `example.org/${DOC3}`, captureSha: c,
                         retrieved: T0, via: ARCHIVE_VIA, retrievalLocator: locator });
  w.finding(Q, [{ target: DOC3 }]);
  return { w, c };
}

test("R2 (BD-18): a raw archive replay's capture is Grade B via archive, at EARNED_CAPTURE_CEILING, so a load-bearing one not co-attested is C-120.4's to acknowledge; its why is provenance's", () => {
  assert.equal(EARNED_CAPTURE_CEILING, "B");
  assert.equal(ARCHIVE_CAPTURE_GRADE, EARNED_CAPTURE_CEILING);
  const { w, c } = archived(RAW_REPLAY);
  const g = w.prov.captureGrade(c);
  const { facts, j } = judge(w, [Q], null);
  const f = facts.get(c);
  assert.deepEqual([f.grade, f.grade_why, f.co_attested], ["B", g.why, false]);
  assert.ok(g.via_archive && g.replay.raw);
  refused(j.refusals[0], "CO_ATTESTATION_UNACKNOWLEDGED");
  assert.deepEqual(j.refusals[0].unacknowledged.map((u) => [u.capture, u.grade]), [[c, "B"]]);
  assert.deepEqual(judge(w, [Q], [{ capture: c, reason: REASON }]).j.refusals, [], "acknowledged, it passes as any B");
});

test("R2 (BD-18): a rewritten archive replay's capture is Grade C, reference only, below EARNED_CAPTURE_CEILING, and needs no acknowledgement; control: none recorded is rewritten too", () => {
  assert.equal(REWRITTEN_REPLAY_GRADE, "C");
  for (const locator of [REWRITTEN, null]) {
    const { w, c } = archived(locator);
    const g = w.prov.captureGrade(c);
    assert.ok(g.reference_only && !g.replay.raw);
    const { facts, j } = judge(w, [Q], null);
    assert.deepEqual([j.refusals, facts.get(c).grade, facts.get(c).grade_why, facts.get(c).co_attested],
      [[], REWRITTEN_REPLAY_GRADE, g.why, false]);
  }
});

test("R2 (C-120.5, C-120.6): an empty reason is SELF_ATTESTED_NO_REASON; a listed capture co-attested or not in the case is SELF_ATTESTATION_NOT_STANDING; in that order after C-120.4; a malformed list is BAD_COMPLETENESS naming the field, alone; listed twice, its first reason kept", () => {
  const { w, a, b } = setup();
  for (const reason of [undefined, "", "   "]) {
    const r = judge(w, [Q], [{ capture: b, ...(reason === undefined ? {} : { reason }) }]).j.refusals;
    assert.deepEqual(r.map((x) => x.reason), ["SELF_ATTESTED_NO_REASON"]);
    refused(r[0], "SELF_ATTESTED_NO_REASON");
    assert.deepEqual(r[0].no_reason, [{ capture: b, ord: 0 }]);
  }
  const co = judge(w, [Q], [{ capture: b, reason: REASON }, { capture: a, reason: REASON }]).j.refusals;
  refused(co[0], "SELF_ATTESTATION_NOT_STANDING");
  assert.deepEqual(co[0].not_standing, [{ capture: a, ord: 1, why: "co_attested" }]);
  const out = judge(w, [Q], [{ capture: b, reason: REASON }, { capture: "e".repeat(64), reason: REASON }]).j.refusals;
  assert.deepEqual(out[0].not_standing, [{ capture: "e".repeat(64), ord: 1, why: "not_in_case" }]);
  /* all three, in order */
  assert.deepEqual(judge(w, [Q], [{ capture: a, reason: "" }]).j.refusals.map((x) => x.reason),
    ["CO_ATTESTATION_UNACKNOWLEDGED", "SELF_ATTESTED_NO_REASON", "SELF_ATTESTATION_NOT_STANDING"]);
  for (const [list, field] of [[{ capture: b }, "selfAttested"], ["x", "selfAttested"], [[b], "selfAttested[0]"],
                               [[{ reason: REASON }], "selfAttested[0]"], [[{ capture: b, reason: 5 }], "selfAttested[0].reason"],
                               [[{ capture: b, reason: 'a "quote"' }], "selfAttested[0].reason"],
                               [[{ capture: b, reason: "a\\b" }], "selfAttested[0].reason"],
                               [[{ capture: b, reason: "a\nb" }], "selfAttested[0].reason"],
                               [[{ capture: b, reason: "x".repeat(2001) }], "selfAttested[0].reason"]]) {
    const r = judge(w, [Q], list).j.refusals;
    assert.deepEqual(r.map((x) => [x.reason, x.field]), [["BAD_COMPLETENESS", field]], JSON.stringify(list).slice(0, 60));
  }
  const twice = judge(w, [Q], [{ capture: b.toUpperCase(), reason: REASON }, { capture: b, reason: "later" }]).j;
  assert.deepEqual([twice.refusals, twice.byCapture.get(b).reason], [[], REASON]);
});

test("R3: in disclosureBlocks' captures an acknowledged capture's rows are self_attested_only with {reason, acknowledged_by, at, sentence}, its signed accounts exact on its first row only; captureBodyLines prints the fixed sentence", () => {
  const { w, a, b } = setup();
  const text = "I saved it from the council page myself.\nThe archive refused it that day.";
  const signature = "-----BEGIN SSH SIGNATURE-----\nU1NIU0lH\n-----END SSH SIGNATURE-----";
  account(w, b, text, signature);
  const { resting, facts, j } = judge(w, [Q, Q2], [{ capture: b, reason: REASON }]);
  const blocks = w.cd.disclosureBlocks({ resting, facts, selfAttested: j, project: "PROJ-x", author: "alice", at: AT });
  assert.deepEqual(blocks.captures.map((c) => [c.member, c.capture, c.self_attested_only, c.accounts.length]),
    [[Q, a, false, 0], [Q, b, true, 1], [Q2, b, true, 0]]);
  const row = blocks.captures[1];
  assert.deepEqual(row.acknowledgement, { reason: REASON, acknowledged_by: "alice", at: AT, sentence: SELF_ATTESTED_SENTENCE });
  assert.deepEqual(row.accounts, [{ by: "alice", at: "2026-09-27T12:00:00Z", text, signature }], "exact bytes");
  assert.equal("acknowledgement" in blocks.captures[0], false);
  assert.equal("accounts_read" in row, false);
  const { accounts_read, ...f } = facts.get(b);
  assert.deepEqual(Object.fromEntries(Object.entries(row).filter(([k]) => k in f)), f, "R2's facts as read");
  void accounts_read;
  /* the byCapture map alone is accepted the same */
  assert.deepEqual(w.cd.disclosureBlocks({ resting, facts, selfAttested: j.byCapture, author: "alice", at: AT }).captures, blocks.captures);
  assert.equal(SELF_ATTESTED_SENTENCE, word("case-disclosures.without_attestation_outsider"));
  const body = captureBodyLines(blocks.captures, []).join("\n");
  const grade = localize("case-disclosures.document.grade_basis", "grade {grade} ({grade_basis})", { grade: "B", grade_basis: String(facts.get(b).grade_basis) });
  for (const s of [word("case-disclosures.document_grade_attestation"), SELF_ATTESTED_SENTENCE,
                   word("case-disclosures.self_attested_acknowledged", { acknowledged_by: "alice", at: AT, reason: REASON }), text, signature,
                   localize("case-disclosures.document.capture_under_members_v1_v2", "- {capture} (under {members}): {v1}{v2}.",
                     { capture: b, members: `${Q}, ${Q2}`, v1: grade, v2: localize("case-disclosures.document.not_co_attested", "; NOT CO-ATTESTED") }),
                   localize("case-disclosures.document.each_document_this_cases_findings", "Each document this case's findings rest on, one level deep, with the grade its capture earns and whether a trusted timestamp and a third party's co-archive attest it. A co-attested Grade {EARNED_CAPTURE_CEILING} document is enough to publish on; one that is not is published only as self-attested, by the owner's stated acknowledgement.", { EARNED_CAPTURE_CEILING })])
    assert.ok(body.includes(s), s.slice(0, 50));
  assert.ok(captureBodyLines([], []).join("\n").includes(word("case-disclosures.case_findings_rest")));
});

test("R2, R3: a late co-attestation is printed as late, and a capture with only one of the two names what it holds", () => {
  const { w, b } = setup();
  lateRow(w, b, 1, { kind: "timestamp", service: "tsa.example", ok: true, at: "2026-09-28T00:00:00Z" });
  const half = captureBodyLines([{ ...w.cd.captureFacts(b), member: Q, accounts: [] }], []).join("\n");
  assert.ok(half.includes(`${localize("case-disclosures.document.not_co_attested", "; NOT CO-ATTESTED")} ${word("case-disclosures.timestamp_archive", { timestamp_at: "2026-09-28T00:00:00Z" })}`));
  lateRow(w, b, 2, { kind: "co_archive", service: "archive.example", ok: true, at: "2026-09-28T00:03:00Z",
                     archived_locator: "https://archive.example/web/late2", matches: true });
  const late = captureBodyLines([{ ...w.cd.captureFacts(b), member: Q, accounts: [] }], []).join("\n");
  assert.ok(late.includes(`${localize("case-disclosures.document.co_attested_timestamp", "; co-attested: a timestamp at {timestamp_at} and a co-archive at {co_archive}",
    { timestamp_at: "2026-09-28T00:00:00Z", co_archive: "https://archive.example/web/late2" })}, ${word("case-disclosures.obtained_late_proves")}.`));
});

test("R4: sourcesStated states, for a capture given to the group, only what sources.publishableAt answers for the public, with its basis, spelled by publication's sourceStatement; with none, publication's unnamedSourceStatement ('Withheld') with the receipt's digest and time; a fetched capture states nothing; no source or entry id; each statement once", () => {
  const w = world();
  for (const m of ["alice", "bo"]) w.member(m);
  const k = w.doc(DOC);
  const f = graded(w, DOC2, CO_ATTESTED);
  w.knocked(k);
  const rows = w.cd.sourcesStated([k, f], V("alice"));
  assert.deepEqual(rows, [{ capture: k, stated: unnamedSourceStatement({ capture: k, received: T0 }), basis: null }]);
  assert.match(rows[0].stated, /^Withheld: /);
  assert.deepEqual([...w.cd.withheldOf(rows)], [k]);
  /* a name disclosed and consented for the public is stated, with its basis; an attribute not consented is not */
  const sourceId = w.sources.sourceOf({ captureSha: k, viewer: V("alice") }).sourceId;
  const name = w.sources.recordDisclosure({ source: sourceId, revealed: { kind: "name", value: "Pat Q. Example" }, how: "self",
                                            knownTo: "group", evidence: "told to alice", sight: ["alice"], by: "alice" });
  const role = w.sources.recordDisclosure({ source: sourceId, revealed: { kind: "attribute", attribute: "role", value: "clerk" },
                                            how: "self", knownTo: "group", evidence: "told to alice", sight: ["alice"], by: "alice" });
  assert.equal(name.ok && role.ok, true);
  assert.equal(w.sources.recordConsent({ source: sourceId, entry: name.entry, audience: "public", evidence: "a signed note",
                                         by: "alice" }).ok, true);
  const entry = w.sources.publishableAt({ source: sourceId, audience: "public" }).entries;
  const named = w.cd.sourcesStated([k, k, f], V("alice"));
  assert.deepEqual(named, [{ capture: k, stated: sourceStatement(entry[0]), basis: "consent" }], "each statement once");
  assert.match(named[0].stated, /Pat Q\. Example/);
  assert.deepEqual([...w.cd.withheldOf(named)], [], "named: not off-the-record");
  for (const leak of [sourceId, name.entry, role.entry, "clerk"]) assert.equal(JSON.stringify(named).includes(leak), false, leak);
  const body = captureBodyLines([], named).join("\n");
  assert.ok(body.includes(`- ${k}: ${named[0].stated}, ${word("case-disclosures.stated_source_consent")}.`));
  assert.ok(captureBodyLines([], []).join("\n").includes(word("case-disclosures.document_case_rests")));
});

test("R4, R18, R23: a source read that fails or throws states the Withheld row — less, never more — and never throws", async () => {
  const k = "e".repeat(64);
  for (const sources of [{ sourceOf: () => { throw new Error("down"); } },
                         { sourceOf: () => null },
                         { sourceOf: () => ({ ok: true, sourceId: "S1", source: { receipt: { sha256: "r".repeat(64), received: T0 } } }),
                           publishableAt: () => { throw new Error("down"); } }]) {
    const w = world({ deps: { sources } });
    const rows = w.cd.sourcesStated([k], V("alice"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].basis, null);
    assert.match(rows[0].stated, /^Withheld: /);
    assert.deepEqual([...w.cd.withheldOf(rows)], [k]);
  }
  /* NO_SUCH_SOURCE is a fetched capture: nothing stated */
  const real = await sourceOfReads();
  for (const none of [real.none, real.fetched]) {
    const w = world({ deps: { sources: { sourceOf: () => none } } });
    assert.deepEqual(w.cd.sourcesStated([k], V("alice")), []);
  }
});

test("R11: a capture a named member made, a load-bearing self-attested Grade B one included, is governed by R2 and R3 unchanged — its account names its member and carries the signature", () => {
  const w = world(); w.member("alice");
  const b = graded(w, DOC);
  account(w, b);
  w.finding(Q, [{ target: DOC }]);
  const { resting, facts, j } = judge(w, [Q], [{ capture: b, reason: REASON }]);
  assert.deepEqual(j.refusals, []);
  const rows = w.cd.sourcesStated([b], V("alice"));
  const blocks = w.cd.disclosureBlocks({ resting, facts, selfAttested: j, withheld: w.cd.withheldOf(rows),
    reached: w.cd.materialsJudged(w.prepared([Q]), w.roles([Q]), V("alice")), project: "PROJ-x", author: "alice", at: AT });
  const row = blocks.captures[0];
  assert.deepEqual([row.self_attested_only, row.accounts[0].by, row.accounts[0].signature], [true, "alice", "SIG-of-alice-7f3"]);
  assert.deepEqual(blocks.materials.attestations.find((x) => x.by_kind === "member"),
    { ref: DOC, by_kind: "member", by: "alice", level: "name", at: "2026-09-27T12:00:00Z", signature: "SIG-of-alice-7f3", recorded_in: null });
});

test("R2 (C39): restingCaptures reads live legs only — a leg whose citation the member severed rests on no capture for the gate; control: the live leg is named", () => {
  const w = world();
  w.member("alice");
  const live = graded(w, DOC), cut = graded(w, DOC2);
  w.finding(Q, [{ target: DOC }, { target: DOC2 }], { severed: [DOC2] });
  assert.deepEqual(w.cd.restingCaptures(w.prepared([Q])), [{ member: Q, capture: live }]);
  const { j } = judge(w, [Q], []);
  assert.deepEqual(j.refusals.map((r) => r.reason), ["CO_ATTESTATION_UNACKNOWLEDGED"]);
  assert.deepEqual(j.refusals[0].unacknowledged.map((u) => u.capture), [live], "only the live leg is named");
  assert.ok(!JSON.stringify(j).includes(cut), "the severed leg's capture is named nowhere");
  /* the same finding with the citation live names both */
  w.finding(Q2, [{ target: DOC }, { target: DOC2 }]);
  assert.deepEqual(w.cd.restingCaptures(w.prepared([Q2])), [{ member: Q2, capture: live }, { member: Q2, capture: cut }]);
});

test("R16 (C39): hunchDebt reads live legs only — a hunch on a severed leg is no debt; control: the same hunch on a live leg is", () => {
  const w = world();
  w.member("alice");
  graded(w, DOC);
  const hunch = { grade: "B", grade_axis: "connection", grade_source: "hunch", author: "member:alice", date: "2026-09-27" };
  w.finding(Q, [{ target: DOC, ...hunch }], { severed: [DOC] });
  assert.equal(w.cd.hunchDebt(w.prepared([Q])), null);
  w.finding(Q2, [{ target: DOC, ...hunch }]);
  assert.equal(w.cd.hunchDebt(w.prepared([Q2])).reason, "UNCLEARED_HUNCH");
});

test("R2 (C40): CO_ATTESTATION_UNACKNOWLEDGED names which of the timestamp and the co-archive each capture lacks; control: a capture with both is not named", () => {
  const w = world();
  w.member("alice");
  const none = graded(w, DOC), tsOnly = graded(w, DOC2, { attestations: CO_ATTESTED.attestations }),
        caOnly = graded(w, DOC3, { co_archive: CO_ATTESTED.co_archive }), both = graded(w, "INFO-2026-0004-d", CO_ATTESTED);
  w.finding(Q, [{ target: DOC }, { target: DOC2 }, { target: DOC3 }, { target: "INFO-2026-0004-d" }]);
  const { j } = judge(w, [Q], []);
  const named = new Map(j.refusals[0].unacknowledged.map((u) => [u.capture, u.missing]));
  assert.deepEqual([...named.keys()].sort(), [none, tsOnly, caOnly].sort());
  assert.deepEqual(named.get(none), ["timestamp", "co_archive"]);
  assert.deepEqual(named.get(tsOnly), ["co_archive"]);
  assert.deepEqual(named.get(caOnly), ["timestamp"]);
  assert.ok(!named.has(both));
});
