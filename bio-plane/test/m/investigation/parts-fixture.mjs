/* R26-R32 (T53; N1272): investigation's parts to interpret, over the real extraction (its R114-R118 interpretation and its
   reading's units), the real reading-pipeline `partsOf` (its R65) and the real retrieval text search (`findIn`, retrieval-browse R1),
   on the investigation fixture's store. A held document is written as extraction writes one (`writeReading`, its units indexed)
   and registered to its bundle in provenance's register; the part's facts are made through extraction's `interpreter` seam
   (`reading-pipeline.interpretUnits`' contract, handed as extraction's own tests hand it, R-SEAM), each call recorded. */
import { createHash } from "node:crypto";
import { world as baseWorld, P1, Q1, Q2 } from "./fixture.mjs";

export const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const AT = "2026-10-28T00:00:00Z";

/** The world with `opts.measured` (R29's table; default: pdf and sheet met) and a scripted interpreter. */
export function world(opts = {}) {
  const calls = [];
  const interpreter = async (document, part) => { calls.push(part); return { part, entities: [], facts: [{ n: calls.length }], at: AT }; };
  const measured = opts.measured === undefined
    ? { pdf: { measured_at: AT, corpus_digest: "c", bar_digest: "b", met: true }, sheet: { measured_at: AT, corpus_digest: "c", bar_digest: "b", met: true } }
    : opts.measured;
  const w = baseWorld({ ...opts, parts: true, interpreter, ...(measured ? { measured } : {}) });
  w.calls = calls;
  let n = 0;
  w.held = [];
  /** A document held in `project` (none: placed in no project), promoted through the real promotion with its capture registered,
   *  then read as extraction writes a reading, its units indexed. */
  w.doc = (project, name, units, reading = {}) => {
    const id = `INFO-2026-${String(++n).padStart(4, "0")}`;
    const d = sha(`${project}|${name}`);
    const path = `captures/${name}`, text = `bytes of ${name}`;
    const md = ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "${name}"`, "current_state: collected",
      "prior_state: null", `created: "${AT}"`, `last_updated: "${AT}"`, "group: test-group", "criticality: supporting", ...(project ? [`project: ${project}`] : []),
      "---", "", "## Summary", "", "A document.", ""].join("\n");
    const prov = { documents: [{ file: path, locator: `https://example.org/${name}`, retrieved: AT, authority: "the publisher",
      authority_state: "determined", authority_basis: "named on the document",
      capture: { method: "acquire", grade: "B", actor_class: "session", sha256: d, encoding: "utf8", bytes: Buffer.byteLength(text) },
      origin: { kind: "named_request" } }] };
    const r = w.promotion.promote({ bundleId: id, base: null, snapKey: `k${n}`, author: "member:ann", meta: { object_type: "information" },
      files: [{ path: "bundle.md", text: md }, { path, text }, { path: "data/provenance.json", text: JSON.stringify(prov, null, 2) }],
      register: [{ sha256: d, path, encoding: "utf8", bytes: Buffer.byteLength(text) }] });
    if (!r.ok) throw new Error(`parts fixture promote refused: ${JSON.stringify(r).slice(0, 600)}`);
    w.record.transact(() => w.extraction.writeReading({ bundleId: id, captureSha: d, composed: true, textUnits: units,
      reading: { found: true, entities: [], content_type: "application/pdf", text_source: null, basis: "t", at: AT, ...reading } }));
    w.held.push(d);
    return { id, sha: d };
  };
  /** A PDF of `pages` pages, page i's text `text(i)`. */
  w.pdf = (project, name, pages, text) => w.doc(project, name,
    Array.from({ length: pages }, (_, i) => ({ extent: { kind: "pdf-page", page: i }, text: text(i), seq: i })), { page_count: pages });
  /** A sheet `sheet` of `rows` rows and `cols` columns, row r's text `text(r)` (one unit a row). */
  w.sheet = (project, name, sheet, rows, cols, text) => w.doc(project, name,
    Array.from({ length: rows }, (_, i) => ({ extent: { kind: "sheet-range", sheet, range: `A${i + 1}:${String.fromCharCode(64 + cols)}${i + 1}` }, text: text(i + 1), seq: i })),
    { content_type: "text/csv", container_extent: { sheets: [{ name: sheet, usedRows: rows, usedCols: cols }] } });
  /** The titles of the questions P1 draws on (Q1, Q2): the investigation's own words (R27). */
  w.ask = (q1, q2 = "") => { for (const [t, q] of [[q1, Q1], [q2, Q2]]) w.st.sql.exec(`UPDATE bundles SET title = ? WHERE bundle_id = ?`, t, q); };
  w.P = P1;
  return w;
}
