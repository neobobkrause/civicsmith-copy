/* wizard-scripts: provider notice ai-accounts:188 (its F2). ai-accounts' door arms now take a stamped `member:<id>` `by` as the
   member owner as it stands (aiownadd, aimineuse, aimycheckset, aipersonalchoose). This module calls none of those arms: it
   imports only aiAccountsOf and KEPT_AWAY_UNREADABLE, and reads the keep-away (ai-accounts R7's aiKeptAway) at R24, R27.
   Confirmed with no code change: the keep-away read through the real ai-accounts answers as before. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { seeded, V } from "./fixture.mjs";

const SRC = new URL("../../../src/wizard-scripts/", import.meta.url);
const ON = { on: true, account: { kind: "own", level: "member" } };

test("notice ai-accounts:188 (R24, R27): no source of this module calls ai-accounts' door arms (aiAccountsOps), only aiAccountsOf; the keep-away an administrator sets through the real ai-accounts still refuses writing help AI_KEPT_AWAY, and cleared offers it", () => {
  const imports = readdirSync(SRC).filter((f) => f.endsWith(".mjs"))
    .flatMap((f) => [...readFileSync(new URL(f, SRC), "utf8").matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\.\/ai-accounts\/[^"]*"/g)])
    .flatMap((m) => m[1].split(",").map((n) => n.trim()).filter(Boolean));
  assert.deepEqual([...new Set(imports)].sort(), ["KEPT_AWAY_UNREADABLE", "aiAccountsOf"]);
  const w = seeded();
  const at = () => w.wz.writingHelpAt({ op: "notewrite", field: "text", assistant: ON });
  assert.deepEqual(at(), { offered: true }, "control: nothing kept away");
  assert.equal(w.accounts.aiKeepAwaySet({ on: true, reason: "We hold residents' records", by: V("erin") }).ok, true);
  assert.deepEqual(at(), { offered: false, code: "AI_KEPT_AWAY" });
  assert.equal(w.accounts.aiKeepAwaySet({ on: false, reason: null, by: V("erin") }).ok, true);
  assert.deepEqual(at(), { offered: true });
});
