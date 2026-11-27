/* site-profiles — requirement-named tests, at the module's interface only: everything
 * is reached through `site-profiles/index.mjs`. Every live id R1–R19 is named in at
 * least one test title, and each test checks the requirement whole over the inputs
 * that decide it. The module registers its own handlers, so nothing else is imported.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as sp from "../index.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { calendarHtml, wordpressArticle, shellHtml, plainHtml } from "./fixtures.mjs";
/** @import { Confidence, Detection, Recogniser, Registry } from "../recogniser.mjs" */
/** @import { StackContext, StackHandler, Part } from "../region.mjs" */
/** @import { CompareHandler, Comparison, DigestContext } from "../index.mjs" */

const {
  identify, CONFIDENCE, confidenceRank, makeRegistry, digests, compare, fidelity, profileRecord,
  SIGNIFICANCE, EVENTS, event, significanceRank, worstSignificance, isMeaningful, bySeverity,
  unescapeHtml, REGION, register, handlers, aspnetWebforms, wordpress, clientRendered, conservative,
} = sp;

const enc = (/** @type {string} */ s) => new TextEncoder().encode(s);
const sha256 = async (/** @type {Uint8Array} */ b) => createHash("sha256").update(b).digest("hex");
const LADDER = new Set([CONFIDENCE.CERTAIN, CONFIDENCE.LIKELY, CONFIDENCE.POSSIBLE, CONFIDENCE.NONE]);
const NOW = "2026-03-20T12:00:00Z";
const CAL = "https://r.test/Calendar.aspx";

/* A stack handler that no built-in handler resembles, defining no `kind`: the only
   way to show R2's "absent when it does not". Registered once, after the built-ins,
   so it cannot pre-empt any of them. */
const KINDLESS = register({
  key: "test_kindless", label: "a test stack with no kind", version: 1, textual: true,
  /** @param {StackContext} ctx @returns {Detection} */
  detect(ctx) {
    if (/X-KINDLESS-STACK/.test(ctx.text || "")) return { match: true, confidence: CONFIDENCE.CERTAIN, signals: ["kindless marker"] };
    return { match: false };
  },
  rules: () => [], renderCritical: () => false, ignorable: () => false,
});

/* Every input the stack tests below use, for the properties that hold over all of them;
   the first four are also named, for R1. */
/** @type {StackContext} a shell that is also WordPress at CERTAIN */
const SHELL_AND_WP = { text: shellHtml() + '<link href="/wp-content/a.css"><link href="/wp-includes/b.js">' };
/** @type {StackContext} ASP.NET LIKELY by its header, over a POSSIBLE shell hint */
const LIKELY_ASPNET = { text: '<div id="app"></div><p>x</p>', headers: { "x-powered-by": "ASP.NET" } };
/** @type {StackContext} ASP.NET and WordPress both LIKELY */
const TIE = { text: '<a href="/wp-content/x.css">x</a>', headers: { "x-powered-by": "ASP.NET" } };
/** @type {StackContext} nothing recognised */
const PLAIN = { text: plainHtml() };
/** @type {StackContext[]} */
const CTXS = [
  SHELL_AND_WP,
  LIKELY_ASPNET,
  TIE,
  PLAIN,
  { text: calendarHtml([["1", "B", "3/3/2026"]]), locator: CAL },
  { text: wordpressArticle(), locator: "https://news.test/2026/03/harbor/" },
  { text: wordpressArticle(), locator: "https://news.test/" },
  { text: shellHtml() },
  { text: "X-KINDLESS-STACK" },
  { text: "plain", headers: { server: "Microsoft-IIS/10" } },
  {},
];

/* ------------------------------------------------------------------ identify */

test("R1 identify returns the first CERTAIN stack, else the highest match, else conservative at NONE with why", () => {
  // the module registers its own four, in order, conservative last
  assert.deepEqual(handlers().slice(0, 4).map((h) => h.key),
    ["client_rendered", "aspnet_webforms", "wordpress", "conservative"]);
  assert.deepEqual(handlers().slice(0, 4), [clientRendered, aspnetWebforms, wordpress, conservative]);
  // first CERTAIN wins, in registration order: a shell that is ALSO WordPress (CERTAIN) is a shell
  const a = identify(SHELL_AND_WP);
  assert.equal(a.handler, clientRendered);
  assert.equal(a.confidence, CONFIDENCE.CERTAIN);
  assert.equal(wordpress.detect(SHELL_AND_WP).confidence, CONFIDENCE.CERTAIN, "the later one was CERTAIN too");
  // nothing CERTAIN: the highest confidence wins (aspnet LIKELY from a header over a POSSIBLE shell hint)
  const b = identify(LIKELY_ASPNET);
  assert.equal(b.handler, aspnetWebforms);
  assert.equal(b.confidence, CONFIDENCE.LIKELY);
  assert.ok(b.considered.some((c) => c.key === "client_rendered" && c.confidence === CONFIDENCE.POSSIBLE));
  assert.ok(b.considered.some((c) => c.key === "aspnet_webforms" && c.confidence === CONFIDENCE.LIKELY));
  // equal confidence: the earlier-registered wins (aspnet before wordpress, both LIKELY)
  const c = identify(TIE);
  assert.equal(c.handler, aspnetWebforms);
  assert.ok(c.considered.some((x) => x.key === "wordpress" && x.confidence === CONFIDENCE.LIKELY));
  // nothing at all: conservative, NONE, and a stated why
  for (const ctx of [PLAIN, {}, null, undefined, "text"]) {
    const d = identify(ctx);
    assert.equal(d.handler, conservative);
    assert.equal(d.confidence, CONFIDENCE.NONE);
    assert.equal(d.why, localize("site-profiles.index.no_handler_recognised_this_document",
      "no handler recognised this document, so it is treated conservatively: nothing is assumed to be decoration and any difference is reported"));
    assert.deepEqual(d.signals, []);
    assert.deepEqual(d.considered, []);
  }
  // always a handler, and a matched one carries no why
  for (const ctx of CTXS) {
    const r = identify(ctx);
    assert.ok(handlers().includes(r.handler));
    if (r.confidence !== CONFIDENCE.NONE) assert.ok(!("why" in r));
  }
});

test("R2 kind is the winning handler's own classification of the address, and absent when it defines none", () => {
  const html = calendarHtml([["1", "Harbor Commission", "3/3/2026"]]);
  assert.equal(identify({ text: html, locator: "https://x.test/MeetingDetail.aspx?ID=1" }).kind, "record");
  assert.equal(identify({ text: html, locator: "https://x.test/Calendar.aspx" }).kind, "index");
  assert.equal(identify({ text: html, locator: "https://x.test/Other.aspx" }).kind, "page");
  assert.equal(identify({ text: html, locator: "https://x.test/" }).kind, "unknown");
  assert.equal(identify({ text: wordpressArticle(), locator: "https://news.test/2026/03/harbor/" }).kind, "article");
  assert.equal(identify({ text: wordpressArticle(), locator: "https://news.test/" }).kind, "index");
  assert.equal(identify({ text: shellHtml() }).kind, "shell");
  const k = identify({ text: "X-KINDLESS-STACK" });
  assert.equal(k.handler, KINDLESS);
  assert.ok(!("kind" in k), "a handler with no kind() gives a result with no kind");
  // the kind is the winner's own answer for that ctx, whatever the input
  for (const ctx of CTXS) {
    const r = identify(ctx);
    if (r.confidence === CONFIDENCE.NONE) continue;
    if (typeof r.handler.kind === "function") assert.equal(r.kind, r.handler.kind(ctx, r.confidence));
    else assert.ok(!("kind" in r));
  }
});

test("R3 every confidence identify or a registry returns is one of the ONE ladder's four values", () => {
  for (const ctx of CTXS) {
    const id = identify(ctx);
    assert.ok(LADDER.has(id.confidence), `stack confidence ${id.confidence}`);
    for (const c of id.considered) assert.ok(LADDER.has(c.confidence));
  }
  // another axis built on the same registry speaks the same ladder
  /** @type {Registry<{ want?: string }, Recogniser<{ want?: string }>>} */
  const axis = makeRegistry();
  for (const conf of [CONFIDENCE.CERTAIN, CONFIDENCE.LIKELY, CONFIDENCE.POSSIBLE])
    axis.register({ key: conf, detect: (ctx) => {
      if (ctx.want === conf) return { match: true, confidence: conf };
      return { match: false, confidence: conf };
    } });
  axis.register({ key: "floor", fallback: true, detect: () => ({ match: false }) });
  for (const want of ["certain", "likely", "possible", "nothing"]) {
    const r = axis.recognise({ want });
    assert.ok(LADDER.has(r.confidence));
  }
  assert.deepEqual(new Set(Object.keys(CONFIDENCE)), new Set(["CERTAIN", "LIKELY", "POSSIBLE", "NONE"]));
});

test("R4 CONFIDENCE is one ladder, ranked CERTAIN, LIKELY, POSSIBLE, NONE; an unknown value ranks with NONE", () => {
  assert.deepEqual(CONFIDENCE, { CERTAIN: "certain", LIKELY: "likely", POSSIBLE: "possible", NONE: "none" });
  const order = [CONFIDENCE.CERTAIN, CONFIDENCE.LIKELY, CONFIDENCE.POSSIBLE, CONFIDENCE.NONE];
  for (let i = 1; i < order.length; i++) assert.ok(confidenceRank(order[i - 1]) > confidenceRank(order[i]));
  for (const u of [undefined, null, "", "CERTAIN", "sure", "constructor", "toString", "__proto__", 3, {}, []])
    assert.equal(confidenceRank(u), confidenceRank(CONFIDENCE.NONE), `unknown ${String(u)}`);
});

/* ------------------------------------------------------------------ registry */

/** @typedef {{ hits?: string[] }} HitCtx the context the registry tests' members read */

test("R5 makeRegistry: register appends and returns, all in order, recognise always answers a member", () => {
  /** @param {string} key @param {Confidence} conf @param {{ fallback?: boolean }} [extra] @returns {Recogniser<HitCtx>} */
  const m = (key, conf, extra) => {
    /** @param {HitCtx} ctx @returns {Detection} */
    const detect = (ctx) => {
      if ((ctx.hits || []).includes(key)) return { match: true, confidence: conf, signals: [key + "!"] };
      return { match: false };
    };
    if (extra && extra.fallback) return { key, label: key, version: 1, fallback: true, detect };
    return { key, label: key, version: 1, detect };
  };
  /** @type {Registry<HitCtx, Recogniser<HitCtx>>} */
  const reg = makeRegistry();
  const A = m("a", CONFIDENCE.LIKELY), B = m("b", CONFIDENCE.CERTAIN), C = m("c", CONFIDENCE.LIKELY),
        D = m("d", CONFIDENCE.CERTAIN), F = m("f", CONFIDENCE.CERTAIN, { fallback: true }), Z = m("z", CONFIDENCE.POSSIBLE);
  for (const x of [A, B, C, D, F, Z]) assert.equal(reg.register(x), x);
  assert.deepEqual(reg.all(), [A, B, C, D, F, Z]);
  reg.all().pop();
  assert.equal(reg.all().length, 6, "all() answers a copy");
  // the first CERTAIN wins, and stops there
  const r1 = reg.recognise({ hits: ["a", "b", "d"] });
  assert.equal(r1.member, B);
  assert.equal(r1.confidence, CONFIDENCE.CERTAIN);
  assert.deepEqual(r1.signals, ["b!"]);
  assert.equal(r1.matched, true);
  assert.deepEqual(r1.considered, [{ key: "a", confidence: "likely", signals: ["a!"] },
                                   { key: "b", confidence: "certain", signals: ["b!"] }]);
  // no CERTAIN: the highest confidence, the earlier on a tie
  const r2 = reg.recognise({ hits: ["z", "c", "a"] });
  assert.equal(r2.member, A);
  assert.equal(r2.confidence, CONFIDENCE.LIKELY);
  assert.deepEqual(r2.considered.map((c) => c.key), ["a", "c", "z"]);
  // a member that matched with no signals lists [] for them
  /** @type {Registry<HitCtx, Recogniser<HitCtx>>} */
  const reg2 = makeRegistry();
  reg2.register({ key: "q", detect: () => ({ match: true, confidence: CONFIDENCE.POSSIBLE }) });
  assert.deepEqual(reg2.recognise({}).considered, [{ key: "q", confidence: "possible", signals: [] }]);
  assert.deepEqual(reg2.recognise({}).signals, []);
  // none matches: the fallback member (fallback: true), at NONE, matched false
  const r3 = reg.recognise({ hits: [] });
  assert.deepEqual(r3, { member: F, confidence: CONFIDENCE.NONE, signals: [], considered: [], matched: false });
  // opts.isFallback names it instead
  /** @type {Registry<HitCtx, Recogniser<HitCtx>>} */
  const named = makeRegistry({ isFallback: (x) => x.key === "c" });
  for (const x of [A, B, C, F]) named.register(x);
  assert.equal(named.fallbackMember(), C);
  assert.equal(named.recognise({}).member, C);
  // no member carries fallback: the last
  /** @type {Registry<HitCtx, Recogniser<HitCtx>>} */
  const last = makeRegistry();
  for (const x of [A, B, C]) last.register(x);
  assert.equal(last.fallbackMember(), C);
  assert.equal(last.recognise({}).member, C);
  // a member's detect throwing propagates
  /** @type {Registry<HitCtx, Recogniser<HitCtx>>} */
  const bad = makeRegistry();
  bad.register({ key: "boom", detect() { throw new RangeError("boom"); } });
  assert.throws(() => bad.recognise({}), RangeError);
});

/* ------------------------------------------------------------------- digests */

test("R6 identity is always sha256 of the bytes", async () => {
  /** @type {Array<[Uint8Array, CompareHandler | null | undefined]>} */
  const cases = [[enc(calendarHtml([["1", "B", "3/3/2026"]])), aspnetWebforms],
                            [enc("plain"), conservative], [new Uint8Array([0, 255, 1]), { textual: false }],
                            [enc(shellHtml()), clientRendered], [enc(wordpressArticle()), wordpress],
                            [new Uint8Array([]), conservative], [enc("x"), null], [enc("x"), undefined]];
  for (const [bytes, h] of cases) {
    const d = await digests(bytes, h, { sha256 });
    assert.equal(d.identity, await sha256(bytes));
  }
});

test("R7 a non-textual handler gives rendition and evidentiary equal to identity and textual false", async () => {
  const bytes = new Uint8Array([37, 80, 68, 70, 0, 1, 2]);
  /** @type {Array<CompareHandler | null>} */
  const odd = [{ key: "binary", textual: false }, {}, null,
               { textual: false, rules: () => [{ key: "x", region: "mechanical", label: "x", patterns: [/()(.)()/g] }] }];
  for (const h of odd) {
    const d = await digests(bytes, h, { sha256 });
    assert.equal(d.rendition, d.identity);
    assert.equal(d.evidentiary, d.identity);
    assert.equal(d.textual, false);
  }
});

test("R8 textual digests: rendition after mechanical rules, evidentiary after the boundary or presentational rules, three region labels", async () => {
  assert.deepEqual(REGION, { EVIDENTIARY: "evidentiary", PRESENTATIONAL: "presentational", MECHANICAL: "mechanical" });
  const row = [["1", "B", "3/3/2026"]];
  // mechanical only moves: rendition and evidentiary both unmoved
  const a = await digests(enc(calendarHtml(row, { state: "AAA" })), aspnetWebforms, { sha256 });
  const b = await digests(enc(calendarHtml(row, { state: "BBB" })), aspnetWebforms, { sha256 });
  assert.notEqual(a.identity, b.identity);
  assert.equal(a.rendition, b.rendition);
  assert.equal(a.evidentiary, b.evidentiary);
  assert.equal(a.textual, true);
  assert.ok((a.mechanical_bytes ?? 0) > 0);
  assert.ok(a.applied.some((x) => x.rule === "webforms_page_state" && x.region === "mechanical"));
  // outside the boundary is presentational: evidentiary unmoved, rendition moved
  const c = await digests(enc(calendarHtml(row, { header: "one" })), aspnetWebforms, { sha256 });
  const d = await digests(enc(calendarHtml(row, { header: "two" })), aspnetWebforms, { sha256 });
  assert.notEqual(c.rendition, d.rendition);
  assert.equal(c.evidentiary, d.evidentiary);
  assert.ok(c.applied.some((x) => x.rule === "outside_the_document" && x.region === "presentational"));
  assert.equal(c.boundary_missed, false);
  // inside the boundary is substance: evidentiary moves
  const e0 = await digests(enc(calendarHtml([["1", "C", "3/3/2026"]])), aspnetWebforms, { sha256 });
  assert.notEqual(e0.evidentiary, c.evidentiary);
  // no boundary declared: the presentational rules decide
  /** @type {CompareHandler} */
  const nb = { key: "nb", textual: true,
    rules: () => [{ key: "chrome", region: "presentational", label: "chrome", patterns: [/(<nav>)([\s\S]*?)(<\/nav>)/g] }] };
  const e = await digests(enc("<nav>one</nav><p>body</p>"), nb, { sha256 });
  const f = await digests(enc("<nav>two</nav><p>body</p>"), nb, { sha256 });
  const g = await digests(enc("<nav>two</nav><p>other</p>"), nb, { sha256 });
  assert.equal(e.evidentiary, f.evidentiary);
  assert.notEqual(f.evidentiary, g.evidentiary);
  assert.notEqual(e.rendition, f.rendition, "presentational rules do not touch the rendition");
  assert.ok((e.presentational_bytes ?? 0) > 0);
  assert.equal(e.rendition, await sha256(enc("<nav>one</nav><p>body</p>")), "no mechanical rule: rendition is the decoded text");
  // a WordPress article: furniture via its <article> boundary
  /** @type {DigestContext} */
  const ctx = { sha256, locator: "https://news.test/2026/03/harbor/" };
  const w1 = await digests(enc(wordpressArticle({ nav: "Home" })), wordpress, ctx);
  const w2 = await digests(enc(wordpressArticle({ nav: "Home | Sports" })), wordpress, ctx);
  assert.equal(w1.evidentiary, w2.evidentiary);
  // every label reported is one of the three
  for (const x of [...a.applied, ...c.applied, ...e.applied, ...w1.applied])
    assert.ok([REGION.EVIDENTIARY, REGION.PRESENTATIONAL, REGION.MECHANICAL].includes(x.region));
});

test("R9 a declared boundary that misses normalises nothing beyond mechanical and says boundary_missed", async () => {
  const noArticle = (/** @type {string} */ nav) => `<html><head><meta name="generator" content="WordPress 6.5"></head>`
    + `<body><nav>${nav}</nav><div>The harbor reopened.</div><footer>f</footer></body></html>`;
  /** @type {DigestContext} */
  const ctx = { sha256, locator: "https://news.test/2026/03/harbor/" };
  const a = await digests(enc(noArticle("Home")), wordpress, ctx);
  const b = await digests(enc(noArticle("Home | Sports")), wordpress, ctx);
  assert.equal(a.boundary_missed, true);
  assert.equal(a.presentational_bytes, 0, "nothing presentational is normalised");
  assert.notEqual(a.evidentiary, b.evidentiary, "a change outside the missed boundary is still substance");
  assert.equal(a.evidentiary, a.rendition);
  // the same for a declared boundary with presentational rules beside it: they are not used
  /** @type {CompareHandler} */
  const both = { textual: true, boundary: () => /<main>([\s\S]*)<\/main>/,
    rules: () => [{ key: "chrome", region: "presentational", label: "chrome", patterns: [/(<nav>)([\s\S]*?)(<\/nav>)/g] }] };
  const m1 = await digests(enc("<nav>one</nav><p>x</p>"), both, { sha256 });
  const m2 = await digests(enc("<nav>two</nav><p>x</p>"), both, { sha256 });
  assert.equal(m1.boundary_missed, true);
  assert.notEqual(m1.evidentiary, m2.evidentiary);
  // the precondition, and the one throw
  for (const bad of [{}, { sha256: "x" }, null, undefined])
    await assert.rejects(() => digests(enc("x"), conservative, bad), TypeError);
  // otherwise never throws: odd handlers, odd rules, odd boundaries
  await assert.doesNotReject(() => digests(enc("x"), { textual: true }, { sha256 }));
  await assert.doesNotReject(() => digests(enc("x"), { textual: true, rules() { throw new Error("bad"); } }, { sha256 }));
  await assert.doesNotReject(() => digests(enc("x"), { textual: true, rules: () => "nope" }, { sha256 }));
  await assert.doesNotReject(() => digests(enc("x"), { textual: true, rules: () => [null, { region: "mechanical" }, { region: "mechanical", patterns: ["x", null] }] }, { sha256 }));
  await assert.doesNotReject(() => digests(enc("x"), { textual: true, boundary() { throw new Error("bad"); } }, { sha256 }));
  await assert.doesNotReject(() => digests(enc("x"), { textual: true, boundary: () => "<main>" }, { sha256 }));
});

/* ------------------------------------------------------------------- compare */

test("R10 compare: identical, undetermined, changed, restyled, unchanged, each as defined", async () => {
  const row = [["1", "B", "3/3/2026"]];
  /** @type {DigestContext} */
  const cert = { sha256, confidence: CONFIDENCE.CERTAIN, locator: CAL };
  const base = enc(calendarHtml(row));
  /** @param {Comparison} r @param {string} verdict @param {boolean | null} change */
  const check = (r, verdict, change) => {
    assert.equal(r.verdict, verdict);
    assert.equal(r.evidentiary_change, change);
    assert.equal(typeof r.why, "string");
    assert.ok(r.why.length > 0);
  };
  // identical: the identity digests are equal, whatever the confidence
  for (const conf of [CONFIDENCE.CERTAIN, CONFIDENCE.LIKELY, undefined])
    check(await compare(base, base, aspnetWebforms, { sha256, confidence: conf }), "identical", false);
  // undetermined: not CERTAIN and not conservative, whatever moved
  for (const conf of [CONFIDENCE.LIKELY, CONFIDENCE.POSSIBLE, CONFIDENCE.NONE, undefined]) {
    const u = await compare(base, enc(calendarHtml(row, { state: "zz" })), aspnetWebforms, { sha256, confidence: conf });
    check(u, "undetermined", null);
    assert.equal(u.confidence, conf || CONFIDENCE.NONE);
  }
  // changed: the evidentiary digests differ
  check(await compare(base, enc(calendarHtml([["1", "C", "3/3/2026"]])), aspnetWebforms, cert), "changed", true);
  // restyled: the evidentiary the same, the rendition differs
  check(await compare(base, enc(calendarHtml(row, { header: "new header" })), aspnetWebforms, cert), "restyled", false);
  // unchanged: only machinery moved
  const un = await compare(base, enc(calendarHtml(row, { state: "zz", nonce: "n2" })), aspnetWebforms, cert);
  check(un, "unchanged", false);
  // the record of how: handler, confidence, artifacts, applied, digests
  assert.equal(un.handler, "aspnet_webforms");
  assert.equal(un.confidence, CONFIDENCE.CERTAIN);
  assert.ok(un.artifacts.includes(localize("site-profiles.aspnet-webforms.page_state_this_site_rebuilds", "page state this site rebuilds on every visit")));
  assert.deepEqual(un.digests.before, await digests(base, aspnetWebforms, cert));
  assert.deepEqual(un.applied, un.digests.before.applied);
  // conservative is trusted without certainty
  check(await compare(enc(plainHtml()), enc(plainHtml({ nonce: "n9" })), conservative, { sha256 }), "unchanged", false);
  check(await compare(enc(plainHtml()), enc(plainHtml({ body: "Other." })), conservative, { sha256 }), "changed", true);
  // errors: as digests
  await assert.rejects(() => compare(base, base, aspnetWebforms, {}), TypeError);
  check(await compare(base, enc("x"), null, { sha256 }), "undetermined", null);
});

/* ------------------------------------------------------------------ fidelity */

test("R11 fidelity is faithful, degraded or insufficient by what is missing and whether it is critical", () => {
  /** @type {Part} */
  const css = { ok: false, kind: "stylesheet", url: "/a.css" };
  /** @type {Part} */
  const icon = { ok: false, kind: "image", url: "/i.png" };
  /** @type {Part} */
  const ad = { ok: false, kind: "script", reason: "THIRD_PARTY" };
  /** @type {Part} */
  const held = { ok: true, kind: "stylesheet" };
  for (const h of [aspnetWebforms, wordpress, conservative])
    assert.deepEqual(fidelity({ subresources: [held, ad] }, h), { level: "faithful", missing: [], critical: [] });
  const d = fidelity({ subresources: [held, icon] }, aspnetWebforms);
  assert.deepEqual({ level: d.level, missing: d.missing, critical: d.critical }, { level: "degraded", missing: [icon], critical: [] });
  const i = fidelity({ subresources: [css, icon] }, aspnetWebforms);
  assert.equal(i.level, "insufficient");
  assert.deepEqual(i.critical, [css]);
  assert.deepEqual(i.missing, [css, icon]);
  assert.equal(fidelity({ subresources: [icon] }, conservative).level, "insufficient", "in ignorance every part is critical");
  assert.equal(fidelity({ subresources: [icon] }, clientRendered).level, "insufficient", "in a shell the script is the document");
  assert.equal(fidelity({ subresources: [ad] }, clientRendered).level, "insufficient", "a shell ignores nothing");
  // never throws, and a handler that cannot say is answered in the safe direction
  assert.equal(fidelity(null, conservative).level, "faithful");
  assert.doesNotThrow(() => assert.equal(fidelity({ subresources: "x" }, null).level, "faithful"));
  assert.equal(fidelity({ subresources: [icon, null] }, {}).level, "insufficient");
  const thrower = { ignorable() { throw new Error("x"); }, renderCritical() { throw new Error("x"); } };
  assert.equal(fidelity({ subresources: [ad] }, thrower).level, "insufficient");
});

/* ------------------------------------------------------------- profileRecord */

test("R12 profileRecord names the handler, its version, the confidence, signals, kind, time and note", () => {
  const id = identify({ text: calendarHtml([["1", "B", "3/3/2026"]]), locator: CAL });
  assert.deepEqual(profileRecord(id, { now: NOW }), { handler: "aspnet_webforms", handler_label: aspnetWebforms.label,
    handler_version: 1, confidence: "certain", signals: id.signals, document_kind: "index", considered: id.considered,
    at: NOW, note: null });
  const none = profileRecord(identify({ text: "plain" }), {});
  assert.equal(none.handler, "conservative");
  assert.equal(none.confidence, "none");
  assert.equal(none.document_kind, "unknown");
  assert.equal(none.note, localize("site-profiles.index.no_handler_recognised_this_document",
    "no handler recognised this document, so it is treated conservatively: nothing is assumed to be decoration and any difference is reported"));
  assert.match(none.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(profileRecord(identify({ text: "X-KINDLESS-STACK" }), { now: NOW }).document_kind, "unknown");
  // never throws
  for (const x of [null, undefined])
    assert.equal(profileRecord(x, { now: NOW }).handler, null);
  assert.doesNotThrow(() => assert.equal(profileRecord(3, { now: NOW }).handler, null));
  assert.doesNotThrow(() => assert.equal(profileRecord("x", { now: NOW }).handler, null));
  assert.doesNotThrow(() => assert.equal(profileRecord({ handler: 7 }, { now: NOW }).handler, null));
  assert.equal(typeof profileRecord(null).at, "string");
});

/* ---------------------------------------------------------- event catalogue */

test("R13 every event kind is named once in EVENTS with its fixed significance; event() draws it and throws on an unknown type", () => {
  assert.deepEqual(SIGNIFICANCE, { EVENT: "event", NOTICE: "notice", ROUTINE: "routine" });
  const grades = new Set([SIGNIFICANCE.EVENT, SIGNIFICANCE.NOTICE, SIGNIFICANCE.ROUTINE]);
  assert.ok(Object.keys(EVENTS).length > 0);
  for (const [type, spec] of Object.entries(EVENTS)) {
    assert.ok(grades.has(spec.significance), type);
    assert.deepEqual(event(type), { type, significance: spec.significance });
    const e = event(type, { key: "k1", significance: "routine", type: "other" });
    assert.deepEqual(e, { type, significance: spec.significance, key: "k1" }, "a detail never regrades");
    assert.deepEqual(Object.keys(e).slice(0, 2), ["type", "significance"]);
  }
  for (const bad of ["no_such_event", "", "constructor", "toString", "__proto__", undefined, null, 3])
    assert.throws(() => event(bad), /unknown event type/, String(bad));
});

test("R14 worstSignificance, isMeaningful and bySeverity", () => {
  const e = event("delisted"), n = event("renamed"), r = event("scheduled");
  assert.equal(worstSignificance([]), null);
  assert.equal(isMeaningful([]), false);
  const lists = [[r], [n], [e], [r, n], [n, r], [r, e, n], [n, n], [r, r, e], [e, e]];
  for (const list of lists) {
    const ranks = list.map((x) => significanceRank(x.significance));
    const worst = list.find((x) => significanceRank(x.significance) === Math.max(...ranks))?.significance;
    assert.equal(worstSignificance(list), worst);
    assert.equal(isMeaningful(list), worstSignificance(list) === "event");
    const copy = list.slice();
    assert.equal(bySeverity(copy), copy, "in place");
    for (let i = 1; i < copy.length; i++)
      assert.ok(significanceRank(copy[i - 1]?.significance) >= significanceRank(copy[i]?.significance));
  }
  assert.ok(significanceRank("event") > significanceRank("notice") && significanceRank("notice") > significanceRank("routine"));
  // none throws on a list of events, and nothing outside the catalogue is ever the worst
  const odd = [{ type: "x", significance: "constructor" }, r, {}, null];
  assert.equal(worstSignificance(odd), "routine");
  assert.equal(worstSignificance([{ significance: "toString" }]), null);
  bySeverity(odd);
  assert.equal(odd[0], r);
});

/* --------------------------------------------------------------- unescapeHtml */

test("R15 unescapeHtml decodes the six entities and nothing else, once", () => {
  assert.equal(unescapeHtml("a&amp;b&#39;c&quot;d&lt;e&gt;f&nbsp;g"), `a&b'c"d<e>f g`);
  assert.equal(unescapeHtml("&amp;lt;"), "&lt;", "decoded once, never twice");
  assert.equal(unescapeHtml("&copy; &#38; &apos; &AMP; &lt"), "&copy; &#38; &apos; &AMP; &lt");
  assert.equal(unescapeHtml("MeetingDetail.aspx?ID=1&amp;GUID=x"), "MeetingDetail.aspx?ID=1&GUID=x");
  for (const x of [null, undefined, 7, {}]) assert.equal(unescapeHtml(x), String(x));
});

/* ----------------------------------------------------------------- invariants */

/** Every string the module answers or holds at its interface: the handlers' words,
   their rules' labels, every why, every signal, the event catalogue, each value written
   out whole, its keys and strings among it.
   @returns {Promise<string[]>} */
async function outwardText() {
  /** @type {string[]} */
  const out = [];
  const walk = (/** @type {unknown} */ v) => { out.push(JSON.stringify(v) ?? ""); };
  for (const h of handlers()) {
    walk({ key: h.key, label: h.label, warning: h.warning });
    for (const ctx of CTXS) {
      for (const r of (typeof h.rules === "function" ? h.rules(ctx) : []))
        walk({ key: r.key, label: r.label, region: r.region });
      walk(h.detect(ctx));
      if (typeof h.kind === "function") walk(h.kind(ctx));
    }
  }
  for (const ctx of CTXS) walk(profileRecord(identify(ctx), { now: NOW }));
  walk({ EVENTS, SIGNIFICANCE, CONFIDENCE, REGION });
  const row = [["1", "B", "3/3/2026"]];
  /** @type {Array<[string, string, StackHandler, string]>} */
  const pairs = [[calendarHtml(row), calendarHtml(row), aspnetWebforms, "certain"],
    [calendarHtml(row), calendarHtml(row, { state: "q" }), aspnetWebforms, "likely"],
    [calendarHtml(row), calendarHtml([["2", "B", "3/3/2026"]]), aspnetWebforms, "certain"],
    [calendarHtml(row), calendarHtml(row, { header: "h" }), aspnetWebforms, "certain"],
    [calendarHtml(row), calendarHtml(row, { state: "q" }), aspnetWebforms, "certain"]];
  for (const [a, b, h, conf] of pairs) {
    const r = await compare(enc(a), enc(b), h, { sha256, confidence: conf });
    walk({ why: r.why, artifacts: r.artifacts, applied: r.applied });
  }
  for (const subs of [[{ ok: false, kind: "stylesheet" }], [{ ok: false, kind: "image" }]])
    walk(fidelity({ subresources: subs }, aspnetWebforms));
  /** @param {unknown} err */
  const said = (err) => { if (err instanceof Error) out.push(err.message); return true; };
  assert.throws(() => event("nope"), said);
  await assert.rejects(() => digests(enc("x"), conservative, {}), said);
  return out;
}

test("R16 no place is named in what the module answers or holds", async () => {
  const PLACES = /oakland|alameda|california|\bbay area\b|berkeley|san francisco|legistar|oaklandside|opengov/i;
  const text = await outwardText();
  assert.ok(text.length > 100);
  for (const s of text) assert.doesNotMatch(s, PLACES);
  // and the handlers need no place: each recognises its stack on a host that names none
  assert.equal(identify({ text: calendarHtml([["1", "B", "3/3/2026"]]), locator: "https://records.example/Calendar.aspx" }).handler, aspnetWebforms);
  assert.equal(identify({ text: wordpressArticle(), locator: "https://news.example/2026/01/x/" }).handler, wordpress);
  assert.equal(identify({ text: shellHtml(), locator: "https://portal.example/" }).handler, clientRendered);
});

test("R17 deterministic over its inputs, reading no store and no network", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("site-profiles must not reach the network"); });
  {
    const row = [["1", "B", "3/3/2026"]];
    const a = enc(calendarHtml(row)), b = enc(calendarHtml(row, { header: "h", state: "s" }));
    /** @type {DigestContext} */
    const ctx = { sha256, confidence: CONFIDENCE.CERTAIN, locator: CAL };
    for (const c of CTXS) {
      assert.deepEqual(identify(c), identify(c));
      assert.deepEqual(profileRecord(identify(c), { now: NOW }), profileRecord(identify(c), { now: NOW }));
    }
    for (const h of [aspnetWebforms, wordpress, clientRendered, conservative]) {
      assert.deepEqual(await digests(b, h, ctx), await digests(b, h, ctx));
      assert.deepEqual(await compare(a, b, h, ctx), await compare(a, b, h, ctx));
      const subs = { subresources: [{ ok: false, kind: "stylesheet" }, { ok: false, kind: "image" }, { ok: true }] };
      assert.deepEqual(fidelity(subs, h), fidelity(subs, h));
    }
    // a fresh registry built the same way answers the same way
    const build = () => {
      /** @type {Registry<StackContext, StackHandler>} */
      const r = makeRegistry();
      for (const h of handlers()) r.register(h);
      return r;
    };
    for (const c of CTXS.filter((x) => x.text)) {
      const [x, y] = [build().recognise(c), build().recognise(c)];
      assert.deepEqual({ ...x, member: x.member?.key }, { ...y, member: y.member?.key });
    }
    assert.deepEqual(event("moved", { k: 1 }), event("moved", { k: 1 }));
  }
});

test("R18 an unrecognised document is never assumed decorated, and a handler without CERTAIN never says unchanged", async () => {
  // conservative: nothing is furniture, almost nothing is machinery
  assert.equal(conservative.conservative, true);
  assert.equal(conservative.detect({ text: plainHtml() }).match, false);
  assert.deepEqual(conservative.rules().map((r) => r.region), ["mechanical"]);
  assert.equal(typeof conservative.boundary, "undefined");
  // so any byte difference outside a nonce is reported, even in what looks like navigation
  const r = await compare(enc(plainHtml({ nav: "Home" })), enc(plainHtml({ nav: "Home | News" })),
    identify({ text: plainHtml() }).handler, { sha256, confidence: identify({ text: plainHtml() }).confidence });
  assert.equal(r.handler, "conservative");
  assert.equal(r.verdict, "changed");
  assert.equal((await compare(enc(plainHtml()), enc(plainHtml({ nonce: "z" })), conservative, { sha256 })).verdict, "unchanged");
  // every other handler, at every confidence short of CERTAIN, never says unchanged or restyled
  const row = [["1", "B", "3/3/2026"]];
  /** @type {Array<[string, string]>} */
  const pairs = [[calendarHtml(row), calendarHtml(row, { state: "q" })], [calendarHtml(row), calendarHtml(row, { header: "h" })],
                 [wordpressArticle(), wordpressArticle({ nav: "x" })], [shellHtml("1"), shellHtml("2")]];
  for (const h of [aspnetWebforms, wordpress, clientRendered])
    for (const conf of [CONFIDENCE.LIKELY, CONFIDENCE.POSSIBLE, CONFIDENCE.NONE, undefined])
      for (const [x, y] of pairs) {
        const v = await compare(enc(x), enc(y), h, { sha256, confidence: conf, locator: "https://n.test/2026/01/a/" });
        assert.equal(v.verdict, "undetermined", `${h.key} at ${conf}`);
      }
  // and a recognised-but-LIKELY stack is answered with its confidence by identify
  const l = identify({ text: plainHtml(), headers: { "x-powered-by": "ASP.NET" } });
  assert.equal(l.confidence, CONFIDENCE.LIKELY);
  const v = await compare(enc(plainHtml()), enc(plainHtml({ nonce: "q" })), l.handler, { sha256, confidence: l.confidence });
  assert.equal(v.verdict, "undetermined");
});

test("R19 every no says which no and why", async () => {
  // no match
  const none = identify({ text: "plain" });
  assert.equal(none.confidence, CONFIDENCE.NONE);
  const noHandler = localize("site-profiles.index.no_handler_recognised_this_document",
    "no handler recognised this document, so it is treated conservatively: nothing is assumed to be decoration and any difference is reported");
  assert.equal(none.why, noHandler);
  assert.equal(profileRecord(none, { now: NOW }).note, noHandler);
  // no confidence: undetermined, with null rather than false, and why
  const u = await compare(enc("<p>a</p>"), enc("<p>b</p>"), aspnetWebforms, { sha256, confidence: CONFIDENCE.LIKELY });
  assert.equal(u.evidentiary_change, null);
  assert.equal(u.why, localize("site-profiles.index.the_document_differs_and_this_kind",
    "the document differs and this kind of document is not recognised well enough to say whether the difference matters"));
  // no meaningful change: each settled no says which
  const row = [["1", "B", "3/3/2026"]];
  /** @type {DigestContext} */
  const cert = { sha256, confidence: CONFIDENCE.CERTAIN };
  /** @type {Set<string>} */
  const whys = new Set();
  for (const b of [calendarHtml(row), calendarHtml(row, { state: "q" }), calendarHtml(row, { header: "h" })]) {
    const r = await compare(enc(calendarHtml(row)), enc(b), aspnetWebforms, cert);
    assert.equal(r.evidentiary_change, false);
    whys.add(r.why);
  }
  assert.equal(whys.size, 3, "identical, unchanged and restyled each say which no");
  // no digest beyond the mechanical: the missed boundary is named, never read as no content
  const missed = await digests(enc("<p>a</p>"), { textual: true, boundary: () => /<main>([\s\S]*)<\/main>/ }, { sha256 });
  assert.equal(missed.boundary_missed, true);
  assert.equal(missed.evidentiary, await sha256(enc("<p>a</p>")));
  // not faithful: says which level and why
  for (const subs of [[{ ok: false, kind: "image" }], [{ ok: false, kind: "stylesheet" }]]) {
    const f = fidelity({ subresources: subs }, aspnetWebforms);
    assert.notEqual(f.level, "faithful");
    assert.match(f.why ?? "", /./);
  }
  // no significance: null, not "routine"
  assert.equal(worstSignificance([]), null);
});
