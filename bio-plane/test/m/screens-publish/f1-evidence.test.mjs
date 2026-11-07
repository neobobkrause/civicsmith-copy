/* screens-publish F1 (R19, R76): the published page's evidence reads the shape `publishedcase` answers. The provider,
 * `public-read`, answers an edition's evidence as `materials: {materials: [...], attestations}` (its R3, R53), each row with its
 * `entry` `{name, locator, fingerprint}`. Each answer here is made by public-read's real code when the test runs (a case
 * edition prepared, signed and published in its own test world, then read by its `publishedcase` op), never built by hand. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "../public-read/fixture.mjs";
import { open, main, word, ok, press, until, C } from "./fixtures.mjs";

const PUBLIC = { session: null };
const CASE = "CASE-2026-0701", F = "INQ-2026-0701";
const D1 = "INFO-2026-0701-minutes", D2 = "INFO-2026-0702-letter";

/* One case edition over F, resting on the documents `docs` (each carried whole), signed and published; `publishedcase`'s answer. */
function answerOver(docs) {
  const w = world();
  if (w.p.caseCarriage && typeof w.p.caseCarriage.marksLapsed === "function") w.p.caseCarriage.marksLapsed = () => [];
  w.member("olive");
  const proj = w.project("Parks", "olive");
  for (const d of docs) w.doc(d);
  w.inquiry(F, docs.length ? { legs: docs.map((d) => ({ target: d })) } : {});
  const capOf = (id) => w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, id).capture_sha;
  const materials = docs.map((d) => ({ ref: d, kind: "document", sha: capOf(d), text_sha: null, origin: `https://example.org/${d}`,
                                       archived_copy: null, included: true, rests_under: "load_bearing" }));
  const pin = w.head(F);
  w.prepare(CASE, 1, { format: "bio-case-document/7", project: proj, roles: [{ target: F, version_sha: pin }], materials });
  const signed = w.signCase(CASE, 1, { project: proj, roster: [{ bundle_id: F, version_sha: pin }] });
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 400));
  assert.equal(w.signFinding(F).ok, true);
  const answer = w.read("publishedcase", { caseId: CASE });
  assert.equal(answer.ok, true, JSON.stringify(answer).slice(0, 300));
  return { answer, shas: docs.map(capOf) };
}

const rows = (p) => main(p).querySelectorAll("[data-evidence-row]");
const opens = (p) => main(p).querySelectorAll('button[data-act="publishedcase"]').filter((b) => b.textContent.includes(word("screen.published.evidence.open")));

test("F1 R19 an edition whose publishedcase answer carries two materials draws two evidence rows, each opening its bytes by its full SHA-256", async () => {
  const { answer, shas } = answerOver([D1, D2]);
  assert.ok(answer.materials && !Array.isArray(answer.materials) && Array.isArray(answer.materials.materials), "the provider's shape: {materials: [...]}");
  assert.equal(answer.materials.materials.length, 2);
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedcase: ok(answer) } });
  assert.equal(rows(p).length, 2, "two evidence rows");
  const names = rows(p).map((r) => r.textContent);
  for (const m of answer.materials.materials) assert.ok(names.includes(m.entry.name), `the row named ${m.entry.name}`);
  assert.equal(opens(p).length, 2, "each row opens its bytes");
  for (const sha of shas) assert.ok(main(p).textContent.includes(sha.slice(0, 12)), "its short hash drawn");
  await p.click(opens(p)[0]);
  await p.settle();
  const q = p.byOp("publishedbytes").at(-1);
  assert.ok(q, "publishedbytes asked");
  assert.ok(shas.includes(q.query.sha256), "by the material's own full SHA-256");
  assert.equal(q.headers.Authorization, undefined, "no credential");
});

test("F1 R39 the print layout lists the same two materials by name and short hash", async () => {
  const { answer, shas } = answerOver([D1, D2]);
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedcase: ok(answer) } });
  const asked = [];
  p.win.print = () => asked.push(main(p).innerHTML);
  await press(p, "pubprint");
  await until(p, () => asked.length);
  const sheet = main(p).querySelector("[data-print-layout]");
  assert.ok(sheet, "the print layout");
  for (const m of answer.materials.materials) assert.ok(sheet.textContent.includes(m.entry.name), `${m.entry.name} listed`);
  for (const sha of shas) assert.ok(sheet.textContent.includes(sha.slice(0, 12)), "its short hash listed");
  assert.ok(sheet.textContent.includes(word("screen.published.evidence")), "under the evidence heading, not counted as unpublished");
});

test("F1 control: an edition with no materials draws no evidence row and no open (and, as R100 says, no evidence heading)", async () => {
  const { answer } = answerOver([]);
  assert.deepEqual(answer.materials && answer.materials.materials, [], "the provider states an empty list");
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedcase: ok(answer) } });
  assert.ok(main(p).textContent.includes(word("screen.published.howtoread")), "the page is drawn");
  assert.equal(main(p).textContent.includes(word("screen.published.evidence")), false, "no evidence heading over nothing");
  assert.equal(rows(p).length, 0);
  assert.equal(opens(p).length, 0);
});
