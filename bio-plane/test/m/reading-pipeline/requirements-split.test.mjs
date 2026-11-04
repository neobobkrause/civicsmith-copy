/* reading-pipeline's requirements file after BOB's split into `reader-contract` (4 Nov 2026, PR 274) and its consolidation under
   the requirements cap: the ids and the unmet marks of `build/requirements/reading-pipeline.md` and `reader-contract.md` together are
   exactly those of `reading-pipeline.md` at the job's start commit (1115f89f), each requirement line word for word, R45–R58 and R60–R67
   in `reader-contract.md` and the rest here. The lines are read with the process's one parser of a requirement line (a line starting
   with `**R<n>**` or `**F<n>**` after an indent and one list marker; unmet when it holds `*(not yet met`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const LINE = /^[ \t]*(?:[-*+][ \t]+|\d+\.[ \t]+)?\*\*([RF][\w.-]+)\*\*[^\r\n]*/gm;
const lines = (text) => [...text.matchAll(LINE)].map((m) => ({ id: m[1], line: m[0], unmet: m[0].includes("*(not yet met") }));
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/* at the start commit: every requirement line's id with the sha-256 (16 hex) of the whole line, and the unmet ids */
const START = {"R24":"e19380ce9b6427d0","R1":"a5eb42fea5599c8c","R2":"ba19fb4ff9bc638e","R32":"e078a1446ff27675","R33":"433dd44cbe7357d2","R34":"b1dcf55fde9a861d","R3":"93ca286926086ea7","R4":"5b9693953cb08d3e","R5":"a41fe5624810a2c8","R6":"4d2ca092ab485956","R7":"bae9a69731341437","R8":"a15660951b9be678","R9":"0ecf2eff23f86b14","R10":"a0ddbb1b5f472599","R11":"e5d6b09b789d6ddb","R12":"8c073865db90c22e","R13":"c55238f26e4b5085","R14":"bbfd7c254b8f0d19","R17":"8e6b259d552fb789","R15":"c80e684002be6c0e","R16":"0da9d226956752a9","R18":"2bd1590092d7168f","R19":"690416b493fdcb42","R23":"5757bb9e2fcde0e0","R30":"4f5bad15deba8c58","R25":"d0884d9bd432698c","R26":"1846d05ea2642450","R27":"e279827a9415e48b","R28":"5a68d9699cc9f4b6","R29":"aec642a044ebcbfa","R31":"200bb6e24878b923","R35":"be66beb7fb7362d9","R36":"e6d42638bdb09c0e","R37":"c836fc895860e3d7","R38":"1959ec5dd096b5c2","R39":"66b318b9deaee972","R40":"6b049eb28e438144","R41":"37929c1792706a06","R42":"9974f4c7a939d637","R43":"380fe29601772e6a","R45":"64bcf55761abbd5c","R46":"3362ee4b6360fb49","R47":"d6a2301833f4d124","R48":"110032dcbfc2e8a9","R49":"005677b6c1682add","R50":"ac08e82fff7d1182","R51":"a84f79cddbfa537f","R60":"e0de8e1cce31e7fc","R61":"633dcb9e4d724a2f","R62":"bcc9b569ee5b50f6","R52":"2f33f4fe4e80ec85","R53":"9503bb8c23a6a999","R54":"138b8c8c10d9fa12","R55":"7d675dc2cc657a71","R56":"980eaa873da1b1f7","R57":"af8cb15a6c6f1a71","R58":"c9c9c0ddaf0c4d37","R59":"aab0554bdd5d2bdf","R63":"294571d327c9a7f7","R64":"64c0752e9ce31d37","R65":"753d5a1b44fe3bd1","R66":"8c6734ad51688b49","R67":"50e614cca5e5aae7","R68":"d3fdf812b4dbd63c","R20":"c62f8ad82248b291","R21":"155228500130b4d2","R22":"61474aa245ab2716"};
const START_UNMET = ["R68"];
/* the line carrying R44's text, R28's amendment and R23's (no id first on its line), kept word for word */
const G41_LINE = "cf65a562a1983338";
const MOVED = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 60, 61, 62, 63, 64, 65, 66, 67].map((n) => `R${n}`);

test("split and consolidation: the ids and unmet marks of reading-pipeline.md and reader-contract.md together equal reading-pipeline.md's at the start commit, every line word for word", () => {
  const rp = lines(read("build/requirements/reading-pipeline.md"));
  const rc = lines(read("build/requirements/reader-contract.md"));
  const all = [...rp, ...rc];
  assert.deepEqual(all.map((l) => l.id).sort(), Object.keys(START).sort(), "the same ids, none lost or added");
  assert.equal(new Set(all.map((l) => l.id)).size, all.length, "no id in both files");
  assert.deepEqual(all.filter((l) => l.unmet).map((l) => l.id).sort(), [...START_UNMET].sort(), "the same unmet marks");
  for (const l of all) assert.equal(hash(l.line), START[l.id], `${l.id} is word for word`);
  assert.deepEqual(rc.map((l) => l.id).sort(), [...MOVED].sort(), "reader-contract holds R45–R58 and R60–R67");
  assert.ok(read("build/requirements/reading-pipeline.md").split("\n").some((l) => hash(l) === G41_LINE), "R44's line is kept word for word");
});

test("split and consolidation: reading-pipeline.md is under the requirements cap (70,000 bytes), and its history is kept in the notes", () => {
  const cap = Number(JSON.parse(read("process/config.json")).requirements_cap ?? 70000);
  assert.ok(Buffer.byteLength(read("build/requirements/reading-pipeline.md")) <= cap);
  assert.ok(Buffer.byteLength(read("build/requirements/reader-contract.md")) <= cap);
  const notes = read("docs/requirements-notes/reading-pipeline.md");
  assert.match(notes, /\*\*Size \(P6\)\.\*\*/);
  assert.match(notes, /## Decided by BOB/);
  assert.equal(lines(notes).length, 0, "the notes hold no requirement line");
});
