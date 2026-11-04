/* public-read — the document and the place a published finding's evidence entry cites (requirements:
 * `build/requirements/public-read.md` R41 (1), amending R39; `case-grammar` R12, R17). The finding's published bytes
 * list its legs (`basis:`); the signed case document states, for each member, a `grading_facts:` row per leg, the
 * `passages:` it relies on and the `materials:` it reaches. A leg that rests on a captured document is named by what the
 * case states of that document and placed at the passage the case states it relies on, so two entries of one case are
 * told apart. Nothing of the document's bytes is read or handed over (B318 4): the name is the material row's `title` (R41, C47), else its `origin`
 * as signed (its `ref` when the origin is not stated), the place the passage's `extent` exactly as signed (an object, or the canonical text of one, R43), for the
 * reader's surface to word. Pure; never throws. */

import { gradingFactsOf, passagesOf, materialsOf, ungradedPassagesOf, typedPassagesOf } from "../case-grammar/index.mjs";

const HEX64 = /^[0-9a-f]{64}$/;
const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
/* a capture a grading fact lists: its SHA-256, whether the row lists it bare or as an object that carries it */
const shaOf = (c) => {
  const v = typeof c === "string" ? c : c && typeof c === "object" ? c.sha ?? c.sha256 ?? c.capture ?? c.capture_sha : null;
  return typeof v === "string" && HEX64.test(v.toLowerCase()) ? v.toLowerCase() : null;
};

/* R43: a signed extent is read as the object it is, or as the canonical JSON text case-grammar R17 signs; text that does
   not parse to an object gives null, never a throw */
const extentOf = (v) => {
  let x = v;
  if (typeof x === "string") { try { x = JSON.parse(x); } catch { return null; } }
  return x && typeof x === "object" && !Array.isArray(x) ? x : null;
};

/** R41 (1): the reader of one signed case document's account of its legs, or null when the document states none
 *  (a format before `/6`, or no grading facts block). `forFinding(id)` answers `{ of(leg) }` for one member: `of(leg)`
 *  takes the finding's published legs in the order its bytes list them and answers each leg's `document`,
 *  `{name, place}` for a leg the case states rests on a captured document (`name` null when the case states no
 *  material for it, `place` null when it cites the whole document), else null. A leg is paired with the signed row of
 *  its target in order (the k-th leg on a target with the k-th row on it), and a row with the first passage of the
 *  finding not yet used that is at one of the row's captures (the leg's `content_id` first, when it names one). */
export function legReaderOf(fm) {
  const grading = gradingFactsOf(fm);
  if (!grading) return null;
  const passages = passagesOf(fm) || {};
  const mats = (materialsOf(fm) || {}).materials;
  const materials = Array.isArray(mats) ? mats.filter((m) => m && typeof m === "object") : [];
  return {
    forFinding(id) {
      const rows = Array.isArray(grading[id]) ? grading[id] : [];
      const mine = Array.isArray(passages[id]) ? passages[id] : [];
      const usedRows = new Set(), usedPassages = new Set();
      /* R47, R49 (T53): `at(leg)` answers `{ord, document}`: the signed row's `ord` the leg is paired with (null when no
         row is), so the leg is found in the `/10` passage blocks, beside `of(leg)`'s `document`. Each leg is asked once. */
      const at = (leg) => {
        const i = rows.findIndex((r, k) => !usedRows.has(k) && r && r.target === (leg && leg.target));
        if (i < 0) return { ord: null, document: null };
        usedRows.add(i);
        const row = rows[i];
        return { ord: Number.isSafeInteger(row.ord) ? row.ord : null, document: documentOf(row, leg) };
      };
      const documentOf = (row, leg) => {
        if (row.kind !== "document") return null;
        const shas = new Set((Array.isArray(row.captures) ? row.captures : []).map(shaOf).filter(Boolean));
        const fits = (p, i) => !usedPassages.has(i) && p && shas.has(String(p.capture_sha ?? "").toLowerCase());
        const named = typeof leg.content_id === "string" ? mine.findIndex((p, i) => fits(p, i) && p.content_id === leg.content_id) : -1;
        const found = named >= 0 ? named : mine.findIndex(fits);
        if (found >= 0) usedPassages.add(found);
        const passage = found >= 0 ? mine[found] : null;
        const extent = extentOf(passage && passage.extent);
        const material = materials.find((m) => shas.has(String(m.sha ?? "").toLowerCase()));
        return { name: material ? text(material.title) ?? text(material.origin) ?? text(material.ref) : null, place: extent };
      };
      return { at, of: (leg) => at(leg).document };
    },
  };
}

/* R49 (T53; DEC-464): the key the typed words' label is drawn by, and the key a member is named by whose credit at signing
   showed nothing of her (`group` or `project`, or none stated). */
export const TYPED_LABEL_KEY = "case.typed.label";
export const TEAM_MEMBER_KEY = "credit.team_member";
const SHOWN = ["cover", "name"];
/* A credit as the signed row states it: the name it showed at `cover` or `name`, else the plain key and nothing of her. */
const creditOf = (level, shown) => (SHOWN.includes(level) && text(shown)
  ? { level, name: text(shown), key: null } : { level: level ?? null, name: null, key: TEAM_MEMBER_KEY });

/** R47, R49 (T53; DEC-461, DEC-464; `case-grammar` R36, R37): what one signed case document states of a member's passages,
 *  for its `basis` entries. `forFinding(id)` answers `{ungraded_count, marks(ord)}`; `marks(ord)` answers `{ungraded,
 *  typed}` for the leg paired with the signed row at `ord`: `ungraded` true when the `ungraded_passages:` block lists (the
 *  finding, `ord`), false when it does not, null for a format before `/10` (or an unreadable block); `typed` `{label_key,
 *  typist, checked_by, frozen_at}` exactly as the `typed_passages:` row states it, `frozen_at` the edition's signing
 *  (`signedAt`), else null. A name is the one the row states, never a member id; nothing is re-read from `content` or
 *  credit. `ungraded_count` is the block's rows for the finding, null before `/10`. Pure; never throws. */
export function passageMarksOf(fm, signedAt = null) {
  let ungraded = { state: "predates", rows: null }, typed = { state: "predates", rows: null };
  try { ungraded = ungradedPassagesOf(fm); typed = typedPassagesOf(fm); } catch { /* states nothing: null below */ }
  const uRows = ungraded.state === "stated" && Array.isArray(ungraded.rows) ? ungraded.rows : null;
  const tRows = typed.state === "stated" && Array.isArray(typed.rows) ? typed.rows : null;
  return {
    forFinding(id) {
      const mineU = uRows ? uRows.filter((r) => r && r.finding === id) : null;
      const mineT = tRows ? tRows.filter((r) => r && r.finding === id) : [];
      return {
        ungraded_count: mineU ? mineU.length : null,
        marks(ord) {
          const t = ord == null ? null : mineT.find((r) => r.ord === ord) || null;
          return {
            ungraded: mineU ? (ord != null && mineU.some((r) => r.ord === ord)) : null,
            typed: t ? { label_key: TYPED_LABEL_KEY, typist: creditOf(t.typist_level, t.typist_shown),
                         checked_by: (Array.isArray(t.checkers) ? t.checkers : []).map((c) => ({ ...creditOf(c.level, c.shown), at: c.at ?? null })),
                         frozen_at: typeof signedAt === "string" && signedAt ? signedAt : null } : null,
          };
        },
      };
    },
  };
}
