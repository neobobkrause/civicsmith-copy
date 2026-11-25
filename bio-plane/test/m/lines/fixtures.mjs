/* lines' published fixture (the fixture rule, K4990): the answers other modules' tests need from `lines`, made by
   the real `recordLine` over the real world of this module's fixture when the test runs, never stored. */
import { world, ANN, MACHINE } from "./fixture.mjs";

/** The refusals of `recordLine` that a module with a `lines` seam is relied on to relay, each made by the real code:
 *  `{ w, answers: { <CODE>: <the answer recordLine gave> } }` over a fresh world `w`. */
export function linesWorld() {
  const w = world();
  const person = w.ent("person", "Pat Holder"), other = w.ent("person", "Sam Seat");
  const office = w.ent("office", "Clerk"), organisation = w.ent("body", "Harbour Authority");
  const T = { statement: "I was there" };
  const act = (a) => w.l.recordLine({ basis: T, by: ANN, ...a });
  const answers = {
    UNKNOWN_LINE_KIND: act({ kind: "gave_to", from: person, to: organisation }),
    NO_SUCH_ENTITY: act({ kind: "part_of", from: "ENT-2026-7777", to: organisation }),
    SEAT_ON_ENDS: act({ kind: "seat_on", from: person, to: other }),
    HOLDER_NOT_A_PERSON: act({ kind: "holds", from: organisation, to: office, capacity: "elected" }),
    UNKNOWN_CAPACITY: act({ kind: "holds", from: person, to: office, capacity: "mascot" }),
    BAD_CAPACITY: act({ kind: "part_of", from: person, to: organisation, capacity: "elected" }),
    MACHINE_NEEDS_IDENTIFIERS: act({ kind: "part_of", from: person, to: organisation, by: MACHINE }),
  };
  return { w, answers };
}
