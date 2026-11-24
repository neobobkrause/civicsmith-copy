/* case-checker — the standalone program's entry (requirements: `build/requirements/case-checker.md` R13, R16).
 *
 * Bundled with `checkCaseFile` and nothing else into one file (`./build-program.mjs`), it runs offline with nothing to
 * install: `node case-checker.mjs <part> [<part> ...] [--document <file> ...] [--keys <file>] [--lens <lens>]`. It reads the files a
 * person names, runs the same `checkCaseFile` Civicsmith runs, and prints each finding's result first, then the whole
 * answer as JSON; a departure in how the case uses its standards (R26) is also printed as a sentence, from the word rows the program carries as data. `--keys` names a file of the group's published keys, one OpenSSH public key per line. `--lens` (R23)
 * is `as_published`, `removed`, or a file holding a reader's own lens as JSON, `{statements, applications}`. It makes no
 * network request. Its exit status is 0 when the check ran, whatever the results, and 2 when it could not read its
 * arguments. */

import { checkCaseFile, RESULT_WORDS } from "./check.mjs";
import { word, hasWord, localize } from "../setup-words/index.mjs";

/** R26: a departure's `says` as a sentence: the English `setup-words` holds for its key, each `{name}` filled from `vars`.
 *  Null when the program holds no words for the key. */
const sentenceOf = (says) => {
  try { return says && hasWord(says.key) ? word(says.key, says.vars) : null; } catch { return null; }
};

/** R13: the program, given its arguments and a way to read a file; answers the text it prints and its exit status. */
export async function runProgram(argv, readFile) {
  const parts = [], documents = [];
  let keys = null, lens;
  const usage = "usage: node case-checker.mjs <part> [<part> ...] [--document <file> ...] [--keys <file>] [--lens as_published|removed|<file>]";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    try {
      if (a === "--document") documents.push(await readFile(argv[++i]));
      else if (a === "--keys") keys = new TextDecoder().decode(await readFile(argv[++i])).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
      else if (a === "--lens") {
        const v = argv[++i];
        if (v === undefined) throw new Error("--lens names no lens");
        lens = v === "as_published" || v === "removed" ? v : JSON.parse(new TextDecoder().decode(await readFile(v)));
      }
      else if (a === "--help" || a === "-h") return { text: usage + "\n", status: 0 };
      else parts.push(await readFile(a));
    } catch (e) {
      return { text: word("case-checker.text.read", { path: argv[i] ?? localize("case-checker.main.an_argument", "an argument"), error: String(e && e.message ? e.message : e), detail: usage }) + "\n", status: 2 };
    }
  }
  if (!parts.length) return { text: usage + "\n", status: 2 };
  const answer = await checkCaseFile({ parts, documents, ...(keys ? { keys } : {}), ...(lens !== undefined ? { lens } : {}) });
  const lines = answer.findings.map((f) => `${f.finding}: ${RESULT_WORDS[f.result] ?? f.result}`);
  /* R26: each standards-use departure in the members' words, as the ceremony draws it */
  for (const r of answer.standards_use?.refusals ?? []) { const s = sentenceOf(r.says); if (s) lines.push(s); }
  return { text: [...lines, "", answer.statement, "", JSON.stringify(answer, null, 2), ""].join("\n"), status: 0 };
}

/* Run when this file is the program Node was started with (never in a Worker, and never when imported). */
const proc = globalThis.process;
if (proc && proc.versions && proc.versions.node && Array.isArray(proc.argv) && typeof proc.argv[1] === "string") {
  const { resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  if (import.meta.url.startsWith("file:") && fileURLToPath(import.meta.url) === resolve(proc.argv[1])) {
    const fs = await import("node:fs/promises");
    const out = await runProgram(proc.argv.slice(2), (p) => fs.readFile(p).then((b) => new Uint8Array(b)));
    proc.stdout.write(out.text);
    proc.exitCode = out.status;
  }
}
