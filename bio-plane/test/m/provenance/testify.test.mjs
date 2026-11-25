/* provenance: a member's firsthand observation (R28), and no place named in the module's behaviour or text (R40). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V } from "./fixture.mjs";
import { testimonyBytes, observerRef, TESTIMONY_FORMAT, TESTIMONY_MAX_BYTES, TESTIMONY_PATH } from "../../../src/provenance/index.mjs";
import * as CHECKS from "../../../src/provenance/checks.mjs";
import { TESTIMONY_GRADE } from "../../../src/record-grammar/index.mjs";

test("R28: testify writes an authored information bundle whose bytes are the header and the words", () => {
  const w = world({ now: "2026-09-27T03:04:05.678Z" });
  const words = "The meeting started at 6:05, not 6:00.\n  Twice.  ";
  const t = w.prov.testify({ words, observedAt: "2026-09-20T18:05Z", title: "  At\tthe\nmeeting ", author: V("ruth") });
  assert.equal(t.ok, true, JSON.stringify(t));
  assert.match(t.bundle_id, /^INFO-2026-\d{4}-observation$/);
  const bytes = testimonyBytes({ id: t.bundle_id, observedAt: "2026-09-20T18:05Z", words });
  assert.equal(bytes, `${TESTIMONY_FORMAT}\nid: ${t.bundle_id}\nobserved_at: 2026-09-20T18:05Z\n\n${words}`);
  assert.equal(t.capture_sha, sha(bytes));
  assert.equal(w.record.readFile(t.bundle_id, t.file).text, bytes, "the words exactly as written");
  assert.deepEqual([t.bytes, t.words_bytes], [Buffer.byteLength(bytes), Buffer.byteLength(words)]);
  assert.equal(w.head(t.bundle_id).currentState, "collected");
  assert.equal(w.head(t.bundle_id).title, "At the meeting");
  /* The register row: authored, with the stamped author and the member's observed_at; recorded kept apart. */
  const row = w.row(`SELECT * FROM register WHERE capture_sha=?`, t.capture_sha);
  assert.deepEqual([row.authored, row.author, row.observed_at, row.bundle_id], [1, V("ruth"), "2026-09-20T18:05Z", t.bundle_id]);
  assert.equal(t.recorded_at, "2026-09-27T03:04:05Z");
  assert.equal(t.observed_at, "2026-09-20T18:05Z");
  /* No author identity in the bytes or any file of the bundle: the observer is named only by reference. */
  for (const p of w.record.livePaths(t.bundle_id)) assert.equal(w.record.readFile(t.bundle_id, p).text.includes("ruth"), false, p);
  const prov = JSON.parse(w.record.readFile(t.bundle_id, "data/provenance.json").text).documents[0];
  assert.equal(prov.author, observerRef(t.bundle_id));
  assert.equal(observerRef(t.bundle_id), `observer:${t.bundle_id}`);
  assert.deepEqual([prov.authored, prov.origin.kind, prov.capture.actor_class, prov.capture.grade], [true, "member", "member", undefined]);
  /* Identical words from two members are two captures. */
  const t2 = w.prov.testify({ words, observedAt: "2026-09-20T18:05Z", author: V("sam") });
  assert.notEqual(t2.capture_sha, t.capture_sha);
  /* The answer's axes. */
  assert.deepEqual([t.axes.capture.grade, t.axes.capture.determined, t.axes.capture.undetermined_because],
                   [null, false, "CAPTURE_AXIS_AUTHORED"]);
  assert.deepEqual([t.axes.connection.grade, t.axes.connection.determined], [null, false]);
  assert.deepEqual([t.axes.testimony.grade, t.axes.testimony.determined], [TESTIMONY_GRADE, true]);
  assert.deepEqual([t.authored, t.origin, t.actor_class, t.author], [true, "member", "member", V("ruth")]);
  assert.equal(typeof t.says, "string");
});

test("R28: the refusals, in order, each with its catalogue row; a refusal spends nothing", () => {
  const w = world();
  const rr = (args) => w.prov.testify({ words: "w", observedAt: "2026-09-20", author: V("ruth"), ...args });
  const codes = {
    TESTIMONY_NOT_A_MEMBER: [rr({ author: "" }), rr({ author: "token:member" }), rr({ author: "class:ai", words: "" })],
    TESTIMONY_AUTHOR_SUPPLIED: [rr({ claimedAuthor: "someone", words: "" })],
    TESTIMONY_NO_WORDS: [rr({ words: "   \n" }), rr({ words: null, observedAt: "bad" })],
    TESTIMONY_WORDS_TOO_LONG: [rr({ words: "é".repeat(TESTIMONY_MAX_BYTES / 2 + 1), observedAt: "bad" })],
    TESTIMONY_OBSERVED_AT_INVALID: [rr({ observedAt: "2026-02-31" }), rr({ observedAt: "" }), rr({ observedAt: "2999-01-01" }),
                                    rr({ observedAt: "2026-09-20T25:00Z" })],
  };
  const checks = { TESTIMONY_NOT_A_MEMBER: "C-53.1", TESTIMONY_AUTHOR_SUPPLIED: "C-53.2", TESTIMONY_NO_WORDS: "C-53.3",
                   TESTIMONY_WORDS_TOO_LONG: "C-53.4", TESTIMONY_OBSERVED_AT_INVALID: "C-53.5" };
  for (const [code, answers] of Object.entries(codes))
    for (const a of answers) assert.deepEqual([a.ok, a.reason, a.check, typeof a.translation], [false, code, checks[code], "string"], code);
  const over = rr({ words: "x".repeat(TESTIMONY_MAX_BYTES + 1) });
  assert.deepEqual([over.bytes, over.limit], [TESTIMONY_MAX_BYTES + 1, TESTIMONY_MAX_BYTES], "refused, never cut");
  assert.equal(w.count("bundles"), 0);
  /* The producing group's absence: refused by the promotion, and no id spent. */
  w.facts.group = null;
  const g = rr({});
  assert.equal(g.reason, "GROUP_UNDETERMINED");
  w.facts.group = "test-group";
  const ok = rr({});
  assert.equal(ok.ok, true);
  assert.match(ok.bundle_id, /^INFO-\d{4}-0001-observation$/, "the refused attempt spent no id");
  /* The canonical bytes already registered: refused naming no bundle; that id is spent. */
  const year = ok.bundle_id.slice(5, 9);
  const nextId = `INFO-${year}-0002-observation`;
  const squat = testimonyBytes({ id: nextId, observedAt: "2026-09-20", words: "w" });
  const r = w.promoteInfo("INFO-2026-0900-squat", { captures: [{ path: "snapshots/s.txt", text: squat }] });
  assert.equal(r.ok, true);
  const hit = rr({});
  assert.deepEqual([hit.reason, hit.check], ["TESTIMONY_WORDS_REGISTERED", "C-53.6"]);
  assert.equal(hit.detail.includes("INFO-2026-0900-squat"), false, "names no bundle");
  const after = rr({});
  assert.equal(after.bundle_id, `INFO-${year}-0003-observation`, "the next attempt gets new bytes");
});

test("R28: only testify's own package carries the authored flag, under a key no JSON body can hold", () => {
  assert.equal(typeof TESTIMONY_PATH, "symbol");
  const parsed = JSON.parse(JSON.stringify({ [TESTIMONY_PATH]: { captureSha: "x" }, "mk1-testimony-path": { captureSha: "x" } }));
  assert.equal(Object.getOwnPropertySymbols(parsed).length, 0);
});

test("R40: no place is named in the module's behaviour or outward text", async () => {
  const w = world();
  const place = /oakland|alameda|california|\bca\b|berkeley/i;
  const texts = [];
  const t = w.prov.testify({ words: "w", observedAt: "2026-09-20", author: V("ruth") });
  texts.push(t, w.prov.testify({ words: "", author: V("r") }), w.prov.testify({ author: "" }));
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  texts.push(w.promoteInfo("INFO-2026-0002-b", { captures: [a] }));
  texts.push(w.prov.versionChain({ addressNorm: "", viewer: V("r") }), w.prov.homeCensus({}), await w.prov.registerAudit(null));
  texts.push(w.prov.captureGrade(a.sha), w.prov.captureGrade(sha("none")), w.prov.declareOrigin({ bundleId: "x", by: "" }));
  texts.push(w.prov.registerHolds({ sha: a.sha, bundle: "INFO-2026-0001-a" }), w.prov.registeredFor("INFO-2026-0001-a"));
  texts.push(w.prov.recordReceipt({ addressNorm: "e.org/a", captureSha: a.sha }), w.prov.receipts({}),
             w.prov.receiptsOfCapture({ captureSha: a.sha }), w.prov.fetchedByThisCopy(a.sha));
  /* Every refusal row this module exports. */
  texts.push(Object.values(CHECKS));
  for (const x of texts) assert.equal(place.test(JSON.stringify(x)), false, JSON.stringify(x).slice(0, 200));
});
