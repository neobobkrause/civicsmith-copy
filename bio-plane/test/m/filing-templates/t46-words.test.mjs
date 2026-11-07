/* filing-templates, T46 (T46-36; R29; DEC-194, N913): C-125.33 TEMPLATE_NOT_REVIEWED takes its translation from
   `words.json`'s `refusal.TEMPLATE_NOT_REVIEWED`, read by key, never a copy, its `{missing}` left for the screen with
   the refusal's `lacks` beside it; C-125.34 TEMPLATE_COURT_PETITION reads its word by key; every other row keeps
   its own; codes, numbers, `where`s and behaviour unmoved. At the interface: the rows as exported, and each refusal as
   the reads answer it, beside its control, the same template offered once its attribution is whole. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { seeded, V, TEST, TEXT, reviewedOf, PROFILE_IDS } from "./fixture.mjs";
import * as ft from "../../../src/filing-templates/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";
import { canonicalJson, sha256HexSync } from "../../../src/record-grammar/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

const WORDS = JSON.parse(await readFile(new URL("../../../../docs/development/ux-substrate/screens/words.json",
  import.meta.url), "utf8")).words;
const en = (key) => {
  const w = WORDS.find((x) => x.key === key);
  assert.ok(w, `words.json holds ${key}`);
  return w.en;
};
const A = V("alice");
const rows = ft.FILING_TEMPLATE_CHECKS;
/* the RFC row's word, read by key from words.json (DEC-260); pinned as r33.test.mjs pins it */
const RFC_TRANSLATION = word("refusal.RFC_QUOTING_MISSING");
const AT = (fn, region) => `src/filing-templates/index.mjs ${fn} > ${region}`;
/* C-125.33 as T45 worded it: answered no longer. */
const T45_NOT_REVIEWED = "This template from the jurisdiction profile is not offered yet. A profile's template is offered only "
  + "once it names who wrote it, the public sources it was written from, a professional's review with no concerns, "
  + "and an approver other than its writer; what it lacks is named.";
/* C-125.34 reads the list's word by key (R29, K4043) */
const COURT_PETITION = word("refusal.TEMPLATE_COURT_PETITION");
/* Every other row (42, C-115.31–.38 less .34, C-115.45, .46, C-125.1–.32 and .34), as T45 left them: the canonical JSON's
   sha256 of each one's check and where, so none moves. A translation is the list's word, read by key (K3810), never
   pinned here as text. */
const KEPT = { count: 42, sha256: "7a3cefaa2f6f8e3d279f80546075bd616883b43155a619563651b65872160621" };
const editedOf = (edit, base = jurisdictions) => ({ ...base, get: (id) => { const p = base.get(id); if (p && p.id === TEST) edit(p); return p; } });

test("R29 C-125.33 TEMPLATE_NOT_REVIEWED reads words.json's refusal.TEMPLATE_NOT_REVIEWED by key from FILING_TEMPLATES_WORDS, never a copy; its code, number and where unmoved; T45's words answered no longer", () => {
  assert.ok(Object.isFrozen(ft.FILING_TEMPLATES_WORDS));
  /* T48 (R33) adds the one key of C-115.47, which r33.test.mjs pins */
  assert.deepEqual(Object.keys(ft.FILING_TEMPLATES_WORDS), ["refusal.TEMPLATE_NOT_REVIEWED", "refusal.RFC_QUOTING_MISSING"],
                   "the table holds exactly the rows' keys");
  assert.equal(ft.FILING_TEMPLATES_WORDS["refusal.TEMPLATE_NOT_REVIEWED"], en("refusal.TEMPLATE_NOT_REVIEWED"), "verbatim from words.json, by key");
  /* the RFC row's word is read by key (DEC-260), pinned in r33.test.mjs */
  assert.equal(ft.FILING_TEMPLATES_WORDS["refusal.RFC_QUOTING_MISSING"], RFC_TRANSLATION, "the module's own word");
  assert.equal(ft.FILING_TEMPLATES_WORDS["refusal.RFC_QUOTING_MISSING"], en("refusal.RFC_QUOTING_MISSING"), "by key from words.json");
  const row = rows.TEMPLATE_NOT_REVIEWED;
  assert.deepEqual(Object.keys(row).sort(), ["check", "translation", "where"]);
  assert.deepEqual([row.check, row.where], ["C-125.33", AT("#profileRefusal", "is-profile-offered")]);
  assert.equal(row.translation, ft.FILING_TEMPLATES_WORDS["refusal.TEMPLATE_NOT_REVIEWED"]);
  assert.equal(row.translation, en("refusal.TEMPLATE_NOT_REVIEWED"));
  assert.match(row.translation, /\{missing\}/, "its placeholder left for the screen");
  assert.notEqual(row.translation, T45_NOT_REVIEWED, "T45's words no longer");
});

test("R29 C-125.34 TEMPLATE_COURT_PETITION reads words.json's refusal.TEMPLATE_COURT_PETITION by key (K4043); every other row keeps its own", () => {
  const row = rows.TEMPLATE_COURT_PETITION;
  assert.deepEqual([row.check, row.where, row.translation], ["C-125.34", AT("#courtPetition", "is-court-petition"), COURT_PETITION]);
  assert.equal(row.translation, en("refusal.TEMPLATE_COURT_PETITION"), "verbatim from words.json, by key");
  /* T47 (R30) moved C-125.4's `where` to its one site, which r30.test.mjs pins; read here at its T46 place, so this pin
     still proves no other check, where or translation moved */
  const kept = Object.fromEntries(Object.entries(rows).filter(([c]) => c !== "TEMPLATE_NOT_REVIEWED" && c !== "RFC_QUOTING_MISSING")
    .map(([c, r]) => [c, { check: r.check, where: c === "TEMPLATE_BLANK_UNKNOWN" ? AT("#textRefusal", "is-template-text") : r.where }]));
  assert.deepEqual([Object.keys(kept).length, sha256HexSync(canonicalJson(kept))], [KEPT.count, KEPT.sha256],
    "no other row's check or where moved");
  for (const code of Object.keys(kept)) {
    assert.ok(!Object.values(ft.FILING_TEMPLATES_WORDS).includes(rows[code].translation), code);
    if (hasWord(`refusal.${code}`)) assert.equal(rows[code].translation, word(`refusal.${code}`), `${code}: the list's word, by key`);
  }
});

test("R29 the refusal is answered by the reads with words.json's sentence and R15's lacks beside it, behaviour unmoved; the control, the same templates with their attribution whole, are offered", () => {
  const w = seeded();
  const want = { "TPL-test-records-request": ["sources", "professional_review"], "TPL-test-bylaw-complaint": ["sources", "professional_review"],
                 "TPL-test-commitment-brief": ["sources", "professional_review"], "TPL-test-recognition": ["professional_review"],
                 "TPL-test-recognition-follow-up": ["professional_review"] };
  const before = w.snapshot();
  for (const [id, lacks] of Object.entries(want)) {
    const o = w.ft.offeredVersion({ template: id, viewer: A });
    assert.deepEqual([o.ok, o.reason, o.code, o.check, o.translation], [false, "TEMPLATE_NOT_REVIEWED", "TEMPLATE_NOT_REVIEWED", "C-125.33",
                                                                         en("refusal.TEMPLATE_NOT_REVIEWED")], id);
    assert.deepEqual([o.template, o.lacks], [id, lacks], `${id}: what fills {missing}, beside it`);
    const r = w.ft.templateRead({ template: id, viewer: A });
    assert.deepEqual([r.offered, r.not_offered.translation, r.not_offered.lacks], [false, en("refusal.TEMPLATE_NOT_REVIEWED"), lacks], id);
  }
  assert.deepEqual(w.ft.templatesFor({ viewer: A }).templates, [], "none listed");
  assert.deepEqual(w.snapshot(), before, "the reads write nothing");
  /* by name too */
  const named = w.ft.offeredVersion({ name: "@request-under-the-records-act", viewer: A });
  assert.deepEqual([named.reason, named.translation, named.lacks], ["TEMPLATE_NOT_REVIEWED", en("refusal.TEMPLATE_NOT_REVIEWED"), want["TPL-test-records-request"]]);
  /* no answer carries T45's words */
  assert.ok(!JSON.stringify([named, ...PROFILE_IDS.map((id) => w.ft.offeredVersion({ template: id, viewer: A }))]).includes(T45_NOT_REVIEWED));
  /* the control: each part supplied, each template offered */
  const ok = seeded({ jur: reviewedOf() });
  for (const id of PROFILE_IDS) assert.equal(ok.ft.offeredVersion({ template: id, viewer: A }).ok, true, id);
  /* C-125.34, as the draft answers it, keeps its words */
  const cp = seeded({ jur: editedOf((p) => { p.action_kinds.find((k) => k.kind === "bylaw_complaint").venue.how = "court"; }) });
  const c = cp.ft.templateDraft({ project: cp.P, kind: "bylaw_complaint", use: "file", profiles: [TEST], name: "P", text: TEXT, author: A, viewer: A });
  assert.deepEqual([c.reason, c.check, c.translation], ["TEMPLATE_COURT_PETITION", "C-125.34", COURT_PETITION]);
});
