/* ratification against inquiry-grammar PR 423 (notice inquiry-grammar:423; its F1, citation R29; DEC-460): a basis leg
   citing what a photograph's file says (its time taken or its place) is judged by inquiry-grammar's own arm, and a
   malformed one is a C-2.8 error FILE_SAYS_LEG_MALFORMED. This module's `op=ratify` (R4) refuses GATE_REFUSED with
   whatever `promotion.runGate` answers over the bundle's image, and the record carries inquiry-grammar's grammar as the
   store's composition root registers it (fixture.mjs), so no code changes: the new finding refuses op=ratify and
   nothing crosses; a well-formed leg gains no such finding. The leg's four keys are inquiry-grammar's own
   (`fileSaysLeg`), the value file-safety's real `fileSays`, never built by hand. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, plane, newKey, signBundle, V } from "./fixture.mjs";
import { ratifyOp } from "../../../src/ratification/ops.mjs";
import { fileSaysLeg } from "../../../src/inquiry-grammar/index.mjs";
import { fileSays } from "../../../src/file-safety/picture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const Q = "INQ-2026-7423-photo", INFO = "INFO-2026-7423-photo";
const SAID = fileSays({ time_taken: "2026:07:01 10:14:03" }).file_says;

function findingMd(id) {
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "When was the photograph taken?"`,
          "current_state: open", "prior_state: null", `created: "2026-07-01T00:00:00Z"`, `last_updated: "2026-07-01T00:00:00Z"`,
          "produced_by:", "  mode: human", "  capability_tier: none", "surfaced_by: human", "group: test-group",
          "references:", `  - target: ${INFO}`, "    rel: cites", "    status: confirmed",
          "state_history: []", "annotations_open: 0", "reeval_pending: false", "visuals: []",
          "recheck_triggers:", "  - text: Revisit after the next budget cycle",
          "    description: The adopted budget may restate the transfer basis.",
          "---", "", "## Question", "", "When was the photograph taken?", "", word("conformance.rests"), "", "## Conclusion", "",
          word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
}

/** the leg's YAML lines, from inquiry-grammar's own four keys over file-safety's value, with `over` laid on */
function legLines(over = {}) {
  const leg = { target: INFO, role: "supports", ...fileSaysLeg("time_taken", SAID.time_taken.value), ...over };
  return Object.entries(leg).map(([k, v], i) => `${i ? "    " : "  - "}${k}: ${JSON.stringify(v)}`);
}

async function setup() {
  const w = world();
  const key = await newKey();
  w.member("alice", { role: "member", signer: key });
  w.project("Team", "alice");
  w.info(INFO);
  w.promote(Q, findingMd(Q));
  const ratify = async (lines) => {
    const p = plane(w, { session: { role: "member:alice" }, viewer: V("alice") });
    if (lines) w.ops.image = (url) => {
      const img = w.record.readImage(url.searchParams.get("id"));
      img["bundle.md"] = img["bundle.md"].replace(/^references:/m, ["basis:", ...lines, "references:"].join("\n"));
      return img;
    };
    else delete w.ops.image;
    const s = w.sha(Q);
    return ratifyOp(p.request({ bundleId: Q, expectedSha: s, sig: await signBundle(key, Q, s) }), p.stub, p.ctx);
  };
  return { w, ratify };
}
/* the gate's findings carry check and detail (no code): the arm's findings are the C-2.8 rows whose detail is one of
   the arm's own sentences, read from the word table over the leg's label (K3810) */
const LABEL = { label: "basis leg 0" };
const WHAT = { ...LABEL, what: word("inquiry-grammar.grammar.file_says_what") };
const CHECKED = word("inquiry-grammar.grammar.file_says_checked_not_false", WHAT);
const ARM = ["file_says_unknown_key", "file_says_from_not_the_file", "file_says_checked_not_false"]
  .map((k) => word(`inquiry-grammar.grammar.${k}`, WHAT));
const fileSaysFindings = (body) => (body.findings || []).filter((x) => x.check === "C-2.8" && (ARM.includes(x.detail) || /file says/.test(x.detail)));

test("notice inquiry-grammar:423 (R4): a basis leg citing the file's time taken marked checked is refused GATE_REFUSED naming the arm's C-2.8 finding (FILE_SAYS_LEG_MALFORMED); nothing crosses", async () => {
  const { w, ratify } = await setup();
  const res = await ratify(legLines({ file_says_checked: true }));
  assert.deepEqual([res.status, res.body.reason], [409, "GATE_REFUSED"], JSON.stringify(res.body).slice(0, 600));
  const own = fileSaysFindings(res.body);
  assert.equal(own.length, 1, JSON.stringify(res.body.findings).slice(0, 600));
  assert.equal(own[0].detail, CHECKED);
  assert.equal(w.count("published_bundles"), 0, "nothing crossed");
});

test("notice inquiry-grammar:423 (R4, control): the same leg well formed passes the gate (no finding of the arm) and is stopped only at the commit's C-58.2", async () => {
  const { ratify } = await setup();
  const res = await ratify(legLines());
  assert.deepEqual(fileSaysFindings(res.body), [], JSON.stringify(res.body).slice(0, 600));
  assert.equal(res.body.check, "C-58.2", "past the gate: refused only at the commit, the finding being in no ratified case (R5)");
});
