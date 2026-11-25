/* screens-intake R42 (T51 fix round; C55; K4164): "Check it now" says what the check found, from the answer's status and note: four
 * answers draw four different sentences, by key. `checkOutcome` is the one drawing `screens-inquiry` imports. */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, text, fill, press, word, says, DOCUMENT_STUB } from "./page.mjs";
import { SCREENS, checkOutcome } from "../../../src/screens-intake/index.mjs";

const ADDRESS = "https://www.example.gov/reports/street-maintenance-2026.html";
const TITLE = "Street maintenance report";
/* the address is the world's network (an environment double): it answers the capture as it was, then the check as `how` says */
const page = (body) => new Response(`<html><head><title>${TITLE}</title></head><body><p>${body}</p></body></html>`, { status: 200, headers: { "content-type": "text/html" } });
const ANSWERS = {
  modified: () => page("The report was revised."),
  removed: () => new Response("gone", { status: 404 }),
  unchanged: () => page("The report."),
  unknown: () => { throw new TypeError("fetch failed: timed out"); },
};
/* the member captures the address and watches it (real acts, the page's own), then the address changes as `how` says and the member asks for the check */
const checked = async (how) => {
  const t = await members({ mai: ["contribute"] });
  let answer = ANSWERS.unchanged;
  t.world.script(ADDRESS, () => answer());
  const p = await openWorld("/app/capture/address", { world: t.world, as: t.mai, screens: [...SCREENS, DOCUMENT_STUB] });
  fill(p, { "ci-address": ADDRESS });
  await press(p, "acquire");
  await press(p, "monitorset");
  answer = ANSWERS[how];
  await press(p, "monitor");
  /* a removal is confirmed only by a second look a day or more after the first answered 404 (the owner's rule) */
  if (how === "removed") {
    /* the monitor reads the platform's Date (not the world's pinned clock): that clock is the one environment double, moved a day on */
    mock.timers.enable({ apis: ["Date"], now: Date.now() });
    try { mock.timers.tick(25 * 3600e3); await press(p, "monitor"); } finally { mock.timers.reset(); }
  }
  p.watch = { t, answer: () => answer };
  return p;
};
const KEYS = { modified: "screen.capture.address.checked.modified", removed: "screen.capture.address.checked.removed", unchanged: "screen.capture.address.checked.unchanged" };

test("R42 four answers (modified, removed, unchanged, could not be told) draw four different sentences, by key", async () => {
  const drawn = new Set();
  for (const status of ["modified", "removed", "unchanged"]) {
    const p = await checked(status);
    assert.ok(says(p, KEYS[status], { title: TITLE }), status);
    for (const [other, key] of Object.entries(KEYS)) if (other !== status) assert.ok(!says(p, key, { title: TITLE }), `${status} is not drawn as ${other}`);
    drawn.add(word(KEYS[status], { title: TITLE }));
  }
  const u = await checked("unknown");
  /* the note is the owner's: the same check asked again, by the member's own act, answers the same one */
  const again = await u.watch.t.mai.act("monitor", { body: { bundleId: u.byOp("monitor")[0].body.bundleId } });
  assert.ok(again.note && again.status === null, "the owner could not tell, and says why");
  assert.ok(says(u, "screen.capture.address.checked.unknown", { title: TITLE, note: again.note }), "could not be told, with the owner's note");
  assert.equal(drawn.size, 3);
});

test("R42 the exported drawing is the one the screen uses; control: it never says one outcome for another", async () => {
  const cs = { w: (k, f) => word(k, f) };
  const seen = new Set(["modified", "removed", "unchanged", undefined].map((status) => checkOutcome(cs, { status, note: "n" }, "T")));
  assert.equal(seen.size, 4, "four answers, four sentences");
});
