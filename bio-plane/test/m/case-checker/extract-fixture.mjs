/* case-checker tests: a `/10` case resting on a cited register row, its extract carried in its material row (R29-R31). The
   row is `case-grammar`'s own (`registerExtractRow`, its R38, R39), never hand-built. Shared by `extract.test.mjs` and the
   battery (`battery.mjs`, R27). Nothing here is a test. */
import * as CG from "../../../src/case-grammar/index.mjs";
import { contentIdFor } from "../../../src/content/extent.mjs";
import { caseFile, gradingFacts, sha, A, B, C, MINUTES_SHA } from "./fixture.mjs";

export const V10 = "bio-case-document/10";
export const SEG = sha("the reduced segment of the register");
export const ORIGINAL = sha("the register's original file");
export const REG = "INFO-2026-0031-register-row";
export const REG2 = "INFO-2026-0032-register-row";
export const HEADER = ["src_row", "name", "amount"];
export const ROW = ["17", "Lakeshore Holdings", "2500"];
export const LIMIT = { key: "contributor_names", citation: "the register's own terms of use", text_key: "jurisdictions.use_limit.contributor_names" };
export const extractArgs = (over = {}) => ({ ref: REG, origin: "https://records.example/register.csv", rests_under: "load_bearing", register: "contributions",
  file: `register-${SEG.slice(0, 16)}.csv`, reduced_sha256: SEG, original_sha256: ORIGINAL, original_covers: "rows 1-400",
  source_date: "2026-08-01", imported_at: "2026-09-01T10:00:00Z", src_row: 17, kept_columns: HEADER, roles: ["row", "name", "amount"],
  dropped_columns: ["address"], header: HEADER, row: ROW, ...over });
export const extractRow = (over) => { const r = CG.registerExtractRow(extractArgs(over)); if (!r.ok) throw new Error(`fixture: ${JSON.stringify(r)}`); return r.row; };

export const EXTENT = { kind: "sheet-range", sheet: `register-${SEG.slice(0, 16)}.csv`, range: "A19:C19" };
export const minutesPassage = { content_id: contentIdFor(MINUTES_SHA, { kind: "pdf-page", page: 0 }, null), capture_sha: MINUTES_SHA,
  extent: { kind: "pdf-page", page: 0 }, chain: null, quoted: "The lease was approved without a vote." };
export const regPassage = (over = {}) => ({ content_id: contentIdFor(SEG, EXTENT, null), capture_sha: SEG, extent: EXTENT, chain: null, quoted: "Lakeshore Holdings 2500", ...over });
export const regLeg = (ref = REG) => ({ target: ref, kind: "document", role: "supports", grade: "B", grade_axis: "capture", grade_source: "capture", ground: null, captures: [SEG] });

/* A `/10` case whose load-bearing member A rests on one register row (or on each of `rows`, with its `legs`),
   the extract carried in its row; `docLines` are signed with the document; `editDoc` changes its text after it is signed. */
export function extractOpts({ rows = [extractRow()], passage = regPassage(), legs = [regLeg()], editDoc = null, docLines = [], format = V10 } = {}) {
  const base = gradingFacts();
  /* a passage's `ord` is its leg's (`case-catalogue` R7 joins them so): the register legs follow the minutes' leg */
  const [first, ...rest] = base[A].legs;
  const facts = { ...base, [A]: { legs: [first, ...legs, ...rest] } };
  const passages = { [A]: [minutesPassage, ...(passage ? [passage] : [])], [B]: [], [C]: [] };
  return { format, facts, signedPassages: passages, docLines,
    materialRows: (m0) => [...m0, ...rows],
    mutate: (texts) => {
      texts.set(CG.caseFilePath("passages", A), JSON.stringify(passages[A]));
      if (editDoc) { const p = CG.caseFilePath("case_document", null); texts.set(p, editDoc(texts.get(p))); }
    } };
}
export const extractCase = (opts) => caseFile(extractOpts(opts));
