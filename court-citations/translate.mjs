/* court-citations: Python regular expressions (the `re` module, str patterns) translated to equivalent JavaScript
 * ones, for the build (R4). Python's Unicode classes are spelled out so they mean what they meant in Python:
 * `\d` is any decimal digit, `\w` any letter, number or underscore, `\s` Python's own white-space set, `.` anything but
 * a newline, and `$` the end or just before a final newline. A construct with no JavaScript equivalent throws
 * `Untranslatable`, which the build lists (R5); nothing is approximated silently. */

import { localize } from "../bio-plane/src/setup-words/index.mjs"

export class Untranslatable extends Error {}

const WORD = "\\p{L}\\p{N}_";
const SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const DIGIT = "\\p{Nd}";
const ASCII_DIGIT = "0-9", ASCII_WORD = "a-zA-Z0-9_", ASCII_SPACE = "\\t\\n\\v\\f\\r ";
const SYNTAX = new Set("^$\\.*+?()[]{}|/");
/** The simple escapes, `\n` `\t` `\r` `\f` `\v` `\a`, as JavaScript source; undefined for any other character.
 * @param {string} c
 * @returns {string | undefined}
 */
function simple(c) {
  switch (c) {
    case "n": return "\\n";
    case "t": return "\\t";
    case "r": return "\\r";
    case "f": return "\\f";
    case "v": return "\\v";
    case "a": return "\\x07";
    default: return undefined;
  }
}

/** @typedef {{source: string, flags: string}} Translated a JavaScript pattern and its flags */
/* translate(source, {ignoreCase}) → {source, flags}: the JavaScript pattern and flags (always `u`). */
/**
 * @param {unknown} source a Python pattern
 * @param {{ignoreCase?: boolean}} [options]
 * @returns {Translated}
 * @throws {Untranslatable} when a construct has no JavaScript equivalent
 */
export function translate(source, { ignoreCase = false } = {}) {
  if (typeof source !== "string") throw new Untranslatable("not a string");
  const src = source;
  const fl = { i: ignoreCase, m: false, s: false, a: false };
  let i = 0;
  // Global inline flags, at the very start only (Python 3.11 refuses them anywhere else).
  while (src.startsWith("(?", i)) {
    const m = /^\(\?([aiLmsux]+)\)/.exec(src.slice(i));
    if (!m) break;
    for (const f of m[1] ?? "") {
      if (f === "i") fl.i = true; else if (f === "m") fl.m = true; else if (f === "s") fl.s = true;
      else if (f === "a") fl.a = true; else if (f === "u") { /* the default for str patterns */ }
      else throw new Untranslatable(`inline flag (?${f})`);
    }
    i += m[0].length;
  }
  /** @param {string} k one of `d`, `w`, `s` */
  const cls = (k) => (fl.a ? (k === "d" ? ASCII_DIGIT : k === "w" ? ASCII_WORD : ASCII_SPACE) : k === "d" ? DIGIT : k === "w" ? WORD : SPACE);
  const word = `[${cls("w")}]`;
  /** @type {string[]} */
  const names = [];
  let groups = 0, out = "";

  // One escape at src[j] === "\\"; returns [text, next index]. inClass: inside [...].
  /**
   * @param {number} j
   * @param {boolean} inClass
   * @returns {[string, number]}
   */
  function escape(j, inClass) {
    const c = src[j + 1];
    if (c === undefined) throw new Untranslatable("trailing backslash");
    if ("dws".includes(c)) return [inClass ? cls(c) : `[${cls(c)}]`, j + 2];
    if ("DWS".includes(c)) {
      if (inClass) throw new Untranslatable(`\\${c} inside a character class`);
      return [`[^${cls(c.toLowerCase())}]`, j + 2];
    }
    if (c === "b") return [inClass ? "\\x08" : `(?:(?<=${word})(?!${word})|(?<!${word})(?=${word}))`, j + 2];
    if (c === "B" && !inClass) return [`(?:(?<=${word})(?=${word})|(?<!${word})(?!${word}))`, j + 2];
    if (c === "A" && !inClass) return ["(?<![\\s\\S])", j + 2];
    if (c === "Z" && !inClass) return ["(?![\\s\\S])", j + 2];
    const s = simple(c);
    if (s) return [s, j + 2];
    if (c === "x") { const h = /^[0-9a-fA-F]{2}/.exec(src.slice(j + 2)); if (!h) throw new Untranslatable("bad \\x"); return [`\\x${h[0]}`, j + 4]; }
    if (c === "u") { const h = /^[0-9a-fA-F]{4}/.exec(src.slice(j + 2)); if (!h) throw new Untranslatable("bad \\u"); return [`\\u${h[0]}`, j + 6]; }
    if (c === "U") { const h = /^[0-9a-fA-F]{8}/.exec(src.slice(j + 2)); if (!h) throw new Untranslatable("bad \\U"); return [`\\u{${h[0].replace(/^0+(?=.)/, "")}}`, j + 10]; }
    if (/[0-7]/.test(c) && (c === "0" || inClass || /^[0-7]{3}/.test(src.slice(j + 1)))) {
      const o = /^[0-7]{1,3}/.exec(src.slice(j + 1))?.[0] ?? c;
      return [`\\u{${parseInt(o, 8).toString(16)}}`, j + 1 + o.length];
    }
    if (/[1-9]/.test(c)) {
      const n = /^[0-9]{1,2}/.exec(src.slice(j + 1))?.[0] ?? c;
      if (Number(n) > groups) throw new Untranslatable(`back-reference \\${n} before its group`);
      return [`(?:\\${n})`, j + 1 + n.length];
    }
    if (/[A-Za-z0-9]/.test(c)) throw new Untranslatable(`escape \\${c}`);
    const lit = src.codePointAt(j + 1) ?? 0, ch = String.fromCodePoint(lit);
    return [literal(ch, inClass), j + 1 + ch.length];
  }
  /** @type {(ch: string, inClass: boolean) => string} */
  const literal = (ch, inClass) => (SYNTAX.has(ch) || (inClass && ch === "-") ? `\\${ch}` : ch);

  /**
   * @param {number} j
   * @returns {[string, number]}
   */
  function charClass(j) { // src[j] === "["
    let k = j + 1, t = "[";
    if (src[k] === "^") { t += "^"; k++; }
    if (src[k] === "]") { t += "\\]"; k++; }
    for (;;) {
      if (k >= src.length) throw new Untranslatable("unterminated character class");
      const c = src[k];
      if (c === "]") return [t + "]", k + 1];
      if (c === "\\") { const [e, n] = escape(k, true); t += e; k = n; continue; }
      if (c === "[" && /^\[[:=.]/.test(src.slice(k))) throw new Untranslatable("POSIX class");
      if (c === "-" && src[k + 1] !== "]" && t !== "[" && t !== "[^") { t += "-"; k++; continue; }
      const ch = String.fromCodePoint(src.codePointAt(k) ?? 0);
      t += c === "-" ? "\\-" : "[]".includes(ch) ? `\\${ch}` : ch;
      k += ch.length;
    }
  }

  const quant = /^\{(\d*)(?:(,)(\d*))?\}/;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { const [e, n] = escape(i, false); out += e; i = n; }
    else if (c === "[") { const [t, n] = charClass(i); out += t; i = n; }
    else if (c === "(") {
      const rest = src.slice(i);
      const named = /^\(\?P<([A-Za-z_][A-Za-z0-9_]*)>/.exec(rest), ref = /^\(\?P=([A-Za-z_][A-Za-z0-9_]*)\)/.exec(rest);
      const plain = /^\(\?(?::|=|!|<=|<!)/.exec(rest), comment = /^\(\?#[^)]*\)/.exec(rest), scoped = /^\(\?([ims]*)(?:-([ims]*))?:/.exec(rest);
      if (named) { const name = named[1] ?? ""; groups++; names.push(name); out += `(?<${name}>`; i += named[0].length; }
      else if (ref) {
        if (!names.includes(ref[1] ?? "")) throw new Untranslatable(localize("court-citations.translate.back_reference_to_v1_before", "back-reference to {v1} before its group", { v1: String(ref[1]) }));
        out += `\\k<${ref[1]}>`; i += ref[0].length;
      }
      else if (plain) { out += plain[0]; i += plain[0].length; }
      else if (comment) { i += comment[0].length; }
      else if (scoped && (scoped[1] || scoped[2])) {
        if (((scoped[1] ?? "") + (scoped[2] || "")).includes("s") || ((scoped[1] ?? "") + (scoped[2] || "")).includes("m")) throw new Untranslatable("scoped (?s) or (?m)");
        out += scoped[0]; i += scoped[0].length;
      }
      else if (rest.startsWith("(?")) throw new Untranslatable(`group ${rest.slice(0, 4)}`);
      else { groups++; out += "("; i++; }
    }
    else if (c === "{") {
      const m = quant.exec(src.slice(i));
      if (m && (m[1] !== "" || m[2])) {
        out += `{${m[1] || "0"}${m[2] ? "," + m[3] : ""}}`; i += m[0].length;
        if (src[i] === "+") throw new Untranslatable("possessive quantifier");
      } else { out += "\\{"; i++; }
    }
    else if ((c === "*" || c === "+" || c === "?") && src[i + 1] === "+") throw new Untranslatable("possessive quantifier");
    else if (c === "}" || c === "]" || c === "/") { out += `\\${c}`; i++; }
    else if (c === ".") { out += fl.s ? "[\\s\\S]" : "[^\\n]"; i++; }
    else if (c === "$") { out += fl.m ? "(?=\\n|(?![\\s\\S]))" : "(?=\\n?(?![\\s\\S]))"; i++; }
    else if (c === "^") { out += fl.m ? "(?<=\\n|^)" : "(?<![\\s\\S])"; i++; }
    else { const ch = String.fromCodePoint(src.codePointAt(i) ?? 0); out += ch; i += ch.length; }
  }
  const flags = "u" + (fl.i ? "i" : "");
  try { new RegExp(out, flags); } catch (e) {
    if (e instanceof SyntaxError) throw new Untranslatable(localize("court-citations.translate.does_not_compile_in_javascript", "does not compile in JavaScript: {message}", { message: String(e.message) }));
    throw e;
  }
  return { source: out, flags };
}

/* Python's re.escape for an edition string, as JavaScript source. */
/** @type {(s: string) => string} */
export const escapeLiteral = (s) => [...s].map((ch) => (SYNTAX.has(ch) ? `\\${ch}` : ch)).join("");
