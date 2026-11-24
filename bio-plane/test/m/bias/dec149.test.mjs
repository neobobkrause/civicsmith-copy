/* bias R16, R24, R26's term, R11's act and remedy, and C-26.2's translation (T35-36; N682, K1833, DEC-149): the bias
   vocabulary says "group statement", never "instance statement", and the adoption's words say "the whole group", never
   "the instance". The scope value `instance` and every field name stay. Each served string is named whole. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, S, WHY } from "./world.mjs";
import { BIAS_CHECKS, INSTANCE_ADOPTION_ACT, INSTANCE_ADOPTION_REMEDY } from "../../../src/bias/index.mjs";
import { notAnAdmin } from "../../../src/membership/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const A = "BIAS-2026-0001-a", L = "BIAS-2026-0003-locked", J = "BIAS-2026-0000-proj", P = "PROJ-2026-0001-p";
const ADMIN = { reason: WHY, author: "admin", identity: "member:admin", viewer: "admin" };
const OWNER = { reason: WHY, scope: "project", scopeId: P, author: "owner", identity: "member:owner", viewer: "member:owner" };
/* DEC-149's retired words, as the sweep's own check reads them (case-authoring `dec149.test.mjs`). */
const RETIRED = /\b(this|the|whole) (plane|instance|copy)\b|\binstance statement\b/i;

const LOCKED_DETAIL = localize("bias.index.a_project_override_naming_locked", "a project override naming a LOCKED team statement is a conformance error; the team statement stands");
const INTERACTIONS_STATED = word("bias.entry_project_statement");

/* A group lens with a locked statement and a project lens that nullifies it, adds one on its subject and names none. */
async function lensWorld() {
  const w = world();
  await w.group("owner");
  w.project(P, "owner");
  w.set(A, [S("s1")], "adopted");
  w.set(L, [S("s3", { locked: true, subject: "ENT-2026-0042" })], "adopted");
  w.set(J, [S("n3", { text: "", nullifies: "s3" }), S("p1", { justification: "We read the office more closely here." })], "adopted");
  for (const id of [A, L]) assert.equal(w.bias.biasAdopt({ bundleId: id, ...ADMIN }).ok, true);
  assert.equal(w.bias.biasAdopt({ bundleId: J, ...OWNER }).ok, true);
  return w;
}

test("R16: each lock_violations entry's detail reads 'a project override naming a LOCKED group statement is a conformance error; the group statement stands'; the scope value instance and the field instance_bundle stay", async () => {
  const w = await lensWorld();
  const m = w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:owner" });
  assert.deepEqual(m.lock_violations, [{ project_bundle: J, statement_id: "n3", nullifies: "s3", instance_bundle: L,
                                         detail: LOCKED_DETAIL }]);
  assert.doesNotMatch(m.lock_violations[0].detail, RETIRED);
  assert.deepEqual(m.statements.filter((s) => s.statement_id === "s3").map((s) => [s.scope, s.locked]), [["instance", true]],
    "the team statement stands, its stored scope value unchanged");
  /* the op answers the same sentence */
  assert.equal(w.ops(`scope=project&scopeId=${P}&viewer=member:owner`).biasmanifest().lock_violations[0].detail, LOCKED_DETAIL);
});

test("R24: interactions_stated reads 'each entry is a project statement on a subject a group statement in force also addresses, … addressing the group statement, … It refuses nothing.', whole; the field instance stays", async () => {
  const w = await lensWorld();
  const m = w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:owner" });
  assert.equal(m.interactions_stated, INTERACTIONS_STATED);
  assert.doesNotMatch(m.interactions_stated, RETIRED);
  assert.deepEqual(m.interactions.map((i) => [i.statement_id, i.instance.map((x) => x.statement_id)]), [["p1", ["s1"]]]);
  assert.equal(w.ops(`scope=project&scopeId=${P}&viewer=member:owner`).biasmanifest().interactions_stated, INTERACTIONS_STATED);
});

test("R11: the group-scope adoption's act reads 'adopting a bias set for the whole group' and its remedy 'A project's owners set the lens over that project's work: adopt this set for a project you own, or ask an administrator to adopt it for the whole group.'; the scope value instance stays", async () => {
  assert.equal(INSTANCE_ADOPTION_ACT, localize("bias.index.adopting_bias_set_whole_team", "adopting a bias set for the whole team"));
  assert.equal(INSTANCE_ADOPTION_REMEDY, word("bias.project_owners_set"));
  const w = await lensWorld();
  const r = w.bias.biasAdopt({ bundleId: A, reason: WHY, author: "owner", identity: "member:owner", viewer: "member:owner" });
  assert.deepEqual(r, notAnAdmin("owner", INSTANCE_ADOPTION_ACT, { remedy: INSTANCE_ADOPTION_REMEDY, scope: "instance" }));
  assert.ok(r.detail.startsWith(INSTANCE_ADOPTION_ACT), r.detail);
  assert.ok(r.message.endsWith(INSTANCE_ADOPTION_REMEDY), r.message);
  for (const t of [r.detail, r.remedy, r.message]) assert.doesNotMatch(t, RETIRED);
});

test("R29: C-26.2's translation reads 'Registry entries are what let the record notice when a project statement and a group statement are about the same thing'; no C-26 row's translation says 'instance statement' or 'the instance'", () => {
  assert.equal(BIAS_CHECKS.BIAS_STATEMENT_SUBJECT_NOT_REGISTERED.translation,
    word("refusal.BIAS_STATEMENT_SUBJECT_NOT_REGISTERED"));
  for (const [code, row] of Object.entries(BIAS_CHECKS)) assert.doesNotMatch(row.translation, RETIRED, code);
});

test("R16, R24, R26: the module's served text says group statement — no manifest, adoption, inhale, draft or debt answer carries a retired word", async () => {
  const w = await lensWorld();
  const answers = [
    w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:owner" }),
    w.bias.biasManifest({ viewer: "admin" }), w.bias.biasManifest({ scope: "project", viewer: "member:owner" }),
    w.bias.biasAdopt({ bundleId: A, reason: WHY, author: "owner", identity: "member:owner", viewer: "member:owner" }),
    w.bias.biasAdopt({ bundleId: A, ...ADMIN }),
    w.bias.biasInhale({ policy: "Verify every figure against a primary record. Our reporters value the craft." }),
    w.bias.descriptionDraft({ viewer: "member:owner" }),
    w.bias.biasDebt({ run: "RUN-x", viewer: "admin" }),
  ];
  /* the stored and wire value `instance` is a value, not text: only the strings a member reads are judged */
  const texts = (v) => typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(texts)
    : v && typeof v === "object" ? Object.entries(v).filter(([k]) => k !== "scope").flatMap(([, x]) => texts(x)) : [];
  for (const a of answers) for (const t of texts(a)) assert.doesNotMatch(t, RETIRED, t);
});
