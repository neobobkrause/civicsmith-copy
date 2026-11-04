/* The provider notice op-declarations:95 (PR 95: R20, R24, R30, R41 restated for T53, `ai-accounts` R35). The group's key ops, the
   account-reference ops and `subscriptiondisconnect` lost their specs, with no aliases. `teamai` read `groupkeystate` and sent `groupkeyset`,
   `groupkeyswitch` and `groupkeyremove`; `connect` read `accountreference` and sent the rest. With them in `SCREENS` the shell refused to
   build any page ("screen teamai's act names groupkeyset, which OPS does not hold"). This module's R95 decides what follows: `connect` and
   `teamai` leave `SCREENS` (their places, `aimine` and `aiproviders`, are screens-ai's and are linked once it registers them; BOB, 4 Nov), and the module's source names none of the
   retired ops. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { OPS, OP_ALIASES } from "../../../src/op-declarations/index.mjs";
import { SCREENS } from "../../../src/screens-settings/index.mjs";
import { checkScreens } from "../../../src/interface-shell/index.mjs";
import { open, said } from "./kit.mjs";
import { teamNamed } from "./seed-common.mjs";
import { R95_RETIRED } from "./r95.mjs";

const SRC = new URL("../../../src/screens-settings/", import.meta.url);

test("notice op-declarations:95: OPS holds no spec and no alias for the ops PR 95 retired (every op R95 lists but `subscriptionsignin`, which is signin-door's and keeps its spec)", () => {
  for (const op of R95_RETIRED.filter((o) => o !== "subscriptionsignin")) {
    assert.equal(OPS[op], undefined, `${op} has no spec`);
    assert.equal(OP_ALIASES[op], undefined, `${op} has no alias`);
  }
});

test("notice op-declarations:95 (R95): SCREENS holds neither connect nor teamai, and the shell's screen check passes over what is left", () => {
  const ids = SCREENS.map((s) => s.id);
  assert.ok(!ids.includes("connect") && !ids.includes("teamai"), ids.join(", "));
  assert.equal(checkScreens(SCREENS), true);
  // every act and every read of every remaining screen is an op OPS holds, for an administrator and for a member
  for (const me of [{ member: "admin", administer: true }, { member: "dev", administer: false }]) for (const s of SCREENS) {
    for (const a of s.acts) assert.ok(OPS[OP_ALIASES[a.op] || a.op], `${s.id}: act ${a.op}`);
    for (const [n, r] of Object.entries(s.reads({ me, subject: s.id === "members" ? "ana" : null, ui: {}, data: {} }) || {})) assert.ok(OPS[r.op], `${s.id}: read ${n} (${r.op})`);
  }
});

test("notice op-declarations:95 (R95): the module's source names none of the retired ops, in code, in a word key or in a comment", () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.length >= 10, "the module's files are read");
  const named = new RegExp(`(^|[^A-Za-z0-9_])(${R95_RETIRED.join("|")})($|[^A-Za-z0-9_])`);
  for (const f of files) {
    const text = readFileSync(new URL(f, SRC), "utf8");
    const hit = named.exec(text);
    assert.equal(hit, null, `${f} names ${hit && hit[2]}`);
  }
});

test("notice op-declarations:95 (R95, R17): the Settings list refers to neither retired screen; aimine and aiproviders, their places, are screens-ai's and are not linked while it registers no screen (BOB, 4 Nov; links.test.mjs); control: members, account and notes draw", async () => {
  const t = await teamNamed("full");
  const a = await open("settings", { world: t.w, as: t.founder });
  const refs = [...a.html.matchAll(/data-screen="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.includes("members") && refs.includes("account"), refs.join(", "));
  assert.ok(!refs.includes("connect") && !refs.includes("teamai"), refs.join(", "));
  assert.ok(!refs.includes("aimine") && !refs.includes("aiproviders"), refs.join(", "));
  for (const [id, who, subject] of [["members", "founder", "ana"], ["account", "dev", null], ["notes", "dev", null]]) {
    const o = await open(id, { world: t.w, as: t[who], subject });
    assert.ok(o.text.includes(said(`screen.${id}.name`)), `${id} drawn`);
  }
});
