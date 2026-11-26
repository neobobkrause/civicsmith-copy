/* runtime-limits: the byte ledger, the one cap convention and the platform's figures (R32, R33, R34; fix round 9 G123a;
 * K4838, K4840 (2)). The ledger counts only the backing stores a reader tells it of; a leak is seen in held(). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { byteLedger, capFor, PLATFORM_FIGURES } from "../../../src/byte-ledger.mjs";
import { readLedgerLine } from "./ledger-line.mjs";

const MiB = 1048576;
/** each figure by its name */
const figures = () => new Map(Object.entries(PLATFORM_FIGURES));

test("R32: hold adds, release takes off under the same tag and never below zero, held is the sum over tags, peak the largest held", () => {
  const l = byteLedger();
  assert.deepEqual([l.held(), l.peak()], [0, 0]);
  l.hold(100, "a"); l.hold(50, "b"); l.hold(0, "a");
  assert.equal(l.held(), 150);
  l.release(30, "a");
  assert.equal(l.held(), 120);
  l.release(1000, "a");
  assert.equal(l.held(), 50);
  l.release(10, "never-held");
  assert.equal(l.held(), 50);
  l.release(50, "b");
  assert.equal(l.held(), 0);
  assert.equal(l.peak(), 150);
  l.hold(200, "c");
  assert.equal(l.peak(), 200);
});

test("R32: hold throws a TypeError for anything but a non-negative integer, and counts nothing then", () => {
  const l = byteLedger();
  for (const bad of [-1, 1.5, NaN, Infinity, "5", null, undefined, {}, 2 ** 60]) assert.throws(() => l.hold(bad, "t"), TypeError, String(bad));
  assert.equal(l.held(), 0);
  assert.equal(l.peak(), 0);
  assert.throws(() => l.release(-1, "t"), TypeError);
});

test("R32: a buffer not released shows in held() after its work ends; every ledger is independent of every other", () => {
  const a = byteLedger(), b = byteLedger();
  /** @param {import("../../../src/byte-ledger.mjs").ByteLedger} l @param {boolean} leak */
  const readRange = (l, leak) => { l.hold(100 * MiB, "range"); if (!leak) l.release(100 * MiB, "range"); };
  readRange(a, false); readRange(b, true);
  assert.equal(a.held(), 0);
  assert.equal(b.held(), 100 * MiB);
  assert.equal(a.peak(), 100 * MiB);
  b.release(100 * MiB, "range");
  assert.equal(a.peak(), 100 * MiB);
  assert.notEqual(a.hold, b.hold);
});

test("R34: PLATFORM_FIGURES is a deeply frozen map name -> {value, source} with Stage 0's start values", () => {
  assert.ok(Object.isFrozen(PLATFORM_FIGURES) && [...figures().values()].every((e) => Object.isFrozen(e)), "deeply frozen: the map and every entry");
  /** @type {{ [name: string]: number }} */
  const start = { isolate_memory_bytes: 268435456, idle_bytes: 52428800, cpu_ms: 300000, LAND_BATCH_BYTES: 1048576, request_body_max: 104857600 };
  for (const [name, v] of Object.entries(start)) assert.equal(figures().get(name)?.value, v, name);
  for (const [name, e] of figures()) {
    assert.deepEqual(Object.keys(e).sort(), ["source", "value"], name);
    assert.ok(Number.isSafeInteger(e.value) && e.value > 0, name);
  }
  assert.throws(() => { "use strict"; PLATFORM_FIGURES.cpu_ms.value = 1; }, TypeError);
  assert.throws(() => { "use strict"; PLATFORM_FIGURES.extra = { value: 1, source: "x" }; }, TypeError);
});

test("R34: an entry's source is a ruling or a PLATFORM.md row; an entry still citing a ruling holds that ruling's figure", () => {
  /** @type {{ [name: string]: number }} */
  const figuresRuled = { isolate_memory_bytes: 268435456, idle_bytes: 52428800, cpu_ms: 300000, LAND_BATCH_BYTES: 1048576, request_body_max: 104857600 };
  const ruled = new Map(Object.entries(figuresRuled));
  for (const [name, e] of figures()) {
    assert.match(e.source, /^(K[0-9]+( \([0-9]+\))?|PLATFORM\.md P-M[0-9]+)$/, name);
    if (/^K/.test(e.source)) assert.equal(e.value, ruled.get(name), `${name} cites ${e.source}`);
  }
  assert.equal(PLATFORM_FIGURES.idle_bytes.source, "K4616");
});

test("R33: capFor is the one formula, from the isolate's memory and the idle figure, whole megabytes, the same for a PDF run and a sheet run", () => {
  const iso = PLATFORM_FIGURES.isolate_memory_bytes.value / MiB, idle = PLATFORM_FIGURES.idle_bytes.value / MiB;
  for (const N of [0, 1, 24, 32, 100, 100.6]) {
    const cap = capFor(N);
    assert.ok(Number.isInteger(cap), `N=${N}`);
    assert.equal(cap, Math.floor(iso - idle - N));
  }
  assert.equal(capFor(24), 182);
  assert.equal(capFor(24), capFor(24));
  assert.ok(capFor(1) > capFor(2));
  assert.equal(capFor(10000), 0);
  assert.throws(() => capFor(-1), TypeError);
  assert.throws(() => capFor("5"), TypeError);
});

test("R33 and R32 (G123a): a 100 MiB range read in a child capped at capFor(100) with the ledger counting stays within the isolate's memory; the leak shows", () => {
  const child = fileURLToPath(new URL("./ledger-child.mjs", import.meta.url));
  const cap = capFor(100);
  /** @param {"read" | "leak"} arg */
  const run = (arg) => {
    const r = spawnSync(process.execPath, [`--max-old-space-size=${cap}`, child, arg], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return readLedgerLine(r.stdout);
  };
  const ok = run("read"), bad = run("leak");
  assert.equal(ok.held, 0);
  assert.equal(ok.peak, MiB);
  assert.equal(bad.held, 100 * MiB);
  assert.equal(ok.cap, 106);
});

test("R22: the new services are pure: the same inputs give the same answers, a ledger keeps its counters in the object its caller made, and importing the files changes nothing shared", async () => {
  const a = byteLedger(), b = byteLedger();
  a.hold(7, "x");
  assert.equal(b.held(), 0);
  assert.equal(capFor(5), capFor(5));
  const again = await import("../../../src/read-bounds.mjs?again");
  assert.deepEqual(again.READ_BOUNDS, (await import("../../../src/read-bounds.mjs")).READ_BOUNDS);
});
