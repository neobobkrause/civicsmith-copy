/* runtime-limits R32, R33 (G123a): the child the byte-ledger test starts under an old-space cap. It reads 100 one-MiB ranges
 * with the ledger counting, keeping each range when its argument is "leak", and writes {held, peak, cap} as one JSON line. */
import { byteLedger, capFor } from "../../../src/byte-ledger.mjs";

const leak = process.argv[2] === "leak";
const l = byteLedger();
/** @type {Uint8Array[]} */
const keep = [];
for (let i = 0; i < 100; i++) {
  const b = new Uint8Array(1048576).fill(i);
  l.hold(b.length, "range");
  if (leak) keep.push(b); else l.release(b.length, "range");
}
console.log(JSON.stringify({ held: l.held(), peak: l.peak(), cap: capFor(100) }));
