/* hypotheses F1 (layer 12, CR2-19; inquiry R92, CR2-20; IV-H1, IV-H3): this module registers a question's rival
   explanations with inquiry at start (`onRivalsListed`), so inquiry's standing read that names no rivals reads this
   module's list, in the order of exploring. Over inquiry's real module and its published world (its `fixture.mjs`), with
   hypotheses made over the same host. Each with a negative control (K874). */
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "../inquiry/fixture.mjs";
import { hypothesesOf } from "../../../src/hypotheses/index.mjs";

const A = "INFO-2026-0001-a";
const Q = "INQ-2026-0001-q";
const VIEWER = "admin";

/* inquiry's world with one open question, and hypotheses over the same host, registered with that inquiry at start */
function setup() {
  const w = world();
  w.doc(A);
  w.inquiry(Q, { legs: [{ target: A }] });
  const h = hypothesesOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, inquiry: w.k });
  const hold = (statement) => {
    const r = h.hold({ inquiry: Q, kind: "other", statement, about: [A], by: VIEWER });
    assert.equal(r.ok, true, JSON.stringify(r));
    return r.hypothesis_id;
  };
  return { w, h, H1: hold("A budget shortfall."), H2: hold("The deck was unsafe."), H3: hold("Too few used it.") };
}
const listed = (w, extra = {}) => w.k.rivalStanding({ question: Q, viewer: VIEWER, ...extra });

test("F1 (inquiry R92) at start this module registers the question's rivals with inquiry: a standing read naming none answers this module's rivals, in the order of exploring, each not established; a question with no rivals set answers none", () => {
  const { w, h, H1, H2, H3 } = setup();
  const none = listed(w);
  assert.deepEqual([none.ok, none.standings], [true, []], JSON.stringify(none).slice(0, 300));
  assert.equal(h.hypothesisRivals({ inquiry: Q, rivals: [H1, H2], by: VIEWER }).ok, true);
  assert.equal(h.exploreNext({ inquiry: Q, rival: H2, by: VIEWER }).ok, true);
  const r = listed(w);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(r.standings.map((s) => [s.rival, s.standing]), [[H2, "not_established"], [H1, "not_established"]]);
  assert.deepEqual(h.rivalsListed({ question: Q, viewer: VIEWER }), [H2, H1], "the list is rivalsOf's order");
  assert.deepEqual(h.rivalsOf({ inquiry: Q, viewer: VIEWER }).rivals.map((x) => x.rival), [H2, H1]);
  /* negative control: a list the caller names wins, and a held hypothesis that is not a rival is not listed */
  assert.deepEqual(listed(w, { rivals: [H3] }).standings.map((s) => s.rival), [H3]);
  assert.equal(r.standings.some((s) => s.rival === H3), false);
});

test("F1 (inquiry R92) the registration is this module's one: a second module is refused; a read with no viewer (the stamp absent, failing closed) or of an absent question is answered no list, and inquiry answers NO_SUCH_BUNDLE before it asks", () => {
  const { w, h, H1, H2 } = setup();
  assert.equal(h.hypothesisRivals({ inquiry: Q, rivals: [H1, H2], by: VIEWER }).ok, true);
  assert.equal(w.k.onRivalsListed("other", () => []).ok, false, "one registration, already hypotheses'");
  assert.equal(h.rivalsListed({ question: Q, viewer: null }), null);
  assert.equal(h.rivalsListed({ question: "INQ-2026-0099-none", viewer: VIEWER }), null);
  assert.equal(listed(w, { viewer: null }).reason, "NO_SUCH_BUNDLE");
  /* the control: the viewer who sees it is answered the list */
  assert.deepEqual(h.rivalsListed({ question: Q, viewer: VIEWER }), [H1, H2]);
});
