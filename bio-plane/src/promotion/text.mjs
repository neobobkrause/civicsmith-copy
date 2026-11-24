/* Small, line-oriented edits of a document's front matter, used by `reopen`, `forkProject` and a creation's producing
 * group (R13). The repository has a front-matter PARSER (record-grammar's, the catalogue's until T18) and no serializer, so a field is rewritten in
 * place and every other byte is left alone. `withProducingGroup` moved here whole from the catalogue in T18 (K636). */

import { parseFrontmatter } from "../record-grammar/index.mjs";
import { localize } from "../setup-words/index.mjs";

/** Append one entry to `state_history`, for the inline-empty, absent and populated shapes. Null when the block is in
 *  a shape this grammar cannot extend, so the caller refuses rather than guesses. */
export function appendStateHistory(text, e) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  const block = [`  - timestamp: "${e.timestamp}"`,
                 `    from_state: ${e.from_state}`,
                 `    to_state: ${e.to_state}`,
                 `    blurb: "${e.blurb}"`,
                 `    author: ${e.author}`];
  let at = -1;
  for (let i = 1; i < end; i++) if (/^state_history:/.test(lines[i])) { at = i; break; }
  if (at === -1) return [...lines.slice(0, end), "state_history:", ...block, ...lines.slice(end)].join("\n");
  const rest = lines[at].slice("state_history:".length).trim();
  if (rest === "[]") return [...lines.slice(0, at), "state_history:", ...block, ...lines.slice(at + 1)].join("\n");
  if (rest !== "") return null;
  let last = at;
  for (let i = at + 1; i < end; i++) {
    if (/^\s/.test(lines[i]) && lines[i].trim() !== "") last = i;
    else break;
  }
  return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
}

/** Rewrite one column-0 scalar of the front matter; a key the document does not carry is left absent. */
export function setScalar(text, key, value) {
  const lines = text.split("\n");
  const end = lines.indexOf("---", 1);
  for (let i = 1; i < (end === -1 ? lines.length : end); i++) {
    if (lines[i].startsWith(key + ":")) { lines[i] = `${key}: ${value}`; return lines.join("\n"); }
  }
  return text;
}

/** A text as a scalar the grammar reads back as itself (R44's fork title). The grammar has no escapes: a value wrapped
 *  in two of one quote character is the text between them, so the wrapper is a quote the text does not hold, never a
 *  JSON string, whose `\"` and `\\` the grammar would keep as written. A text holding both quotes is wrapped in `"`,
 *  and the promotion it goes into judges what the grammar reads. */
export function quotedScalar(text) {
  const s = String(text);
  return !s.includes('"') ? `"${s}"` : !s.includes("'") ? `'${s}'` : `"${s}"`;
}

/** Add a Session Log entry after the `## Session Log` heading's section, opening the section when absent. */
export function appendSessionLog(text, entry) {
  const at = text.indexOf("## Session Log");
  if (at < 0) return localize("promotion.text.text_session_log_entry", "{text}\n## Session Log\n\n{entry}", { text: String(text), entry: String(entry) });
  const nxt = text.indexOf("\n## ", at + 1);
  const cutAt = nxt === -1 ? text.length : nxt + 1;
  return text.slice(0, cutAt) + entry + "\n" + text.slice(cutAt);
}

/** Set a column-0 scalar, opening it immediately before the closing fence when the document does not carry it. */
export function setOrAddScalar(text, key, value) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return text;
  const end = lines.indexOf("---", 1);
  if (end === -1) return text;
  for (let i = 1; i < end; i++)
    if (lines[i].startsWith(key + ":")) { lines[i] = `${key}: ${value}`; return lines.join("\n"); }
  return [...lines.slice(0, end), `${key}: ${value}`, ...lines.slice(end)].join("\n");
}

/** Append reference entries to `references`, for the absent, inline-empty and block shapes; null for any other. */
export function spliceReferences(text, additions) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  const block = additions.map((a) =>
    localize("promotion.text.rel_rel_target_target_status", "  - rel: {rel}\n    target: {target}\n    status: {status}\n    note: \"{v1}\"", { rel: String(a.rel), target: String(a.target), status: String(a.status), v1: String(a.note ?? "") }));
  let ref = -1;
  for (let i = 1; i < end; i++) if (/^references:/.test(lines[i])) { ref = i; break; }
  if (ref === -1) return [...lines.slice(0, end), "references:", ...block, ...lines.slice(end)].join("\n");
  const rest = lines[ref].slice("references:".length).trim();
  if (rest === "[]") return [...lines.slice(0, ref), "references:", ...block, ...lines.slice(ref + 1)].join("\n");
  if (rest !== "") return null;
  let last = ref;
  for (let i = ref + 1; i < end; i++) {
    if (lines[i].trim() === "") continue;
    if (/^\s/.test(lines[i])) { last = i; continue; }
    break;
  }
  return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
}

/** D-436 — THE ONE DEFINITION of how a producing group is written into a document's bytes. `stampGroup` (`index.mjs`,
 *  R13) calls it for every creation at the one write path, and a suite that judges a composer's bytes AS THE PLANE WILL HOLD THEM calls
 *  the same function — so neither is a copy of the other, and a change to how the group is written moves both.
 *  Replaces the top-level `group:` line (column 0, inside the front matter), or opens one immediately before the closing
 *  fence, the convention every key the plane adds follows. Returns the text UNCHANGED when there is no front matter block
 *  to write into, and when the document already names `slug` in any spelling the catalogue's parser reads as it — so a
 *  correct document is never rewritten. */
export function withProducingGroup(text, slug) {
  if (typeof text !== 'string' || typeof slug !== 'string' || !slug) return text;
  if (parseFrontmatter(text).data?.group === slug) return text;
  const lines = text.split('\n');
  if (lines[0] !== '---') return text;
  const end = lines.indexOf('---', 1);
  if (end === -1) return text;
  for (let i = 1; i < end; i++)
    if (lines[i].startsWith('group:')) { lines[i] = `group: ${slug}`; return lines.join('\n'); }
  return [...lines.slice(0, end), `group: ${slug}`, ...lines.slice(end)].join('\n');
}
