/* What a reading must be, asserted: shared by the shape-runner cases of G124f and G128i (plane's corpus R set). A refusal passes only with a numeric `size` equal to the file's figure, a `bound` equal to the table's, and a
   sentence (the reading's `why`/`basis`) holding both figures and not the word "undecodable" (S-8). */
import assert from "node:assert/strict";

export const digits = (s) => String(s || "").replace(/[,\s_]/g, "");
/** the reading is whole: the child lived, completeness `whole`, nothing owed */
export function whole(r, label) {
  assert.equal(r.died, false, `${label}: ${r.error || r.stderr}`);
  const g = r.reading; assert.ok(g, `${label}: no reading was made`);
  assert.equal(g.refusal, null, `${label}: refused ${JSON.stringify(g.refusal)}: ${g.completeness && g.completeness.why}`);
  assert.equal(g.completeness && g.completeness.state, "whole", `${label}: ${JSON.stringify(g.completeness)}`);
  assert.deepEqual(r.done.left, [], `${label}: work still owed`);
}
/** the reading is refused with the size and the limit it was judged against */
export function refused(r, label, size, bound) {
  assert.equal(r.died, false, `${label}: ${r.error || r.stderr}`);
  const g = r.reading; assert.ok(g, `${label}: no reading was made`);
  const said = `${g.completeness && g.completeness.why} | ${g.basis}`;
  assert.ok(g.refusal, `${label}: not refused; it said: ${said} (state ${g.completeness && g.completeness.state}, read_through ${g.read_through}/${g.total})`);
  assert.equal(Number(g.refusal.size), size, `${label}: the refusal's size ${g.refusal.size}, the file's figure ${size}`);
  assert.equal(Number(g.refusal.bound), bound, `${label}: the refusal's limit ${g.refusal.bound}, the table's ${bound}`);
  assert.ok(digits(said).includes(String(size)) && digits(said).includes(String(bound)), `${label}: the sentence holds neither or only one of the figures ${size} and ${bound}: ${said}`);
  assert.ok(!/undecodable/i.test(said), `${label}: worded as an undecodable region (S-8): ${said}`);
}

/** the upload itself is refused at the entry's limit (the harness's child exits 4 with the capture's answer): the answer names
 *  `TOO_LARGE` with a numeric `size` over the limit and `bound` equal to the table's. The capture counts the bytes it took
 *  before it stopped, so `size` is over the bound, not the file's own figure. */
export function refusedAtUpload(r, label, bound) {
  const m = /the upload was refused: (.*)$/s.exec(String(r.error || ""));
  assert.ok(m, `${label}: the upload was not refused: ${r.died ? r.error || r.stderr : "the file was read"}`);
  const num = (k) => { const x = new RegExp(`"${k}":(\\d+)`).exec(m[1]); return x ? Number(x[1]) : null; };
  assert.match(m[1], /"reason":"TOO_LARGE"/, `${label}: ${m[1]}`);
  assert.equal(num("bound"), bound, `${label}: the refusal's limit, the table's ${bound}: ${m[1]}`);
  assert.ok(num("size") > bound, `${label}: the refusal's size is over the limit: ${m[1]}`);
}
