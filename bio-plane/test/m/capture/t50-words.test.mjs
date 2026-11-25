/* capture, T50 (N1116; K3366, K3368; DEC-257, DEC-258, DEC-260; `setup-words` R11–R13): words by key. The module holds no
   member-facing English: every sentence it answers is `setup-words`' `word(key, vars)`, and no test here holds a
   sentence's English. The keys it reads are the `reads` list for `capture` in `words-reads.json`; each is held
   (`hasWord`), and the sentences a fixture can draw out are asserted equal to `word(key, vars)`. A key some other test file
   of this module drives is named in ELSEWHERE with that file, and the union must be the whole list. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fresh, bucket, receipt, register, H } from "./fixture.mjs";
import { CAPTURE_CHECKS } from "../../../src/capture/checks.mjs";
import { WITHHELD_QUESTION } from "../../../src/capture/index.mjs";
import { WORD_KEYS, say, rowWord, keysRead } from "../../../src/capture/words.mjs";
import { word, hasWord, WORD_ROWS } from "../../../src/setup-words/index.mjs";

const raw = (key) => WORD_ROWS.find((r) => r[0] === key)[1];
const reads = async () => JSON.parse(await readFile(
  new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8")).modules.capture;
const asserted = new Set();
const same = (actual, key, vars) => { asserted.add(key); assert.equal(actual, word(key, vars), key); };

test("every key the module reads is held by setup-words (hasWord), each once, and is the `reads` list for capture in words-reads.json (DEC-258)", async () => {
  assert.ok(Object.isFrozen(WORD_KEYS));
  assert.equal(new Set(WORD_KEYS).size, WORD_KEYS.length, "no key twice");
  for (const key of WORD_KEYS) {
    assert.equal(hasWord(key), true, key);
    assert.match(word(key, Object.fromEntries((raw(key).match(/\{(\w+)\}/g) ?? []).map((p) => [p.slice(1, -1), "x"]))), /\S/, key);
  }
  const { reads: list } = await reads();
  assert.deepEqual([...WORD_KEYS].sort(), [...list].sort());
  /* control: a key the list lacks is not held; say() reads no word outside the module's own list */
  assert.equal(hasWord("capture.no_such_sentence"), false);
  assert.throws(() => say("capture.no_such_sentence"), /not one of this module's word keys/);
  assert.throws(() => say("refusal.NOT_AN_ADMIN"), /not one of this module's word keys/, "a held key of another module is not this one's");
  assert.throws(() => word("capture.no_such_sentence"), /UNKNOWN_WORD/);
});

test("R37 every refusal row's translation is the words of refusal.<CODE>, and no row's words carry the word group", () => {
  assert.deepEqual(Object.keys(CAPTURE_CHECKS).sort(), ["ACCOUNT_NO_TEXT", "CAPTURE_NOT_HELD", "EVIDENCE_NOT_HELD", "MACHINE_CANNOT_SET_ASIDE",
                                                        "NOT_THE_CAPTURING_ACTOR", "SET_ASIDE_NO_REASON", "UPLOAD_NO_STATEMENT"]);
  for (const [code, row] of Object.entries(CAPTURE_CHECKS)) {
    same(row.translation, `refusal.${code}`);
    /* R101's CAPTURE_NOT_HELD reads the design's key through `localize` (a stand-in) until the design adds it to capture's `reads` */
    if (code !== "CAPTURE_NOT_HELD") assert.equal(row.translation, rowWord(code));
  }
  /* "team", never "group", in what people read (N1160): every sentence the module reads */
  for (const key of WORD_KEYS) assert.doesNotMatch(raw(key), /\bgroup(?!ing)/i, key);
  same(WITHHELD_QUESTION, "screen.held.withheld");
});

test("R15 R8 R22 R23 R39 R40: the sentences the store's acts answer are the words of their keys", async () => {
  const { c } = fresh();
  /* R15: an enqueue that names no subject */
  await c.taskEnqueue({ kind: "authority-undetermined", captureSha: H("1"), subject: "  " });
  same(c.taskEvents({ limit: 5 })[0].subject, "capture.text.capture_whose_authority");
  /* R8: an address never attempted; one governed refusal; failures that reach the count; the age arm; one old failure */
  const addr = "https://x.example/doc";
  same(c.sourceReachability({ addressNorm: addr }).basis, "capture.basis.attempt_address_ever");
  await c.recordSourceOutcome({ addressNorm: addr, outcome: "governed", at: "2026-01-01T00:00:00Z" });
  same(c.sourceReachability({ addressNorm: addr, now: "2026-01-01T00:00:00Z" }).basis, "capture.basis.eligible_governed_refusal", { governed_refusals: 1 });
  await c.recordSourceOutcome({ addressNorm: addr, outcome: "source_refused", at: "2026-01-01T00:00:00Z" });
  same(c.sourceReachability({ addressNorm: addr, now: "2026-01-02T00:00:00Z" }).basis, "capture.basis.eligible_threshold_met");
  same(c.sourceReachability({ addressNorm: addr, now: "2026-01-20T00:00:00Z" }).basis, "capture.basis.eligible_failing_days", { stale_days: 19 });
  await c.recordSourceOutcome({ addressNorm: addr, outcome: "fetch_failed", at: "2026-01-02T00:00:00Z" });
  same(c.sourceReachability({ addressNorm: addr, now: "2026-01-20T00:00:00Z" }).basis, "capture.basis.failing_since_days",
       { first_failure_since: "2026-01-01T00:00:00Z", stale_days: 19, days: 14, min_for_age: 2 });
  await c.recordSourceOutcome({ addressNorm: addr, outcome: "fetch_failed", at: "2026-01-03T00:00:00Z" });
  same(c.sourceReachability({ addressNorm: addr, now: "2026-01-03T00:00:00Z" }).basis, "capture.basis.consecutive_failures_produced",
       { consecutive_failures: 3, failures: 3 });
  /* R22: a session that is not there */
  same(c.loadCaptureSession({ session: "nope" }).note, "capture.note.capture_session_either");
  /* R23: a run that was never refused */
  same(c.recordCaptureLimit({ runtime: "subrequests" }).note, "capture.note.run_refused_says");
  /* R39, R40: a render over the cap waits; a render that reports no elapsed time */
  const at = "2026-10-07T12:00:00Z";
  c.renderAdmit({ allowanceMs: 10000, reserveMs: 1000, cap: 1, at });
  same(c.renderAdmit({ allowanceMs: 10000, reserveMs: 1000, cap: 1, at }).why, "capture.why.renders_running_group", { running: 1, cap_n: 1 });
  same(c.renderSpend({ at }).why, "capture.why.renderer_reported_elapsed");
});

test("R29 R24 R27: the notes of the host's navigation, the site's chrome and a document's links are the words of their keys", () => {
  const { c, s } = fresh();
  /* R29: nothing observed yet */
  const empty = c.navChanges({ host: "h.example" });
  assert.equal(empty.note, say("capture.note.fewer_two_captures") + say("capture.note.chrome_containment_chrome"));
  same(empty.note.slice(0, word("capture.note.fewer_two_captures").length), "capture.note.fewer_two_captures");
  asserted.add("capture.note.chrome_containment_chrome");
  assert.ok(empty.note.endsWith(word("capture.note.chrome_containment_chrome")));
  /* R29: two captures whose navigation differs: a link is lost */
  const nav = (addrs) => addrs.map((a) => ({ ref: a, address: a, address_norm: a, type: "deferred", chrome: true, chrome_basis: "<nav>" }));
  for (const [cap, page, first, links] of [[H("7"), "https://h.example/p1", "2026-01-01T00:00:00Z", ["https://h.example/a", "https://h.example/b"]],
                                           [H("8"), "https://h.example/p2", "2026-01-02T00:00:00Z", ["https://h.example/a"]]]) {
    receipt(s, { address: page, capture: cap, first });
    c.recordLinks({ sourceCapture: cap, links: nav(links) });
  }
  const two = c.navChanges({ host: "h.example" });
  assert.ok(two.observations >= 2);
  assert.ok(two.note.startsWith(word("capture.note.link_lost_site")));
  asserted.add("capture.note.link_lost_site");
  /* the lost link carried on one page only is undetermined, never lost */
  assert.equal(two.undetermined.length, 1);
  same(two.undetermined[0].why, "capture.why.carried_chrome_region");
  /* R24: fewer than three documents, and the primaries with no page on record */
  const obs = (a) => [{ address_norm: a, address: a, sha256: H("a"), content_type: "text/css", bytes: 1, kind: "furniture" }];
  c.recordSiteAssets({ host: "h.example", primarySha: H("e"), observations: obs("https://h.example/a.css") });
  const one = c.siteChrome({ host: "h.example" });
  assert.ok(one.note.startsWith(word("capture.note.fewer_three_documents")));
  assert.ok(one.note.endsWith(word("capture.note.further_capture_host", { undetermined: 1, s: "" })));
  asserted.add("capture.note.fewer_three_documents"); asserted.add("capture.note.further_capture_host");
  c.recordSiteAssets({ host: "h.example", primarySha: H("f"), observations: obs("https://h.example/a.css") });
  assert.ok(c.siteChrome({ host: "h.example" }).note.endsWith(word("capture.note.further_capture_host", { undetermined: 2, s: "s" })), "the plural");
  /* R24: three documents on record */
  for (const [cap, page] of [[H("1"), "https://h.example/d1"], [H("2"), "https://h.example/d2"], [H("3"), "https://h.example/d3"]]) {
    receipt(s, { address: page, capture: cap, first: "2026-01-01T00:00:00Z" });
    c.recordSiteAssets({ host: "h.example", primarySha: cap, observations: obs("https://h.example/a.css") });
  }
  assert.ok(c.siteChrome({ host: "h.example" }).note.startsWith(word("capture.note.chrome_means_address")));
  asserted.add("capture.note.chrome_means_address");
  /* R27: a link that resolves to nothing the record holds, and the note every resolution carries */
  c.recordLinks({ sourceCapture: H("7"), links: nav(["https://elsewhere.example/x"]) });
  const r = c.resolveLinks({ sourceCapture: H("7") });
  same(r.note, "capture.note.undetermined_resting_state");
  same(r.links.find((l) => l.resolution === "offsite").basis, "capture.basis.record_holds_capture");
});

test("R27: a link to the document itself, and one whose target changed between the captures bracketing the source's retrieval, state their bases in the words of their keys", () => {
  const { c, s } = fresh();
  const T = "2026-05-10T00:00:00Z";
  const link = (a) => ({ ref: a, address: a, address_norm: a, citation_norm: a, type: "deferred" });
  c.recordLinks({ sourceCapture: H("a"), capturedAt: T, links: [link("https://t.example/self"), link("https://t.example/changed")] });
  /* the document's own address, seen served on both sides of its retrieval, is its own capture */
  receipt(s, { address: "https://t.example/self", capture: H("a"), first: "2026-05-01T00:00:00Z", last: "2026-05-20T00:00:00Z", observations: 2 });
  /* a target last seen before the retrieval as one capture and first seen after it as another */
  receipt(s, { address: "https://t.example/changed", capture: H("b"), first: "2026-05-01T00:00:00Z", last: "2026-05-05T00:00:00Z" });
  receipt(s, { address: "https://t.example/changed", capture: H("c"), first: "2026-05-15T00:00:00Z", last: "2026-05-16T00:00:00Z" });
  const by = Object.fromEntries(c.resolveLinks({ sourceCapture: H("a") }).links.map((l) => [l.link_ref, l]));
  assert.equal(by["https://t.example/self"].verdict, "contemporaneous");
  same(by["https://t.example/self"].basis, "capture.basis.link_points_document");
  assert.equal(by["https://t.example/changed"].verdict, "undetermined");
  same(by["https://t.example/changed"].basis, "capture.basis.target_changed_somewhere");
});

test("R79 R83: the sentences a held document's undetermined answers carry are the words of their keys", async () => {
  const { c, s } = fresh();
  s.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('m1', 'c', 'member', 'active', '2026-01-01', '2026-01-01')`);
  register(s, H("1"), "INFO-1");
  const now = "2026-03-11T00:00:00Z";
  const row = (await c.heldCaptures({ viewer: "member:m1", now })).held[0];
  same(row.eligibility_basis, "capture.undetermined.batch_release_examination");
  same(row.captured_for_basis, "capture.basis.reader_questions_document");
  /* a set-aside with no reader registered: the questions waiting are undetermined */
  const aside = c.setAside({ ids: ["INFO-1"], reason: "r", author: "member:m1", viewer: "member:m1" });
  same(aside.documents[0].waiting_basis, "capture.waiting_basis");
  /* a reader that answers nothing it can use */
  const quiet = fresh();
  quiet.s.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('m1', 'c', 'member', 'active', '2026-01-01', '2026-01-01')`);
  register(quiet.s, H("1"), "INFO-1");
  quiet.c.registerReader("captured-for", "capture-requests", () => { throw new Error("down"); });
  same((await quiet.c.heldCaptures({ viewer: "member:m1", now })).held[0].captured_for_basis, "capture.basis.did_answer_questions", { module: "capture-requests" });
});

test("R86: an upload's provenance document states its authority in the words of its key, with the instant", async () => {
  const f = fresh({ evidence: bucket() });
  const at = "2026-03-01T10:00:00Z";
  const up = await f.c.uploadCapture({ bytes: new TextEncoder().encode("a file"), statement: "from my drawer", by: "member:m1", at });
  assert.equal(up.ok, true);
  same(up.document.authority_basis, "capture.authority_basis", { at });
});

/* The keys other test files of this module assert as `word(key, vars)` where they draw the sentence: reattest's
   (knocker and t35: the replay's bases, the late note and sentence), the links' other verdict bases (services), the held
   page's wait (t49), the evidence-storage refusal (t35). `acquisition.string.attempt_reported` is drawn by no fixture:
   `attest` always reports an attempt for each authority it asks, so the fallback sentence for "none reported" is
   defensive; its key is held and the module reads it only through `say`. */
const ELSEWHERE = [
  "capture.match_basis.archived_locator_replay", "capture.match_basis.co_archive_gave", "capture.match_basis.co_archive_replay",
  "capture.match_basis.co_archive_replay_holds", "capture.match_basis.governor_holding_requests", "capture.match_basis.replay_answered",
  "capture.match_basis.replay_fetched", "capture.match_basis.replay_larger_group", "capture.note.attempt_recorded_late",
  "capture.text.proves_bytes_existed", "capture.basis.bytes_seen_served", "capture.basis.capture_target_postdates",
  "capture.basis.link_points_document_itself", "capture.basis.record_captures_target", "capture.basis.record_holds_capture_target",
  "capture.files_basis", "capture.undetermined.examination_did_answer", "capture.undetermined.examination_did_answer_document",
  "capture.response.group_civicsmith_evidence",
];
const UNDRAWN = ["acquisition.string.attempt_reported"];

test("every key the module reads is asserted as its words by a fixture here or in the file ELSEWHERE names, but one no fixture draws; the page wait's symbol is read when the module loads", () => {
  const driven = new Set([...asserted, ...ELSEWHERE]);
  for (const key of ELSEWHERE) assert.ok(WORD_KEYS.includes(key), `${key} is one of the module's keys`);
  assert.deepEqual(WORD_KEYS.filter((k) => !driven.has(k)).sort(), [...UNDRAWN, "capture.symbol.page_wait_ran"].sort());
  assert.equal(keysRead().has("capture.symbol.page_wait_ran"), true, "read at load, as the symbol's description");
  for (const key of keysRead()) assert.ok(WORD_KEYS.includes(key), key);
});
