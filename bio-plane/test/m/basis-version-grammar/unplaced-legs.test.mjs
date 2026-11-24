/* basis-version-grammar R11 (T51 fix round 2, C41; K4312), as R3 amends it (fix round 10, cause 30b; K5077): a finding
   that refuses a version because a supporting leg has no ground carries `legs`. No version is now refused for that (an
   unlabelled supporting leg is a necessary leg, R3), so no finding carries `legs`. Pure: the grammar over a frontmatter
   object. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DOC, DOC2, fm, findingsOf, codes } from "./helper.mjs";

const placed = { version: "first", target: DOC, role: "supports", ground: "main" };
const unplaced = (target) => ({ version: "first", target, role: "supports" });

test("R11: a version with two supporting legs, one placed, is not refused, and no finding names the other", () => {
  const x = fm({ legs: [placed, unplaced(DOC2)] });
  assert.deepEqual(codes(x), []);
  assert.ok(findingsOf(x).every((f) => f.legs === undefined));
});

test("R11 control: a version that concludes carries no such finding, and no finding carries `legs`", () => {
  const x = fm({ legs: [placed] });
  assert.deepEqual(codes(x), []);
  assert.ok(findingsOf(x).every((f) => f.legs === undefined));
});

test("R11 control: findings other than a partition's carry no `legs`, beside an unplaced leg too", () => {
  const x = fm({ v: { relationship: "or" }, legs: [placed, unplaced(DOC2)] });
  assert.ok(codes(x).includes("VERSION_RELATIONSHIP_DISAGREES"));
  assert.ok(findingsOf(x).every((f) => f.legs === undefined));
});
