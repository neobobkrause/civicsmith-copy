/* contradiction — the document splices its acts write with (R35, R36). K57: each module that splices keeps its own
 * copy. The repository has a frontmatter parser and no serializer, so every edit is line-oriented and touches only the
 * lines it owns; a splice that meets a shape it cannot address answers the text unchanged, and the act that needed it
 * refuses rather than guesses. */

/** Frontmatter-safe for a derived or member's string: the restricted grammar has no escapes, so a line break folds to
 *  a space and a quote or backslash becomes an apostrophe. */
export function fmSafe(s) {
  return String(s ?? "").replace(/[\r\n]+/g, " ").replace(/["\\]/g, "'").trim();
}

/** Remove a frontmatter BLOCK (its key line and its indented lines); the text unchanged when absent. */
export function removeBlock(text, key) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return text;
  const end = lines.indexOf("---", 1);
  if (end === -1) return text;
  let at = -1;
  for (let i = 1; i < end; i++) if (lines[i] === `${key}:` || lines[i].startsWith(`${key}: `)) { at = i; break; }
  if (at === -1) return text;
  let last = at;
  for (let i = at + 1; i < end; i++) {
    if (/^\s/.test(lines[i]) && lines[i].trim() !== "") last = i; else break;
  }
  return [...lines.slice(0, at), ...lines.slice(last + 1)].join("\n");
}

/** Write frontmatter lines whole in place of any block the key already holds, just before the closing fence. `lines`
 *  begin with the key's own line. The text unchanged when it has no frontmatter. */
export function setFrontmatterLines(text, key, lines) {
  const t = removeBlock(text, key);
  const all = t.split("\n");
  if (all[0] !== "---") return t;
  const end = all.indexOf("---", 1);
  if (end === -1) return t;
  return [...all.slice(0, end), ...lines, ...all.slice(end)].join("\n");
}

/** Append one entry under `## Session Log`, opening the section when absent (C-13.2: a moved `last_updated` has an
 *  account). */
export function appendSessionLog(text, entry) {
  const at = text.indexOf("## Session Log");
  if (at < 0) return text.replace(/\s*$/, "\n") + "\n## Session Log\n\n" + entry + "\n";
  const nxt = text.indexOf("\n## ", at + 1);
  const cut = nxt === -1 ? text.length : nxt + 1;
  const head = text.slice(0, cut);
  return head + (head.endsWith("\n") ? "" : "\n") + entry + "\n" + text.slice(cut);
}

/** Rewrite one column-0 scalar inside the frontmatter, or open it before the closing fence. */
export function setOrAddScalar(text, key, value) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return text;
  const end = lines.indexOf("---", 1);
  if (end === -1) return text;
  for (let i = 1; i < end; i++)
    if (lines[i].startsWith(key + ":")) { lines[i] = `${key}: ${value}`; return lines.join("\n"); }
  return [...lines.slice(0, end), `${key}: ${value}`, ...lines.slice(end)].join("\n");
}

/** A snap-key suffix. */
export function rand(n = 4) {
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
