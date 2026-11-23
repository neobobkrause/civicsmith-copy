/* journey-check R17 (N1160, U15; DEC-281; K3472): no served page or word row says "group" for a team. The rule is the
   module's own (`group-words.mjs`, ARCH 23 Nov 2026): `TEAM_WORD` and `OTHER_SENSE`, each other-sense row named with its sense. The rows are scanned as data; the pages the
   walk serves are scanned as drawn, at each step, in a real browser over fixture pages. */
import { test, before, after } from "node:test";
import { word as tableWord } from "../../../src/setup-words/index.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { designRule, groupIn, rowsSayingGroup, designRows, setupRows, senseKeys, OTHER_SENSE } from "../../../src/journey-check/group-words.mjs";
import { Walk, FAIL } from "../../../src/journey-check/walker.mjs";
import { word } from "../../../src/journey-check/words.mjs";
import { browser } from "../../../src/journey-check/run.mjs";

let B, dir;
before(async () => { B = await browser(); dir = mkdtempSync(join(tmpdir(), "jc-group-")); });
after(async () => { await B?.close(); rmSync(dir, { recursive: true, force: true }); });

test("R17: no row of words.json or of setup-words says \"group\" for a team, outside the rows kept in another sense", () => {
  const rule = designRule();
  assert.deepEqual(rowsSayingGroup(designRows(), { rule }), []);
  assert.deepEqual(rowsSayingGroup(setupRows(), { rule }), []);
  /* the lists are the ones the walk serves: both are whole, not empty */
  assert.ok(designRows().length > 1000 && setupRows().length > 1000);
  /* the rows kept in another sense are rows of the list: the list is not empty or stale */
  const kept = senseKeys({ rule });
  assert.ok(kept.length >= 10, `${kept.length} rows kept`);
});

test("R17 control: a row kept in another sense is allowed; a row saying \"your group's Civicsmith\" fails, in any case and plural", () => {
  const rule = designRule();
  const kept = senseKeys({ rule })[0];
  assert.deepEqual(rowsSayingGroup([{ key: kept, en: "A community group, a block club or a neighborhood team" }], { rule }), []);
  assert.deepEqual(rowsSayingGroup([{ key: "fixture.not.kept", en: "Your group's Civicsmith" }], { rule }).map((r) => r.key), ["fixture.not.kept"]);
  assert.equal(rowsSayingGroup([{ key: "fixture.plural", en: "Your groups" }], { rule }).length, 1);
  assert.equal(rowsSayingGroup([{ key: "fixture.upper", en: "YOUR GROUP" }], { rule }).length, 1);
  /* identifiers are not text: a placeholder and a hyphenated name are left alone */
  assert.deepEqual(rowsSayingGroup([{ key: "fixture.ident", en: "Opens {group} at group-identity" }], { rule }), []);
  /* a team said as a team is not found */
  assert.deepEqual(groupIn(tableWord("screen.site.start"), { rule }), []);
});

test("R17: the six rows ARCH ruled keep \"group\" in another sense are kept, each with its sense; every listed id is a row of the list", () => {
  const senseOf = new Map(OTHER_SENSE.flatMap(([ids, sense]) => ids.map((id) => [id, sense])));
  for (const [id, sense] of [["citation.checks.bad_ground", "a citation group"], ["citation.index.bad_ground", "a citation group"],
    ["inquiry-grammar.checks.a_passage_that_cuts_against_the_conclusion", "a ground, which groups passages or legs"],
    ["inquiry-grammar.grammar.grounds_i_declares_label_which_p", "a ground, which groups passages or legs"],
    ["inquiry-grammar.grammar.take_the_passage_out_of_its_ground_first", "a ground, which groups passages or legs"],
    ["run-productions.declared.suggest", "a numbered group of a list (\u00a74 group 2)"]]) {
    assert.equal(senseOf.get(id), sense, id);
    assert.ok(designRule().GROUP_SENSE.test(id), id);
  }
  /* a listed id that names no row is stale: every exact id is a key of setup-words */
  const keys = new Set(setupRows().map((r) => r.key));
  for (const id of senseOf.keys()) if (!id.includes("*")) assert.ok(keys.has(id), `${id} is a row of the list`);
  /* control: a rule without one of the six finds that row */
  const without = OTHER_SENSE.map(([ids, sense]) => [ids.filter((i) => i !== "citation.index.bad_ground"), sense]);
  assert.deepEqual(rowsSayingGroup(setupRows(), { rule: designRule(without) }).map((r) => r.key), ["citation.index.bad_ground"]);
});

/* a page drawn as the walk would, one step on it */
async function stepOn(html, { within = "body" } = {}) {
  const walk = new Walk({ out: join(dir, String(Math.random()).slice(2)), arm: "local" });
  const ctx = await B.newContext();
  try {
    const page = walk.watch(await ctx.newPage());
    await page.setContent(html);
    await walk.step(page, "a fixture page", async () => {});
    return walk;
  } finally { await ctx.close(); }
}

test("R17: a page the walk serves that says \"group\" for a team fails the step that drew it, naming where; control: a page saying team passes", { timeout: 120000 }, async () => {
  const bad = await stepOn(`<!doctype html><title>Home</title><main id="cs-main"><h1>Welcome</h1><p>This is your group's Civicsmith.</p></main>`);
  assert.deepEqual(bad.failures.map((f) => f.kind), [FAIL.GROUP]);
  assert.match(bad.failures[0].detail, /uses the retired word for a team: …?.*your group's Civicsmith/);
  assert.equal(bad.failures[0].step, "a fixture page");
  /* the title, the labels a screen reader reads and a hidden disclosure's words are drawn words too */
  const hidden = await stepOn(`<!doctype html><title>Your group</title><main><button aria-label="Leave the group">x</button><details><summary>More</summary>Groups at work</details></main>`);
  assert.equal(hidden.failures.filter((f) => f.kind === FAIL.GROUP).length, 3, hidden.report());
  const good = await stepOn(`<!doctype html><title>Home</title><main id="cs-main"><p>This is your team's Civicsmith.</p><a href="/app/group-identity">Who your team is</a></main>`);
  assert.deepEqual(good.failures, []);
});

test("R17 control: a page drawing a row kept in another sense passes; script and style text is not drawn text", { timeout: 120000 }, async () => {
  const kept = senseKeys();
  const drawn = kept.map((k) => { try { return word(k, {}); } catch { return null; } }).filter((w) => w && /groups?\b/i.test(w));
  assert.ok(drawn.length, "at least one kept row says group in its own words");
  const ok = await stepOn(`<!doctype html><title>Home</title><style>.group{color:red}</style><script>const group = 1;</script><main><p>${drawn[0]}</p></main>`);
  assert.deepEqual(ok.failures, [], ok.report());
});
