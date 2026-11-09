/* The arms of fleetbundles' negative control (bundler F3), as data: `bio-plane/test/fleetbundles.control.mjs` applies each
 * to the real tree, runs `test/system/fleetbundles.test.mjs`, restores by content and sha256, and grades the run; and
 * `f3-control.test.mjs` holds the table itself. Pure: nothing here touches a file.
 *
 * Since the dist pass (PR 624) the suite reads no `dist/`: it builds every guarded bundle and the plane into its own
 * temp dir and builds a second time to compare. So the only changes that can fail it are a source change that breaks a
 * build, a recipe change that makes two builds differ or drops a recipe flag, a member that stops declaring its bundle,
 * and the remedy text its synthetic subject hands a reader. The arms that edited a committed artifact or expected a
 * source edit to stale one (the old 1, 1b, 2, 2-noinstall, 2b, 3, 5, 6, 6b, 8) are retired: no such artifact exists.
 *
 * An arm is { id, label, file (repo-relative), edit(text) -> text, expect: "fail" | "pass", names, holds, mayDie? }:
 * `names` are strings the suite's output must contain, `holds` strings it must not. `mayDie` is set on the arms that break
 * agent-worker's or ocr-worker's build: the suite builds those two again, unguarded, in its section 2a, and stops there on
 * an uncaught build error (exit 1, no tally), after naming the member that did not build. */

export const SYNTAX_BREAK = "\nexport const __p3ControlBroken = ;\n";

/** Replace `from` with `to`, refusing unless `from` occurs exactly once: an arm that matched nothing armed nothing. */
export function replaceOnce(text, from, to) {
  const hits = text.split(from).length - 1;
  if (hits !== 1) throw new Error(`the anchor occurs ${hits} time(s), not once: ${JSON.stringify(from.slice(0, 80))}`);
  return text.replace(from, () => to);
}

const RECIPE = "bio-plane/scripts/fleet-bundle.mjs";
const REMEDY_NOW = 'const REBUILD = "Run `node bio-plane/scripts/bundles.mjs` from the repository root, "';
const fails = (prefix) => `FAIL  ${prefix}`;

export const ARMS = [
  {
    id: "baseline", label: "nothing armed: the suite is green on the tree as it stands",
    file: null, edit: null, expect: "pass", names: ["fleetbundles: "], holds: ["FAIL  "],
  },
  {
    id: "1", label: "a NON-entry module of agent-worker's build, across trees (agent-harness/src/harness.mjs), no longer parses",
    file: "agent-harness/src/harness.mjs", edit: (t) => t + SYNTAX_BREAK, expect: "fail",
    names: ["agent-worker: its bundle did not build", "../agent-harness/src/harness.mjs"], mayDie: true,
    holds: [fails("pdf-worker:"), "pdf-worker: its bundle did not build", "bio-plane: its bundle did not build"],
  },
  {
    id: "2", label: "pdf-worker's own entry (pdf-worker/src/index.mjs) no longer parses",
    file: "pdf-worker/src/index.mjs", edit: (t) => t + SYNTAX_BREAK, expect: "fail",
    names: ["pdf-worker: its bundle did not build"], mayDie: true,
    holds: [fails("agent-worker:"), "agent-worker: its bundle did not build", "bio-plane: its bundle did not build"],
  },
  {
    id: "2b", label: "a PLANE source four bundles build (bio-plane/src/pdfstructure.mjs) no longer parses: "
      + "the plane, agent-worker, pdf-worker and ocr-worker each fail to build, by name, and sheet-worker does not",
    file: "bio-plane/src/pdfstructure.mjs", edit: (t) => t + SYNTAX_BREAK, expect: "fail",
    names: ["bio-plane: its bundle did not build", "pdf-worker: its bundle did not build", "ocr-worker: its bundle did not build",
      "agent-worker: its bundle did not build"], mayDie: true,
    holds: ["sheet-worker: its bundle did not build", "agent-runner: its bundle did not build", "file-scanner: its bundle did not build"],
  },
  {
    id: "4", label: "pdf-worker's marker drops its `bundle` block: a member that stops declaring itself is named, never unguarded",
    file: "pdf-worker/fleet-member.json",
    edit: (t) => { const o = JSON.parse(t); if (!o.bundle) throw new Error("the marker has no bundle block to drop"); delete o.bundle; return JSON.stringify(o, null, 2) + "\n"; },
    expect: "fail",
    names: [fails("every discovered member declares one")],
    holds: [fails("agent-worker:")],
  },
  {
    id: "5", label: "the recipe stops reproducing: every build carries a different banner, so two builds of unchanged source differ",
    file: RECIPE,
    edit: (t) => replaceOnce(t, "    metafile: true,\n",
      '    metafile: true, banner: { js: "var __p3Control = " + JSON.stringify(String(Math.random())) + ";" },\n'),
    expect: "fail",
    names: [fails("agent-worker: a fresh build of"), fails("pdf-worker: a fresh build of"), fails("bio-plane: a fresh build of")],
    holds: ["its bundle did not build"],
  },
  {
    id: "9", label: "the recipe drops `preserveSymlinks`: the recipe assertion fails for every guarded bundle and the plane, "
      + "though a real install's bytes do not move",
    file: RECIPE, edit: (t) => replaceOnce(t, "    preserveSymlinks: true,", "   "), expect: "fail",
    names: [fails("pdf-worker: its build recipe preserves symlinks"), fails("agent-worker: its build recipe preserves symlinks"),
      fails("bio-plane: its build recipe preserves symlinks")],
    holds: [fails("agent-worker: a fresh build of"), "its bundle did not build"],
  },
  {
    id: "10", label: "the one remedy constant every staleness finding carries goes back to the one-bundle `npm run build`",
    file: RECIPE,
    edit: (t) => replaceOnce(t, REMEDY_NOW, 'const REBUILD = "Run `npm run build` in the member\'s own directory, "'),
    expect: "fail",
    names: [fails("(j) TOTAL: every finding the armed states produced names that remedy"), fails("(j) and at least four DO name"),
      fails("(j) NONE of them names the one-bundle command")],
    holds: [fails("(b) and says it is a STALE BUNDLE"), "its bundle did not build"],
  },
  {
    id: "10b", label: "over-strictness: the remedy constant reworded around the SAME command must pass",
    file: RECIPE,
    edit: (t) => replaceOnce(t, REMEDY_NOW, 'const REBUILD = "Rebuild with `node bio-plane/scripts/bundles.mjs`, from the repository root, "'),
    expect: "pass", names: ["fleetbundles: "], holds: ["FAIL  "],
  },
  {
    id: "10c", label: "over-strictness: a plain comment in the recipe naming `npm run build` is not a remedy and must pass",
    file: RECIPE,
    edit: (t) => t + "\n/* F3 over-strictness probe: a member is built by npm run build in its own directory. */\n",
    expect: "pass", names: ["fleetbundles: "], holds: ["FAIL  "],
  },
];

/** Grade one run of the suite against its arm: [] when it behaved as declared, else what did not. */
export function grade(arm, { status, out }) {
  const wrong = [];
  const tally = /fleetbundles: (\d+) pass, (\d+) fail/.exec(out);
  if (!tally && !(arm.mayDie && status !== 0 && status !== null)) wrong.push("the suite printed no tally: it died rather than failing");
  if (arm.expect === "pass" && status !== 0) wrong.push(`exit ${status}, want 0`);
  if (arm.expect === "fail" && status === 0) wrong.push("exit 0: the armed change did not fail the suite");
  for (const n of arm.names) if (!out.includes(n)) wrong.push(`missing: ${n}`);
  for (const h of arm.holds) if (out.includes(h)) wrong.push(`should hold, but present: ${h}`);
  return wrong;
}
