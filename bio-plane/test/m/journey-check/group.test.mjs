/* journey-check R17 (N1160, U15; DEC-281; K3472): no served page or word row says "group" for a team. The rule is the
   design's own, read from `build_words.mjs`: `TEAM_WORD` and `GROUP_SENSE`. The rows are scanned as data; the pages the
   walk serves are scanned as drawn, at each step, in a real browser over fixture pages. */
import { test, before, after } from "node:test";
import { word as tableWord } from "../../../src/setup-words/index.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { designRule, groupIn, rowsSayingGroup, designRows, setupRows, senseKeys, BUILD_WORDS } from "../../../src/journey-check/group-words.mjs";
import { Walk, FAIL } from "../../../src/journey-check/walker.mjs";
import { word } from "../../../src/journey-check/words.mjs";
import { browser } from "../../../src/journey-check/run.mjs";

let B, dir;
before(async () => { B = await browser(); dir = mkdtempSync(join(tmpdir(), "jc-group-")); });
after(async () => { await B?.close(); rmSync(dir, { recursive: true, force: true }); });

test("R17: no row of words.json or of setup-words says \"group\" for a team, outside the rows the design's GROUP_SENSE keeps", () => {
  const rule = designRule();
  assert.deepEqual(rowsSayingGroup(designRows(), { rule }), []);
  assert.deepEqual(rowsSayingGroup(setupRows(), { rule }), []);
  /* the lists are the ones the walk serves: both are whole, not empty */
  assert.ok(designRows().length > 1000 && setupRows().length > 1000);
  /* the rows the design keeps are rows of the list: GROUP_SENSE is read, not an empty or stale pattern */
  const kept = senseKeys({ rule });
  assert.ok(kept.length >= 10, `${kept.length} rows kept`);
});

test("R17 control: a row in GROUP_SENSE is allowed; a row saying \"your group's Civicsmith\" fails, in any case and plural", () => {
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

test("R17: the rule is read from the design's build, never copied: a build that keeps another row keeps that row", () => {
  const src = readFileSync(BUILD_WORDS, "utf8");
  const other = src.replace(/^const GROUP_SENSE = .*$/m, "const GROUP_SENSE = /^fixture\\.kept$/;");
  const file = join(dir, "build_words.mjs");
  writeFileSync(file, other);
  const rule = designRule(file);
  assert.deepEqual(rowsSayingGroup([{ key: "fixture.kept", en: "a group of cases" }], { rule }), []);
  assert.equal(rowsSayingGroup([{ key: senseKeys()[0], en: tableWord("screen.group-identity.kind.community") }], { rule }).length, 1);
  assert.throws(() => designRule(join(dir, "missing.mjs")));
  writeFileSync(file, "const nothing = 1;\n");
  assert.throws(() => designRule(file), /no `const TEAM_WORD/);
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

test("R17 control: a page drawing a row the design's GROUP_SENSE keeps passes; script and style text is not drawn text", { timeout: 120000 }, async () => {
  const kept = senseKeys();
  const drawn = kept.map((k) => { try { return word(k, {}); } catch { return null; } }).filter((w) => w && /groups?\b/i.test(w));
  assert.ok(drawn.length, "at least one kept row says group in its own words");
  const ok = await stepOn(`<!doctype html><title>Home</title><style>.group{color:red}</style><script>const group = 1;</script><main><p>${drawn[0]}</p></main>`);
  assert.deepEqual(ok.failures, [], ok.report());
});
