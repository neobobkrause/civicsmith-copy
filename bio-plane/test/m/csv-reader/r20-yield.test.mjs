/* csv-reader R20 (fix round 7, G82; K4743): `text(partsOrBytes, {inlineCellsMax, yieldNow})` awaits `yieldNow()` between
   its 1 MiB windows and answers exactly what the call without it answers. The clock in the stretch test is the test's
   own, read in `yieldNow` outside the call (R-CLOCK); no figure is taken from inside the module. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEntry } from "../../../src/csv-reader/index.mjs";
import { bigCsv, csvField, randomText, prng, MIB } from "./large.mjs";
import { enc, overBytes } from "./fixtures.mjs";
/** @import { PartsOrBytes, TextOptions } from "../../../src/csv-reader/index.mjs" */

/** A yieldNow that counts its calls. @returns {{n: number, fn: () => Promise<void>}} */
const counter = () => { const c = { n: 0, fn: async () => { c.n++; } }; return c; };
/** Lets every microtask already queued, and those they queue, run; no timer is used. */
const settle = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
/** R20 says a body that is not bytes changes nothing, which `text`'s stated type leaves out: the value is handed on as the
 *  kind the slot states, as a caller the checker does not see may.
 *  @param {unknown} v @returns {PartsOrBytes} */
const asPartsOrBytes = (v) => /** @type {PartsOrBytes} */ (v);
/** R20 says a yieldNow that is not a function changes nothing, which the option's stated type leaves out: handed on likewise.
 *  @param {unknown} v @returns {(() => unknown) | undefined} */
const asYieldNow = (v) => /** @type {(() => unknown) | undefined} */ (v);

test("R20 text() awaits yieldNow between its 1 MiB windows (3.5 MiB: at least 3 awaits), none for a body within one window", async () => {
  const big = bigCsv({ rows: 1850 });
  assert.ok(big.bytes.length > 3.1 * MIB && big.bytes.length < 3.7 * MIB, `body ${big.bytes.length}`);
  const c = counter();
  const t = await csvEntry.text(big.bytes, { yieldNow: c.fn });
  assert.equal(t.ok, true);
  assert.ok(c.n >= 3, `yieldNow called ${c.n} times`);
  const small = counter();
  await csvEntry.text(bigCsv({ rows: 100 }).bytes, { yieldNow: small.fn });
  assert.equal(small.n, 0, "a body of one window has no gap to yield in");
  const parts = await csvEntry.parts(big.bytes);
  const again = counter();
  await csvEntry.text(parts, { yieldNow: again.fn });
  assert.ok(again.n >= 3 && again.n <= c.n, `parts() given: the walk's own gaps (${again.n} of ${c.n}; bytes also yields in parts())`);
});

test("R20 yieldNow is awaited: the next window is not walked until it settles; a non-function, a throw and a rejection change nothing", async () => {
  const body = bigCsv({ rows: 1294 }).bytes;
  const want = await csvEntry.text(body);
  /* each yieldNow settles only when the test releases it, after every microtask has run: a call that did not await it would
     end with one still open, and one that walked on would open a second */
  const state = { open: 0, overlapped: false, settled: false };
  /** @type {(() => void)[]} */
  const pending = [];
  /** @returns {Promise<void>} */
  const slow = () => {
    state.open++;
    if (state.open > 1) state.overlapped = true;
    return new Promise((r) => { pending.push(() => { state.open--; r(); }); });
  };
  const call = csvEntry.text(body, { yieldNow: slow }).finally(() => { state.settled = true; });
  for (let i = 0; i < 10_000 && !state.settled; i++) { await settle(); pending.shift()?.(); }
  assert.deepEqual(await call, want);
  assert.equal(state.open, 0);
  assert.equal(state.overlapped, false);
  /** @type {unknown[]} */
  const notFunctions = ["yes", null, 7];
  for (const yieldNow of notFunctions) assert.deepEqual(await csvEntry.text(body, { yieldNow: asYieldNow(yieldNow) }), want);
  /** @type {(() => unknown)[]} */
  const failing = [() => { throw new Error("no"); }, async () => { throw new Error("no"); }];
  for (const yieldNow of failing) assert.deepEqual(await csvEntry.text(body, { yieldNow }), want);
});

/** @returns {[string, Uint8Array][]} each body by its name */
function awkwardBodies() {
  /** @param {number} n */
  const filler = (n) => "x".repeat(n);
  /** @param {number} n */
  const rows = (n) => Array.from({ length: n }, (_, i) => `${i},${filler(30)}`);
  const head = rows(60).join("\r\n") + "\r\n";                       // the delimiter signature reads the first 50 lines
  /* pad one record so that a chosen byte lands on the 1 MiB edge (counted from the start of the body, after any BOM) */
  /** @param {string} prefix @param {number} target @param {(n: number) => string} make */
  const padTo = (prefix, target, make) => prefix + make(target - prefix.length);
  const edge = MIB;
  /** @type {[string, Uint8Array][]} */
  const bodies = [];
  /** @param {string} name @param {Uint8Array} body */
  const add = (name, body) => { bodies.push([name, body]); };
  add("record crossing the edge", enc(padTo(head, edge - 20, (n) => filler(n) + "\r\n") + "alpha,beta-gamma-delta-epsilon,zeta\r\n" + rows(70000).join("\r\n")));
  add("quoted newline across the edge", enc(padTo(head, edge - 3, (n) => filler(n) + "\r\n") + '"line one\nline two\r\nline three",b\r\nlast,row\r\n' + rows(70000).join("\r\n")));
  add("doubled quote across the edge", enc(padTo(head, edge - 4, (n) => filler(n) + "\r\n") + '"a""b""""c",d\r\n' + rows(70000).join("\n")));
  add("CRLF split by the edge", enc(padTo(head, edge - 1, (n) => filler(n)) + "\r\nx,y\r\n" + rows(70000).join("\r\n")));
  /* a two-byte, a three-byte and a four-byte character, each starting a byte or two before the edge */
  /** @type {[string, string, number][]} */
  const characters = [["two-byte", "é", 1], ["three-byte", "€", 2], ["four-byte", "😀", 3]];
  for (const [name, ch, back] of characters) {
    const pre = head + filler(edge - back - head.length - 1) + ",";
    add(`${name} character across the edge`, new Uint8Array([...new TextEncoder().encode(pre + ch + ",tail\r\n" + rows(70000).join("\r\n"))]));
    assert.ok(new TextEncoder().encode(pre).length < edge && new TextEncoder().encode(pre + ch).length > edge, name);
  }
  add("BOM", new Uint8Array([0xef, 0xbb, 0xbf, ...enc(head + rows(80000).join("\r\n"))]));
  const huge = filler(300 * 1024);
  add("row over the cap", enc(head + `1,${huge},2\r\n` + rows(60000).join("\r\n") + `\r\n3,${huge},"${huge}\n${huge}"\r\n` + rows(30000).join("\r\n")));
  add("undetermined encoding past the head", new Uint8Array([...enc(head + rows(70000).join("\r\n")), 0x2c, 0x96, 0x0d, 0x0a, ...enc("a,b\r\n")]));
  add("semicolon, no final newline", enc(rows(80000).map((r) => r.replace(",", ";")).join("\n")));
  /** @param {string} s @returns {Uint8Array} UTF-16LE with a BOM */
  const u16 = (s) => { const b = new Uint8Array(2 + s.length * 2); b[0] = 0xff; b[1] = 0xfe; for (let i = 0; i < s.length; i++) { b[2 + i * 2] = s.charCodeAt(i) & 255; b[3 + i * 2] = s.charCodeAt(i) >> 8; } return b; };
  add("utf-16le", u16(head + rows(40000).join("\r\n") + "\r\n€,😀\r\n"));
  const bad = u16(head + rows(40000).join("\r\n")); bad[bad.length - 1] = 0xd8; bad[bad.length - 2] = 0x41;
  add("utf-16le invalid tail", bad);
  return bodies;
}

test("R20 the answer with yieldNow deep-equals the answer without, over awkward bodies, bytes or parts()", async () => {
  for (const [name, body] of awkwardBodies()) {
    /** @type {TextOptions[]} */
    const options = [{}, { inlineCellsMax: 256 * 1024 }, { inlineCellsMax: 0 }];
    for (const opts of options) {
      const c = counter();
      const want = await csvEntry.text(body, opts);
      const got = await csvEntry.text(body, { ...opts, yieldNow: c.fn });
      assert.deepEqual(got, want, `${name} ${JSON.stringify(opts)}`);
      assert.ok(c.n >= 1, `${name}: yielded ${c.n}`);
      const parts = await csvEntry.parts(body);
      assert.deepEqual(await csvEntry.text(parts, { ...opts, yieldNow: c.fn }), want, `${name} parts`);
    }
  }
});

test("R20 the answer is the same over the size guard, an empty body, and a body that is not bytes", async () => {
  const over = overBytes();
  /** @type {unknown[]} */
  const bodies = [over, new Uint8Array(0), null, "text"];
  for (const body of bodies) {
    const c = counter();
    assert.deepEqual(await csvEntry.text(asPartsOrBytes(body), { yieldNow: c.fn }), await csvEntry.text(asPartsOrBytes(body)));
  }
});

test("R20 no synchronous stretch of a 17 MiB read covers more than one window (test's own clock)", async () => {
  const rand = prng(5);
  /** @type {string[]} */
  const out = [];
  let bytes = 0;
  for (let r = 1; bytes < 17 * MIB - 4096; r++) {
    const record = [String(r), randomText(rand, 400), randomText(rand, 400), r % 7 === 0 ? `a,b\nsecond ${randomText(rand, 30)}` : "x"].map(csvField).join(",");
    out.push(record);
    bytes += record.length + 2;
  }
  const body = enc(out.join("\r\n") + "\r\n");
  assert.ok(body.length > 16.9 * MIB && body.length <= 17 * MIB, `body ${body.length}`);
  /** @type {number[]} */
  const stretches = [];
  let mark = performance.now();
  /* the stretch is the module's own synchronous work between two yields; the yield itself is not timed */
  const yieldNow = async () => { const now = performance.now(); stretches.push(now - mark); await Promise.resolve(); mark = performance.now(); };
  const t = await csvEntry.text(body, { inlineCellsMax: 512 * 1024, yieldNow });
  stretches.push(performance.now() - mark);
  assert.equal(t.ok, true);
  assert.ok(stretches.length >= 17, `${stretches.length} stretches`);
  const longest = Math.max(...stretches), total = stretches.reduce((a, b) => a + b, 0);
  console.log(`R20 stretch (bar 500 ms, K4354): ${stretches.length} stretches, longest ${longest.toFixed(1)} ms, total ${total.toFixed(1)} ms`);
  assert.ok(longest < 500, `longest stretch ${longest} ms of ${total} ms`);
});
