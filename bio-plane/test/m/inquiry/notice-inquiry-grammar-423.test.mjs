/* Provider notice inquiry-grammar:423 (inquiry-grammar F1; citation R29; DEC-460): `inquiry-grammar` added a leg citing
   what a photograph's file says (`fileSaysLeg`, `readFileSaysLeg`, `fileSaysLegFindings`, `FILE_SAYS_*`), judged by
   `checkInquiryBasis` on every leg. This module confirmed, with no code change: its grammar face re-exports
   `checkInquiryBasis` as the same binding (R4–R9), so R11's check at the write judges the new leg by the provider's own
   arm (`FILE_SAYS_LEG_MALFORMED` inside `BASIS_REFUSED`); a well-formed leg lands with its four keys held in the
   document; and `divide` carries it to a child verbatim (R24). The leg's keys are made by the provider's real
   `fileSaysLeg`, over what `file-safety`'s real `fileSays` reads from a photograph, never built by hand. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, inquiryMd } from "./fixture.mjs";
import { checkInquiryBasis as inquiryCheck } from "../../../src/inquiry/index.mjs";
import { checkInquiryBasis, fileSaysLeg, readFileSaysLeg, FILE_SAYS_LEG_KEYS } from "../../../src/inquiry-grammar/index.mjs";
import { fileSays } from "../../../src/file-safety/picture.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const SAID = fileSays({ time_taken: "2026:07:01 10:14:03", gps_latitude: 51.5007 }).file_says;
const yaml = (v) => (typeof v === "string" ? JSON.stringify(v) : String(v));
/* An inquiry whose legs each carry `keys` (the file-says keys and any other fields), written as the document holds them. */
const docWith = (id, legs) => inquiryMd(id, {
  refs: [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t })),
  extra: ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, `    role: ${l.role || "supports"}`,
    ...Object.entries(l.keys || {}).map(([k, v]) => `    ${k}: ${yaml(v)}`)])] });
const legsOf = (w, id) => parseFrontmatter(w.text(id)).data.basis;

test("notice inquiry-grammar:423 R4 R11: the grammar face is the provider's binding; a leg citing a photograph's time taken lands through R11's check with its four keys held", () => {
  assert.equal(inquiryCheck, checkInquiryBasis, "R4–R9 are met through inquiry-grammar's own binding");
  const w = world();
  const PIC = "INFO-2026-4231-photo", ID = "INQ-2026-4231-q";
  w.doc(PIC, ["a photograph of the square"]);
  const keys = fileSaysLeg("time_taken", SAID.time_taken.value);
  assert.ok(keys, "the provider makes the leg's keys");
  const r = w.promote(ID, docWith(ID, [{ target: PIC, keys }]));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 500));
  const [leg] = legsOf(w, ID);
  assert.deepEqual(readFileSaysLeg(leg), { field: "time_taken", value: SAID.time_taken.value, from: "the file", checked: false });
  assert.deepEqual(w.k.basisFor(ID).legs.map((l) => l.target_id), [PIC], "the leg is projected like any leg (R12)");
});

test("notice inquiry-grammar:423 R11: a malformed file-says leg is refused BASIS_REFUSED with the provider's FILE_SAYS_LEG_MALFORMED named, and nothing is written", () => {
  const w = world();
  const PIC = "INFO-2026-4232-photo", ID = "INQ-2026-4232-q";
  w.doc(PIC, ["a photograph of the square"]);
  const bad = { ...fileSaysLeg("gps_latitude", SAID.gps_latitude.value), file_says_checked: true };
  const r = w.promote(ID, docWith(ID, [{ target: PIC, keys: bad }]));
  assert.equal(r.reason, "BASIS_REFUSED", JSON.stringify(r).slice(0, 500));
  assert.ok(JSON.stringify(r).includes("FILE_SAYS_LEG_MALFORMED"), JSON.stringify(r).slice(0, 800));
  assert.equal(w.record.head(ID), null, "nothing was written");
  const ok = w.promote(ID, docWith(ID, [{ target: PIC, keys: fileSaysLeg("gps_latitude", SAID.gps_latitude.value) }]));
  assert.equal(ok.ok, true, "control: the same leg, well formed, lands");
});

test("notice inquiry-grammar:423 R24: divide carries a file-says leg to its child verbatim, all four keys kept", () => {
  const w = world(); w.member("alice");
  const PIC = "INFO-2026-4233-photo", B = "INFO-2026-4234-b";
  const P = "INQ-2026-4233-p", C1 = "INQ-2026-4234-a", C2 = "INQ-2026-4235-b";
  w.doc(PIC, ["a photograph of the square"]); w.doc(B);
  const keys = fileSaysLeg("time_taken", SAID.time_taken.value);
  assert.equal(w.promote(P, docWith(P, [{ target: PIC, keys }, { target: B }])).ok, true);
  const r = w.k.divide({ target: P, reason: "two questions", viewer: "admin", author: V("alice"),
    children: [{ id: C1, question: "When was it taken?", legs: [0] }, { id: C2, question: "The rest?", legs: [1] }] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 500));
  const [leg] = legsOf(w, C1);
  for (const k of FILE_SAYS_LEG_KEYS) assert.deepEqual(leg[k], keys[k], k);
  assert.equal(legsOf(w, C2).some((l) => readFileSaysLeg(l)), false, "the other child carries none");
});
