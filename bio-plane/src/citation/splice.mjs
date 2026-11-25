/* citation — the splices by which a citation is written into the citing document's bytes (R2, R4, R6). Pure; each
 * returns the new text, or null when the block it must edit is not in a shape the restricted frontmatter grammar can
 * extend in place: that grammar has no escapes and no serializer, so a wrong guess would corrupt a document silently
 * and the write would then promote the corruption.
 *
 * `spliceEdgeStatus`, `legExtentLines` and `spliceBasis` moved here from the retired legacy store's `store.mjs` (only
 * citing called them); `spliceReferences`, `setScalar` and the Session Log splice were copied from it (K57), each
 * module holding its own. */

/** R4: rewrite the `status` and `note` of specific `cites` entries in place, touching nothing else. Walks the
 *  references block entry by entry, tracking which target the current entry belongs to, and edits only the two lines
 *  of the entries named in `changes` (target → {status, note}). An entry whose note line is absent gains one, because
 *  the reason has to land somewhere; an entry with no status is not ours to guess at. Null unless every change
 *  applied. */
import { localize } from "../setup-words/index.mjs"

/**
 * @param {string} text the citing document's `bundle.md`
 * @param {Map<string, {status: string, note: string}>} changes target to its new status and note
 * @returns {string|null}
 */
export function spliceEdgeStatus(text, changes) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  let ref = -1;
  for (let i = 1; i < end; i++) if (/^references:/.test(lines[i])) { ref = i; break; }
  if (ref === -1) return null;

  /* Entry boundaries first, so an edit never runs past the entry it belongs to. An entry starts at `  - ` and ends
     before the next one or at the end of the block. */
  const starts = [];
  for (let i = ref + 1; i < end; i++) {
    if (/^ {2}- /.test(lines[i])) starts.push(i);
    else if (!/^\s/.test(lines[i]) && lines[i].trim() !== "") break;
  }
  if (!starts.length) return null;
  const blockEnd = (() => {
    let last = ref;
    for (let i = ref + 1; i < end; i++) {
      if (lines[i].trim() === "") continue;
      if (/^\s/.test(lines[i])) { last = i; continue; }
      break;
    }
    return last;
  })();

  const out = lines.slice();
  let applied = 0;
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s], to = (s + 1 < starts.length ? starts[s + 1] : blockEnd + 1) - 1;
    let target = null;
    for (let i = from; i <= to; i++) {
      const m = /^\s*(?:- )?target:\s*(.+?)\s*$/.exec(lines[i]);
      if (m) { target = m[1].replace(/^["']|["']$/g, ""); break; }
    }
    if (!target || !changes.has(target)) continue;
    const ch = changes.get(target);
    let sawNote = false, statusLine = -1;
    for (let i = from; i <= to; i++) {
      if (/^\s*(?:- )?status:/.test(lines[i])) { out[i] = "    status: " + ch.status; statusLine = i; }
      if (/^\s*(?:- )?note:/.test(lines[i])) { out[i] = `    note: "${ch.note}"`; sawNote = true; }
    }
    if (statusLine === -1) return null;
    if (!sawNote) out[statusLine] = out[statusLine] + `\n    note: "${ch.note}"`;
    applied++;
  }
  return applied === changes.size ? out.join("\n") : null;
}

/** R2: append entries to the `references` block, touching nothing else (copied from the retired legacy store, K57). Three shapes are
 *  reachable: an inline empty `references: []`, a populated block, and no references key at all; any other inline
 *  scalar is refused (null). An entry is `{rel, target, status, note, extent_capture?}`; `extent_capture` is the capture
 *  a case's edge was pinned to (REC-219 / D-579(a)). */
/**
 * @param {string} text
 * @param {{rel: *, target: *, status: *, note?: *, extent_capture?: *}[]} additions
 * @returns {string|null}
 */
export function spliceReferences(text, additions) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;

  const block = additions.map((a) =>
    localize("citation.splice.rel_rel_target_target_status", "  - rel: {rel}\n    target: {target}\n    status: {status}\n    note: \"{v1}\"{v2}", { rel: String(a.rel), target: String(a.target), status: String(a.status), v1: String(a.note ?? ""), v2: String(typeof a.extent_capture === "string" ? `\n    extent_capture: ${a.extent_capture}` : "") }));

  let ref = -1;
  for (let i = 1; i < end; i++) if (/^references:/.test(lines[i])) { ref = i; break; }

  if (ref === -1)   // no key at all: open one immediately before the closing fence
    return [...lines.slice(0, end), "references:", ...block, ...lines.slice(end)].join("\n");

  const rest = lines[ref].slice("references:".length).trim();
  if (rest === "[]")   // an empty inline array becomes a block
    return [...lines.slice(0, ref), "references:", ...block, ...lines.slice(ref + 1)].join("\n");
  if (rest !== "") return null;   // some other inline scalar: not ours to reinterpret

  /* A block. Append after its LAST indented line, so a blank line between the block and the next column-0 key stays
     where the author put it rather than being swallowed into the array. */
  let last = ref;
  for (let i = ref + 1; i < end; i++) {
    if (lines[i].trim() === "") continue;
    if (/^\s/.test(lines[i])) { last = i; continue; }
    break;
  }
  return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
}

/** REC-97 / IC-90 — the extent lines a composed leg contributes to the basis block, or none. The extent is DISCOVERED
 *  on the leg rather than read off a list (any `extent_*` key, and `content_id`), so a field the extent grammar gains
 *  needs no edit here. ORDER IS FIXED so the bytes are deterministic: `extent_kind` first, the rest alphabetically,
 *  `content_id` last. QUOTING IS BY TYPE: a number and an inline array are bare, because the grammar reads them back as
 *  a number and an array; a string is ALWAYS quoted, so a sheet named `12` is never read back as an integer. The values
 *  are fenced at the act (no quote, backslash, newline or comment mark), so the quoting cannot be broken from outside.
 *  A leg that names no part contributes nothing, which is what keeps a cite naming no part byte-identical. */
/**
 * @param {Object<string, *>} l a composed leg
 * @returns {string[]}
 */
export function legExtentLines(l) {
  const keys = Object.keys(l).filter((k) => k.startsWith("extent_") || k === "content_id");
  if (!keys.length) return [];
  const order = (k) => (k === "extent_kind" ? 0 : k === "content_id" ? 2 : 1);
  keys.sort((a, b) => order(a) - order(b) || (a < b ? -1 : a > b ? 1 : 0));
  const out = [];
  for (const k of keys) {
    const v = l[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "number") out.push(`    ${k}: ${v}`);
    else if (Array.isArray(v)) out.push(`    ${k}: [${v.join(", ")}]`);
    else out.push(`    ${k}: "${String(v)}"`);
  }
  return out;
}

/** R2 (REC-37): APPEND legs to the `basis` block, touching nothing else — `spliceReferences` line for line, the same
 *  three reachable shapes and the same refusal (null) of any other inline scalar. A key is rendered only if the leg
 *  carries it, which is the whole reason an undetermined leg is honest in the bytes: absent grade, axis and source is
 *  what the leg grammar reads as undetermined-and-stated (R8, DEC-18), while `grade: null` would be a member asserting
 *  a null; an empty note is omitted for the same reason. Nothing here rewrites or removes a leg already carried. */
/**
 * @param {string} text
 * @param {Object<string, *>[]} legs each `{target, role, target_edition?, grade?, grade_axis?, grade_source?, note?, ground?}` and its part's fields
 * @returns {string|null}
 */
export function spliceBasis(text, legs) {
  if (!legs.length) return text;
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;

  const block = legs.map((l) => [
    `  - target: ${l.target}`,
    `    role: ${l.role}`,
    /* R16: a leg on another team's finding names the one edition it rests on, and no grade of its own */
    ...(Number.isInteger(l.target_edition) ? [`    target_edition: ${l.target_edition}`] : []),
    ...(l.grade ? [`    grade: ${l.grade}`] : []),
    ...(l.grade_axis ? [`    grade_axis: ${l.grade_axis}`] : []),
    ...(l.grade_source ? [`    grade_source: ${l.grade_source}`] : []),
    ...(l.note ? [`    note: "${l.note}"`] : []),
    ...(typeof l.ground === "string" && l.ground ? [`    ground: ${l.ground}`] : []),
    ...legExtentLines(l),
  ].join("\n"));

  let bi = -1;
  for (let i = 1; i < end; i++) if (/^basis:/.test(lines[i])) { bi = i; break; }

  if (bi === -1)   // no key at all: open one immediately before the closing fence
    return [...lines.slice(0, end), "basis:", ...block, ...lines.slice(end)].join("\n");

  const rest = lines[bi].slice("basis:".length).trim();
  if (rest === "[]")   // an empty inline array becomes a block
    return [...lines.slice(0, bi), "basis:", ...block, ...lines.slice(bi + 1)].join("\n");
  if (rest !== "") return null;   // some other inline scalar: not ours to reinterpret

  let last = bi;
  for (let i = bi + 1; i < end; i++) {
    if (lines[i].trim() === "") continue;
    if (/^\s/.test(lines[i])) { last = i; continue; }
    break;
  }
  return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
}

/** R17: REMOVE the legs on `target` from the `basis` block, touching nothing else: the entries are found as
 *  `spliceEdgeStatus` finds a reference's, by the `target:` line, and dropped whole; a block left empty becomes
 *  `basis: []`. Answers `{text, editions}` (the `target_edition` of each leg removed, in order, null for a leg naming
 *  none), or null when the block is not in a shape this grammar can edit in place or holds no leg on `target`. */
/**
 * @param {string} text
 * @param {string} target
 * @returns {{text: string, editions: (number|null)[]}|null}
 */
export function removeBasisLegs(text, target) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  let bi = -1;
  for (let i = 1; i < end; i++) if (/^basis:/.test(lines[i])) { bi = i; break; }
  if (bi === -1 || lines[bi].slice("basis:".length).trim() !== "") return null;
  let last = bi;
  for (let i = bi + 1; i < end; i++) {
    if (lines[i].trim() === "") continue;
    if (/^\s/.test(lines[i])) { last = i; continue; }
    break;
  }
  const starts = [];
  for (let i = bi + 1; i <= last; i++) if (/^ {2}- /.test(lines[i])) starts.push(i);
  const gone = new Set(), editions = [];
  starts.forEach((from, s) => {
    const to = (s + 1 < starts.length ? starts[s + 1] : last + 1) - 1;
    let found = null, edition = null;
    for (let i = from; i <= to; i++) {
      const t = /^\s*(?:- )?target:\s*(.+?)\s*$/.exec(lines[i]);
      if (t && found === null) found = t[1].replace(/^["']|["']$/g, "");
      const e = /^\s*(?:- )?target_edition:\s*(\d+)\s*$/.exec(lines[i]);
      if (e) edition = Number(e[1]);
    }
    if (found === target) { for (let i = from; i <= to; i++) gone.add(i); editions.push(edition); }
  });
  if (!gone.size) return null;
  if (gone.size >= starts.length && starts.every((f, s) => gone.has(f))) {
    return { text: [...lines.slice(0, bi), "basis: []", ...lines.slice(last + 1)].join("\n"), editions };
  }
  return { text: lines.filter((_, i) => !gone.has(i)).join("\n"), editions };
}

/** R24: set the capture-axis grade of the `n`th leg of the `basis` block (its order in the block), touching nothing else
 *  of that leg or the document: any `grade`, `grade_axis` and `grade_source` lines it held are dropped and the three
 *  written after its `role:` line, as `spliceBasis` orders them. `target` is the target the caller read the leg by, checked
 *  against the entry so a document that moved under the caller is not written. Answers the new text, or null when the block
 *  is not in a shape this grammar can edit in place, holds no `n`th entry, or that entry is not on `target`. */
/**
 * @param {string} text
 * @param {number} n the leg's order in the block, from 0
 * @param {string} target
 * @param {*} grade the letter, written with axis and source `capture`
 * @returns {string|null}
 */
export function setLegGrade(text, n, target, grade) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  let bi = -1;
  for (let i = 1; i < end; i++) if (/^basis:/.test(lines[i])) { bi = i; break; }
  if (bi === -1 || lines[bi].slice("basis:".length).trim() !== "") return null;
  let last = bi;
  for (let i = bi + 1; i < end; i++) {
    if (lines[i].trim() === "") continue;
    if (/^\s/.test(lines[i])) { last = i; continue; }
    break;
  }
  const starts = [];
  for (let i = bi + 1; i <= last; i++) if (/^ {2}- /.test(lines[i])) starts.push(i);
  if (!Number.isInteger(n) || n < 0 || n >= starts.length) return null;
  const from = starts[n], to = (n + 1 < starts.length ? starts[n + 1] : last + 1) - 1;
  let found = null, roleAt = -1, targetAt = -1;
  const entry = [];
  for (let i = from; i <= to; i++) {
    const t = /^\s*(?:- )?target:\s*(.+?)\s*$/.exec(lines[i]);
    if (t && found === null) { found = t[1].replace(/^["']|["']$/g, ""); targetAt = entry.length; }
    if (/^\s*(?:- )?(grade|grade_axis|grade_source):/.test(lines[i])) continue;
    if (/^\s*(?:- )?role:/.test(lines[i]) && roleAt === -1) roleAt = entry.length;
    entry.push(lines[i]);
  }
  if (found !== target) return null;
  const at = roleAt === -1 ? targetAt : roleAt;
  entry.splice(at + 1, 0, `    grade: ${grade}`, "    grade_axis: capture", "    grade_source: capture");
  return [...lines.slice(0, from), ...entry, ...lines.slice(to + 1)].join("\n");
}

/** R25 (K5407): set the own `status` of the `n`th legs of the `basis` block (`changes`: order in the block → {target, status?, role?}; a `status` of `severed` is written as `status: "severed"` and any other drops the line (absent is live, K5407), and a `role` rewrites that leg's role line, and no other leg's),
 *  touching nothing else of any leg or the document: a `status` line a leg held is dropped and the new one written after
 *  its `role:` line. `target` is checked against the entry, as `setLegGrade` checks it, so a document that moved under the
 *  caller is not written. Answers the new text, or null when the block is not in a shape this grammar can edit in place,
 *  holds no such entry, or an entry is not on its target. */
/**
 * @param {string} text
 * @param {Map<number, {target: string, status?: string, role?: string}>} changes
 * @returns {string|null}
 */
export function setLegStatus(text, changes) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  let bi = -1;
  for (let i = 1; i < end; i++) if (/^basis:/.test(lines[i])) { bi = i; break; }
  if (bi === -1 || lines[bi].slice("basis:".length).trim() !== "") return null;
  let last = bi;
  for (let i = bi + 1; i < end; i++) {
    if (lines[i].trim() === "") continue;
    if (/^\s/.test(lines[i])) { last = i; continue; }
    break;
  }
  const starts = [];
  for (let i = bi + 1; i <= last; i++) if (/^ {2}- /.test(lines[i])) starts.push(i);
  const out = [];
  out.push(...lines.slice(0, bi + 1));
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s], to = (s + 1 < starts.length ? starts[s + 1] : last + 1) - 1;
    const entry = lines.slice(from, to + 1);
    const ch = changes.get(s);
    if (!ch) { out.push(...entry); continue; }
    let found = null, roleAt = -1, targetAt = -1;
    const kept = [];
    for (const ln of entry) {
      const t = /^\s*(?:- )?target:\s*(.+?)\s*$/.exec(ln);
      if (t && found === null) { found = t[1].replace(/^["']|["']$/g, ""); targetAt = kept.length; }
      if (ch.status && /^\s*(?:- )?status:/.test(ln)) continue;
      if (/^\s*(?:- )?role:/.test(ln) && roleAt === -1) {
        roleAt = kept.length;
        if (ch.role) { kept.push(ln.replace(/role:.*$/, `role: ${ch.role}`)); continue; }
      }
      kept.push(ln);
    }
    if (found !== ch.target) return null;
    if (ch.status === "severed") kept.splice((roleAt === -1 ? targetAt : roleAt) + 1, 0, `    status: "severed"`);
    out.push(...kept);
  }
  for (const n of changes.keys()) if (!Number.isInteger(n) || n < 0 || n >= starts.length) return null;
  out.push(...lines.slice(last + 1));
  return out.join("\n");
}

/** R23: set the `role` of every leg in the `basis` block whose `target` is in `targets`, touching nothing else of the leg
 *  or the document. Answers `{text, from}`, `from` mapping each target to the roles its legs held before (in order), or null
 *  when the block is not in a shape this grammar can edit in place, or a named target's leg has no `role:` line to
 *  rewrite. A leg already on `role` is rewritten to itself (the bytes are the same). */
/**
 * @param {string} text
 * @param {Set<string>} targets
 * @param {string} role
 * @returns {{text: string, from: Map<string, string[]>}|null}
 */
export function setBasisRole(text, targets, role) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  let bi = -1;
  for (let i = 1; i < end; i++) if (/^basis:/.test(lines[i])) { bi = i; break; }
  if (bi === -1 || lines[bi].slice("basis:".length).trim() !== "") return null;
  let last = bi;
  for (let i = bi + 1; i < end; i++) {
    if (lines[i].trim() === "") continue;
    if (/^\s/.test(lines[i])) { last = i; continue; }
    break;
  }
  const starts = [];
  for (let i = bi + 1; i <= last; i++) if (/^ {2}- /.test(lines[i])) starts.push(i);
  const out = lines.slice(), from = new Map();
  for (let s = 0; s < starts.length; s++) {
    const a = starts[s], b = (s + 1 < starts.length ? starts[s + 1] : last + 1) - 1;
    let target = null, at = -1, was = null;
    for (let i = a; i <= b; i++) {
      const t = /^\s*(?:- )?target:\s*(.+?)\s*$/.exec(lines[i]);
      if (t && target === null) target = t[1].replace(/^["']|["']$/g, "");
      const r = /^(\s*(?:- )?)role:\s*(.+?)\s*$/.exec(lines[i]);
      if (r && at === -1) { at = i; was = r[2]; }
    }
    if (target === null || !targets.has(target)) continue;
    if (at === -1) return null;
    out[at] = lines[at].replace(/role:.*$/, `role: ${role}`);
    if (!from.has(target)) from.set(target, []);
    from.get(target).push(was);
  }
  return from.size === targets.size ? { text: out.join("\n"), from } : null;
}

/** Set a top-level frontmatter scalar that is already there (copied from the retired legacy store, K57); the text unchanged when the
 *  key is absent. Used for `last_updated`, which every citing document carries. */
/**
 * @param {string} text
 * @param {string} key
 * @param {*} value
 * @returns {string}
 */
export function setScalar(text, key, value) {
  const lines = text.split("\n");
  const end = lines.indexOf("---", 1);
  for (let i = 1; i < (end === -1 ? lines.length : end); i++) {
    if (lines[i].startsWith(key + ":")) { lines[i] = `${key}: ${value}`; return lines.join("\n"); }
  }
  return text;
}

/** R3, R4: append one Session Log entry at the end of the `## Session Log` section (opening the section when the
 *  document has none), as both acts wrote it inline in the retired legacy store (a copy, K57). */
/**
 * @param {string} text
 * @param {string} entry
 * @returns {string}
 */
export function appendSessionLog(text, entry) {
  const at = text.indexOf("## Session Log");
  if (at < 0) return localize("citation.splice.text_session_log_entry", "{text}\n## Session Log\n\n{entry}", { text: String(text), entry: String(entry) });
  const nxt = text.indexOf("\n## ", at + 1);
  const cut = nxt === -1 ? text.length : nxt + 1;
  return text.slice(0, cut) + entry + "\n" + text.slice(cut);
}
