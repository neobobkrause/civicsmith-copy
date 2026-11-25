/* The answers this module publishes for its users' tests (K4990, K4993, K4995, K5044): each is made by this module's real
   code when the test runs, never stored. A user's test takes its value from here instead of building the answer by hand. */
import { world } from "./fixture.mjs";

/* R79 (DEC-386): the real answer of withdrawing a confirmed expertise through the module's `expertiseWithdraw`: `ok`, with
   state `withdrawn`, for a member's label declared by the member and confirmed by an administrator, withdrawn with a reason. */
export async function expertiseWithdrawn() {
  const w = await world().group("ann");
  w.m.expertiseDeclare({ memberId: "ann", label: "CPA" });
  w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "admin" });
  return w.m.expertiseWithdraw({ memberId: "ann", label: "CPA", reason: "licence lapsed", by: "admin" });
}

/* R81 (N202; membership re-exports `listenerRefusal`): the real refusals of a registration of the password setter, through
   the module's own `registerPasswordSetter`: a second registration of a slot that takes one (LISTENER_DECLARED, naming the
   holder), and a registration whose function is not one (LISTENER_MALFORMED). Each carries its row's `check` and
   `translation`. The first registration is the real one, so the second is refused by the module, not by the test. */
export function listenerRefusals() {
  const w = world({ omit: ["setter"] });
  const registered = w.m.registerPasswordSetter(() => true, "credentials");
  return {
    registered,
    declared: w.m.registerPasswordSetter(() => true, "credentials"),
    malformed: w.m.registerPasswordSetter("not a function", "credentials"),
  };
}
