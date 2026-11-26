/* runtime-limits R32, R33 (G123a): the one line ledger-child.mjs writes, read back by the byte-ledger test. */

/**
 * @param {string} text the child's standard output
 * @returns {{ held: number, peak: number, cap: number }}
 * @throws {TypeError} when the text is not the child's line
 */
export function readLedgerLine(text) {
  const out = JSON.parse(text);
  const held = typeof out === "object" && out !== null && "held" in out ? out.held : undefined;
  const peak = typeof out === "object" && out !== null && "peak" in out ? out.peak : undefined;
  const cap = typeof out === "object" && out !== null && "cap" in out ? out.cap : undefined;
  if (typeof held !== "number" || typeof peak !== "number" || typeof cap !== "number") throw new TypeError(`not the ledger child's line: ${text}`);
  return { held, peak, cap };
}
