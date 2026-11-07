/* interface-shell, attempt 9 (3): ux DEC-496 (BD-14 Q9.7). The kit draws a grade's gloss, the word `mark.grade.gloss.<scale>.<letter>`,
   as the design's `.cs-gloss` beside `.cs-grade` where that grade first appears in a draw; the copy's scale with
   `mark.grade.gloss.copy.lead` before the capture gloss (DEC-461), the ceiling's with the capture gloss. R56 holds: the gloss is drawn
   only while a served stylesheet defines `.cs-gloss`. interface-assets' served `civicsmith.css` (ASSETS_COMMIT 1b6f2bc383) does not
   yet; the design's does (visual-language/civicsmith.css, from 4e44af84). So the tests serve the rule through the page's own frame rules
   (the t53 contribution's style, which R56 counts as served), and the control is the page as served today.
   fixtures-own: a stand-in screen drawing the kit's grades, the test's own input */
import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { interfaceScript } from "../../../src/interface-shell/index.mjs";
/* the design's class (`visual-language/components.css`), named here so the test runs, and fails on its assertions, with the code reverted */
const GLOSS_CLASS = "cs-gloss";
import { word } from "../../../src/setup-words/index.mjs";
import { boot } from "./harness.mjs";

const SERVED = Object.freeze({ style: ".cs-main .cs-gloss{margin-inline-start:6px}" });
const GRADES = { id: "home", reads: () => ({}), acts: [],
  render: (cs) => '<div id="g">' + ["<p>" + cs.grade("capture", "B") + "</p>", "<p>" + cs.grade("capture", "B") + "</p>", "<p>" + cs.grade("connection", "D") + "</p>",
    "<p>" + cs.grade("capture", "C") + "</p>", "<p>" + cs.grade("copy", "B") + "</p>", "<p>" + cs.grade("subject", "Z") + "</p>"].join("") + "</div>" };
const paras = (p) => p.doc.getElementById("g").querySelectorAll("p");
const glossOf = (para) => para.querySelector("." + GLOSS_CLASS);

test("DEC-496 a grade's gloss is drawn as .cs-gloss right after its .cs-grade chip, where that grade first appears in the draw: each scale and letter once, the copy's after its lead, a letter with no gloss word none", async () => {
  const p = await boot({ screens: [GRADES], path: "/app/home", contribution: SERVED });
  const [b1, b2, d, c, copy, z] = paras(p);
  assert.equal(glossOf(b1).textContent, word("mark.grade.gloss.capture.b"));
  assert.equal(b1.querySelector(".cs-grade").nextElementSibling, glossOf(b1), "beside the chip, after it");
  assert.equal(b1.querySelector(".cs-grade").contains(glossOf(b1)), false, "not inside the chip (R15)");
  assert.equal(glossOf(b2), null, "the same grade again carries the chip alone");
  assert.equal(glossOf(d).textContent, word("mark.grade.gloss.connection.d"));
  assert.equal(glossOf(c).textContent, word("mark.grade.gloss.capture.c"));
  assert.equal(glossOf(copy).textContent, word("mark.grade.gloss.copy.lead") + " " + word("mark.grade.gloss.capture.b"), "the copy's scale: the lead, then the capture gloss");
  assert.ok(z.querySelector(".cs-grade"));
  assert.equal(glossOf(z), null, "no gloss word, no gloss");
  assert.ok(interfaceScript([GRADES], { contribution: SERVED }).includes('"gloss":"cs-gloss"'));
});

test("DEC-496, R56 control: while no served stylesheet defines .cs-gloss (the page as served today), no gloss is drawn and no undefined class reaches the page", async () => {
  const p = await boot({ screens: [GRADES], path: "/app/home" });
  for (const para of paras(p)) { assert.ok(para.querySelector(".cs-grade")); assert.equal(glossOf(para), null); }
  assert.ok(interfaceScript([GRADES]).includes('"gloss":""'));
});
