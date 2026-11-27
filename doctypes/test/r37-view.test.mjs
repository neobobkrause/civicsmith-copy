/* doctypes — R37 over a classification view (fix round 9, K4892). Every registered type's `detect`, over the view docprofile
 * hands the types for a 3 MiB sheet (CLASSIFY_VIEW_MAX_CHARS, 1.5 M characters), leaves little uncollected garbage: each type
 * flattens the view once per `detect`, not once per pass. Measured in a child (./r37-view-child.mjs) with a 2 MB young
 * generation and no collection after the `detect`, as the plane's isolate runs: a large-object string is freed only by a major
 * collection, so in one tick of an isolate that is shared they pile up. Before the fix `regulation` left 37.0 MB, `meeting_minutes`
 * 12.6 MB, `meeting_agenda` 1.1 MB, `staff_report` 1.0 MB. The bar is counts of megabytes, never a time (R-CLOCK).
 * The answers are unchanged on every fixture: bounded.test.mjs, g140.test.mjs, doctypes.test.mjs and the type suites. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DOCTYPES } from "../index.mjs";
import { flatWindows, counted } from "../windows.mjs";
/** @import { DoctypeContext } from "../../docprofile/doctypes/index.mjs" */
/** @import { FlatWindow } from "../windows.mjs" */
/** @import { ViewReport } from "./r37-view-child.mjs" */

/**
 * How the child ended, and what it wrote.
 * @typedef {{ code: number | null, out: string, err: string }} ChildRun
 */

/* Proposed (BOB records): a detect leaves under 6 MB of garbage over the 1.5 M-character view. Measured at 3.8 MB for the
   worst type (`regulation`: the one flat string and its parts), 0.0 to 1.0 for the rest; 37.0 before. */
const LEFT_MB = 6;
const CHILD = fileURLToPath(new URL("./r37-view-child.mjs", import.meta.url));

/** @returns {Promise<ChildRun>} */
function child() {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--expose-gc", CHILD], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (/** @type {Buffer} */ d) => (out += d));
    p.stderr.on("data", (/** @type {Buffer} */ d) => (err += d));
    p.on("close", (/** @type {number | null} */ code) => resolve({ code, out, err }));
    setTimeout(() => p.kill("SIGKILL"), 120_000).unref();
  });
}

test("R37 every type's detect over a 3 MiB sheet's classification view leaves under 6 MB uncollected, with no collection in the stretch", async () => {
  const r = await child();
  assert.equal(r.code, 0, r.err.slice(-400));
  const m = /** @type {ViewReport} decodes what the module's own child printed */ (JSON.parse(String(r.out.trim().split("\n").pop())));
  assert.ok(m.of > 3_000_000 && m.chars < m.of && m.chars <= 1.5 * 1024 * 1024, `the view is ${m.chars} of ${m.of} characters`);
  assert.deepEqual(Object.keys(m.types), DOCTYPES.map((t) => t.key), "every registered type is measured");
  for (const [key, t] of Object.entries(m.types)) assert.ok(t.leftMB < LEFT_MB, `${key} left ${t.leftMB.toFixed(1)} MB over a ${m.chars}-character view`);
  for (const [key, t] of Object.entries(m.types))
    if (key !== "generic") assert.ok(t.work > 0 && t.work <= 4 * m.chars, `${key} charged ${t.work} characters to ctx.work (R40)`);
});

test("R37 the one flat string a detect scans is flatten(text): every white-space character, lone surrogates and every length of run", () => {
  const WS = ["\t", "\n", "\v", "\f", "\r", " ", " ", " ", " ", " ", " ", " ", " ", " ", "　", "﻿"];
  const NOT = ["\u0085", "᠎", "​", "⁠", "a", "Z", "9", "😀", "\ud83d", "\ude00", "é", "-"];
  let seed = 7;
  const rnd = /** @param {number} n @returns {number} */ (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  /** Entry `i` of `xs`, which `rnd` keeps in range; the `TypeError` reading a member of a missing one raised.
   *  @param {ReadonlyArray<string>} xs @param {number} i @returns {string} @throws {TypeError} where it is missing */
  const at = (xs, i) => { const x = xs[i]; if (x === undefined) throw new TypeError("Cannot read properties of undefined (reading 'repeat')"); return x; };
  for (let round = 0; round < 40; round++) {
    let text = "";
    for (let i = 0, n = 1 + rnd(900); i < n; i++) text += rnd(3) ? (rnd(2) ? WS[rnd(WS.length)] : NOT[rnd(NOT.length)]) : at(WS, rnd(WS.length)).repeat(1 + rnd(4));
    const want = text.replace(/\s+/g, " ");
    /* in a detect (one flat string) and outside one (windows of 7 characters with 3 of padding) */
    /** The windows the detect saw, once it has run. @type {FlatWindow[][]} */
    const inside = [];
    counted({ key: "t", detect(/** @type {DoctypeContext} */ ctx) { inside[0] = [...flatWindows(ctx.text)]; return { match: false }; } }).detect({ text, work: { chars: 0, limit: Infinity } });
    const seen = inside[0];
    if (seen === undefined) throw new TypeError("Cannot read properties of null (reading 'length')");
    assert.equal(seen.length, 1, "one window");
    const one = seen[0];
    if (one === undefined) throw new TypeError("Cannot read properties of undefined (reading 'buf')");
    assert.equal(one.buf.slice(one.from, one.to), want);
    let outside = "";
    for (const w of flatWindows(text, { chunk: 7, pad: 3 })) outside += w.buf.slice(w.from, w.to);
    assert.equal(outside, want);
  }
});
