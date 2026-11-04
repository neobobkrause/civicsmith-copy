/* Notice ai-accounts:188 (PR 188, ai-accounts F2): ai-accounts' door arms (aiownadd, aimineuse, aimycheckset,
   aipersonalchoose, ownerOf's member arm) now take a stamped `by` that already reads `member:<id>` as the owner as it
   stands, never `member:member:<id>`. Confirmed with no code change here: this module imports nothing of ai-accounts
   and none of its feeds reads it (its Uses name `ai-accounts` only for R60's `creditsStopsOpen`, not yet met, T53), so
   no item it raises can carry an owner those arms write. Nothing to revert: the receipt takes --exempt-revert. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { world } from "./world.mjs";

const SRC = new URL("../../../src/queue-producers/", import.meta.url);

test("notice ai-accounts:188: no source file of this module imports ai-accounts, and feedItems reads no feed of it; control: the module does import the providers it reads (capture-requests, ai-runs)", () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.includes("index.mjs"));
  const imports = files.flatMap((f) => [...readFileSync(new URL(f, SRC), "utf8").matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]));
  assert.deepEqual(imports.filter((p) => /ai-accounts/.test(p)), [], "no import of ai-accounts");
  for (const used of ["../capture-requests/index.mjs", "../ai-runs/index.mjs"]) assert.ok(imports.includes(used), used);

  const r = world().read(null, "class:admin");
  const feeds = [...Object.keys(r.facts.ms), ...r.facts.absent, ...r.facts.failed.map((f) => f.feed)];
  assert.ok(feeds.length > 0, "the feeds read are named");
  assert.deepEqual(feeds.filter((f) => /ai-accounts|ai-credits/.test(f)), [], "no feed reads ai-accounts");
});
