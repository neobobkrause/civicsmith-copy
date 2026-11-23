/* bundler's provenance check over a throwaway git repository: proves R9 (for a set of files, each is stated committed and
 * unchanged, changed, staged or untracked, and reported; where git cannot answer, UNVERIFIED, never clean). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  readGitProvenance, stateOf, contentStateOf, classifyDiscovered, reportProvenance, repoPath,
} from "../../../../scripts/provenance.mjs";
import { scratch, git } from "./fixture.mjs";

test("R9: each file is stated committed and unchanged, changed (edited, staged edit, deleted), staged and not committed, or untracked, and reported naming each", () => {
  const { root, done } = scratch("r9");
  try {
    git(root, "init", "-q");
    mkdirSync(join(root, "sub"));
    for (const f of ["same.txt", "edited.txt", "sub/deleted.txt", "staged-edit.txt"]) writeFileSync(join(root, f), `${f}\n`);
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "c1");
    writeFileSync(join(root, "edited.txt"), "moved\n");
    rmSync(join(root, "sub/deleted.txt"));
    writeFileSync(join(root, "staged-edit.txt"), "staged change\n");
    git(root, "add", "staged-edit.txt");
    writeFileSync(join(root, "staged.txt"), "s\n");
    git(root, "add", "staged.txt");
    writeFileSync(join(root, "loose.txt"), "u\n");

    const prov = readGitProvenance(root);
    assert.match(prov.headSha, /^[0-9a-f]{4,}$/);
    const want = {
      "same.txt": ["in the commit", "unchanged"],
      "edited.txt": ["in the commit", "changed"],
      "sub/deleted.txt": ["in the commit", "changed"],
      "staged-edit.txt": ["in the commit", "changed"],
      "staged.txt": ["staged, not yet committed", null],
      "loose.txt": ["UNTRACKED", null],
    };
    for (const [p, [state, content]] of Object.entries(want))
      assert.deepEqual([stateOf(prov, p), contentStateOf(prov, p)], [state, content], p);
    assert.equal(repoPath(root, join(root, "sub", "deleted.txt")), "sub/deleted.txt");

    const items = Object.keys(want).map((path) => ({ path, what: `the file ${path}`, counted: "one item" }));
    const c = classifyDiscovered(prov, items);
    assert.deepEqual([c.verified, c.accounted, c.headSha], [true, 6, prov.headSha]);
    assert.deepEqual(c.off.map((r) => r.path).sort(), ["loose.txt", "staged.txt"]);
    assert.deepEqual(c.changed.map((r) => r.path).sort(), ["edited.txt", "staged-edit.txt", "sub/deleted.txt"]);
    assert.deepEqual(c.inCommit.sort(), ["edited.txt", "same.txt", "staged-edit.txt", "sub/deleted.txt"]);

    const lines = [];
    const rc = reportProvenance({ prov, items, instrument: "the probe", corpus: "6 files",
      totals: [{ label: "items", contaminated: 6, reproducible: 4, source: "files" }], log: (x) => lines.push(x) });
    const out = lines.join("\n");
    assert.deepEqual(rc.rows, c.rows);
    assert.match(out, new RegExp(`^provenance: 4 of 6 discovered item\\(s\\) are in the commit at HEAD \\(${prov.headSha}\\) · 6 files`));
    assert.match(out, /loose\.txt\s+\(UNTRACKED\) — the file loose\.txt: one item/);
    assert.match(out, /staged\.txt\s+\(staged, not yet committed\)/);
    for (const p of ["edited\\.txt", "staged-edit\\.txt", "sub/deleted\\.txt"]) assert.match(out, new RegExp(`${p}\\s+\\(changed since the commit\\)`), p);
    assert.match(out, /6 items were counted above; 4 of them come from files/, "the reproducible total is printed beside the counted one");
    assert.doesNotMatch(out, /same\.txt/, "an unchanged committed file needs no line");

    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "c2");
    const clean = [];
    const cc = reportProvenance({ prov: readGitProvenance(root), items: items.filter((i) => i.path !== "sub/deleted.txt"),
      instrument: "the probe", log: (x) => clean.push(x) });
    assert.equal(clean.length, 1, "all committed and unchanged: one line");
    assert.match(clean[0], /^provenance: 5 of 5 discovered item\(s\) are in the commit/);
    assert.deepEqual([cc.off, cc.changed], [[], []]);
  } finally { done(); }
});

test("R9: where git cannot answer (not a repository), every file is UNVERIFIED and the report says so, never clean", () => {
  const { root, done } = scratch("r9none");
  const ceiling = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = dirname(root);   /* git may not look above the fixture for a repository */
  try {
    writeFileSync(join(root, "a.txt"), "a");
    const prov = readGitProvenance(root);
    assert.deepEqual([prov.inHead, prov.inIndex, prov.changed, prov.headSha], [null, null, null, ""]);
    assert.deepEqual([stateOf(prov, "a.txt"), contentStateOf(prov, "a.txt")], ["UNVERIFIED", "UNVERIFIED"]);
    const c = classifyDiscovered(prov, [{ path: "a.txt", what: "w", counted: "c" }]);
    assert.deepEqual([c.verified, c.accounted, c.off, c.changed, c.inCommit], [false, 1, [], [], []], "nothing claimed either way");
    const lines = [];
    reportProvenance({ prov, items: [{ path: "a.txt", what: "w", counted: "c" }], instrument: "x", log: (x) => lines.push(x) });
    assert.match(lines.join("\n"), /^provenance: UNVERIFIED over all 1 discovered item\(s\) — git could not answer/);
    assert.doesNotMatch(lines.join("\n"), /are in the commit/);
  } finally {
    if (ceiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES; else process.env.GIT_CEILING_DIRECTORIES = ceiling;
    done();
  }
});

test("R9: a repository with no commit yet cannot answer ls-tree HEAD, so its files are UNVERIFIED, not untracked", () => {
  const { root, done } = scratch("r9empty");
  try {
    git(root, "init", "-q");
    writeFileSync(join(root, "a.txt"), "a");
    git(root, "add", "a.txt");
    const prov = readGitProvenance(root);
    assert.equal(stateOf(prov, "a.txt"), "UNVERIFIED");
    assert.equal(classifyDiscovered(prov, [{ path: "a.txt", what: "w", counted: "c" }]).verified, false);
  } finally { done(); }
});
