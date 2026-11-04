/* answer-envelope: the T53 provider notices admission:171, strength:176, ai-accounts:188, answers:197 and
   question-explorer:199. Of each provider this module reads only its check families, at its place in `build/modules.json`
   (R2, R7), and decorates its refusals with them; nothing else of theirs is used here. Each is confirmed with no code
   change: every row of the provider's families decorates with its own code, check and translation, unless an earlier
   listed family already holds the code (R2's composition), and the provider's file sits at its modules.json place. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { M } from "./load.mjs";

const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);
const translated = (r) => !!r && typeof r.translation === "string" && r.translation !== "";
const MODULES = JSON.parse(readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules.map((m) => m.id);

/* the first listed row with words holding `code`, and the file it is in */
function firstHolder(code) {
  for (const [p, ns] of M.CHECK_FAMILY_FILES)
    for (const k of Object.keys(ns).sort()) if (isFamily(k, ns[k]) && translated(ns[k][code])) return [p, ns[k][code]];
  return null;
}

/* the module of each listed file, by its directory; the list's module ids are in modules.json order */
const moduleOf = (p) => (p === "src/setup.mjs" ? "instance-setup" : p === "src/skilldoctrine.mjs" ? "skills" : p.split("/")[1]);

async function confirm(id, file, { shadowed = {} } = {}) {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const i = paths.indexOf(file);
  assert.ok(i >= 0, `${file} is listed`);
  const ns = M.CHECK_FAMILY_FILES[i][1];
  assert.equal(ns, await import(`../../../${file}`));
  /* its place: after every listed file of an earlier module and before every one of a later module */
  const rank = MODULES.indexOf(id);
  assert.ok(rank >= 0, id);
  paths.forEach((p, j) => {
    const r = MODULES.indexOf(moduleOf(p));
    if (r < 0 || r === rank) return;
    assert.equal(j < i, r < rank, `${p} against ${file}`);
  });
  let own = 0, all = 0;
  for (const [k, rows] of Object.entries(ns)) if (isFamily(k, rows))
    for (const [code, row] of Object.entries(rows)) {
      if (!translated(row)) continue;
      all++;
      const [p, first] = firstHolder(code);
      if (p === file && first === row) {
        own++;
        assert.deepEqual(M.dec49Attach({ ok: false, reason: code }),
                         { ok: false, reason: code, code, check: row.check ?? null, translation: row.translation }, `${id} ${code}`);
      } else {
        /* held earlier: only the codes named here, each by the family that holds it */
        assert.equal(shadowed[code], p, `${id} ${code} is decorated from ${p}, not its own row`);
        assert.deepEqual(M.dec49Row(code), { check: first.check ?? null, translation: first.translation }, code);
      }
    }
  assert.ok(all > 0 && own > 0, `${id}: ${own} of ${all}`);
  assert.equal(all - own, Object.keys(shadowed).length, `${id}: the rows held earlier are exactly those named`);
  /* negative control: a code no family holds gains nothing */
  assert.equal(M.dec49Attach({ ok: false, reason: `NO_SUCH_${id.toUpperCase().replace(/-/g, "_")}_CODE` }).check, undefined);
}

test("notice admission:171 (R2, R7): admission's families decorate with their own code, check and translation, read from src/admission/checks.mjs at its modules.json place", async () => {
  await confirm("admission", "src/admission/checks.mjs");
});

test("notice ai-accounts:188 (R2, R7, R17): ai-accounts' family decorates with its own code, check and translation, read from src/ai-accounts/checks.mjs at its modules.json place, directly before credentials'", async () => {
  await confirm("ai-accounts", "src/ai-accounts/checks.mjs");
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  assert.equal(paths.indexOf("src/ai-accounts/checks.mjs") + 1, paths.indexOf("src/credentials/checks.mjs"));
});

test("notice answers:197 (R2, R7, R10): answers' family decorates with its own code, check and translation, read from src/answers/checks.mjs at its modules.json place, directly after question-explorer's", async () => {
  await confirm("answers", "src/answers/checks.mjs");
});

test("notice question-explorer:199 (R2, R7, R10): question-explorer's family decorates with its own code, check and translation, read from src/question-explorer/checks.mjs at its modules.json place, directly before answers'", async () => {
  await confirm("question-explorer", "src/question-explorer/checks.mjs");
});

test("notice strength:176 (R2, R7): strength's families decorate with their own code, check and translation, read from src/strength/checks.mjs at its modules.json place; BAD_GRADE alone is decorated from citation's C-33.61, which holds the same code earlier in the order", async () => {
  await confirm("strength", "src/strength/checks.mjs", { shadowed: { BAD_GRADE: "src/citation/checks.mjs" } });
});

test.todo("R7 (strength:176's family): strength's BAD_GRADE decorates with its own C-107.2, as R7 pins it; citation's C-33.61 (DEC-441, K5303) holds the same code earlier in the order, so it is the code's owners' to re-code");
