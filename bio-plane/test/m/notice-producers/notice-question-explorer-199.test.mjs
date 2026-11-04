/* notice question-explorer:199 for R17: an exploring run is now opened naming its paying principal `principalAi` (and
   `principalAiRef`), as ai-runs' T53 rename asks, in place of `principalClaude`. This module reads only `findsFor`, whose
   answer is unchanged: a find the run makes is one `question-find` item per recipient, the paying account's owner told
   `ai.label.explored` with `{owner}`, every other recipient `ai.label.explored.member`. Confirmed with no code change of this
   module's. Over the real question-explorer on its own test world. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world as qeWorld, Q as QQ, PROJ, CAP, CALLER } from "../question-explorer/fixture.mjs";
import { fresh, reader, ofKind } from "./fixture.mjs";
import { WORDS } from "../ai-use/fixture.mjs";

const UTC = () => ({ time_zone: { value: "UTC" } });

test("notice question-explorer:199 (R17) a run opened under principalAi: its find reaches the question's recipients as one question-find each, the owner of the paying project account labelled ai.label.explored with the project's name, another recipient ai.label.explored.member", async () => {
  const w = await qeWorld().standard();
  w.st.sql.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const { read } = reader(fresh(w.host, { membership: w.membership, view: UTC, questionExplorer: w.p }));
  const at = Date.parse("2026-10-10T09:00:00Z");
  w.follow(QQ, "alice", "bob");
  w.project(PROJ, ["alice"], { owners: ["alice"] });
  w.draw(QQ, PROJ);
  await w.setExplore("group", "no");
  const o = await w.openRun(`project:${PROJ}`);
  const opened = w.calledAs("open").at(-1);
  assert.equal(opened.principalAi, `project:${PROJ}`, "the run names its paying principal as principalAi");
  assert.equal("principalClaude" in opened, false, "never the retired name");
  w.p.find({ run: o.run, kind: "capture", ref: CAP, bearing: "supports", how: "the minutes record the vote", caller: CALLER });
  const name = w.rows(`SELECT title FROM bundles WHERE bundle_id = ?`, PROJ)[0]?.title ?? PROJ;
  const [a] = ofKind(read("alice", { now: at }), "question-find");
  const [b] = ofKind(read("bob", { now: at }), "question-find");
  assert.ok(a && b, "each recipient has one item");
  assert.equal(a.id, b.id);
  assert.equal(a.label, WORDS["ai.label.explored"].replace("{owner}", name));
  assert.equal(b.label, WORDS["ai.label.explored.member"], "control: a recipient who does not own the paying account");
  assert.deepEqual(ofKind(read("carol", { now: at }), "question-find"), [], "control: not a recipient");
});
