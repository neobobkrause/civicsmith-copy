/* words-reads.src.mjs — DEC-258 (K3366): each L11 module's list of the keys it reads, written to words-reads.json.
 *
 * K3366: words.json is generated into the plane at build, `setup-words` exports `word(key, vars)`, a module holds keys
 * only (never English) and its tests assert each key exists. T49's L11 is held until (a) every member-facing sentence of
 * its 20 modules is a key in words.json and (b) each module's keys are listed. This writes (b) and checks (a).
 *
 * Run, from this folder, on T49's source:
 *     git archive origin/tranche/T49 bio-plane/src | tar -x -C <dir>
 *     node words-reads.src.mjs <dir>          (or <dir>/bio-plane/src)
 * On the tranche it is a `generated` row (process/config.json), built from the repository root, never committed
 * (2.6 MB, over max_file_bytes): node docs/development/ux-substrate/screens/words-reads.src.mjs . --build
 * after words.json is built (node build_words.mjs). It writes words-reads.json and exits 1, naming each, if any listed key
 * is not in words.json, any inline string is left untriaged, or any decision below no longer finds its string.
 *
 * A module's reads are: the keys of its keyed rows (its words.mjs: SCREEN_WORDS, SHELL_WORDS); every string literal in its
 * source that is a key (what it passes to w(), cs.w(), say(), a label: or a refuse:); and the key each of its inline
 * member-facing strings is keyed to — the word whose English it is (matched), or the key DECISIONS give it (minted under
 * DEC-258 in words-t49.src.py, or the design's own word where the design already says it: the design's key governs).
 * affordances also reads every act.<op>.does its ACT_HELP covers and DEC-253's vocabulary keys; setup-words reads "*".
 * An inline string that no member reads (a builder's rationale, a provenance quote, test-harness text, a wire diagnostic)
 * is listed under `unkeyed` with why. Keyed rows the design retired (DEC-256) are listed under `retired`, and a key the
 * module names wrongly under `renamed`, neither read.
 *
 * The string extractor below is the inventory's (DEC-258's triage): a tokenizer that joins `+` chains and template
 * literals into one text (`${…}` for each expression), drops comments, imports, comparisons, throws and logging, and
 * keeps text that reads as English. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REQUIREMENT_READS_BY_MARK } from "./words-reads-requirements.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = process.argv.includes("--build"); // the gate's and deploy's build: write the file, report problems, exit 0
const ARG = process.argv.slice(2).find((a) => a !== "--build");
if (!ARG) { console.error("usage: node words-reads.src.mjs <T49 extract dir, or its bio-plane/src>"); process.exit(2); }
const SRC = fs.existsSync(path.join(ARG, "bio-plane", "src")) ? path.resolve(ARG, "bio-plane", "src") : path.resolve(ARG);
const WORDS = path.join(HERE, "words.json");
const MODULES = ["op-capabilities","op-grades","affordances","setup-words","op-declarations","admission","interface-assets","interface-shell","screens-action","screens-daily","screens-entry","screens-inquiry","screens-intake","screens-investigate","screens-publish","screens-settings","control-plane","plane","store-assembly","site","journey-check","screens-document-beta"];

// ---------- tokenizer ----------
const KW_BEFORE_REGEX = new Set(["return","typeof","case","do","else","in","of","new","delete","void","throw","yield","await","instanceof"]);
function tokenize(src, i0, stopAtBrace, lineRef) {
  const toks = []; let i = i0; let depth = 0;
  const prevSig = () => toks.length ? toks[toks.length - 1] : null;
  const isIdStart = (c) => /[A-Za-z_$À-￿]/.test(c);
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { lineRef.line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i+1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i+1] === "*") { const e = src.indexOf("*/", i+2); const end = e < 0 ? src.length : e + 2; for (let k = i; k < end; k++) if (src[k] === "\n") lineRef.line++; i = end; continue; }
    if (c === "#" && src[i+1] === "!" && i === 0) { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === '"' || c === "'") {
      const line = lineRef.line; let j = i + 1; let v = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") { const n = src[j+1]; const map = {n:"\n",t:"\t",r:"\r","0":"\0"}; if (n === "u") { if (src[j+2] === "{") { const e = src.indexOf("}", j); v += String.fromCodePoint(parseInt(src.slice(j+3, e),16)); j = e+1; continue; } v += String.fromCharCode(parseInt(src.slice(j+2,j+6),16)); j += 6; continue; } if (n === "\n") { lineRef.line++; j += 2; continue; } v += map[n] ?? n; j += 2; continue; }
        if (src[j] === "\n") break;
        v += src[j]; j++;
      }
      toks.push({ t: "str", v, line }); i = j + 1; continue;
    }
    if (c === "`") {
      const line = lineRef.line; let j = i + 1; const parts = []; let cur = ""; const subs = [];
      while (j < src.length && src[j] !== "`") {
        if (src[j] === "\\") { const n = src[j+1]; cur += n === "n" ? "\n" : n === "`" ? "`" : n === "$" ? "$" : n; if (n === "\n") lineRef.line++; j += 2; continue; }
        if (src[j] === "$" && src[j+1] === "{") {
          parts.push(cur); cur = "";
          const r = tokenize(src, j + 2, true, lineRef); subs.push(r.toks); parts.push({ expr: src.slice(j+2, r.end - 1) }); j = r.end; continue;
        }
        if (src[j] === "\n") lineRef.line++;
        cur += src[j]; j++;
      }
      parts.push(cur);
      toks.push({ t: "tpl", parts, subs, line }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i+1]))) { let j = i; while (j < src.length && /[0-9a-zA-Z_.]/.test(src[j])) j++; toks.push({ t: "num", v: src.slice(i,j), line: lineRef.line }); i = j; continue; }
    if (isIdStart(c)) { let j = i; while (j < src.length && /[A-Za-z0-9_$À-￿]/.test(src[j])) j++; toks.push({ t: "id", v: src.slice(i,j), line: lineRef.line }); i = j; continue; }
    if (c === "/") {
      const p = prevSig();
      const regexOk = !p || (p.t === "punct" && !/^[)\]}]$/.test(p.v)) || (p.t === "id" && KW_BEFORE_REGEX.has(p.v));
      if (regexOk) { let j = i + 1, cls = false; while (j < src.length) { const d = src[j]; if (d === "\\") { j += 2; continue; } if (d === "[") cls = true; else if (d === "]") cls = false; else if (d === "/" && !cls) break; else if (d === "\n") break; j++; } j++; while (/[a-z]/.test(src[j] || "")) j++; toks.push({ t: "regex", v: src.slice(i,j), line: lineRef.line }); i = j; continue; }
    }
    // punctuators
    const three = src.slice(i, i+4);
    let p = ["===","!==","**=","...","&&=","||=","??=",">>>"].find((x) => three.startsWith(x)) || ["=>","==","!=","<=",">=","&&","||","??","?.","++","--","+=","-=","*=","/=","<<",">>"].find((x) => three.startsWith(x)) || c;
    if (stopAtBrace) { if (p === "{") depth++; if (p === "}") { if (depth === 0) return { toks, end: i + 1 }; depth--; } }
    toks.push({ t: "punct", v: p, line: lineRef.line }); i += p.length;
  }
  return { toks, end: i };
}

// ---------- heuristics ----------
const ENT = { "&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&#39;":"'","&apos;":"'","&nbsp;":" ","&rsquo;":"’","&lsquo;":"‘","&ldquo;":"“","&rdquo;":"”","&mdash;":"—","&ndash;":"–","&middot;":"·","&hellip;":"…","&rarr;":"→","&larr;":"←","&times;":"×" };
const decode = (s) => s.replace(/&[a-z]+;|&#\d+;/g, (m) => ENT[m] ?? (m.startsWith("&#") ? String.fromCharCode(+m.slice(2,-1)) : m));
const PH = "\u0001";
const MODPREFIX = new RegExp("^(" + fs.readdirSync(SRC).map((d) => d.replace(/\.mjs$/, "")).join("|") + ")( \\([^)]*\\))?: ");
const NAT = /^[(\"“'‘«]*[A-Za-z][a-z'’]*(-[A-Za-z]+)*[)\"”'’».,;:!?…]*$/;
function englishReason(text) {
  const t = text.replace(new RegExp(PH + "\\d+" + PH, "g"), " X ").trim();
  if (!/[A-Za-z]/.test(t)) return "nonalpha";
  const toks = t.split(/\s+/).filter(Boolean);
  const nat = toks.filter((w) => NAT.test(w) && w !== "X").length;
  const ok = nat >= 3 || (/^[A-Z][a-z]/.test(t) && /\s/.test(t) && nat >= 1);
  if (!ok) return "short";
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|PRAGMA|BEGIN|COMMIT|REPLACE)\b/.test(t) || /\b(FROM|WHERE|VALUES|INTO|ORDER BY|JOIN|NOT NULL|PRIMARY KEY)\b/.test(t)) return "sql";
  if (/\{[^}]*[a-z-]+\s*:[^}]*\}/.test(t) || /;/.test(t) && t.split(";").filter((x) => x.trim()).every((x) => /^\s*[a-z-]+\s*:\s*[^;]{1,60}$/.test(x) && x.length < 70)) return "css";
  if (/^[.#@][a-z][\w-]*([\s,>{:.]|$)/.test(t)) return "css";
  if (/^(GET|POST|PUT|HEAD|PATCH|DELETE|OPTIONS)\s/.test(t)) return "http";
  if (/=>|\bfunction\s*\(|\b(const|let|var)\s+\w+\s*=|\breturn\b.*;|\bdocument\.[a-zA-Z]|\bwindow\.[a-zA-Z]/.test(t)) return "code";
  if (toks.some((w) => /^(cs|mk|is|has|js|data|aria)-/.test(w)) && !/[A-Z]/.test(t) && !/[.,;:!?]/.test(t)) return "class";
  if (/\b(R\d+[a-z]?|DEC-\d+|K\d{3,}|N\d{3,}|D\d{2,}|REC-\d+|NOTICE)\b/.test(t)) return "devref";
  if (/^[\w.\/-]+\.(mjs|js|json|css|html|svg|woff2?)$/.test(t)) return "path";
  const denom = toks.filter((w) => w !== "X" && /[A-Za-z0-9]/.test(w) && !/^\{[^}]+\}[^A-Za-z]*$/.test(w)).length || 1;
  if (nat / denom < 0.4) return "lowratio";
  if (MODPREFIX.test(t)) return "devprefix";
  return null;
}
// extract candidate texts from a (merged) text; returns [{text}] with PH sentinels
function candidates(text) {
  if (!/<\/?[a-zA-Z][^<>]*>|<[a-zA-Z][\w-]*[\s>]|^[^<]*>|<\/[a-z]/.test(text)) return [text];
  let s = text;
  const out = [];
  // attributes
  for (const m of s.matchAll(/\b(aria-label|title|placeholder|alt|label|aria-description)\s*=\s*"([^"]*)"/g)) out.push(m[2]);
  for (const m of s.matchAll(/\b(aria-label|title|placeholder|alt|label|aria-description)\s*=\s*'([^']*)'/g)) out.push(m[2]);
  // drop leading partial tag
  const fgt = s.indexOf(">"), flt = s.indexOf("<");
  if (fgt >= 0 && (flt < 0 || fgt < flt)) { const pre = s.slice(0, fgt); if (/[="]/.test(pre) || /^\s*[\w-]*\s*$/.test(pre)) s = s.slice(fgt + 1); }
  // drop trailing partial tag
  const llt = s.lastIndexOf("<"), lgt = s.lastIndexOf(">");
  if (llt >= 0 && llt > lgt) s = s.slice(0, llt);
  for (const seg of s.split(/<[^>]*>/)) out.push(seg);
  return out;
}
const clean = (s) => decode(s).replace(/\s+/g, " ").trim().replace(/^[·—–|:,]\s*/, "").replace(/\s*[·—–|]$/, "").trim();

// ---------- context pass ----------
const DEV_CALLEE = /(^|\.)(Error|TypeError|RangeError|SyntaxError|ReferenceError|AggregateError|log|warn|error|info|debug|trace|assert|ok|equal|strictEqual|deepEqual|deepStrictEqual|fail|write|prepare|exec|RegExp|require|resolve|join|fileURLToPath|URL|querySelector|querySelectorAll|getElementById|matches|closest|setAttribute|getAttribute|createElement|addEventListener|removeEventListener|dispatchEvent|Event|CustomEvent|fetch|digest|importKey|encode|decode|split|replace|replaceAll|startsWith|endsWith|includes|indexOf|test|match|header|get|has|set|delete)$/;
const KEYRE = /^[A-Za-z0-9_{}-]*\.[A-Za-z0-9_.{}-]*$/;
function analyse(toks, inherited, emit, stats) {
  const stack = [];
  const consumed = new Set();
  const calleeAt = (k) => { let s = []; let j = k - 1; while (j >= 0) { const t = toks[j]; if (t.t === "id") { s.unshift(t.v); j--; if (toks[j] && toks[j].t === "punct" && (toks[j].v === "." || toks[j].v === "?.")) { s.unshift("."); j--; continue; } break; } break; } let c = s.join(""); if (toks[j] && toks[j].t === "id" && toks[j].v === "new") c = "new " + c; return c; };
  let pendingWords = false;
  const ctxDev = () => inherited.dev || stack.some((f) => f.dev);
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]; const top = stack[stack.length - 1];
    if (t.t === "punct") {
      if (t.v === "(" || t.v === "[" || t.v === "{") {
        const callee = t.v === "(" ? calleeAt(k) : "";
        const wd = pendingWords || stack.some((f) => f.wordsDecl); pendingWords = false;
        stack.push({ wordsDecl: wd, open: t.v, callee, dev: t.v === "(" && DEV_CALLEE.test(callee.replace(/^new /, "")), idx: 0, firstKey: false, propKey: null, elemFirst: true });
        if (top && top.elemFirst) top.elemFirst = false;
      } else if (t.v === ")" || t.v === "]" || t.v === "}") stack.pop();
      else if (t.v === "," && top) { top.idx++; top.propKey = null; top.elemFirst = true; }
      else if (t.v === ":" && top && top.open === "{") { const p = toks[k-1], pp = toks[k-2]; if (p && (p.t === "id" || p.t === "str" || p.t === "num") && pp && pp.t === "punct" && (pp.v === "{" || pp.v === ",")) top.propKey = p.v; }
      continue;
    }
    if (t.t === "str" && top && top.idx === 0 && (KEYRE.test(t.v) || (top.open === "[" && /^[a-z][\w.{}-]*$/.test(t.v) && toks[k-1] && toks[k-1].v === "["))) top.firstKey = true;
    if (top && top.idx === 0 && t.t === "id" && toks[k+1] && toks[k+1].v === "+") { /* prefix + "x.y" */ }
    if (t.t === "id" && /(WORDS|ROWS|^rows)$/.test(t.v) && toks[k+1] && toks[k+1].v === "=") pendingWords = true;
    if (t.t === "punct" && t.v === ";") pendingWords = false;
    if (t.t === "str" && top && top.idx === 0 && top.open === "(" && /(^|\.)row$/.test(top.callee)) top.firstKey = true;
    if (t.t !== "str" && t.t !== "tpl") { if (top) top.elemFirst = false; continue; }
    if (consumed.has(k)) continue;
    // build chain
    const pieces = []; const line = t.line; let k2 = k;
    const pushTok = (tk) => { if (tk.t === "str") pieces.push(tk.v); else for (const p of tk.parts) pieces.push(typeof p === "string" ? p : null); };
    pushTok(t);
    while (toks[k2+1] && toks[k2+1].t === "punct" && toks[k2+1].v === "+") {
      // operand
      let j = k2 + 2; const n = toks[j]; if (!n) break;
      if (n.t === "str" || n.t === "tpl") { pushTok(n); consumed.add(j); k2 = j; continue; }
      // non-string operand: scan to next top-level '+' or terminator
      let d = 0; let m = j; let bad = false;
      for (; m < toks.length; m++) { const x = toks[m]; if (x.t === "punct") { if ("([{".includes(x.v)) d++; else if (")]}".includes(x.v)) { if (d === 0) break; d--; } else if (d === 0 && (x.v === "+" || [",",";",":","?","||","&&","??","===","!==","==","!=","=",">","<",">=","<=","-","*","/"].includes(x.v))) break; } }
      if (m === j) { bad = true; }
      if (bad) break;
      pieces.push(null); k2 = m - 1;
      if (!(toks[m] && toks[m].t === "punct" && toks[m].v === "+")) break;
    }
    // compose text with sentinels
    let text = ""; let n = 0; for (const p of pieces) text += p === null ? PH + (n++) + PH : p;
    // context
    const prev = toks[k-1], prev2 = toks[k-2];
    let form = "inline";
    if (prev && prev.t === "id" && (prev.v === "from" || prev.v === "import")) form = "import";
    else if (prev && prev.t === "punct" && prev.v === "(" && prev2 && prev2.t === "id" && prev2.v === "import") form = "import";
    else if (prev && prev.t === "id" && prev.v === "throw") form = "dev";
    else if (ctxDev()) form = "dev";
    else if ((prev && prev.t === "punct" && /^[!=]==?$/.test(prev.v)) || (toks[k2+1] && toks[k2+1].t === "punct" && /^[!=]==?$/.test(toks[k2+1].v))) form = "compare";
    else if (stack.some((f) => f.wordsDecl)) form = "keyed-row";
    else if (top && top.idx === 1 && top.firstKey && (top.open === "[" || (top.open === "(" && /(^|\.)row$/.test(top.callee)))) form = "keyed-row";
    else if (top && top.open === "{" && top.propKey && KEYRE.test(top.propKey) && /[a-z]\.[a-z]/.test(top.propKey)) form = "keyed-map";
    for (const c of candidates(text)) {
      const raw = c; const cl = clean(c.replace(new RegExp(PH + "\\d+" + PH, "g"), PH + "0" + PH)).replace(new RegExp(PH + "0" + PH, "g"), "${…}");
      if (!cl) continue;
      const why = englishReason(cl.replace(/\$\{…\}/g, PH + "0" + PH));
      if (why) { stats[why] = (stats[why] || 0) + (why === "short" || why === "nonalpha" ? 0 : 1); if (globalThis.SAMPLES && !["short","nonalpha"].includes(why)) (SAMPLES[why] ||= []).push(line + " " + cl.slice(0,140)); continue; }
      emit({ line, text: cl, form, propKey: top && top.open === "{" ? top.propKey : null });
    }
    if (t.t === "tpl") for (const sub of t.subs) analyse(sub, { dev: ctxDev() || form === "dev" }, emit, stats);
    if (top) top.elemFirst = false;
  }
}

// ---------- words ----------
const W = JSON.parse(fs.readFileSync(WORDS, "utf8")).words;
const norm = (s) => decode(s).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const exact = new Map(), normal = new Map();
for (const w of W) { if (typeof w.en !== "string") continue; (exact.get(w.en) || exact.set(w.en, []).get(w.en)).push(w.key); const n = norm(w.en); (normal.get(n) || normal.set(n, []).get(n)).push(w.key); }
const withPh = W.filter((w) => typeof w.en === "string" && /\{[^}]+\}/.test(w.en));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function match(text) {
  if (exact.has(text)) return { key: exact.get(text)[0], how: "exact", n: exact.get(text).length };
  const n = norm(text);
  if (normal.has(n)) return { key: normal.get(n)[0], how: "normalized", n: normal.get(n).length };
  if (text.includes("${…}")) {
    const re = new RegExp("^" + n.split("${…}").map(esc).join("\\{[^}]+\\}") + "$");
    const hit = withPh.find((w) => re.test(norm(w.en)));
    if (hit) return { key: hit.key, how: "template" };
  }
  // partial: the fragment occurs inside a longer word (literal parts, >= 3 words)
  const lit = n.split("${…}").map((s) => s.trim()).filter((s) => s.split(" ").length >= 3);
  if (lit.length) { const p = W.find((w) => typeof w.en === "string" && lit.every((l) => norm(w.en).includes(l))); if (p) return { key: null, partial: p.key }; }
  return { key: null };
}


// ---------- DEC-258's decisions ----------
/* Each: [module, file, how + text, key | {why}]. how: "=" the whole text, "^" its start, "~" anywhere in it. A decision
   comes before a match by English (plane's legacy screen titles match unrelated words by accident). */
const WHY = {
  filegrammar: "the record file's own grammar (its front matter and section labels, as record-grammar parses them), not member prose; the sentences inside it are keyed (DEC-272)",
  grade: "a grade's rationale for builders (a rung's reason, an absence's ground, an op's note); screens draw weight.* and act.<op>.does",
  harness: "the journey walk's test harness: its fixtures, steps and findings; no member reads it",
  generated: "a comment written into a generated asset",
  header: "an HTTP header's value",
  elementnote: "a builder's note on an element, read by tests",
  provenance: "a provenance quote for builders: where an op's admission was ruled",
  ground: "a builder's ground for an op no control offers; no screen draws it",
  wire: "the wire's `error` or `detail` beside a refusal's code, for builders; the shell draws refusal.<CODE> with the answer's fields, never these (interface-shell R13)",
  stated: "DOOR_WINDOW_STATED, the limit as a field beside DOOR_RATE_LIMITED; the member reads refusal.DOOR_RATE_LIMITED, which carries {minutes}",
  apiuse: "API usage for the client holding the value, never drawn",
  diag: "a diagnostic for builders (an HTTP body, a pack that would not render, a hash recipe, a wiring or registry finding)",
  whoami: "whoami's `detail`, which no screen draws",
  replay: "a replaying tool's refusal `detail`, never a member's",
  badtask: "BAD_TASK's or a malformed request's `detail`: a request the interface never sends",
  assistantinput: "a `why` in the records handed to the assistant, not drawn for a member",
  legacy: "the legacy interface's screen registry (plane R24, K1475), handed to `answers`; the design draws no such screen, and its own registry replaces these entries when its interface ships",
  grammar: "record-grammar's required heading (HEADINGS.inquiry), matched exactly by the grammar: keyed with the grammar, not here",
};
const dev = (k) => ({ why: WHY[k] });
const DECISIONS = [
  // DEC-272: on T49 after L11's merges, the record files' own grammar
  ["screens-daily", "screens-daily/queue.mjs", "^--- object_type: inquiry", dev("filegrammar")],
  ["screens-daily", "screens-daily/start-project.mjs", "^--- object_type: project", dev("filegrammar")],
  ["control-plane", "control-plane/archive.mjs", "^Changes: ${…}", dev("filegrammar")],
  // DEC-443 (B538): the inquiry file's session-log lines (record grammar); control-plane R130's stand-in reads its key
  ["screens-daily", "screens-daily/queue.mjs", "^### Session ${…} | Formation | interactive", dev("filegrammar")],
  ["screens-daily", "screens-daily/queue.mjs", "^Changes: created.", dev("filegrammar")],
  ["control-plane", "control-plane/index.mjs", "~the file is kept, but its reading could not be queued", "control-plane.reading.not_registered"],
  // op-grades' four statements and affordances' drifted act.queuemute.does now read their keys in the source (OP-GRADES #11,
  // AFFORDANCES #34, merged K3375): DEC-263 drops their decisions, the keys being read as literals; a client's usage hint
  ["affordances", "affordances/facts.mjs", "^affordances are asked of an object", dev("apiuse")],
  ["op-declarations", "op-declarations/index.mjs", "^A read a screen draws from", dev("ground")],
  ["op-declarations", "op-declarations/index.mjs", "^A step another act takes", dev("ground")],
  ["admission", "admission/index.mjs", "=at most ${…} requests from one source in any ${…} minutes", dev("stated")],
  ["interface-shell", "interface-shell/browser.mjs", "=Bearer ${…}", dev("header")],
  // screens: the words a screen writes into a project file a member opens (its grammar stays)
  ["screens-daily", "screens-daily/home.mjs", "~Trigger: started from the group's home", "file.trigger.home"],
  ["screens-daily", "screens-daily/projects.mjs", "~Trigger: started from the projects list", "file.trigger.projects"],
  ["screens-daily", "screens-daily/queue.mjs", "~Trigger: opened from a hint in the queue", "file.trigger.queue"],
  ["screens-inquiry", "screens-inquiry/project.mjs", "=## What It Rests On", dev("grammar")],
  ["screens-inquiry", "screens-inquiry/project.mjs", "=## What Would Falsify This", dev("grammar")],
  ["screens-inquiry", "screens-inquiry/project.mjs", "=- text: Revisit this", "file.recheck.revisit"],
  ["screens-inquiry", "screens-inquiry/project.mjs", "^description: A member set no specific trigger", "file.recheck.none"],
  ["screens-investigate", "screens-investigate/explore.mjs", "^What does this chain show:", "file.chain.title"],
  ["screens-investigate", "screens-investigate/explore.mjs", "=- text: Revisit this chain", "file.recheck.chain"],
  ["screens-investigate", "screens-investigate/explore.mjs", "^description: Opened from a chain", "file.recheck.chain.why"],
  ["screens-investigate", "screens-investigate/explore.mjs", "=## What It Rests On", dev("grammar")],
  ["screens-investigate", "screens-investigate/explore.mjs", "=## What Would Falsify This", dev("grammar")],
  ["screens-investigate", "screens-investigate/explore.mjs", "^What does this chain of connections show", "file.chain.question"],
  ["screens-investigate", "screens-investigate/explore.mjs", "^Explored as of", "file.chain.rests"],
  ["screens-investigate", "screens-investigate/timeline.mjs", "=a member's reading of the passage", "screen.timeline.method.member"],
  // control-plane
  ["control-plane", "control-plane/app.mjs", "=Not found", dev("diag")],
  ["control-plane", "control-plane/draft.mjs", "^the draft's {field} is over its limit", dev("wire")], // DEC-366: the detail beside ASSISTANT_DRAFT_UNAVAILABLE; the shell draws refusal.<CODE>
  ["control-plane", "control-plane/archive.mjs", "^${…}, from the archive", "file.archive.entry.title"],
  ["control-plane", "control-plane/archive.mjs", "^Archive captured from", "file.archive.title"],
  ["control-plane", "control-plane/archive.mjs", "^A file cut out of the archive", "file.archive.entry.summary"],
  ["control-plane", "control-plane/archive.mjs", "^An archive captured by the record", "file.archive.summary"],
  ["control-plane", "control-plane/archive.mjs", "^Filed at collected and never higher", "file.archive.provenance"],
  ["control-plane", "control-plane/archive.mjs", "^Changes: created from the archive's unpack", "file.log.unpacked"],
  // DEC-267: the group's fields (its description) read their own label; a member's fields the member's
  ["control-plane", "control-plane/draft.mjs", "~and then the words are your group's", "draft.machine.label.group"],
  ["control-plane", "control-plane/draft.mjs", "^a draft: nothing is saved until you edit it", "draft.machine.label"],
  ["control-plane", "control-plane/draft.mjs", "^the draft's ${…} is over its limit", dev("wire")],
  ["control-plane", "control-plane/index.mjs", "^this answer exactly as served", dev("diag")],
  ["control-plane", "control-plane/index.mjs", "=knockerconsent is a POST", dev("wire")],
  ["control-plane", "control-plane/index.mjs", "=the pack could not be rendered", dev("diag")],
  ["control-plane", "control-plane/index.mjs", "^instance has no bootstrap credential", dev("wire")],
  ["control-plane", "control-plane/index.mjs", "^bootstrap credential ", dev("wire")],
  ["control-plane", "control-plane/index.mjs", "^capabilities are set by an administrator and gate", dev("whoami")],
  ["control-plane", "control-plane/index.mjs", "^a machine credential has no member behind it", dev("whoami")],
  ["control-plane", "control-plane/index.mjs", "^this promotion says it is a replay", dev("replay")],
  ["control-plane", "control-plane/index.mjs", "^your group's Civicsmith has no assistant bound to it", "refusal.AGENT_WORKER_UNBOUND"],
  ["control-plane", "control-plane/index.mjs", "=the text was not checked", "refusal.AGENT_WORKER_UNBOUND"],
  ["control-plane", "control-plane/index.mjs", "=nothing was translated", "refusal.AGENT_WORKER_UNBOUND"],
  ["control-plane", "control-plane/index.mjs", "=the run was not started", "refusal.AGENT_WORKER_UNBOUND"],
  ["control-plane", "control-plane/index.mjs", "~It is not stored and cannot be recovered", "credential.token.once"],
  ["control-plane", "control-plane/index.mjs", "~Give it to the recipient: it lets them READ this one draft", "screen.review-copy.link.once"],
  ["control-plane", "control-plane/index.mjs", "~Give it to the reviewer: it lets them READ this one template version", "template.review.secret.once"],
  ["control-plane", "control-plane/index.mjs", "^a POST to op=", dev("apiuse")],
  // store-assembly: the ask's refusals, by code (moved from plane/ask.mjs); the legacy screen registry read as the design's screens
  ["store-assembly", "store-assembly/ask.mjs", "~is a member's own act, from their own session", "refusal.ASK_NOT_A_MEMBER"],
  ["store-assembly", "store-assembly/ask.mjs", "~is a POST", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "~body is not JSON", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "=the draft did not come back. Nothing was kept.", "refusal.AGENT_WORKER_SILENT"],
  ["store-assembly", "store-assembly/ask.mjs", "=the assistant member did not answer. Nothing was kept.", "refusal.AGENT_WORKER_SILENT"],
  ["store-assembly", "store-assembly/ask.mjs", "=the assistant member's answer was not JSON. Nothing was kept.", "refusal.AGENT_WORKER_SILENT"],
  ["store-assembly", "store-assembly/ask.mjs", "^your group's Civicsmith has no assistant bound to it", "refusal.AGENT_WORKER_UNBOUND"],
  ["store-assembly", "store-assembly/ask.mjs", "^the language this passage is read in could not be read", "translate.undetermined.language"],
  ["store-assembly", "store-assembly/ask.mjs", "^a passage of more than", "refusal.PASSAGE_TOO_LONG"],
  ["store-assembly", "store-assembly/ask.mjs", "~project keeps its material away could not be read", "ai.keepaway.unread"],
  ["store-assembly", "store-assembly/ask.mjs", "=the plan could not be read. Nothing was drafted.", "ai.draft.planunread"],
  ["store-assembly", "store-assembly/ask.mjs", "^the records this draft is about could not be read", "ai.draft.recordsunread"],
  ["store-assembly", "store-assembly/ask.mjs", "=no note of yours is held by that number", "refusal.NO_SUCH_NOTE"],
  ["store-assembly", "store-assembly/ask.mjs", "=a reading is a member's own act", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "^a status report's draft names its plan", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "=the plan this draft is about cannot be read here", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "^a reading names its subject", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "={detail}. Nothing was drafted.", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "=the records this draft is about cannot be read here", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "=a draft that reads records is a member's own act", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "^a bearing draft names", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "^the reply named is not an entry", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "^an infraction draft names", dev("badtask")],
  ["store-assembly", "store-assembly/ask.mjs", "^the reply's text is not held", dev("assistantinput")],
  // DEC-431: capture R113's begin act, its default saying "group" (DEC-281: team): the design's word is the key's
  ["affordances", "affordances/act-help.mjs", "^Starts sending a large document to the group's store", "act.captureuploadbegin.does"],
  /* DEC-444: T51's stand-ins for the two ops DEC-443 worded (K5303); the design's sentences are ACT_HELP's leggrade and signerknown */
  ["affordances", "affordances/act-help.mjs", "^Records how well your team's copy of a cited document shows the passage", "act.leggrade.does"],
  ["affordances", "affordances/act-help.mjs", "^An administrator says they know about a signing key a member registered", "act.signerknown.does"],
  ...[["The queue", "screen.queue.name"], ["Everything the record is asking of somebody", "screen.queue.purpose"],
      ["The evidence finder", "screen.finder.name"], ["One query surface over the record", "screen.finder.purpose"],
      ["What the record knows about a person, office or thing", "screen.people.purpose"],
      ["A member's idea with its test", "screen.theme.purpose"], ["The cases this group is building", "screen.projects.purpose"],
      ["What has been collected and not yet vouched for", "screen.held.purpose"],
      ["Members & governance", "screen.members.name"], ["Who holds what in your group's Civicsmith", "screen.members.purpose"],
      ["Add something new", "screen.capture.name"], ["Where a document enters the record from outside it", "screen.capture.purpose"],
      ["The document", "screen.document.name"], ["One document as the record holds it", "screen.document.purpose"],
      ["The question", "screen.question.name"], ["A question the record is working on", "screen.question.purpose"],
      ["The project", "screen.project.name"], ["A case's workspace", "screen.project.purpose"],
      ["The action", "screen.action.name"], ["Something this group has asked of somebody outside it", "screen.action.purpose"],
      ["Case files", "screen.front.name"], ["The cases your group's Civicsmith has published", "screen.front.purpose"],
      ["Review copy", "screen.review-copy.name"], ["A draft case shown to chosen reviewers", "screen.review-copy.purpose"],
      ["A published case", "screen.published.name"], ["One published case at one edition", "screen.published.purpose"],
  ].map(([t, k]) => ["plane", "plane/screens.mjs", (k.endsWith(".name") ? "=" : "^") + t, k]),
];
/* DEC-264 (N1125): affordances.mjs's act names and prompts, keyed in words-t49.src.py (AFFORDANCES_NAMES: key -> the module's
   present text, a whole label or a prompt's start) */
for (const [key, was] of Object.entries(JSON.parse(fs.readFileSync(path.join(HERE, "words-t49.json"), "utf8")).affordances_names || {}))
  DECISIONS.push(["affordances", "affordances.mjs", (key.startsWith("act.") ? "=" : "^") + was, key]);
/* DEC-413 (B473, K4458): on T51 after fix round 3, the declared ops' own descriptions (control-plane's owner ops, the plane's
   ask), builders' grading text like op-grades' (their member sentences are act.<op>.does rows), and a bias file's section label. */
for (const pre of ["upload-directed: ", "read: a case's drafts of its account", "case-directed: ", "action-directed: ", "credential: a member's own sign-in", "read: every interface word"])
  DECISIONS.push(["store-assembly", "store-assembly/owner-ops.mjs", "^" + pre, dev("grade")]);
DECISIONS.push(["store-assembly", "store-assembly/declared.mjs", "^member-directed: a member's own question", dev("grade")]);
/* DEC-424 (B495): on T51 after fix round 6, the plane's owedwork op description is builders' grading text like the other declared ops'; the
   interrupted reading's reason is the design's own word (DEC-417 plane.pending.interrupted, whose English the code's stand-in no longer matches). */
DECISIONS.push(["store-assembly", "store-assembly/declared.mjs", "^what the object still owes one document", dev("grade")]);
DECISIONS.push(["store-assembly", "store-assembly/pending.mjs", "=the reading did not finish; the object stopped", "plane.pending.interrupted"]);
DECISIONS.push(["screens-settings", "screens-settings/bias.mjs", "=## What This Does Not Enforce", dev("filegrammar")]);
/* What a module's remaining inline strings are, when no decision or word names them. */
const DEFAULTS = {
  "op-grades": "grade", "journey-check": "harness", "interface-assets": "generated", "interface-shell": "elementnote",
  "op-declarations": "provenance", "admission": "wire", "plane": null,
};
const DEFAULT_BY_FILE = { "plane/screens.mjs": "legacy", "store-assembly/unpack.mjs": "diag", "store-assembly/wiring.mjs": "diag", "store-assembly/wizards.mjs": "diag" };
/* A key a module names that the design holds under another name: the design's governs. */
/* DEC-271 (B228): AGENT_WORKER_UNBOUND's details read refusal.AGENT_WORKER_UNBOUND (DEC-267), not the interim ai.refused.notdeployed;
   admission reads DEC-262's session limit. DEC-265 (B226 (5)): reads a module's requirements name ahead of its source: screens-settings R32 draws each section's
   name and purpose (the settings index's thirteen sections and its own), R38 connect.ifnot and the refusal reference. */
const REQUIREMENT_READS = {
  "admission": ["refusal.DOOR_RATE_LIMITED.session"],
  "screens-settings": [...["settings", "account", "connect", "ties", "notes", "recovery", "group", "group-identity", "members",
    "places", "security", "updates", "translations", "wizards"].flatMap((id) => [`screen.${id}.name`, `screen.${id}.purpose`]),
    "connect.ifnot", "screen.connect.refusal.reference"],
  /* ux-design R2: screens-document-beta's marks whose words are all in the stream, each mark's keys as its requirement names
     them (build/requirements/screens-document-beta.md). The module has no source of its own yet: these are its reads. */
  "screens-document-beta": Object.values(REQUIREMENT_READS_BY_MARK["screens-document-beta"]).flat(),
};
const RENAMED = {
  "screens-action": { "act.optionpropose.label.plan": "act.planask.label.plan" },
  "screens-investigate": { "act.connectionassert.label.explore": "act.stepsource.label.explore" },
};
/* DEC-370 (B390, K4134): a key a module's `act.${op}.label.${screen}` pattern matches only because the module holds both words
   apart (`claim` as an op, `setup` as a screen), though it draws no such act: the setup screen's claim button reads
   screen.setup.claim.button, so neither module reads the registry's setup claim label. */
const NOT_READ = {
  "screens-entry": ["act.claim.label.setup"],
  /* DEC-371 (B391, K4136): four more, each pattern filled by words the module holds for other ends (`explore` and
     `document`, `heldcaptures` and `held`, `reconcile` and `money`, `transcribe`), acts the other modules' screens draw. */
  "screens-settings": ["act.claim.label.setup", "act.explore.label.document", "act.heldcaptures.label.held", "act.reconcile.label.money",
    "act.transcribe.label.document"],
  /* DEC-373 (B396, K4154): refusal codes the module meets but draws through each screen's own words (doorbell's
     screen.doorbell.refused.*, review-copy's until.bad, the ceremony's refused.* and gate.notargets, "Nothing is here"),
     the dynamic `"screen.action.pressure." + kind` read whole, and the ceremony's abridging line (it lists every line). */
  "screens-publish": ["refusal.KNOCK_EMPTY", "refusal.KNOCK_PAYLOAD_TOO_LARGE", "refusal.KNOCK_ENVELOPE_TOO_LARGE",
    "refusal.KNOCKER_SECRET_WEAK", "refusal.RATE_IP", "refusal.RATE_GLOBAL", "refusal.BAD_CONTENT", "refusal.KNOCK_NOT_STORED",
    "refusal.REQUIRED_ARGUMENT_MISSING", "refusal.REVIEW_BAD_UNTIL", "refusal.NO_ATTESTING_KEY", "refusal.NO_SIGNERS",
    "refusal.CASE_SIGNER_NOT_AN_OWNER", "refusal.NO_TARGET", "refusal.NOT_PUBLISHED", "refusal.IMPORT_NO_SUCH_EDITION",
    "screen.action.pressure.kind", "screen.ceremony.signs.lines"],
};
/* DEC-253's ten vocabularies, which affordances publishes with its words. */
const VOCAB_SETS = ["linekinds", "linecapacities", "lineroles", "moneykinds", "moneyphases", "moneystages", "moneybases",
  "moneyprecisions", "identityclaimkinds", "connectionkinds"];

// ---------- run ----------
const KEYS = new Set(W.map((w) => w.key));
const T49W = JSON.parse(fs.readFileSync(path.join(HERE, "words-t49.json"), "utf8"));
const RETIRED = new Set(T49W.retired);
const MINTED = new Set(T49W.rows.filter((r) => /^DEC-258/.test(r.note || "")).map((r) => r.key));
const problems = [];
const used = new Set();
const walkDir = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walkDir(path.join(d, e.name)) : [path.join(d, e.name)]);
const decide = (m, file, text) => {
  for (let i = 0; i < DECISIONS.length; i++) {
    const [dm, df, spec, target] = DECISIONS[i];
    if (dm !== m || df !== file) continue;
    const how = spec[0], t = spec.slice(1);
    if (how === "=" ? text === t : how === "^" ? text.startsWith(t) : text.includes(t)) { used.add(i); return target; }
  }
  return undefined;
};
const literalKeys = (toks, out) => { for (const t of toks) {
  if (t.t === "str" && KEYS.has(t.v)) out.add(t.v);
  if (t.t === "tpl") { if (t.parts.length === 1 && KEYS.has(t.parts[0])) out.add(t.parts[0]); for (const s of t.subs) literalKeys(s, out); } } };
/* translations of admission's refusal rows, by code: each reads refusal.<CODE> */
const translations = new Map();
if (fs.existsSync(path.join(SRC, "admission", "checks.mjs"))) {
  const checks = await import(pathToFileURL(path.join(SRC, "admission", "checks.mjs")).href);
  for (const v of Object.values(checks)) if (v && typeof v === "object")
    for (const [code, row] of Object.entries(v)) if (row && typeof row.translation === "string") translations.set(clean(row.translation), `refusal.${code}`);
}

const out = { _note: "DEC-258 (K3366): each L11 module of T49 reads exactly these keys through setup-words' word(key, vars) and holds no "
  + "English. `reads` are keys of words.json (setup-words: \"*\", it generates the whole list); `unkeyed` are the inline strings left "
  + "as they are because no member reads them, each with why; `retired` are keyed rows the design withdrew (DEC-256), to be "
  + "dropped; `renamed` maps a key the module names to the design's key for it. Written by words-reads.src.mjs from "
  + "origin/tranche/T49's bio-plane/src; do not edit by hand.", modules: {} };
for (const m of MODULES) {
  const dir = path.join(SRC, m);
  if (!fs.existsSync(dir)) {
    /* ux-design R2: a module with no source of its own reads what its requirements name (REQUIREMENT_READS), nothing else */
    const req = (REQUIREMENT_READS[m] || []).filter((k) => { if (KEYS.has(k)) return true; problems.push(`${m}: its requirements read ${k}, not in words.json`); return false; }).sort();
    out.modules[m] = req.length
      ? { reads: req, counts: { reads: req.length, requirementReads: req.length }, unkeyed: [], note: "no source of its own yet: it reads the keys its requirements name" }
      : { reads: [], counts: { reads: 0 }, unkeyed: [], note: "not built yet at T49: no source, so it reads no key yet" };
    continue;
  }
  const reads = new Set(), lits = new Set(), unkeyed = [], retired = new Set(), renamed = {};
  const srcs = [];
  const c = { keyedRows: 0, literalKeys: 0, inline: 0, inlineKeyed: 0, inlineUnkeyed: 0 };
  if (m === "setup-words") {
    const sw = await import(pathToFileURL(path.join(dir, "index.mjs")).href);
    out.modules[m] = { reads: ["*"], counts: { reads: "*", generatedRows: (sw.WORD_ROWS || []).length }, unkeyed: [],
      note: "generates the word list from words.json (setup-words R1–R3) and exports word(key, vars): it reads every key" };
    continue;
  }
  /* keyed rows */
  const wm = path.join(dir, "words.mjs");
  if (fs.existsSync(wm) && m !== "affordances") {
    const mod = await import(pathToFileURL(wm).href);
    for (const v of Object.values(mod)) if (Array.isArray(v)) for (const r of v) if (Array.isArray(r) && typeof r[0] === "string") {
      c.keyedRows++;
      if (RETIRED.has(r[0])) retired.add(r[0]);
      else if (KEYS.has(r[0])) reads.add(r[0]);
      else problems.push(`${m}: keyed row ${r[0]} is not in words.json`);
    }
  }
  /* DEC-264 (N1125): a module whose main file sits beside its folder (affordances.mjs) reads through that file too */
  const files = [...walkDir(dir), ...(fs.existsSync(dir + ".mjs") && m === "affordances" ? [dir + ".mjs"] : [])]
    .filter((f) => /\.(mjs|js|cjs|html)$/.test(f) && !/test/i.test(path.basename(f)));
  for (const f of files) {
    const rel = path.relative(SRC, f).split(path.sep).join("/");
    const src = fs.readFileSync(f, "utf8");
    srcs.push(src);
    const { toks } = tokenize(src, 0, false, { line: 1 });
    literalKeys(toks, lits);
    for (const [from, to] of Object.entries(RENAMED[m] || {})) if (src.includes(JSON.stringify(from))) { renamed[from] = to; reads.add(to); }
    analyse(toks, { dev: false }, (e) => {
      if (["import", "compare", "dev", "keyed-row"].includes(e.form)) return;
      c.inline++;
      const d = decide(m, rel, e.text);
      const mt = d === undefined ? match(e.text) : { key: null };
      const target = d !== undefined ? d : mt.key ? mt.key
        : m === "affordances" && /act-help\.mjs$/.test(rel) ? undefined
        : (DEFAULT_BY_FILE[rel] || DEFAULTS[m]) ? dev(DEFAULT_BY_FILE[rel] || DEFAULTS[m]) : undefined;
      if (m === "admission" && translations.has(e.text) && d === undefined) { reads.add(translations.get(e.text)); c.inlineKeyed++; return; }
      if (target === undefined) { problems.push(`${m}: untriaged ${rel}:${e.line} ${e.text.slice(0, 100)}`); return; }
      /* ACT_HELP's texts are keyed through ACT_HELP below, by op, not by the word their English happens to match */
      if (typeof target === "string") { if (!(m === "affordances" && /act-help\.mjs$/.test(rel))) reads.add(target); c.inlineKeyed++; }
      else { unkeyed.push({ file: rel, line: e.line, text: e.text, why: target.why }); c.inlineUnkeyed++; }
    }, {});
  }
  for (const k of lits) if (!RETIRED.has(k)) reads.add(k);
  c.literalKeys = lits.size;
  /* DEC-278 (B238): keys a module computes, a key's head joined to a code or name the module holds (`refusal.${code}`,
     "screen.front." + k): each head (a dotted name ending in "." before `${` or before +) joined to each string, property
     name or CONSTANT_NAME the module's source holds, read where the joined key is a word (and retired where it is retired) */
  { const heads = new Set(), tails = new Set(), pats = [], tpats = []; let n = 0;
    for (const t0 of srcs) { const t = t0.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\"'`])\/\/[^\n]*/g, "$1");   /* comments name keys they do not read */
      for (const r of t.matchAll(/`([a-z][\w-]*(?:\.[\w-]+)*\.)\$\{/g)) heads.add(r[1]);
      for (const r of t.matchAll(/["'`]([a-z][\w-]*(?:\.[\w-]+)*\.)["'`]\s*\+/g)) heads.add(r[1]);
      /* DEC-329 (B303 (1)): a head held in a name (`const S = "screen.setup."`, then `S + "skipped"`) */
      for (const r of t.matchAll(/=\s*["'`]([a-z][\w-]*(?:\.[\w-]+)*\.)["'`]\s*[,;)]/g)) heads.add(r[1]);
      /* DEC-329: a key whose last placeholder is a glued suffix (`act.${id}.name${selected ? ".selected" : ""}`): the key with and without a dotted suffix */
      for (const r of t.matchAll(/`([a-z][\w-]*(?:\.[\w-]*|\$\{[^}`]*\})*[\w-])\$\{[^}`]*\}`/g)) pats.push(new RegExp("^" + r[1].split(/\$\{[^}`]*\}/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\w-]+") + "(?:\\.[\\w-]+)?$"));
      /* DEC-329 (B303 (1)): a key ending in its placeholder (`act.${op}.label.${screen}`): read where every filled part is a string the module holds */
      for (const r of t.matchAll(/`([a-z][\w-]*(?:\.[\w-]+)*\.(?:\$\{[^}`]*\}(?:\.[\w-]+)*\.)*\$\{[^}`]*\})`/g)) tpats.push(new RegExp("^" + r[1].split(/\$\{[^}`]*\}/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("([\\w-]+)") + "$"));
      for (const r of t.matchAll(/["'`]([\w-]+(?:\.[\w-]+)*)["'`]/g)) tails.add(r[1]);
      for (const r of t.matchAll(/\b([A-Za-z_][\w]*)\s*:/g)) tails.add(r[1]);
      for (const r of t.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) tails.add(r[1]);
      /* a key with words after its placeholder (`screen.tour.step${n}.title`): every word the pattern fits */
      for (const r of t.matchAll(/`([a-z][\w-]*(?:\.[\w-]+)*\.?[\w-]*(?:\$\{[^}`]*\}[\w-]*)+(?:\.[\w-]+)+)`/g)) pats.push(new RegExp("^" + r[1].split(/\$\{[^}`]*\}/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\w-]+") + "$"));
    }
    for (const re of tpats) for (const k of KEYS) { const mm = re.exec(k); if (mm && mm.slice(1).every((x) => tails.has(x))) { if (RETIRED.has(k)) retired.add(k); else if (!reads.has(k)) { reads.add(k); n++; } } }
    for (const re of pats) for (const k of KEYS) if (re.test(k)) { if (RETIRED.has(k)) retired.add(k); else if (!reads.has(k)) { reads.add(k); n++; } }
    for (const h of heads) for (const tl of tails) { const k = h + tl;
      if (RETIRED.has(k)) retired.add(k); else if (KEYS.has(k) && !reads.has(k)) { reads.add(k); n++; } }
    c.computedKeys = n; }
  /* DEC-265 (B226 (5)): keys a module's requirements name that its merged source does not read yet */
  for (const k of NOT_READ[m] || []) reads.delete(k);
  for (const k of REQUIREMENT_READS[m] || []) { if (KEYS.has(k)) reads.add(k); else problems.push(`${m}: its requirements read ${k}, not in words.json`); }
  /* affordances: ACT_HELP's acts read act.<op>.does (or the design's key its text is); DEC-253's vocabularies */
  if (m === "affordances") {
    const { ACT_HELP, ACT_HELP_KEYS = {} } = await import(pathToFileURL(path.join(dir, "act-help.mjs")).href);
    let n = 0;
    for (const [op, text] of Object.entries(ACT_HELP)) {
      /* DEC-266: the key act-help binds the op to (ACT_HELP_KEYS, AFFORDANCES R62) governs, so a reworded text still finds it */
      const k = KEYS.has(ACT_HELP_KEYS[op]) ? ACT_HELP_KEYS[op] : KEYS.has(`act.${op}.does`) ? `act.${op}.does` : match(clean(text)).key;
      if (k) { reads.add(k); n++; } else problems.push(`affordances: ACT_HELP.${op} has no act.${op}.does and its text is no word`);
    }
    const vocab = W.filter((w) => VOCAB_SETS.some((s) => w.key.startsWith(`label.${s}.`))).map((w) => w.key);
    vocab.forEach((k) => reads.add(k));
    Object.assign(c, { actHelp: n, vocabulary: vocab.length });
  }
  const list = [...reads].sort();
  for (const k of list) if (!KEYS.has(k)) problems.push(`${m}: reads ${k}, which is not in words.json`);
  out.modules[m] = { reads: list, counts: { reads: list.length, minted: list.filter((k) => MINTED.has(k)).length, ...c },
    unkeyed, ...(retired.size ? { retired: [...retired].sort() } : {}), ...(Object.keys(renamed).length ? { renamed } : {}) };
}
/* DEC-272: a decision whose string its module no longer holds (the module now reads keys, K3366) is retired, not a failure,
   when it named an unkeyed string or its key is still among the module's reads; it fails when the key it gave is no longer read. */
let retiredDecisions = 0;
const movedDecisions = [];
DECISIONS.forEach((d, i) => {
  if (used.has(i)) return;
  const [dm, , spec, target] = d;
  if (typeof target !== "string" || (out.modules[dm] && out.modules[dm].reads.includes(target))) { retiredDecisions++; return; }
  // DEC-345: the string and its key have both left the module (the screen moved): nothing a member reads is lost here.
  movedDecisions.push(`${i} (${dm}, ${target})`);
});
if (retiredDecisions) console.log(`${retiredDecisions} decisions retired: their modules now hold keys, not those strings`);
if (movedDecisions.length) console.log(`${movedDecisions.length} decisions moot: string and key both left the module: ${movedDecisions.join("; ")}`);
// DEC-260: the other modules, keyed in batches; each batch's words-reads-mod-<n>.json gives its modules' reads, unkeyed
// and renamed, and every key it lists must be a word as here.
for (const f of fs.readdirSync(HERE).filter((f) => /^words-reads-mod-\d+\.json$/.test(f)).sort()) {
  for (const [m, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(HERE, f), "utf8")))) {
    if (out.modules[m]) { problems.push(`${f}: ${m} is already listed`); continue; }
    for (const k of v.reads || []) if (!KEYS.has(k)) problems.push(`${f}: ${m} reads ${k}, which is not a word`);
    out.modules[m] = { reads: [...(v.reads || [])].sort(), counts: { reads: (v.reads || []).length, unkeyed: (v.unkeyed || []).length }, unkeyed: v.unkeyed || [],
      ...(v.renamed && Object.keys(v.renamed).length ? { renamed: v.renamed } : {}), ...(v.note ? { note: v.note } : {}), batch: "DEC-260" };
  }
}
// DEC-343 (B341): the words check names a module by its id in build/modules.json, so an entry listed by its file name
// (`ooxml.mjs`) goes under the module that owns that file (`ooxml`; `docx.mjs` under `office-readers`), merged with it.
{
  let owners = new Map();
  try {
    const mj = JSON.parse(fs.readFileSync(path.resolve(HERE, "../../../../build/modules.json"), "utf8")); // the tree's own, as the gate builds it
    for (const mod of mj.modules || mj) for (const p of mod.paths || []) if (/\.mjs$/.test(p)) owners.set(p.replace(/^bio-plane\/src\//, ""), mod.id);
  } catch (e) { problems.push(`build/modules.json could not be read (${e.message}): file-named entries keep their names`); }
  for (const name of Object.keys(out.modules).filter((k) => k.endsWith(".mjs"))) {
    const id = owners.get(name);
    if (!id || id === name) continue;
    const v = out.modules[name]; delete out.modules[name];
    const t = out.modules[id];
    if (!t) { out.modules[id] = { ...v, files: [name] }; continue; }
    const reads = Array.isArray(t.reads) && t.reads[0] === "*" ? t.reads : [...new Set([...(t.reads || []), ...(v.reads || [])])].sort();
    out.modules[id] = { ...t, reads, unkeyed: [...(t.unkeyed || []), ...(v.unkeyed || [])], files: [...(t.files || []), name] };
  }
}
// DEC-344 (B343): strings BOB's module jobs judged no member reads (K3970), hand-kept in words-reads-handoffs.json by
// module id, join that module's unkeyed list (a module with no entry yet gets one).
{
  const ho = JSON.parse(fs.readFileSync(path.join(HERE, "words-reads-handoffs.json"), "utf8")).modules;
  for (const [id, list] of Object.entries(ho)) {
    const t = out.modules[id] ??= { reads: [], counts: { reads: 0 }, unkeyed: [], batch: "DEC-344" };
    const have = new Set(t.unkeyed.map((u) => u.text));
    for (const u of list) if (!have.has(u.text)) { t.unkeyed.push(u); have.add(u.text); }
  }
}
fs.writeFileSync(path.join(HERE, "words-reads.json"), JSON.stringify(out, null, 1) + "\n");
const tot = Object.values(out.modules).reduce((a, v) => ({ reads: a.reads + (Array.isArray(v.reads) && v.reads[0] !== "*" ? v.reads.length : 0), unkeyed: a.unkeyed + v.unkeyed.length }), { reads: 0, unkeyed: 0 });
for (const [m, v] of Object.entries(out.modules)) console.log(m.padEnd(20), JSON.stringify(v.counts), v.retired ? "retired " + v.retired.length : "", v.renamed ? "renamed " + Object.keys(v.renamed).length : "");
console.log(`words-reads.json: ${Object.keys(out.modules).length} modules, ${tot.reads} keys read (setup-words "*"), ${tot.unkeyed} inline strings unkeyed, ${MINTED.size} keys minted (DEC-258)`);
/* A problem is design-stream triage drift (an untriaged string, a word not yet keyed): the design lane's own run fails on it;
   the `generated` row's build (--build) writes the file and reports it, so a job's gate is never red for the design stream's work. */
if (problems.length) { console.error(problems.length + " problem(s):\n" + problems.join("\n")); process.exit(BUILD ? 0 : 1); }
console.log("All keys read are words; every inline string is keyed or stated unkeyed.");
