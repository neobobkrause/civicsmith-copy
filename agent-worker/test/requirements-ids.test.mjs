/* agent-worker — the requirements file's ids, kept through the consolidation and the agent-drafts split (4 Nov 2026).
 *
 * build/requirements/agent-worker.md was brought under the 70,000-byte cap by moving non-requirement text to
 * docs/requirements-notes/agent-worker.md and by retiring the seven POST /draft lines moved to agent-drafts
 * (R59, R68, R69, R70, R76, R77, R86 -> agent-drafts R1-R7). START is every R and F id at the start commit
 * (d837b6d9), with its mark (null when met, "retired", or the not-yet-met text) and a digest of its whole line.
 *
 * ADMITTED is each found mark added since (5 Nov 2026: F2-F4, BOB's attempt 4), with the mark it was added under and a
 * digest of its text after the mark, so the mark may be struck when met but the finding itself is never reworded.
 * (Attempt 7, coordinator ruling 5 Nov 20:18: F2-F4 moved out of Open for Bob into this module's own marks, reopened
 * under that ruling's mark, their text unchanged.) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const CAP = 70000;
const MOVED = { R59: "R1", R68: "R2", R69: "R3", R70: "R4", R76: "R5", R77: "R6", R86: "R7" };
const START = {
  R1: [null, "9702593aa3fe9ff9"],
  R2: [null, "91099baca346df52"],
  R3: [null, "fa3a107b64a30895"],
  R4: [null, "dfbeeebe1a679fe2"],
  R5: [null, "129694ce5273306f"],
  R6: ["not yet met: T53", "fa0c0ab97187a2c9"],
  R7: [null, "3af663c9a7ec7f72"],
  R8: [null, "4e8072fd12373858"],
  R9: ["retired", "76ebbb77df971fab"],
  R10: ["retired", "62a909096542f132"],
  R11: ["retired", "bd4503e05d1c1b6b"],
  R12: ["retired", "66f5f8bb8255bbe6"],
  R13: ["retired", "bf488cb715bc2289"],
  R14: ["retired", "8a21b02c1b6b11ae"],
  R15: ["retired", "0e0b395701351a70"],
  R16: ["retired", "7d7aaea0d463af65"],
  R17: ["retired", "9dc4f4a31250fe2e"],
  R18: ["retired", "2fcc825aba03c0d3"],
  R19: ["retired", "77f838cbd9d83f1a"],
  R20: ["retired", "840d512864b81bdc"],
  R21: ["retired", "dba0420b49e962fa"],
  R22: ["retired", "b9a10cf6ee30fe76"],
  R23: ["retired", "fab7886206bdd98c"],
  R24: ["retired", "996589776840fd1a"],
  R25: ["retired", "459c77d10be54012"],
  R26: ["retired", "d68d4cf4b96e8a49"],
  R49: ["retired", "f2cf5f391c995d67"],
  R27: ["retired", "fdd420b22c7b64fd"],
  R50: ["retired", "b70b027edc7b8155"],
  R51: ["retired", "631ea8bce89fed9c"],
  R52: ["retired", "98b51f5f51e9e202"],
  R53: [null, "4251e70f7cbf2d91"],
  R28: ["not yet met: T53", "cf40b36c2ee3c645"],
  R29: ["not yet met: T53", "f1f31100c1c60cfa"],
  R30: ["not yet met: T53", "4285eb9a01f292ed"],
  R31: [null, "2e32eed57ebd7d50"],
  R32: ["not yet met: T53", "fec1f962b87cf0c9"],
  R33: ["not yet met: T53", "fcbd43fead9e73e0"],
  R71: ["not yet met: T53", "0f1cca5a7412f447"],
  R34: ["not yet met: T53", "5a810b23367cb58c"],
  R54: ["not yet met: T53", "ce956568da343ce8"],
  R55: ["not yet met: T53", "37953f0b5ea916bd"],
  R89: [null, "645a977e11383773"],
  R90: ["retired", "834963d35a1d9315"],
  R56: ["not yet met: T53", "5a81e5f3a6d70ad9"],
  R57: ["not yet met: T53", "74cf5add62d60a71"],
  R58: ["not yet met: T53", "86436583f94426dc"],
  R59: ["not yet met: T53", "eacb266a5f1a5c69"],
  R68: [null, "7a0fbaffd3f8587a"],
  R69: [null, "06558371c3520fc2"],
  R70: ["not yet met: T53", "f0aff44169483be7"],
  R76: [null, "5a85fcd208fae895"],
  R77: [null, "12209d6a7a4c4d22"],
  R78: ["retired", "357a40f8c0ee0b41"],
  R72: ["not yet met: T53", "66937afb98cdd624"],
  R73: ["not yet met: T53", "946fe8682003fd08"],
  R74: ["not yet met: T53", "722337dbdd2ddb5e"],
  R75: [null, "0e8398ba786da7b7"],
  R66: ["not yet met: T53", "7e4583bb32da4192"],
  R67: ["not yet met: T53", "2c6795881d1f462f"],
  R60: [null, "58adba3f614a1514"],
  R61: [null, "57495ba38aff1739"],
  R62: [null, "1c9df8ff391fdf96"],
  R63: [null, "05ddf4417cb9bbba"],
  R64: ["not yet met: T53", "4c0dd0ff4e4c4260"],
  R79: [null, "8505d516ba07757c"],
  R80: ["retired", "d6034d0a6b09dd82"],
  R88: ["retired", "5fdaa8673124dd58"],
  R81: ["not yet met: T53", "f2cc8fea4883fe91"],
  R82: ["not yet met: T53", "6ac7ef1ee429a7c1"],
  R83: ["not yet met: T53", "7dcf3df17d714af0"],
  R84: ["not yet met: T53", "2659c7725f7e7825"],
  R85: ["not yet met: T53", "49ffbdaf3f000698"],
  R86: ["not yet met: T53", "e9bb694eeaa5f0a1"],
  R87: [null, "25001ca6381b2f05"],
  R91: ["not yet met: T53", "167b1e1ef6b5139e"],
  R92: ["retired", "c71444253d958ffd"],
  R93: [null, "8ebafc6ea4157683"],
  R94: ["retired", "911328e0ae860adb"],
  R95: ["retired", "12fef063f9a3ff35"],
  R96: ["retired", "9c7b08c2cb0b9a77"],
  R97: ["retired", "99a94d97bab5faa4"],
  R98: ["retired", "e165554eb77efd21"],
  R99: ["retired", "26f656d550cbadb2"],
  R100: ["retired", "831abdd856a66c8c"],
  R101: ["retired", "07f92d962edd9b0d"],
  R102: ["retired", "456c6aa7f3359eba"],
  R103: ["retired", "5778973661c66095"],
  R104: ["retired", "56916b59ecc8fed2"],
  R105: ["retired", "81fcb232f259b3dc"],
  R106: ["retired", "d3f09b9f2937db6b"],
  R120: ["not yet met: T53", "fa40a77c52436334"],
  R121: ["not yet met: T53", "d2e84b603c87923a"],
  R122: ["not yet met: T53", "3803a42878eeee59"],
  R123: ["not yet met: T53", "a52255fd1634b8a1"],
  R124: ["not yet met: T53", "3e85b48327c1171d"],
  R125: ["not yet met: T53", "011f93427b8abf60"],
  R126: ["not yet met: T53", "7166f059df27321f"],
  R127: ["not yet met: T53", "02fe9dafc885c17c"],
  R128: ["not yet met: T53", "1965e20ddd3e32a4"],
  R35: ["not yet met: T53", "c70868e47e9ce8df"],
  R36: ["not yet met: T53", "0676a9c8ff9277eb"],
  R37: ["not yet met: T53", "8f317d2ae53dcd90"],
  R38: ["retired", "ba61a92d51c3736e"],
  R39: ["retired", "69f05038d8c07343"],
  R40: ["retired", "53939afd8bd926ac"],
  R41: ["retired", "456c7b0bf64efe15"],
  R42: [null, "197455396376af46"],
  R43: [null, "0c8368bb9a2d6413"],
  R44: [null, "8f5f98c951a08a85"],
  R45: [null, "ad2887a37f5a0391"],
  R46: [null, "dae5bd451ab03e7f"],
  R47: [null, "194b9e6f6dfe4001"],
  R65: [null, "d7165ed166c40a9b"],
  R48: [null, "ad84e2d07c9b9f93"],
  R107: ["retired", "41c3d40141489c3d"],
  R108: ["retired", "5b117960358ddb34"],
  R109: ["not yet met: T53", "064c77d0f66ebf55"],
  R110: ["not yet met: T53", "d155c6338d75500d"],
  R111: ["not yet met: T50", "9ffb87acc56d4aff"],
  R112: ["not yet met: T53", "63cfc6116103bb24"],
  R113: [null, "d85b669231441c0b"],
  R114: ["retired", "0ab5135f0e459ee2"],
  R115: ["retired", "84205f2d560e3dc3"],
  R116: ["retired", "62560f10720e10db"],
  R117: ["retired", "eb68a7d76a5c7fb9"],
  R118: ["retired", "2868a63ab06d0c6e"],
  R119: [null, "acbb9f9105b59c7f"],
  F1: ["not yet met: walk p3dev-l1", "ff088529553c9baa"],
};

/* F1 struck by BOB's ruling (5 Nov 2026, 03:13): the rollout check is bundler's (its F2), R47 unchanged. Its line
   keeps its finding word for word after the note that replaced the mark. */
const MOVED_OUT = { F1: "(moved to bundler F2, coordinator ruling 5 Nov 2026)" };

const ADMITTED = {
  F2: ["not yet met: coordinator ruling 5 Nov 20:18", "a3ff85819faf6c0f"],
  F3: ["not yet met: coordinator ruling 5 Nov 20:18", "0c742c78c3eb6ec9"],
  F4: ["not yet met: coordinator ruling 5 Nov 20:18", "d869859058702ae8"],
  /* F5: BOB's ruling 6 Nov 03:33, added here already met (PR 616 closed unmerged); its test is f2-runner-bound's F5. */
  F5: ["not yet met: coordinator ruling 5 Nov 20:18, restated 6 Nov 03:33", "7bfff2655168d558"],
};

const LINE = /^- \*\*([RF]\d+)\*\*(?: \*\((not yet met: [^)]*|retired[^*]*)\)\*)?/;
function idsOf(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = LINE.exec(line);
    if (!m) continue;
    assert.equal(out[m[1]], undefined, `${m[1]} appears twice`);
    out[m[1]] = { line, mark: m[2] ? (m[2].startsWith("retired") ? "retired" : m[2]) : null };
  }
  return out;
}
const digest = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

const file = read("build/requirements/agent-worker.md");
const now = idsOf(file);
const drafts = idsOf(read("build/requirements/agent-drafts.md"));

test("the requirements file is under the cap", () => {
  assert.ok(Buffer.byteLength(file) <= CAP, `${Buffer.byteLength(file)} bytes`);
});

test("the set of R and F ids is unchanged by the consolidation, but for the admitted found marks", () => {
  assert.deepEqual(Object.keys(now).sort(), [...Object.keys(START), ...Object.keys(ADMITTED)].sort());
});

test("each admitted found mark is open under the mark it was added with, or struck, and its finding is unchanged", () => {
  for (const [id, [mark, hash]] of Object.entries(ADMITTED)) {
    assert.ok(now[id], `${id} missing`);
    assert.ok(now[id].mark === null || now[id].mark === mark, `${id} mark ${now[id].mark}`);
    const text = now[id].line.replace(/^- \*\*F\d+\*\* (?:\*\([^)]*\)\* )?/, "");
    assert.equal(digest(text), hash, `${id} finding changed`);
  }
});

test("every id not moved keeps its line verbatim, and so its mark", () => {
  for (const [id, [mark, hash]] of Object.entries(START)) {
    if (MOVED[id] || MOVED_OUT[id]) continue;
    assert.equal(now[id].mark, mark, `${id} mark`);
    assert.equal(digest(now[id].line), hash, `${id} line changed`);
  }
});

test("the unmet marks are unchanged but for the moved ids, which agent-drafts now carries", () => {
  /* MOVED_OUT (F1, BOB's ruling) and ADMITTED (F2-F4) are excluded; agent-drafts PR 358 struck the moved ids' marks there. */
  const unmet = (o, f) => Object.entries(o).filter(([id, v]) => f(v) && !MOVED[id] && !MOVED_OUT[id] && !ADMITTED[id]).map(([id]) => id).sort();
  assert.deepEqual(unmet(now, (v) => v.mark && v.mark !== "retired"), unmet(START, ([m]) => m && m !== "retired"));
});

test("every moved id is retired here naming its agent-drafts id, and exists there with its start mark", () => {
  for (const [old, neu] of Object.entries(MOVED)) {
    assert.equal(now[old].mark, "retired", `${old} not retired`);
    assert.ok(now[old].line.includes(`agent-drafts:${neu}`), `${old} names agent-drafts:${neu}`);
    assert.ok(drafts[neu], `agent-drafts ${neu} missing`);
    assert.ok(drafts[neu].line.includes(`moved from agent-worker:${old}`), `agent-drafts ${neu} names ${old}`);
    /* agent-drafts may since have met the mark it carried over (R1, R4, R7, PR 358): open as at start, or struck. */
    assert.ok(drafts[neu].mark === START[old][0] || drafts[neu].mark === null, `agent-drafts ${neu} mark is ${old}'s at start or met`);
  }
});

test("each retired id here that names agent-drafts is one of the moved ids", () => {
  for (const [id, v] of Object.entries(now)) {
    /* Only retired lines: F4's finding names agent-drafts PR 358 (agent-drafts:358) without having moved. */
    if (v.mark === "retired" && v.line.includes("agent-drafts:")) assert.ok(MOVED[id], `${id} names agent-drafts but did not move`);
  }
});

test("F1 is struck as moved to bundler F2, its finding unchanged", () => {
  for (const [id, note] of Object.entries(MOVED_OUT)) {
    assert.equal(now[id].mark, null, `${id} still carries a mark`);
    const was = `- **${id}** *(${START[id][0]})* `;
    const finding = now[id].line.slice(`- **${id}** ${note} `.length);
    assert.ok(now[id].line.startsWith(`- **${id}** ${note} `), `${id} carries the note`);
    assert.equal(digest(was + finding), START[id][1], `${id} finding changed`);
  }
});
