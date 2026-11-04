/* ratification against strength PR 176 (notice strength:176; strength R46, R47; DEC-464): a leg on a typed passage
   counts at the passage's grade, and its grading facts say it is typed and whether it is checked. This module reads only
   `strength.testimonyCorroboration` (R35; unchanged) and, through the case gate (R8), the document's own
   `grading_facts:` rows, so it needs no change: a typed leg is graded by the record, so a /10 document need not list it
   as ungraded (C-41.18, `case-catalogue` R7), and one that lists it, or a leg with no grade and no `typed`, is refused. */
import { test } from "node:test";
import { passagesWorld, refusedAlike, signs, typedRow, ungraded, TYPED, Q1 } from "./passages-world.mjs";

test("notice strength:176: a typed leg whose grading facts say typed (strength R47) signs unlisted as ungraded, checked or not; listed as ungraded it is refused C-41.18; a leg with no grade and no typed fact, unlisted, is refused", async () => {
  for (const typed of [{ checked: false }, { checked: true }]) {
    const checkers = typed.checked ? [{ level: "group", shown: null, at: "2026-10-03T09:00:00Z" }] : [];
    const lines = typedRow(TYPED, { checkers });
    await signs(await passagesWorld({ passages: [TYPED], facts: [{ finding: Q1, ord: 1, grade: null, typed }], lines }),
                `typed ${JSON.stringify(typed)}`);
    await refusedAlike(await passagesWorld({ passages: [TYPED], facts: [{ finding: Q1, ord: 1, grade: null, typed }],
                                             lines: [...lines, ...ungraded(TYPED)] }), ["C-41.18"], `typed ${JSON.stringify(typed)}, listed ungraded`);
  }
  await refusedAlike(await passagesWorld({ passages: [TYPED], facts: [{ finding: Q1, ord: 1, grade: null }], lines: typedRow(TYPED) }),
                     ["C-41.18"], "no grade, no typed fact, not listed");
});
