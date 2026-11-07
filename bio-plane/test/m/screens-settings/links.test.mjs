/* Every link a Settings screen draws opens a registered screen (BOB, 4 Nov, coordinator audit 17:23: Settings linked `/app/aimine` and
   `/app/aiproviders`, screens-ai's, while screens-ai has no paths and registers no screen). A screen is registered when a screens module the
   plane serves holds it in its `SCREENS`: the screens modules with paths in build/modules.json, the set control-plane composes the page
   from (interface-shell R28). The page is this module's screens with stand-ins for `watching` and `leads`, whose doors are drawn only where
   the shell knows their acts (R17's C91), as settings.test.mjs does; the whole composed page is not booted, as it does not build today
   (screens-daily's `queue` names the retired `projectkeyset`, which OPS does not hold). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { all, open, SCREENS } from "./kit.mjs";
import { teamNamed } from "./seed-common.mjs";

const ROOT = new URL("../../../../", import.meta.url);
/* a module the plane serves has a source folder; one whose only path is its requirements file (screens-intake-rounds, screens-public,
   screens-document-beta) has no code yet and registers no screen */
const SOURCE = (m) => m.paths.find((p) => /^bio-plane\/src\/.+\/$/.test(p));
const SERVED = JSON.parse(readFileSync(new URL("build/modules.json", ROOT), "utf8")).modules.filter((m) => /^screens-/.test(m.id) && SOURCE(m));
const ALL = [];
for (const m of SERVED) ALL.push(...(await import(new URL(SOURCE(m) + "index.mjs", ROOT))).SCREENS);
const REGISTERED = new Set(ALL.map((s) => s.id));
const stub = (id, op) => ({ id, reads: () => ({}), render: () => "", acts: [{ op, send: () => null }], words: [], parts: {} });
const PAGE = [...SCREENS, stub("watching", "monitoring"), stub("leads", "lead")];

/* the screen each in-app link opens: `/app/<screen>[/...]` (the shell's addresses, interface-shell R9), or the `data-screen` it navigates to */
const targets = (o) => all(o.tree, (e) => e.tag === "a" && (e.attrs["data-screen"] || /^\/app\/[^/]/.test(e.attrs.href || "")))
  .filter((e) => !/^\/app\/assets\//.test(e.attrs.href || ""))
  .flatMap((e) => [e.attrs["data-screen"], /^\/app\/([^/?#]+)/.exec(e.attrs.href || "")?.[1]].filter(Boolean));

test("R17 R3 every link Settings and Your account draw opens a registered screen, to an administrator and to a member; none links aimine or aiproviders while screens-ai registers no screen", async () => {
  assert.ok(REGISTERED.has("settings") && REGISTERED.has("account") && REGISTERED.has("watching"), "control: the registry is the served screens'");
  const t = await teamNamed("full");
  for (const [id, who] of [["settings", "founder"], ["settings", "dev"], ["account", "founder"], ["account", "dev"]]) {
    const o = await open(id, { world: t.w, as: t[who], screens: PAGE });
    const to = targets(o);
    assert.ok(to.length >= 3, `control: ${id} as ${who} draws its links (${to.join(", ")})`);
    for (const s of to) assert.ok(REGISTERED.has(s), `${id} as ${who} links ${s}, which no served module registers`);
    for (const s of ["aimine", "aiproviders"]) if (!REGISTERED.has(s)) assert.ok(!to.includes(s), `${id} as ${who} links ${s}`);
  }
});

test("every link each of this module's screens draws, to the founder of a full team, opens a registered screen", async () => {
  const t = await teamNamed("full");
  for (const s of SCREENS) {
    const o = await open(s.id, { world: t.w, as: t.founder, screens: PAGE });
    for (const x of targets(o)) assert.ok(REGISTERED.has(x), `${s.id} links ${x}, which no served module registers`);
  }
});
