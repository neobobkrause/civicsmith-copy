/* format-registry: requirement-named tests for the registry's services and invariants
 * (build/requirements/format-registry.md R1-R13, R24-R27), at the module's interface.
 * Every test that changes the registry puts the built-in roster back exactly as it found it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerFormat, unregisterFormat, getFormat, listFormats, detectFormat } from "../../../src/formats.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const BUILT_IN = ["jpeg", "png", "gif", "tiff", "webp", "bmp", "jp2", "heic", "heif", "avif", "html", "mhtml", "pdf", "rtf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "csv", "doc", "xls", "ppt", "json", "ndjson", "xml", "svg", "kml", "kmz", "geojson", "ics", "vcf", "srt", "vtt", "eml", "msg", "mbox", "tar", "gz", "7z", "zip", "text"];
const enc = (s) => new TextEncoder().encode(s);
const PDF = enc("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
const HTML = enc("<!DOCTYPE html><html><body>x</body></html>");
/* Binary bytes that no entry claims: with the real roster they are `unlisted` and unnamed (R38), with the registry emptied (or no `text`
   fallback) R12's `undetermined`. Plain words would be `text` (R35). */
const NOTHING = Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3);

/** Runs `fn` with the registry emptied, then restores the roster in its original order. */
function withEmptyRegistry(fn) {
  const saved = listFormats().map((f) => unregisterFormat(f));
  try { return fn(); }
  finally {
    for (const f of listFormats()) unregisterFormat(f);
    for (const e of saved) registerFormat(e);
    assert.deepEqual(listFormats(), BUILT_IN);
  }
}

/** Re-registers the built-in entries in their original order (after a test moved one to the end). */
function restoreBuiltInOrder() {
  const held = new Map(listFormats().map((f) => [f, unregisterFormat(f)]));
  for (const f of BUILT_IN) registerFormat(held.get(f));
  assert.deepEqual(listFormats(), BUILT_IN);
}

/** A detect spy: logs every call as [name, bytes, contentType] and answers `answer(bytes, ct)`. */
function spy(name, log, answer = () => null) {
  return { format: name, detect(bytes, ct) { log.push([name, bytes, ct]); return answer(bytes, ct); } };
}

test("R1: an entry must name its format — null, undefined, a non-object, a missing, empty or non-string format all throw", () => {
  const msg = { message: "a format entry must name its format" };
  const detect = () => null;
  for (const bad of [null, undefined, 0, 1, "", "x", true, Symbol("s"), 5n, {}, { detect },
    { format: "", detect }, { format: 5, detect }, { format: null, detect }, { format: ["x"], detect },
    { format: new String("x"), detect }]) {
    assert.throws(() => registerFormat(bad), msg);
  }
  assert.deepEqual(listFormats(), BUILT_IN);
});

test("R2: detect must be a function", () => {
  for (const detect of [undefined, null, 1, "detect", {}, [], true]) {
    const entry = { format: "r2-stub" };
    if (detect !== undefined) entry.detect = detect;
    assert.throws(() => registerFormat(entry), { message: 'format "r2-stub": detect(bytes, contentType) is required' });
  }
  assert.equal(getFormat("r2-stub"), null);
  assert.deepEqual(listFormats(), BUILT_IN);
});

test("R3: parts, structure and text are each optional; present and not a function throws naming the slot", () => {
  const detect = () => null;
  for (const slot of ["parts", "structure", "text"]) {
    for (const bad of [1, 0, "", "fn", {}, [], true, false]) {
      assert.throws(() => registerFormat({ format: "r3-stub", detect, [slot]: bad }),
        { message: `format "r3-stub": ${slot} must be a function or null` });
      assert.equal(getFormat("r3-stub"), null);
    }
  }
  const variants = [
    {},
    { parts: null, structure: null, text: null },
    { parts: undefined, structure: undefined, text: undefined },
    { parts: () => 1, structure: () => 2, text: () => 3 },
    { parts: null, structure: () => 2 },
  ];
  for (const v of variants) {
    const e = { format: "r3-stub", detect, ...v };
    assert.equal(registerFormat(e), e);
    assert.equal(unregisterFormat("r3-stub"), e);
  }
  assert.deepEqual(listFormats(), BUILT_IN);
});

test("R4: a second registration under a held format throws, and the existing entry stays in place", () => {
  const first = { format: "r4-stub", detect: () => null };
  registerFormat(first);
  try {
    const second = { format: "r4-stub", detect: () => ({ format: "r4-stub" }) };
    assert.throws(() => registerFormat(second), { message: 'format "r4-stub" is already registered; unregister it first' });
    assert.equal(getFormat("r4-stub"), first);
    assert.deepEqual(listFormats(), [...BUILT_IN, "r4-stub"]);
    for (const f of BUILT_IN) {
      const held = getFormat(f);
      assert.throws(() => registerFormat({ format: f, detect: () => null }),
        { message: `format "${f}" is already registered; unregister it first` });
      assert.equal(getFormat(f), held);
    }
  } finally { unregisterFormat("r4-stub"); }
  assert.deepEqual(listFormats(), BUILT_IN);
});

test("R5: the entry is stored and returned unchanged — not cloned, no default filled — and reachable from getFormat and detectFormat", () => {
  const MAGIC = "#R5-STUB";
  const entry = Object.freeze({
    format: "r5-stub",
    detect: (b, ct) => (b && new TextDecoder("latin1").decode(b).startsWith(MAGIC) ? { format: "r5-stub", confidence: "certain", signals: [] } : null),
  });
  assert.equal(detectFormat(enc(MAGIC), null).format, "text");
  try {
    const got = registerFormat(entry);
    assert.equal(got, entry);
    assert.deepEqual(Object.keys(got), ["format", "detect"]);
    assert.equal("parts" in got, false);
    assert.equal(getFormat("r5-stub"), entry);
    assert.equal(detectFormat(enc(MAGIC), null).format, "r5-stub");
  } finally { unregisterFormat("r5-stub"); }
});

test("R6: unregisterFormat removes and returns the entry; an unknown key answers null, changes nothing, never throws", () => {
  const e = { format: "r6-stub", detect: () => null };
  registerFormat(e);
  assert.equal(unregisterFormat("r6-stub"), e);
  assert.equal(getFormat("r6-stub"), null);
  assert.deepEqual(listFormats(), BUILT_IN);
  for (const k of ["r6-stub", "", "HTML", "Pdf", undefined, null, 0, NaN, {}, [], Symbol("k"), () => 1]) {
    assert.equal(unregisterFormat(k), null);
    assert.deepEqual(listFormats(), BUILT_IN);
  }
  const pdf = unregisterFormat("pdf");
  assert.equal(pdf.format, "pdf");
  assert.equal(getFormat("pdf"), null);
  assert.deepEqual(listFormats(), BUILT_IN.filter((f) => f !== "pdf"));
  assert.equal(unregisterFormat("pdf"), null);
  registerFormat(pdf);
  restoreBuiltInOrder();
});

test("R7: getFormat returns the stored entry exactly as received, or null; never throws", () => {
  const e = { format: "r7-stub", detect: () => null, extra: { a: 1 } };
  registerFormat(e);
  try { assert.equal(getFormat("r7-stub"), e); } finally { unregisterFormat("r7-stub"); }
  for (const f of BUILT_IN) assert.equal(getFormat(f).format, f);
  for (const k of ["r7-stub", "", "HTML", undefined, null, 0, NaN, {}, [], Symbol("k")]) assert.equal(getFormat(k), null);
});

test("R8: listFormats returns every key in registration order; a re-registered format moves to the end", () => {
  assert.deepEqual(listFormats(), BUILT_IN);
  const a = { format: "r8-a", detect: () => null }, b = { format: "r8-b", detect: () => null };
  registerFormat(a); registerFormat(b);
  try {
    assert.deepEqual(listFormats(), [...BUILT_IN, "r8-a", "r8-b"]);
    registerFormat(unregisterFormat("r8-a"));
    assert.deepEqual(listFormats(), [...BUILT_IN, "r8-b", "r8-a"]);
    const html = unregisterFormat("html");
    registerFormat(html);
    assert.deepEqual(listFormats(), [...BUILT_IN.filter((f) => f !== "html"), "r8-b", "r8-a", "html"]);
    const list = listFormats();
    list.push("mutated");
    assert.equal(listFormats().includes("mutated"), false);
  } finally {
    unregisterFormat("r8-a"); unregisterFormat("r8-b");
    restoreBuiltInOrder();
  }
  assert.deepEqual(listFormats(), BUILT_IN);
  withEmptyRegistry(() => assert.deepEqual(listFormats(), []));
});

test("R9: bytes count only as a non-empty Uint8Array; a content type only as a non-empty string", () => {
  withEmptyRegistry(() => {
    const log = [];
    registerFormat(spy("s", log));
    const u8 = new Uint8Array([1, 2, 3]);
    const buf = Buffer.from([1, 2, 3]);
    for (const bytes of [undefined, null, new Uint8Array(0), Buffer.alloc(0), [1, 2, 3], new ArrayBuffer(3),
      new Uint16Array([1]), new Int8Array([1]), new DataView(new ArrayBuffer(2)), "abc", 7, {}]) {
      for (const ct of [undefined, null, "", 0, 1, {}, ["text/html"], new String("text/html"), true]) {
        log.length = 0;
        const r = detectFormat(bytes, ct);
        assert.deepEqual(log, [], "neither pass runs when nothing counts as provided");
        assert.deepEqual(r.signals, [localize("format-registry.formats.no_bytes_to_sniff", "no bytes were available to sniff"),
          localize("format-registry.formats.no_content_type_declared", "no content type was declared")]);
      }
    }
    for (const bytes of [u8, buf, new Uint8Array(new ArrayBuffer(8), 2, 1)]) {
      log.length = 0;
      detectFormat(bytes, "");
      assert.deepEqual(log, [["s", bytes, null]]);
      assert.equal(log[0][1], bytes);
    }
    log.length = 0;
    detectFormat(null, "x");
    assert.deepEqual(log, [["s", null, "x"]]);
  });
});

test("R10: pass 1 asks every entry detect(bytes, null) in registration order and returns the first truthy result carrying .format, verbatim", () => {
  withEmptyRegistry(() => {
    const log = [];
    const hit = { format: "c", confidence: "certain", signals: ["s"], extra: { k: 1 } };
    registerFormat(spy("a", log, () => ({ confidence: "certain" })));
    registerFormat(spy("b", log, () => true));
    registerFormat(spy("c", log, (b) => (b ? hit : null)));
    registerFormat(spy("d", log, (b) => (b ? { format: "d" } : null)));
    const bytes = enc("x");
    const r = detectFormat(bytes, "text/plain");
    assert.equal(r, hit);
    assert.deepEqual(log.map(([n, b, ct]) => [n, b === bytes, ct]), [["a", true, null], ["b", true, null], ["c", true, null]]);
    for (const nothing of [null, undefined, false, 0, "", {}, { format: "" }, { format: null }]) {
      unregisterFormat("c"); unregisterFormat("d");
      registerFormat(spy("c", log, () => nothing));
      registerFormat(spy("d", log, (b) => (b ? { format: "d" } : null)));
      log.length = 0;
      const r2 = detectFormat(bytes, null);
      assert.deepEqual(r2, { format: "d" });
      assert.deepEqual(log.map(([n]) => n), ["a", "b", "c", "d"]);
    }
  });
  // with the built-in roster: the answer is the matching entry's own detect result, verbatim
  assert.deepEqual(detectFormat(PDF, "text/html"), getFormat("pdf").detect(PDF, null));
  assert.deepEqual(detectFormat(HTML, "application/pdf"), getFormat("html").detect(HTML, null));
});

test("R11: pass 2 runs only when pass 1 had no hit and a content type is provided; asks detect(null, contentType) in order; first hit verbatim", () => {
  withEmptyRegistry(() => {
    const log = [];
    const hit = { format: "b", confidence: "likely", signals: [], more: true };
    registerFormat(spy("a", log));
    registerFormat(spy("b", log, (b, ct) => (ct === "x/b" ? hit : null)));
    registerFormat(spy("c", log, (b, ct) => (ct ? { format: "c" } : null)));
    const bytes = enc("zzz");
    const r = detectFormat(bytes, "x/b");
    assert.equal(r, hit);
    assert.deepEqual(log.map(([n, b, ct]) => [n, b === bytes ? "bytes" : b, ct]),
      [["a", "bytes", null], ["b", "bytes", null], ["c", "bytes", null], ["a", null, "x/b"], ["b", null, "x/b"]]);
    log.length = 0;
    assert.equal(detectFormat(null, "x/b"), hit);
    assert.deepEqual(log.map(([n, b, ct]) => [n, b, ct]), [["a", null, "x/b"], ["b", null, "x/b"]]);
    log.length = 0;
    assert.deepEqual(detectFormat(null, "x/other"), { format: "c" });
    // pass 1 hit: pass 2 never runs
    unregisterFormat("a");
    registerFormat(spy("a", log, (b) => (b ? { format: "a" } : null)));
    log.length = 0;
    assert.deepEqual(detectFormat(bytes, "x/b"), { format: "a" });
    assert.equal(log.some(([, b]) => b === null), false);
    // no content type provided: pass 2 never runs
    unregisterFormat("a"); registerFormat(spy("a", log));
    log.length = 0;
    detectFormat(bytes, "");
    assert.equal(log.some(([, b]) => b === null), false);
  });
  assert.deepEqual(detectFormat(null, "text/csv"), getFormat("csv").detect(null, "text/csv"));
  assert.deepEqual(detectFormat(NOTHING, "application/pdf"), getFormat("pdf").detect(null, "application/pdf"));
});

test("R12: no hit in either pass returns the stated undetermined with both reasons", () => {
  /* the real roster closes on `unlisted` for bytes (R38); a registry without its `text` fallback keeps R12's `undetermined` */
  let closed = true;
  const und = (a, b) => (closed && a === NO_SIG ? { format: "unlisted", named: null, confidence: "none", signals: [a, b] }
    : { format: "undetermined", confidence: "none", signals: [a, b] });
  const NO_SIG = localize("format-registry.formats.no_magic_byte_match", "no registered magic-byte signature matched");
  const NO_BYTES = localize("format-registry.formats.no_bytes_to_sniff", "no bytes were available to sniff");
  const NO_CT = localize("format-registry.formats.no_content_type_declared", "no content type was declared");
  const ct = (c) => localize("format-registry.formats.content_type_ct_matched_no", 'content type "{ct}" matched no registered format', { ct: c });
  for (const run of [() => null, withEmptyRegistry]) {
    const check = () => {
      assert.deepEqual(detectFormat(NOTHING, "x/none"), und(NO_SIG, ct("x/none")));
      assert.deepEqual(detectFormat(NOTHING, null), und(NO_SIG, NO_CT));
      assert.deepEqual(detectFormat(NOTHING, ""), und(NO_SIG, NO_CT));
      assert.deepEqual(detectFormat(null, "x/none"), und(NO_BYTES, ct("x/none")));
      assert.deepEqual(detectFormat(new Uint8Array(0), 'a "quoted" type'), und(NO_BYTES, ct('a "quoted" type')));
      assert.deepEqual(detectFormat(undefined, undefined), und(NO_BYTES, NO_CT));
      assert.deepEqual(detectFormat(), und(NO_BYTES, NO_CT));
    };
    closed = run !== withEmptyRegistry;
    if (run === withEmptyRegistry) {
      run(check);
      run(() => assert.deepEqual(detectFormat(PDF, "application/pdf"), und(NO_SIG, ct("application/pdf"))));
    } else check();
  }
  const a = detectFormat(null, null), b = detectFormat(null, null);
  assert.notEqual(a, b, "each undetermined is a fresh object a caller may keep");
});

test("R12, R17: the reasons the registry states are read by their word keys", () => {
  const [bytesReason, typeReason] = detectFormat(NOTHING, null).signals;
  assert.equal(bytesReason, localize("format-registry.formats.no_magic_byte_match", "no registered magic-byte signature matched"));
  assert.equal(typeReason, localize("format-registry.formats.no_content_type_declared", "no content type was declared"));
  assert.equal(detectFormat(HTML, null).signals[0], localize("format-registry.formats.magic_doctype_root_tag", "magic: doctype/root tag in the first 1024 bytes"));
  assert.equal(detectFormat(null, null).signals[0], localize("format-registry.formats.no_bytes_to_sniff", "no bytes were available to sniff"));
});

test("R13: the only answers are an entry's verbatim result or the stated undetermined; an entry's detect error propagates", () => {
  withEmptyRegistry(() => {
    const boom = new Error("entry detect failed");
    registerFormat({ format: "thrower", detect: () => { throw boom; } });
    assert.throws(() => detectFormat(enc("x"), null), (e) => e === boom);
    assert.throws(() => detectFormat(null, "x/y"), (e) => e === boom);
    assert.deepEqual(detectFormat(null, null).format, "undetermined", "no provided input calls no entry");
    unregisterFormat("thrower");
    const answers = [];
    registerFormat({ format: "sometimes", detect: (b, ct) => (ct === "x/s" ? { format: "sometimes", confidence: "likely", signals: [] } : null) });
    for (const [b, c] of [[enc("q"), null], [enc("q"), "x/s"], [null, "x/s"], [null, "x/t"], [enc("q"), "x/t"]]) answers.push(detectFormat(b, c).format);
    assert.deepEqual(answers, ["undetermined", "sometimes", "sometimes", "undetermined", "undetermined"]);
  });
  // the built-in roster: every answer is some registered entry's own detect result or the undetermined
  const inputs = [[PDF, null], [HTML, null], [NOTHING, null], [null, "text/html"], [null, "application/pdf"],
    [null, "text/csv"], [NOTHING, "application/octet-stream"], [enc("PK\x03\x04junk"), null]];
  for (const [b, c] of inputs) {
    const r = detectFormat(b, c);
    if (r.format === "undetermined" || r.format === "unlisted") { assert.equal(r.confidence, "none"); continue; }
    const own = b ? getFormat(r.format).detect(b, null) : getFormat(r.format).detect(null, c);
    assert.deepEqual(r, own);
  }
});

test("R24: one entry per format key, and registration order is the order listFormats and both detect passes iterate", () => {
  withEmptyRegistry(() => {
    const log = [];
    const both = (n) => spy(n, log, () => ({ format: n }));
    registerFormat(both("x")); registerFormat(both("y"));
    assert.throws(() => registerFormat(both("x")));
    assert.deepEqual(listFormats(), ["x", "y"]);
    assert.deepEqual(detectFormat(enc("b"), null), { format: "x" });
    assert.deepEqual(detectFormat(null, "t"), { format: "x" });
    registerFormat(unregisterFormat("x"));
    assert.deepEqual(listFormats(), ["y", "x"]);
    assert.deepEqual(detectFormat(enc("b"), null), { format: "y" });
    assert.deepEqual(detectFormat(null, "t"), { format: "y" });
  });
});

test("R25: detectFormat's answer for one registry state and one pair of inputs never changes; nothing here reads the clock or the network", () => {
  const inputs = [[PDF, null], [HTML, "text/plain"], [NOTHING, "x/none"], [null, "text/csv"], [null, null], [enc("PK\x03\x04"), null]];
  const first = inputs.map(([b, c]) => detectFormat(b, c));
  const saved = { fetch: globalThis.fetch, now: Date.now, perf: performance.now, Date: globalThis.Date, random: Math.random };
  const trap = (what) => () => { throw new Error(`format-registry touched ${what}`); };
  globalThis.fetch = trap("fetch");
  Date.now = trap("Date.now");
  performance.now = trap("performance.now");
  Math.random = trap("Math.random");
  globalThis.Date = new Proxy(saved.Date, { construct: trap("new Date"), apply: trap("Date()") });
  try {
    for (let i = 0; i < 3; i++) assert.deepEqual(inputs.map(([b, c]) => detectFormat(b, c)), first);
    const e = { format: "r25-stub", detect: () => null };
    registerFormat(e); getFormat("r25-stub"); listFormats(); unregisterFormat("r25-stub");
  } finally {
    globalThis.fetch = saved.fetch; Date.now = saved.now; performance.now = saved.perf;
    Math.random = saved.random; globalThis.Date = saved.Date;
  }
  // registerFormat/unregisterFormat are the mutators: the same state gives the same answers again
  const pdf = unregisterFormat("pdf");
  assert.equal(detectFormat(PDF, null).format, "text", "R35: the bytes are valid text and no other entry claims them");
  registerFormat(pdf);
  restoreBuiltInOrder();
  assert.deepEqual(inputs.map(([b, c]) => detectFormat(b, c)), first);
});

test("R26: bytes always outrank a declared content type — every entry has pass 1 before any entry sees pass 2", () => {
  withEmptyRegistry(() => {
    const log = [];
    // a content-type-only claimer registered FIRST, a bytes claimer registered LAST
    registerFormat(spy("ct-first", log, (b, ct) => (ct ? { format: "ct-first", confidence: "likely" } : null)));
    registerFormat(spy("mid", log));
    registerFormat(spy("bytes-last", log, (b) => (b ? { format: "bytes-last", confidence: "certain" } : null)));
    const r = detectFormat(enc("x"), "x/any");
    assert.equal(r.format, "bytes-last");
    assert.deepEqual(log.map(([n, b, ct]) => [n, b === null, ct]),
      [["ct-first", false, null], ["mid", false, null], ["bytes-last", false, null]]);
    // an entry that would answer on both at once is only ever asked one at a time
    log.length = 0;
    unregisterFormat("bytes-last");
    detectFormat(enc("x"), "x/any");
    for (const [, b, ct] of log) assert.ok((b === null) !== (ct === null), "each call carries exactly one input");
    const firstPass2 = log.findIndex(([, b]) => b === null);
    assert.equal(log.slice(0, firstPass2).length, 2);
    assert.ok(log.slice(0, firstPass2).every(([, , ct]) => ct === null));
  });
  // the built-in roster: a PDF served as text/html, and HTML served as application/pdf
  assert.equal(detectFormat(PDF, "text/html").format, "pdf");
  assert.equal(detectFormat(HTML, "application/pdf").format, "html");
  assert.equal(detectFormat(PDF, "text/csv").format, "pdf");
});

test("R27: an unmatched input is a stated undetermined with why; an unknown key is null from getFormat and unregisterFormat, never a throw", () => {
  const r = detectFormat(NOTHING, "x/unknown");
  assert.equal(r.format, "unlisted", "the real roster closes on a held, unnamed unlisted for bytes (R38)");
  assert.equal(r.named, null);
  assert.equal(r.confidence, "none");
  assert.equal(r.signals.length, 2);
  assert.ok(r.signals.every((s) => typeof s === "string" && s.length > 0));
  for (const k of ["nope", "", undefined, null, 42]) {
    assert.equal(getFormat(k), null);
    assert.equal(unregisterFormat(k), null);
  }
  assert.deepEqual(listFormats(), BUILT_IN);
});
