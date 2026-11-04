/* notice case-tensions:262 (T53; PR 262, source only, no requirement text): `case-tensions` now spells the attribution
   body it splices into a case document in the words of that document's own format (case-grammar R33, R35). docket
   reads one thing of case-tensions: `caseTensions` (its R4), the open candidates on a case's project, for the core still
   due (R9 (c)) and a `disclosure` entry (R6). Confirmed with no code change: the tensions coreDue lists are exactly the
   candidates the real case-tensions answers for the case, and a disclosed one leaves. The world is docket's fixture,
   with the real case-tensions and publication (K4990). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, post, CASE } from "./fixture.mjs";

const A = "member:alice";

test("notice case-tensions:262 (R9 (c)) coreDue's tension items are the candidates the real case-tensions.caseTensions answers for the case, and a disclosure placed for one removes it", async () => {
  const w = seeded();
  w.publish(w.P, CASE, 2, [{ id: w.F1, role: "load_bearing" }], { whatChanged: "Corrected the totals." });
  w.tensions.list = [{ member: w.F1, candidate: "CAND-1", state: "open" }, { member: w.F1, candidate: "CAND-2", state: "open" }];
  const provided = w.caseTensions.caseTensions({ project: w.P, limit: 200 });
  const theirs = provided.cases.filter((k) => k.case === CASE).flatMap((k) => k.tensions.map((t) => t.candidate)).sort();
  assert.deepEqual(theirs, ["CAND-1", "CAND-2"], JSON.stringify(provided).slice(0, 400));
  const ours = () => w.docket.coreDue({ case: CASE, viewer: A }).items.filter((i) => i.kind === "tension").map((i) => i.ref).sort();
  assert.deepEqual(ours(), theirs);
  await post(w, { kind: "disclosure", edition: 2, candidate: "CAND-1" });
  assert.deepEqual(ours(), ["CAND-2"], "control: a disclosed candidate is no longer due");
});
