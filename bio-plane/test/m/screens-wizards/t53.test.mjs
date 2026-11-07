/* T53 (JOURNEYS R-36): R23, each wizard filter explains itself, over the real served page answered by the real store (`world.mjs`).
   Words are read by key (K3810): each filter's `screen.wizards.state.<k>.tip` and `screen.wizards.empty.<k>`, settled by the design
   lane; the library's own explanation is `act.wizards.does` and the screen's `screen.wizards.purpose`. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, has, lacks, open, said, squash } from "./kit.mjs";
import { decode } from "../interface-shell/dom.mjs";
import { team } from "./world.mjs";

const STATES = ["offered", "draft", "submitted", "withdrawn", "retired", "broken", "proposed"];
const tipOf = (b) => squash(decode(b.attrs["data-tip"] || ""));

test("R23 each filter's tip is its own, distinct, in place of the library's; an empty list says what its filter holds, naming no administrators for a member; control: the library's explanation stays", async () => {
  const t = await team();
  const a = await open("wizards", { team: t, as: t.mai });
  const filters = acts(a.tree).filter((b) => b.attrs["data-act"] === "wizards" && b.attrs["data-state"]);
  assert.deepEqual(filters.map((b) => b.attrs["data-state"]), STATES, "one filter per state the library lists");
  const tips = filters.map(tipOf);
  for (const [i, k] of STATES.entries()) {
    assert.ok(tips[i].includes(said(`screen.wizards.state.${k}.tip`)), `${k}: its own explanation`);
    assert.ok(!tips[i].includes(said("act.wizards.does")), `${k}: not the library's`);
  }
  assert.equal(new Set(tips).size, STATES.length, "each filter's tip is distinct");
  // an empty Withdrawn list, for a member who is no administrator: its own line, not the library's line naming administrators
  const w = await open("wizards", { team: t, as: t.mai, subject: "withdrawn" });
  has(w, "screen.wizards.empty.withdrawn");
  lacks(w, "screen.wizards.empty");
  for (const k of STATES.filter((x) => x !== "withdrawn")) lacks(w, `screen.wizards.empty.${k}`);
  // every filter that holds nothing yet draws its own empty line (Civicsmith's own wizards are always offered)
  for (const k of STATES.filter((x) => x !== "offered")) {
    const e = await open("wizards", { team: t, as: t.mai, subject: k });
    has(e, `screen.wizards.empty.${k}`);
  }
  // control: the library's explanation stays on the library screen
  has(a, "screen.wizards.purpose");
});
