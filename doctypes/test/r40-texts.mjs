/* The texts R40's tests read (doctypes R40, R41): small seeded texts made of the phrases the types look for, to compare
 * what the types answer before and after their work was made linear (`fixtures/r40-answers.json`), and the large texts
 * the cases of G140 and G133c name. Nothing here is the module under test. */

const FRAGMENTS = [
  // staff directory
  "ann@city.gov", "bo.lee@city.gov", "c_d@city.gov", "e-f@CITY.gov.", "x@mail.example.org", "(510) 555-0100", "555-0199", "ext. 4", "Staff Directory",
  "a@b", "@city.gov", "a@@b.com", "_x@city.gov", "-x@city.gov", "x.y.z@a.b.co", "1/2/2026", "Jan 5", "contacts",
  // calendar
  "<tr><td>Rules Committee</td><td>7/16/2026</td><td><a href=\"MeetingDetail.aspx?ID=11\">Meeting details</a></td></tr>",
  "<main>", "</main>", "<tr>", "</tr>", "<td>", "Date Range Dropdown", "View.ashx?M=A&ID=12", "CANCELLED", "99/99/2026", "12/31/2025",
  // citations
  "Ordinance No. 13000 C.M.S.", "Resolution No. 88000 C.M.S.", "O.M.C. 2.20.030", "Oakland Municipal Code Section 8.28.005", "file 20-1234", "26-0910",
  // regulation
  "SECTION 1. Title.", "SECTION 2. Findings.", "DOES HEREBY ORDAIN", "WHEREAS the Council finds", "\"Board\" means the body.", "\"Term\" and \"Other\" mean things.",
  "as used in this chapter, \"X\" includes y", "Except as provided in Section 2,", "notwithstanding the above.", "This shall not apply to us.", "Sec. 4 does not apply. Next one.",
  "2.20.030 - Definitions.", "A.", "(a)", "1.", ":", "list:\n1.\nitem\n2.\nitem",
  // report
  "TO: the Council", "FROM: the Manager", "SUBJECT: a matter", "DATE: June 1, 2026", "RECOMMENDATION", "SUMMARY", "COST", "Respectfully submitted",
  // words
  "the", "of", "and", "word", " ", "  ", "\n", "\n", "\r\n", ".", ";", ". ", "Mr. ", "etc. ", "\t",
];

/** `count` seeded texts of phrases and white space.
 *  @param {number} count
 *  @returns {string[]} */
export function randomTexts(count) {
  let seed = 4040;
  const rnd = /** @param {number} n @returns {number} */ (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < count; i++) {
    let t = "";
    for (let j = 0, n = 2 + rnd(70); j < n; j++) t += FRAGMENTS[rnd(FRAGMENTS.length)] + (rnd(3) ? " " : "");
    out.push(t);
  }
  return out;
}

/** `unit` repeated to exactly `chars` characters.
 *  @param {string} unit @param {number} chars @returns {string} */
export const repeated = (unit, chars) => unit.repeat(Math.ceil(chars / unit.length)).slice(0, chars);

/** A text of `n` addresses at one domain, each with a name and a number, joined by `sep`.
 *  @param {number} n @param {string} sep @returns {string} */
export function addresses(n, sep) {
  /** @type {string[]} */
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(`Person ${i} <user${i}@city.gov> (510) 555-${String(1000 + (i % 9000))}`);
  return parts.join(sep);
}

/** About `chars` characters of lines of distinct addresses at one domain, as a spreadsheet exported to text. The lines are
 *  written into a buffer, which the heap does not hold, so the text is the only large thing the heap holds. Only the
 *  characters written are read back, so the buffer's first contents never reach the text.
 *  @param {number} chars @returns {string} */
export function csvOfAddresses(chars) {
  const buf = Buffer.alloc(chars + 200);
  let n = 0;
  for (let i = 0; n < chars; i++) n += buf.write(`Person ${i},user${i}@city.gov,555-01${String(i % 100).padStart(2, "0")}\n`, n, undefined, "latin1");
  return buf.toString("latin1", 0, n);
}

/** `n` definitions, one to a line, under a heading the regulation type reads as an instrument.
 *  @param {number} n @returns {string} */
export function definitions(n) {
  const parts = ["The City Council does hereby ordain as follows:", "SECTION 1. Definitions."];
  for (let i = 0; i < n; i++) parts.push(`"Term ${i}" means a thing numbered ${i} in this chapter.`);
  return parts.join("\n");
}

/** `n` exceptions, one to a line (`oneLine` false) or all on one line, under the same heading.
 *  @param {number} n @param {boolean} oneLine @returns {string} */
export function exceptions(n, oneLine) {
  /** @type {string[]} */
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(`Except as provided in Section ${i % 30}, this shall not apply.`);
  return "The City Council does hereby ordain as follows:\nSECTION 1. Title.\n" + parts.join(oneLine ? " " : "\n");
}

/** `n` citations of fifty instruments, one to a line (`n` a multiple of fifty), behind the formula that makes the text an
 *  instrument.
 *  @param {number} n @returns {string} */
export function citations(n) {
  const block = Array.from({ length: 50 }, (_, i) => `See Ordinance No. ${13000 + i} C.M.S.`).join("\n") + "\n";
  return "The City Council does hereby ordain as follows:\n" + block.repeat(Math.ceil(n / 50)).slice(0, -1);
}

/** A calendar page of `n` dates in one table cell.
 *  @param {number} n @returns {string} */
export function datesPage(n) {
  return `<html><body><a href="MeetingDetail.aspx?ID=1">Meeting details</a> Date Range Dropdown <main><table><tr><td>${"1/2/2026 ".repeat(n)}</td></tr></table></main></body></html>`;
}
