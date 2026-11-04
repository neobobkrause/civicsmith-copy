/* reading-pipeline R29 (T41-9; N820, D21; text-chain R104): the AI's reading of the pages Civicsmith's own text
 * recognition could not read, a transcription tier above tier 3, at a member's act on the account that pays for it,
 * within its limits (`use: "transcribe"`), never under a "no AI" material limit. Tested at the module's interface:
 * `read` with the `transcription` its caller hands in, and the pieces `tier4Pages` and `tier4Extend` (R23); and R30, the
 * re-read's seed (`tier3SeedFrom`, `tier3Extend`) keeping the pages the AI read.
 *
 * THE ACCOUNT IS REAL (K874's negative controls): record-core, membership and ai-accounts over one SQLite database
 * (node:sqlite, the engine a Durable Object runs), and the account is asked of `ai-accounts.accountFor` (its R7, R11)
 * as the caller hands it in, `transcription.accounts` (R31, T48; N996). `credentials`, later in the order than
 * ai-accounts and no longer this module's dependency, is never built: the founder's claim it states to membership (its
 * R17, membership R94) is a test fact here, and enrolment's password setter (membership R95) a test setter that
 * stores nothing, as ai-accounts' own tests do. The limits (`ai-use.useCheck`) and the AI itself are the caller's and
 * are scripted here. */
import { test } from "node:test";
import { word } from "../../../src/setup-words/index.mjs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { accountForRefused } from "../ai-accounts/fixtures.mjs";
import { world } from "../ai-accounts/fixture.mjs";
import { PLANS, HOSTS } from "../ai-accounts/catalogue.mjs";
import { derivationCap, captureBound, checkChain, describeChain } from "../../../src/textchain.mjs";
import * as rp from "../../../src/reading-pipeline/index.mjs";
import { bucket, evidenceStore, hold, doc, withEntry, i2, noText, folio, member, ocrAnswer } from "./fixture.mjs";
import { registerDoctype, readText } from "../../../../docprofile/registry.mjs";
import { registerDoctypes } from "../../../../doctypes/index.mjs";
import { wordRx } from "../../word-rx.mjs";
import { said } from "./said.mjs";

registerDoctypes(registerDoctype);
const { tier4Pages, tier4Extend, tier3SeedFrom, tier3Extend, TRANSCRIBE_USE, AI_READING_LABEL, AI_TRANSCRIPTION_SOURCE } = rp;

const SEAL = "test-seal-secret-0123456789";
const ANN_KEY = "sk-ann-own-key-never-shown";
const P1_KEY = "sk-project-one-key-never-shown";
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/* A group: the founder, a second administrator; `ann` holds her own API key; `dee` holds none and the group holds no
   key; project P1 (owned by ann, `bob` joined) holds its own key; P2 (owned by ann) holds none. `acc` is ai-accounts'
   instance on the group's storage. (notice ai-accounts:124) The world is ai-accounts' own (`test/m/ai-accounts/fixture.mjs`:
   its real membership and record-core over SQLite, and ai-catalogue's published fixture), and the accounts are set by
   T53's acts (`accountSet` as its `own` and `projectAccount` call it, switched on by `accountSwitch`, each recipient's notice
   seen by ann and bob, not dee), since PR 124 left the old key acts no catalogue to serve from. */
async function group() {
  const w = await world().group("ann", "bob", "dee");
  const acc = w.a, m = w.m;
  for (const id of ["ann", "bob"]) acc.recipientNoticeSeen({ member: id, provider: PLANS.provider, host: HOSTS.main, by: id });
  for (const p of ["P1", "P2"]) w.project(p, "ann");
  assert.equal(w.join("P1", "ann", "bob").ok, true);
  const own = await w.own("ann", { secret: ANN_KEY });
  assert.equal(own.ok, true);
  assert.equal(acc.accountSwitch({ account_id: own.account_id, on: true, by: "ann" }).ok, true);
  const p1 = await w.projectAccount("P1", "ann", { secret: P1_KEY });
  assert.equal(p1.ok, true);
  assert.equal(acc.accountSwitch({ account_id: p1.account_id, on: true, by: "ann" }).ok, true, "a project's account is off when first set (ai-accounts)");
  return { acc, m, w };
}

/* The caller's limits (`ai-use.useCheck`, its R3) and AI, scripted and recorded. */
function limits(answer = null) {
  const asked = [];
  return { asked, useCheck: async (q) => { asked.push(q); return typeof answer === "function" ? answer(q) : answer; } };
}
function ai(answer) {
  const calls = [];
  return { calls, transcribe: async (q) => { calls.push(q); return typeof answer === "function" ? answer(q) : answer; } };
}
const model = (pages, extra = {}) => ({ ok: true, engine: "vision-model", version: "3",
  pages: pages.map((p) => ({ page: p, text: `the AI read page ${p}` })), asked: pages, sent: pages, owed: [], ...extra });

/* A scanned PDF as the pdf entry reads it: page 0 a text layer, page 1 a scan, page 2 an image filling the page with
   its folio "12". Tier 3 is not bound, so pages 1 and 2 stay unread. */
const PAGES = [{ page: 0, text: "Staff report on the capital plan" },
               { page: 1, text: "", undetermined: [noText(1)] },
               { page: 2, text: "12", undetermined: [folio(2)] }];
const scanEntry = (pages = PAGES) => ({ format: "pdf", structure: async () => ({ ok: true, text: i2(pages), pages: pages.length, notes: [] }) });
/* `read` called directly, as its caller does, with the `transcription` a member's act hands in. */
async function readWith({ transcription = null, env = {}, pages = PAGES } = {}) {
  const b = bucket();
  const d = await hold(b, `%PDF scan ${JSON.stringify(pages)}`);
  const document = doc({ digest: d, format: "pdf", ct: "application/pdf", locator: "https://records.example.gov/report.pdf" });
  return withEntry(scanEntry(pages), () => rp.read(document, { evidence: evidenceStore(b), env, storeName: "bio", transcription }));
}
const leaks = (out, ...secrets) => secrets.filter((s) => JSON.stringify(out).includes(s));

test("R29 R23: a member's act on her own account, within its limits: the pages Civicsmith's own text recognition could not read are the AI's reading, under pixels -> ai_transcription(<model>) at tier 4, uncapped and so undetermined; a folio page keeps its folio with the AI's reading appended; labelled the AI's reading; the key reaches the AI alone", async () => {
  const { acc } = await group();
  const lim = limits(null);
  const a = ai((q) => model(q.pages));
  const out = await readWith({ transcription: { member: "ann", accounts: acc, useCheck: lim.useCheck, transcribe: a.transcribe, at: "2026-10-09T12:00:00Z" } });
  const r = out.reading;
  /* asked once, for exactly the unread pages, with the account the cascade chose, the digest and the store */
  assert.equal(a.calls.length, 1);
  assert.deepEqual([a.calls[0].pages, a.calls[0].use, a.calls[0].store, a.calls[0].account.level, a.calls[0].account.key],
                   [[1, 2], TRANSCRIBE_USE, "bio", "member", ANN_KEY]);
  assert.match(a.calls[0].capture_sha, /^[0-9a-f]{64}$/);
  assert.deepEqual(lim.asked, [{ owner: "member:ann", member: "ann", use: "transcribe", at: "2026-10-09T12:00:00Z" }]);
  /* the reading: tier 4, the AI's pages merged by R6's rule */
  assert.deepEqual([r.read_from_text, r.text_tier, r.text_container], [true, 4, "pdf"]);
  assert.deepEqual(r.ai_transcription, { pages: [1, 2], engine: "vision-model", version: "3", label: AI_READING_LABEL });
  assert.deepEqual(out.text_units.map((u) => [u.extent.page, u.text]),
                   [[0, "Staff report on the capital plan"], [1, "the AI read page 1"], [2, "12\nthe AI read page 2"]]);
  /* the chain: the layer part (pages 0 and the folio page 2) and the AI's part (pages 1, 2), part-stamped (D-723) */
  const c0 = r.text_source;
  assert.equal(checkChain(c0), null);
  assert.deepEqual(c0.map((s) => [s.step, s.extent.pages, s.extent.part]),
                   [["layer", [0, 2], 0], ["pixels", [1, 2], 1], ["ai_transcription", [1, 2], 1]]);
  const step = c0[2];
  assert.deepEqual([step.engine, step.version, step.cap, step.measured_by, step.calibration],
                   ["vision-model", "3", null, AI_TRANSCRIPTION_SOURCE, null]);
  assert.equal(c0[1].cap, null, "the pixels the AI read are uncapped too");
  /* undetermined: no machine mints a grade (R20; text-chain R104) */
  assert.equal(derivationCap(c0), null);
  assert.equal(derivationCap(c0, { page: 1 }), null);
  assert.equal(captureBound(c0), null, "captureBound answers undetermined for text the AI produced");
  assert.doesNotMatch(JSON.stringify(out), /"grade"/);
  /* labelled: the basis says it, the chain's sentence says it */
  assert.match(r.basis, /pages 2-3 that Civicsmith's own text recognition could not read were transcribed by the AI \(vision-model 3\) at a member's request, on the account that pays for it: this text is the AI's reading, not yet determined/);
  assert.match(r.basis, said("reading-pipeline.already_held_little", { appended: "page 3" }));
  /* re-recorded at fix round 9 (K4861 (3), K4863): text-chain R39 spells the pages 1-based, as a reader counts */
  assert.match(describeChain(c0), new RegExp(`${said("textchain.label.ai_reading_page").source} \\(vision-model 3\\) \\(pages 2-3\\)`), "the chain's own sentence (text-chain's 1-based pages)");
  assert.doesNotMatch(r.basis, /\binstance\b|\bthe plane\b/i, "DEC-149's words");
  /* R18: pages the AI read are tier 4, named by the model; the folio page has both producers */
  const pg = Object.fromEntries(r.provenance.pages.map((p) => [p.page, p]));
  assert.deepEqual([pg[0].tier, pg[0].member, pg[1].tier, pg[1].member], [1, "plane", 4, null]);
  assert.deepEqual(pg[2].producers, [{ tier: 1, member: "plane" }, { tier: 4, member: null }]);
  assert.ok(r.provenance.producers.some((p) => p.tier === 4 && p.engine === "vision-model 3" && p.pages.join() === "1,2"));
  /* the key went to the AI only */
  assert.deepEqual(leaks(out, ANN_KEY, P1_KEY), []);
});

test("R29: on a project's account the act names the project: the project's key pays (owner `project:<id>` asked of the limits), once the member has read its notice", async () => {
  const { acc } = await group();
  const seen = acc.projectKeyNoticeSeen({ member: "bob", project: "P1", by: "bob" });
  assert.equal(seen.ok, true, JSON.stringify(seen));
  const lim = limits(null);
  const a = ai((q) => model(q.pages));
  const out = await readWith({ transcription: { member: "bob", project: "P1", accounts: acc, useCheck: lim.useCheck, transcribe: a.transcribe } });
  assert.equal(a.calls.length, 1, out.reading.basis);
  assert.deepEqual([a.calls.length, a.calls[0].account.level, a.calls[0].account.key], [1, "project", P1_KEY]);
  assert.deepEqual(lim.asked.map((q) => [q.owner, q.member, q.use]), [["project:P1", "bob", "transcribe"]]);
  assert.equal(out.reading.text_tier, 4);
  assert.deepEqual(leaks(out, ANN_KEY, P1_KEY), []);
});

test("R29 (negative controls, K874): no account, the use switched off, the group's \"no AI\" limit, the project's, a limit reached, no limits checked, no member's act: nothing is sent to the AI, the reading is tiers 1-3's exactly, and its basis names why", async () => {
  const base = (await readWith()).reading;
  const same = (r, label) => {
    for (const k of ["text_source", "text_tier", "found", "entities", "provenance", "text_chars", "page_count"])
      assert.deepEqual(r[k], base[k], `${label}: ${k} is tiers 1-3's`);
    assert.equal(r.ai_transcription, undefined, `${label}: no AI reading`);
  };
  const cases = [
    ["no account", async (w) => ({ member: "dee" }), /NO_ACCOUNT/],
    ["switched off", async (w) => { assert.equal(w.acc.accountUsesSet({ owner: "member:ann", switch: "transcribe", on: false, by: "ann" }).ok, true);
                                    return { member: "ann" }; }, /AI_USE_SWITCHED_OFF/],
    ["group keeps it away", async (w) => { assert.equal(w.acc.aiKeepAwaySet({ on: true, uses: ["transcribe"], reason: "no AI on our records", by: "admin" }).ok, true);
                                           return { member: "ann" }; }, /AI_KEPT_AWAY/],
    ["project keeps it away", async (w) => { assert.equal(w.acc.projectAiKeepAwaySet({ project: "P1", on: true, uses: ["transcribe"], reason: "not this matter", by: "ann" }).ok, true);
                                             return { member: "ann", project: "P1" }; }, /PROJECT_AI_KEPT_AWAY/],
    ["a project he cannot see", async (w) => ({ member: "dee", project: "P1" }), /NO_SUCH_PROJECT/],
    // fixtures-contract: ai-use use-check
    ["limit reached", async (w) => ({ member: "ann", useCheck: async () => ({ ok: false, code: "AI_LIMIT_REACHED", detail: "this month's use is spent" }) }), /AI_LIMIT_REACHED: this month's use is spent/],
    ["no limits checked", async (w) => ({ member: "ann", useCheck: null }), /limits of the account that would pay for it could not be checked/],
    ["no member's act", async (w) => ({ member: null }), /only at a member's own act/],
    ["no accounts handed in", async (w) => ({ member: "ann", accounts: null }), /could not be checked/],
  ];
  for (const [label, setup, says] of cases) {
    const w = await group();
    const lim = limits(null);
    const a = ai(() => { throw new Error("the AI must not be asked"); });
    const extra = await setup(w);
    const transcription = { accounts: w.acc, useCheck: lim.useCheck, transcribe: a.transcribe, ...extra };
    const out = await readWith({ transcription });
    assert.equal(a.calls.length, 0, `${label}: nothing sent to the AI`);
    same(out.reading, label);
    assert.match(out.reading.basis, /the AI was not asked to transcribe pages 2-3: /, label);
    assert.match(out.reading.basis, says, label);
    assert.deepEqual(leaks(out, ANN_KEY, P1_KEY), [], `${label}: no key`);
  }
  /* beside them, the positive: a group limit on another use only leaves transcription on */
  const w = await group();
  w.acc.aiKeepAwaySet({ on: true, uses: ["ask"], reason: "no questions", by: "admin" });
  const a = ai((q) => model(q.pages));
  const out = await readWith({ transcription: { member: "ann", accounts: w.acc, useCheck: limits(null).useCheck, transcribe: a.transcribe } });
  assert.deepEqual([a.calls.length, out.reading.text_tier], [1, 4]);
});

test("R29 R21: without a member's act `read` is tiers 1-3's exactly (no key added); a document with no page the plane could not read asks nothing and reads no account; tier 3's filled pages are never sent", async () => {
  const w = await group();
  const without = await readWith();
  assert.equal(without.reading.ai_transcription, undefined);
  assert.doesNotMatch(without.reading.basis, /\bAI\b/);
  /* every page read by its layer: no account is read, the AI is not asked */
  let asked = 0;
  const counting = { accountFor: async (q) => { asked++; return w.acc.accountFor(q); } };
  const a = ai(() => { throw new Error("must not be asked"); });
  const plain = await readWith({ pages: [{ page: 0, text: "all text" }], transcription: { member: "ann", accounts: counting, useCheck: limits(null).useCheck, transcribe: a.transcribe } });
  assert.deepEqual([asked, a.calls.length, plain.reading.text_tier], [0, 0, 1]);
  assert.match(plain.reading.basis, said("reading-pipeline.page_left_civicsmith"));
  /* tier 3 fills page 1; only the folio page OCR did not fill is the AI's */
  const ocr = member((body) => ocrAnswer(body.pages.filter((p) => p === 1)));
  const b = ai((q) => model(q.pages));
  const both = await readWith({ env: { OCR_WORKER: ocr }, transcription: { member: "ann", accounts: w.acc, useCheck: limits(null).useCheck, transcribe: b.transcribe } });
  assert.deepEqual(b.calls.map((q) => q.pages), [[2]]);
  assert.deepEqual(both.reading.text_source.map((s) => [s.step, s.extent && s.extent.pages]),
                   [["layer", [0, 2]], ["pixels", [1]], ["ocr", [1]], ["pixels", [2]], ["ai_transcription", [2]]]);
  assert.equal(both.reading.text_tier, 4);
});

test("R29 R6 R9 R23: tier4Pages and tier4Extend: the pages selected are the unread ones (a scan marker still standing, or OCR read to no glyph), none when encrypted; an answer naming no model is refused; a page not asked, or one carrying text, is never merged and is named; a page the AI left out stays unread", async () => {
  const floored = { page: 3, text: "", undetermined: [{ page: 3, reason: "ocr_below_floor", count: 1 }] };
  assert.deepEqual(tier4Pages(i2([...PAGES, floored])), [1, 2, 3]);
  assert.deepEqual(tier4Pages(i2([...PAGES, { page: 4, text: "", undetermined: [{ page: null, reason: "encrypted", count: 1 }] }])), []);
  assert.deepEqual(tier4Pages(i2([{ page: 0, text: "x" }])), []);
  assert.deepEqual(tier4Pages(null), []);
  const { acc } = await group();
  const go = (answer) => tier4Extend({ member: "ann", accounts: acc, useCheck: async () => null, transcribe: async () => answer },
                                     { sha: "d", storeName: "bio", i2text: i2(PAGES), wiredTier: 1, chain: rp.layerChainFor(i2(PAGES), { tier: 1, container: "pdf" }) });
  const unnamed = await go({ ok: true, pages: [{ page: 1, text: "x" }] });
  assert.deepEqual([unnamed.filled, unnamed.wiredTier], [[], 1]);
  assert.match(unnamed.aiNote, said("reading-pipeline.answer_name_model"));
  const declined = await go({ ok: false, reason: "busy" });
  assert.match(declined.aiNote, said("reading-pipeline.index.ai_declined", { reason: " (busy)" }));
  const mixed = await go(model([0, 1, 7]));
  assert.deepEqual(mixed.filled, [1]);
  assert.match(mixed.aiNote, /page 3 the AI did not transcribe, and it stays unread/);
  assert.match(mixed.aiNote, said("reading-pipeline.page_returned_merged", { refused_why: 2, page: `page 1 (${word("reading-pipeline.asked")}), page 8 (${word("reading-pipeline.document_page")})` }));
  assert.equal(mixed.i2text.pages[0].text, "Staff report on the capital plan", "a page with text is never replaced");
  const nothing = await go(model([]));
  assert.match(nothing.aiNote, said("reading-pipeline.returned_text_page"));
  const thrown = await tier4Extend({ member: "ann", accounts: acc, useCheck: async () => null, transcribe: async () => { throw new Error("down"); } },
                                   { sha: "d", storeName: "bio", i2text: i2(PAGES), wiredTier: 1, chain: null });
  assert.match(thrown.aiNote, wordRx("reading-pipeline.reached"));
  assert.equal((await tier4Extend(null, { i2text: i2(PAGES) })).aiNote, null, "no act: nothing said, nothing done");
});

/* R29 (T43; N853a, K2611): the paying account's or its limits' refusal is answered as given in `aiRefusal`, beside
   `aiNote`, and nothing is filled; every other stop is `aiNote` alone. */
const t4On = (transcription, text = i2(PAGES)) => tier4Extend(transcription,
  { sha: "d", storeName: "bio", i2text: text, wiredTier: 1, chain: rp.layerChainFor(text, { tier: 1, container: "pdf" }) });
const unchanged = (t4, label) => {
  assert.deepEqual([t4.filled, t4.wiredTier, t4.engine], [[], 1, null], label);
  assert.deepEqual(t4.i2text, i2(PAGES), `${label}: nothing filled`);
  assert.deepEqual(t4.chain, rp.layerChainFor(i2(PAGES), { tier: 1, container: "pdf" }), `${label}: the chain is tiers 1-3's`);
  assert.match(t4.aiNote, /^the AI was not asked to transcribe pages 2-3: /, label);
};

test("R29 (N853a): an accountFor answering NO_ACCOUNT and a useCheck answering AI_LIMIT_REACHED are each answered as given in aiRefusal, beside aiNote; nothing is filled and the AI is not asked", async () => {
  /* the refusal is the real ai-accounts' (a member who holds no account), taken from its published fixture and from the real accounts that answer it */
  const noAccount = await accountForRefused({ member: "dee", act: { kind: "transcribe", member: "dee" } });
  assert.equal(noAccount.code, "NO_ACCOUNT");
  const a1 = ai(() => { throw new Error("the AI must not be asked"); });
  const lim1 = limits(null);
  const r1 = await t4On({ member: "dee", accounts: (await group()).acc, useCheck: lim1.useCheck, transcribe: a1.transcribe });
  assert.deepEqual(r1.aiRefusal, noAccount, "the refusal as given, not a re-wording");
  assert.match(r1.aiNote, /NO_ACCOUNT: /);
  assert.deepEqual([a1.calls.length, lim1.asked.length], [0, 0], "no limit asked after the account refused");
  unchanged(r1, "NO_ACCOUNT");

  const { acc } = await group();
  const reached = { ok: false, code: "AI_LIMIT_REACHED", check: "C-29.9", translation: "this month's limit is reached",
                    whose: "member:ann", scope: "transcribe", unit: "pages", period: "month" };
  const a2 = ai(() => { throw new Error("the AI must not be asked"); });
  const r2 = await t4On({ member: "ann", accounts: acc, useCheck: async () => reached, transcribe: a2.transcribe });
  assert.equal(r2.aiRefusal, reached);
  assert.match(r2.aiNote, /AI_LIMIT_REACHED/);
  assert.equal(a2.calls.length, 0);
  unchanged(r2, "AI_LIMIT_REACHED");
  /* the unjudged form of the limit's refusal (ai-use R3) is a refusal too */
  const unjudged = { ok: false, code: "AI_LIMIT_REACHED", unjudged: true, whose: "member:ann" };
  assert.equal((await t4On({ member: "ann", accounts: acc, useCheck: async () => unjudged, transcribe: a2.transcribe })).aiRefusal, unjudged);
});

test("R29 (N853a): every refusal the real ai-accounts.accountFor answers for the act is aiRefusal exactly as accountFor answers it: NO_ACCOUNT, AI_USE_SWITCHED_OFF, RECIPIENT_NOTICE_DUE, AI_KEPT_AWAY, PROJECT_AI_KEPT_AWAY, a project the member cannot see; and read passes none of it into the reading", async () => {
  const cases = [
    ["NO_ACCOUNT", async () => ({ member: "dee" })],
    ["AI_USE_SWITCHED_OFF", async (w) => { assert.equal(w.acc.accountUsesSet({ owner: "member:ann", switch: "transcribe", on: false, by: "ann" }).ok, true);
                                          return { member: "ann" }; }],
    /* (notice ai-accounts:124) T53's per-recipient notice (ai-accounts R51) in place of the group key's */
    ["RECIPIENT_NOTICE_DUE", async (w) => { const t = await w.w.team({ secret: "sk-group-key-never-shown" });
                                            assert.equal(t.ok, true);
                                            assert.equal(w.acc.accountSwitch({ account_id: t.account_id, on: true, by: "admin" }).ok, true);
                                            return { member: "dee" }; }],
    ["AI_KEPT_AWAY", async (w) => { w.acc.aiKeepAwaySet({ on: true, uses: ["transcribe"], reason: "no AI on our records", by: "admin" }); return { member: "ann" }; }],
    ["PROJECT_AI_KEPT_AWAY", async (w) => { w.acc.projectAiKeepAwaySet({ project: "P1", on: true, uses: ["transcribe"], reason: "not this matter", by: "ann" });
                                            return { member: "ann", project: "P1" }; }],
    ["NO_SUCH_PROJECT", async () => ({ member: "dee", project: "P1" })],
  ];
  for (const [code, setup] of cases) {
    const w = await group();
    const who = await setup(w);
    const expected = await w.acc.accountFor({ member: who.member, act: { kind: "transcribe", member: who.member, ...(who.project ? { project: who.project } : {}) } });
    assert.deepEqual([expected.ok, expected.code], [false, code], `${code}: the arm is real`);
    const a = ai(() => { throw new Error("the AI must not be asked"); });
    const t4 = await t4On({ ...who, accounts: w.acc, useCheck: limits(null).useCheck, transcribe: a.transcribe });
    assert.deepEqual(t4.aiRefusal, expected, code);
    assert.equal(a.calls.length, 0, code);
    unchanged(t4, code);
    assert.deepEqual(leaks(t4, ANN_KEY, P1_KEY, "sk-group-key-never-shown"), [], `${code}: no key`);
    /* `read` answers the reading only: the refusal is the caller's to answer, the basis names it as before */
    const out = await readWith({ transcription: { ...who, accounts: w.acc, useCheck: limits(null).useCheck, transcribe: a.transcribe } });
    assert.equal(JSON.stringify(out).includes("aiRefusal"), false, `${code}: read carries no aiRefusal`);
    assert.match(out.reading.basis, new RegExp(code), code);
  }
});

test("R29 (N853a, control, K874): every other stop is aiNote alone, with no aiRefusal key: a declining AI, an unreachable AI, an answer naming no model, no text returned, no member's act, no accounts, an accountFor or useCheck that throws, no limits checked, no AI set up, no page left; and a filled reading carries none", async () => {
  const { acc } = await group();
  const base = { member: "ann", accounts: acc, useCheck: async () => null };
  // fixtures-generic: busy
  // fixtures-contract: store-assembly transcribe-answer
  const stops = [
    ["a declining AI", { ...base, transcribe: async () => ({ ok: false, reason: "busy" }) }, /the AI declined \(busy\)/],
    ["an unreachable AI", { ...base, transcribe: async () => { throw new Error("down"); } }, /could not be reached/],
    ["no model named", { ...base, transcribe: async () => ({ ok: true, pages: [{ page: 1, text: "x" }] }) }, /did not name the model/],
    ["no text returned", { ...base, transcribe: async () => model([]) }, /returned no text/],
    ["no member's act", { ...base, member: null, transcribe: async () => model([1]) }, /only at a member's own act/],
    ["no accounts", { ...base, accounts: null, transcribe: async () => model([1]) }, /could not be checked/],
    ["accountFor throws", { ...base, accounts: { accountFor: async () => { throw new Error("x"); } }, transcribe: async () => model([1]) }, /could not be checked/],
    ["useCheck throws", { ...base, useCheck: async () => { throw new Error("x"); }, transcribe: async () => model([1]) }, /limits .* could not be checked/],
    ["no limits checked", { ...base, useCheck: null, transcribe: async () => model([1]) }, /limits .* could not be checked/],
    ["no AI set up", { ...base, transcribe: null }, /no AI is set up/],
  ];
  for (const [label, tx, says] of stops) {
    const t4 = await t4On(tx);
    assert.equal("aiRefusal" in t4, false, label);
    assert.match(t4.aiNote, says, label);
    unchanged(t4, label);
  }
  const none = await t4On({ ...base, transcribe: async () => model([0]) }, i2([{ page: 0, text: "all text" }]));
  assert.deepEqual(["aiRefusal" in none, none.filled], [false, []]);
  assert.match(none.aiNote, said("reading-pipeline.page_left_civicsmith"));
  const filled = await t4On({ ...base, transcribe: async (q) => model(q.pages) });
  assert.deepEqual(["aiRefusal" in filled, filled.filled, filled.wiredTier], [false, [1, 2], 4]);
  assert.equal("aiRefusal" in (await tier4Extend(null, { i2text: i2(PAGES) })), false, "no act at all");
});

/* R31 (T48; N996; K3101): the paying account is asked of `ai-accounts`, handed in as `transcription.accounts`. */
// fixtures-own: harness a recording wrapper around the real ai-accounts' accountFor (the test's own harness: it records the question asked and delegates; it answers nothing itself)
const asking = (inner) => { const asked = []; return { asked, accountFor: async (q) => { asked.push(q); return inner(q); } }; };

test("R31: a transcription whose accounts (ai-accounts) answers NO_ACCOUNT answers that refusal as given in aiRefusal and fills nothing; control: one whose accounts.accountFor answers an account transcribes the asked pages as before, the same act asked", async () => {
  const { acc } = await group();
  /* dee holds no key and the group holds none: the real ai-accounts.accountFor refuses */
  const deeAcc = asking((q) => acc.accountFor(q));
  const a1 = ai(() => { throw new Error("the AI must not be asked"); });
  const refused = await t4On({ member: "dee", accounts: deeAcc, useCheck: limits(null).useCheck, transcribe: a1.transcribe });
  assert.deepEqual(deeAcc.asked, [{ member: "dee", act: { kind: "transcribe", member: "dee" } }], "the act R29 asks");
  const expected = await acc.accountFor({ member: "dee", act: { kind: "transcribe", member: "dee" } });
  assert.deepEqual([expected.ok, expected.code], [false, "NO_ACCOUNT"], "the arm is real");
  assert.deepEqual(refused.aiRefusal, expected);
  assert.match(refused.aiNote, /NO_ACCOUNT/);
  assert.equal(a1.calls.length, 0);
  unchanged(refused, "NO_ACCOUNT from ai-accounts");
  /* control: ann's own key serves the act; the asked pages are transcribed, on that account */
  const annAcc = asking((q) => acc.accountFor(q));
  const a2 = ai((q) => model(q.pages));
  const served = await t4On({ member: "ann", project: "P2", accounts: annAcc, useCheck: limits(null).useCheck, transcribe: a2.transcribe });
  assert.deepEqual(annAcc.asked, [{ member: "ann", act: { kind: "transcribe", member: "ann", project: "P2" } }]);
  assert.equal("aiRefusal" in served, false);
  assert.deepEqual([a2.calls.length, a2.calls[0].pages, a2.calls[0].account.level, a2.calls[0].account.key, served.filled, served.wiredTier],
                   [1, [1, 2], "member", ANN_KEY, [1, 2], 4]);
  assert.deepEqual(leaks(served, ANN_KEY, P1_KEY), [], "the key reaches the AI alone");
  /* and through `read`, the reading is the AI's at tier 4 */
  const out = await readWith({ transcription: { member: "ann", accounts: acc, useCheck: limits(null).useCheck, transcribe: ai((q) => model(q.pages)).transcribe } });
  assert.deepEqual([out.reading.text_tier, out.reading.ai_transcription.pages], [4, [1, 2]]);
});

test("R31 (controls): an accounts that is absent, has no accountFor, or throws stops the AI tier with the aiNote for an account that could not be checked, no aiRefusal, nothing filled, the AI not asked", async () => {
  const stops = [
    ["accounts absent", { accounts: undefined }],
    ["accounts null", { accounts: null }],
    ["accounts with no accountFor", { accounts: {} }],
    ["accountFor not a function", { accounts: { accountFor: "yes" } }],
    ["accountFor throws", { accounts: { accountFor: async () => { throw new Error("down"); } } }],
    ["accountFor throws synchronously", { accounts: { accountFor: () => { throw new Error("down"); } } }],
  ];
  for (const [label, extra] of stops) {
    const a = ai(() => { throw new Error("the AI must not be asked"); });
    const lim = limits(null);
    const t4 = await t4On({ member: "ann", useCheck: lim.useCheck, transcribe: a.transcribe, ...extra });
    assert.match(t4.aiNote, /^the AI was not asked to transcribe pages 2-3: the account that would pay for it could not be checked$/, label);
    assert.equal("aiRefusal" in t4, false, label);
    assert.deepEqual([a.calls.length, lim.asked.length], [0, 0], label);
    unchanged(t4, label);
  }
});

test("R31 (through T48): a transcription that hands credentials and no accounts is read the same way; when accounts is handed it alone is asked, credentials never", async () => {
  const { acc } = await group();
  /* credentials R72's delegate answers accountFor as ai-accounts does: modelled by a delegate over the same instance */
  const delegate = { accountFor: (q) => acc.accountFor(q) };
  for (const who of [{ member: "ann" }, { member: "dee" }, { member: "bob", project: "P1" }]) {
    const run = (k, v) => t4On({ ...who, [k]: v, useCheck: limits(null).useCheck, transcribe: ai((q) => model(q.pages)).transcribe });
    const viaAccounts = await run("accounts", acc);
    const viaAlias = await run("credentials", delegate);
    assert.deepEqual(viaAlias, viaAccounts, JSON.stringify(who));
  }
  /* both handed: accounts is the one asked */
  const never = { accountFor: async () => { throw new Error("credentials must not be asked when accounts is handed"); } };
  const annAcc = asking((q) => acc.accountFor(q));
  const both = await t4On({ member: "ann", accounts: annAcc, credentials: never, useCheck: limits(null).useCheck, transcribe: ai((q) => model(q.pages)).transcribe });
  assert.deepEqual([annAcc.asked.length, both.filled, both.wiredTier], [1, [1, 2], 4]);
  /* an accounts handed with no accountFor stops, even beside a credentials that would answer */
  const stopped = await t4On({ member: "ann", accounts: {}, credentials: delegate, useCheck: limits(null).useCheck, transcribe: ai((q) => model(q.pages)).transcribe });
  assert.match(stopped.aiNote, wordRx("reading-pipeline.account_pay_checked"));
  unchanged(stopped, "accounts without accountFor beside credentials");
});

test("R18 R19 (R29): readingProvenance credits a page an ai_transcription step covers to tier 4, named by the model, never to tier 3's OCR member for the pixels before it; compareProvenance attributes a change to it", async () => {
  const PIX = { step: "pixels", cap: null, measured_by: AI_TRANSCRIPTION_SOURCE, calibration: null };
  const AIT = { step: "ai_transcription", engine: "vision-model", version: "3", cap: null, measured_by: AI_TRANSCRIPTION_SOURCE, calibration: null };
  const text = i2([{ page: 0, text: "the AI read this" }]);
  const p = await rp.readingProvenance({ text, chain: [PIX, AIT], tier: 4, container: "pdf", planeVersion: "v" });
  assert.deepEqual(p.pages.map((x) => [x.page, x.tier, x.member]), [[0, 4, null]]);
  assert.deepEqual(p.producers.map((x) => [x.tier, x.member, x.engine]), [[4, null, "vision-model 3"]]);
  /* beside it, an OCR part still reads tier 3 on ocr-worker */
  const ocr = await rp.readingProvenance({ text: i2([{ page: 0, text: "the OCR engine read this" }]), chain: [{ step: "pixels", cap: "C", measured_by: "M" }, { step: "ocr", engine: "tess", version: "5", cap: "C", measured_by: "M" }], tier: 3, container: "pdf" });
  assert.deepEqual(ocr.pages.map((x) => [x.tier, x.member]), [[3, "ocr-worker"]]);
  const c = rp.compareProvenance(ocr, p);
  assert.equal(c.state, "differs");
  assert.match(c.says, /page 1 was read by tier 3 on ocr-worker before and by tier 4 on an unnamed member now/);
});

test("R29 (N835, ai-use R1): the paying owner is spelled from the bare member id: a member handed stamped `member:ann` and one handed bare `ann` are both judged as owner `member:ann`, never `member:member:ann`, and both are served by her own account", async () => {
  const { acc } = await group();
  for (const handed of ["member:ann", "ann"]) {
    const lim = limits(null);
    const a = ai((q) => model(q.pages));
    const t4 = await tier4Extend({ member: handed, accounts: acc, useCheck: lim.useCheck, transcribe: a.transcribe, at: "2026-10-11T00:00:00Z" },
                                 { sha: "d", storeName: "bio", i2text: i2(PAGES), wiredTier: 1, chain: rp.layerChainFor(i2(PAGES), { tier: 1, container: "pdf" }) });
    assert.deepEqual(lim.asked, [{ owner: "member:ann", member: handed, use: "transcribe", at: "2026-10-11T00:00:00Z" }], handed);
    assert.doesNotMatch(JSON.stringify(lim.asked), /member:member:/, handed);
    assert.deepEqual([a.calls.length, a.calls[0].account.level, a.calls[0].account.key, t4.filled, t4.wiredTier],
                     [1, "member", ANN_KEY, [1, 2], 4], handed);
  }
  /* a project's and the group's owner are not the member's, whatever the member's spelling */
  const w = await group();
  w.acc.projectKeyNoticeSeen({ member: "bob", project: "P1", by: "bob" });
  const lim = limits(null);
  await tier4Extend({ member: "member:bob", project: "P1", accounts: w.acc, useCheck: lim.useCheck, transcribe: ai((q) => model(q.pages)).transcribe },
                    { sha: "d", storeName: "bio", i2text: i2(PAGES), wiredTier: 1, chain: null });
  assert.deepEqual(lim.asked.map((q) => q.owner), ["project:P1"]);
});

/* R30: a four-page scan. The first reading, at a member's act, had the OCR member read pages 0 and 2 (it gave nothing
   for 1 and 3) and the AI read page 1 (it gave nothing for 3): the stored reading holds pages 0 and 2 under
   `pixels -> ocr`, page 1 under `pixels -> ai_transcription`, and page 3 unread. */
const SCAN4 = [0, 1, 2, 3].map((p) => ({ page: p, text: "", undetermined: [noText(p)] }));
async function storedReading() {
  const { acc } = await group();
  const ocr = member((body) => ocrAnswer(body.pages.filter((p) => p === 0 || p === 2)));
  const a = ai((q) => model(q.pages.filter((p) => p === 1)));
  const out = await readWith({ pages: SCAN4, env: { OCR_WORKER: ocr },
    transcription: { member: "ann", accounts: acc, useCheck: limits(null).useCheck, transcribe: a.transcribe } });
  assert.deepEqual(a.calls.map((q) => q.pages), [[1, 3]], "the first reading asked the AI for the pages OCR left");
  const units = out.text_units.map((u) => ({ page: u.extent.page, text: u.text }));
  assert.deepEqual(units.map((u) => u.page), [0, 1, 2]);
  return { acc, reading: out.reading, units };
}
const stepsOf = (chain) => chain.map((s) => [s.step, s.extent ? s.extent.pages : null]);
const reReadEnv = (answer) => ({ OCR_WORKER: member(answer) });

test("R30 R23: tier3SeedFrom seeds the stored reading's pixels -> ai_transcription part beside its pixels -> ocr part, each under its own chain and with its own words", async () => {
  const { reading, units } = await storedReading();
  assert.deepEqual(stepsOf(reading.text_source),
                   [["pixels", [0, 2]], ["ocr", [0, 2]], ["pixels", [1]], ["ai_transcription", [1]]]);
  const seed = tier3SeedFrom(reading, units);
  assert.deepEqual(seed.parts.map((p) => [p.pages, p.chain.map((s) => s.step)]),
                   [[[0, 2], ["pixels", "ocr"]], [[1], ["pixels", "ai_transcription"]]]);
  const ai1 = seed.parts[1].chain[1];
  assert.deepEqual([ai1.engine, ai1.version, ai1.cap, ai1.measured_by, "extent" in ai1], ["vision-model", "3", null, AI_TRANSCRIPTION_SOURCE, false]);
  assert.deepEqual([...seed.text.entries()].sort((x, y) => x[0] - y[0]),
                   [[0, "ocr text of page 0"], [1, "the AI read page 1"], [2, "ocr text of page 2"]]);
  /* negative controls: a unit on a page no transcribing part covers, and a chain that does not check, seed nothing */
  assert.equal(tier3SeedFrom(reading, [{ page: 3, text: "never read" }]), null);
  const broken = reading.text_source.map((s) => (s.step === "ai_transcription" ? { ...s, engine: undefined } : s));
  assert.equal(tier3SeedFrom({ text_source: broken }, units), null, "a chain checkChain refuses is not seeded, as today");
});

test("R30 R6 R29: a re-read that asks the OCR member for the rest keeps the AI's page with its text and chain, asks neither the OCR member nor the AI for it again, and the reading it composes still carries it", async () => {
  const { acc, reading, units } = await storedReading();
  const seed = tier3SeedFrom(reading, units);
  const env = reReadEnv((body) => ocrAnswer(body.pages));
  const t3 = await tier3Extend(env, { sha: "d", storeName: "bio", i2text: i2(SCAN4), wiredTier: 1, tier2PerPage: null, fmt: "pdf", seed });
  assert.deepEqual(env.OCR_WORKER.calls.map((x) => x.body.pages), [[3]], "only the page nobody read is asked of the OCR member");
  assert.deepEqual([t3.filled, t3.seeded, t3.stillWanting, t3.wiredTier], [[3], [0, 1, 2], false, 4]);
  assert.deepEqual(t3.i2text.pages.map((p) => [p.page, p.text]),
                   [[0, "ocr text of page 0"], [1, "the AI read page 1"], [2, "ocr text of page 2"], [3, "ocr text of page 3"]]);
  assert.equal(checkChain(t3.chain), null);
  assert.deepEqual(stepsOf(t3.chain), [["pixels", [0, 2, 3]], ["ocr", [0, 2, 3]], ["pixels", [1]], ["ai_transcription", [1]]]);
  assert.match(t3.ocrNote, /3 of them were transcribed by an earlier reading of this capture and kept/);
  /* the AI is not asked again: no page is left for it, and nothing is read of any account */
  assert.deepEqual(tier4Pages(t3.i2text), []);
  let accounts = 0;
  const never = ai(() => { throw new Error("the AI must not be asked again"); });
  const t4 = await tier4Extend({ member: "ann", accounts: { accountFor: async (q) => { accounts++; return acc.accountFor(q); } },
                                 useCheck: limits(null).useCheck, transcribe: never.transcribe },
                               { sha: "d", storeName: "bio", i2text: t3.i2text, wiredTier: t3.wiredTier, chain: t3.chain });
  assert.deepEqual([never.calls.length, accounts, t4.filled], [0, 0, []]);
  /* the reading a re-read writes (readingFromWire over it, extraction R34) carries the AI's page and part */
  const wired = readText(rp.decodeView(t3.i2text), { headers: null, locator: null, content_type: null, at: reading.at });
  const r = rp.readingFromWire({ wired, docType: { type: { key: reading.content_type, version: reading.reader_version } },
                                 chain: t3.chain, wiredTier: t3.wiredTier, fmt: "pdf", retrieved: reading.at,
                                 tier2note: null, ocrNote: t3.ocrNote, tier3Candidate: t3.stillWanting });
  assert.deepEqual(r.text_source, t3.chain);
  assert.equal(r.text_tier, 4);
  const u = rp.textUnitsFor(t3.i2text).textUnits;
  assert.deepEqual(u.find((x) => x.extent.page === 1).text, "the AI read page 1");
  const prov = await rp.readingProvenance({ text: t3.i2text, chain: t3.chain, tier: t3.wiredTier, container: "pdf" });
  assert.deepEqual(prov.pages.map((p) => [p.page, p.tier]), [[0, 3], [1, 4], [2, 3], [3, 3]]);
});

test("R30: the AI's page is never dropped when the OCR member has every page already, fails, or is not bound; with none bound only the page nobody read is left for the AI", async () => {
  const { acc, reading, units } = await storedReading();
  const seed = tier3SeedFrom(reading, units);
  const go = (env, s = seed, text = i2(SCAN4)) => tier3Extend(env, { sha: "d", storeName: "bio", i2text: text, wiredTier: 1, tier2PerPage: null, fmt: "pdf", seed: s });
  const keepsAi = (t3, label) => {
    assert.equal(t3.i2text.pages.find((p) => p.page === 1).text, "the AI read page 1", label);
    assert.ok(stepsOf(t3.chain).some(([s, pg]) => s === "ai_transcription" && JSON.stringify(pg) === "[1]"), label);
    assert.equal(t3.wiredTier, 4, label);
    assert.ok(!tier4Pages(t3.i2text).includes(1), `${label}: the AI is not asked for page 1 again`);
  };
  /* the OCR member answers an error */
  const failing = reReadEnv(() => ({ status: 500, body: { ok: false } }));
  const f = await go(failing);
  assert.deepEqual([f.filled, f.seeded, f.stillWanting], [[], [0, 1, 2], true]);
  assert.match(f.ocrNote, /^the OCR member answered 500, so this document stays unread; 3 of them were transcribed by an earlier reading/);
  keepsAi(f, "member failed");
  /* the OCR member cannot be reached */
  const down = reReadEnv(() => new Error("down"));
  const d = await go(down);
  assert.match(d.ocrNote, said("reading-pipeline.ocr_member_reached"));
  keepsAi(d, "member down");
  /* no OCR member bound: kept, and only page 4 (index 3) is left for the AI */
  const n = await go({});
  assert.deepEqual([n.filled, n.seeded, n.stillWanting], [[], [0, 1, 2], true]);
  assert.match(n.ocrNote, /3 page\(s\) of this document without a text layer were transcribed by an earlier reading of this capture and kept; the other 1 have no text layer to read and no OCR engine is installed/);
  keepsAi(n, "no member");
  assert.deepEqual(tier4Pages(n.i2text), [3]);
  const a = ai((q) => model(q.pages));
  const t4 = await tier4Extend({ member: "ann", accounts: acc, useCheck: limits(null).useCheck, transcribe: a.transcribe },
                               { sha: "d", storeName: "bio", i2text: n.i2text, wiredTier: n.wiredTier, chain: n.chain });
  assert.deepEqual(a.calls.map((q) => q.pages), [[3]], "the AI is asked only for the page nobody read");
  assert.deepEqual(stepsOf(t4.chain).filter(([s]) => s === "ai_transcription"), [["ai_transcription", [1]], ["ai_transcription", [3]]],
                   "the AI's kept page keeps its part beside the new one");
  assert.deepEqual(t4.i2text.pages.map((p) => p.text), ["ocr text of page 0", "the AI read page 1", "ocr text of page 2", "the AI read page 3"]);
  /* every page held already: the OCR member is not asked, and the text and chain are the stored ones */
  const full = tier3SeedFrom(reading, [...units, { page: 3, text: "x" }]);
  assert.equal(full.text.has(3), false, "page 3 is no transcribing part's, so it is not seeded");
  const three = i2(SCAN4.slice(0, 3));
  const allKept = await go(reReadEnv(() => new Error("must not be asked")), seed, three);
  assert.match(allKept.ocrNote, said("reading-pipeline.page_document_without", { kept: 3 }));
  assert.deepEqual([allKept.filled, allKept.seeded, allKept.stillWanting], [[], [0, 1, 2], false]);
  keepsAi(allKept, "all kept");
  assert.deepEqual(tier4Pages(allKept.i2text), []);
});

test("R30 (negative control): a stored reading with only OCR parts is seeded as before, and a re-read of it is tier 3 with no AI part", async () => {
  const ocr = member((body) => ocrAnswer(body.pages.filter((p) => p !== 3)));
  const out = await readWith({ pages: SCAN4, env: { OCR_WORKER: ocr } });
  const units = out.text_units.map((u) => ({ page: u.extent.page, text: u.text }));
  const seed = tier3SeedFrom(out.reading, units);
  const ocrChain = out.reading.text_source.filter((s) => s.step !== "layer").map(({ extent, ...bare }) => bare);
  assert.deepEqual(seed.parts, [{ chain: ocrChain, pages: [0, 1, 2] }]);
  const env = reReadEnv((body) => ocrAnswer(body.pages));
  const t3 = await tier3Extend(env, { sha: "d", storeName: "bio", i2text: i2(SCAN4), wiredTier: 1, tier2PerPage: null, fmt: "pdf", seed });
  assert.deepEqual(env.OCR_WORKER.calls.map((x) => x.body.pages), [[3]]);
  assert.deepEqual([t3.filled, t3.seeded, t3.wiredTier], [[3], [0, 1, 2], 3]);
  assert.ok(!t3.chain.some((s) => s.step === "ai_transcription"));
  /* and with no seed, a member-less re-read says what it always said */
  const none = await tier3Extend({}, { sha: "d", storeName: "bio", i2text: i2(SCAN4), wiredTier: 1, tier2PerPage: null, fmt: "pdf" });
  assert.equal(none.ocrNote, word("reading-pipeline.document_text_layer"));
  assert.deepEqual([none.chainSet, none.wiredTier, none.seeded], [false, 1, []]);
});
