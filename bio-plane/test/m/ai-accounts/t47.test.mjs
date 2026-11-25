/* Ported from credentials' t47.test.mjs (T48-10; split map §6, K874): its account arms, each under its new id with its
   old one kept. The disclosure-first order held here (R23, was credentials R64: its registration seam and its one site
   of DISCLOSURE_DUE) and R1's T47 clause (was credentials R22) refusing an API key through it. A run segment's
   credential (credentials R63) stays credentials'. Every refusal has a control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { world } from "./fixture.mjs";
import { AI_ACCOUNT_CHECKS } from "../../../src/ai-accounts/index.mjs";
import { MEMBERSHIP_CHECKS } from "../../../src/membership/index.mjs";

const WORDS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8"));
const word = (key) => {
  const found = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") { if (v.key === key && typeof v.en === "string") found.push(v.en); Object.values(v).forEach(walk); }
  };
  walk(WORDS);
  assert.equal(found.length, 1, `words.json holds ${key} once`);
  return found[0];
};
const DUE_KEYS = ["check", "code", "detail", "member", "ok", "reason", "translation"];

test("R23 (was credentials R64): registerDisclosureRead: one registration whoever makes it, malformed and second refused through membership R81; disclosureDue null for shown, DISCLOSURE_DUE (C-29.40) for anything else or a throw, nothing asked with none registered; writes nothing; reached by no route", async () => {
  const w = await world().group("ann");
  /* with none registered: no order is held, and nothing is asked */
  assert.equal(w.c.disclosureDue({ member: "ann" }), null);
  for (const [module, fn] of [[null, () => ({ shown: true })], ["", () => ({ shown: true })], ["instance-setup", null],
                              ["instance-setup", "disclosureOf"], [7, () => ({})]]) {
    const r = w.c.registerDisclosureRead(module, fn);
    assert.deepEqual([r.ok, r.code, r.check, r.translation], [false, "LISTENER_MALFORMED", MEMBERSHIP_CHECKS.LISTENER_MALFORMED.check,
      MEMBERSHIP_CHECKS.LISTENER_MALFORMED.translation], String(module));
  }
  assert.equal(w.c.disclosureDue({ member: "ann" }), null, "a refused registration registers nothing");
  let answer = { ok: true, shown: false };
  const asked = [];
  const fn = (a) => { asked.push(a); if (answer instanceof Error) throw answer; return answer; };
  assert.deepEqual(w.c.registerDisclosureRead("instance-setup", fn), { ok: true, module: "instance-setup" });
  for (const who of ["instance-setup", "plane"]) {
    const second = w.c.registerDisclosureRead(who, () => ({ shown: true }));
    assert.deepEqual([second.ok, second.code, second.module, second.check], [false, "LISTENER_DECLARED", "instance-setup",
      MEMBERSHIP_CHECKS.LISTENER_DECLARED.check], who);
  }
  const before = w.snapshot();
  /* fail closed: every answer but `shown: true`, and a throw, is the one refusal */
  const notShown = [{ ok: true, shown: false }, { shown: "true" }, { shown: 1 }, {}, null, undefined, "shown", true,
                    Promise.resolve({ shown: true }), new Error("store unreadable")];
  for (const a of notShown) {
    answer = a;
    const r = w.c.disclosureDue({ member: "ann" });
    assert.deepEqual(Object.keys(r ?? {}).sort(), DUE_KEYS, String(a));
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation, r.member],
      [false, "DISCLOSURE_DUE", "DISCLOSURE_DUE", "C-29.40", word("refusal.DISCLOSURE_DUE"), "ann"], String(a));
    assert.ok(typeof r.detail === "string" && r.detail.length > 20);
  }
  answer = { ok: true, member: "ann", shown: true, shown_at: "2026-10-12T00:00:00Z" };
  assert.equal(w.c.disclosureDue({ member: "ann" }), null, "shown: the order is met");
  assert.deepEqual(asked.at(-1), { member: "ann" }, "the registered read is asked for the member named");
  assert.equal(w.snapshot(), before, "R23 writes nothing");
  /* its row: C-29.40, its `where` its one site, its translation words.json's by key (C-69.6's code and sentence) */
  assert.deepEqual(AI_ACCOUNT_CHECKS.DISCLOSURE_DUE, { check: "C-29.40",
    where: "src/ai-accounts/index.mjs disclosureDue > is-disclosure-shown", translation: word("refusal.DISCLOSURE_DUE") });
  const routes = Object.keys(w.ops());
  assert.ok(!routes.some((r) => /disclosure/.test(r)), "in-plane: no route reaches the seam or the read");
});

test("R1 R23 (was credentials R22's T47 clause, R64): accountReferenceSet: an API key is refused DISCLOSURE_DUE while R23 answers the disclosure due, asked after every other refusal, writing nothing; held once shown; accountReferenceRemove never refused for it", async () => {
  const w = await world().group("ann", "bob");
  const shown = new Set();
  const asked = [];
  w.c.registerDisclosureRead("instance-setup", ({ member }) => { asked.push(member); return { ok: true, shown: shown.has(member) }; });
  const set = (o) => w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ant-T47-SENTINEL", by: "ann", ...o });
  const before = w.snapshot();
  /* every earlier refusal answers as before, while the disclosure is due */
  const earlier = [[{ by: "class:member" }, "MACHINE_CANNOT_HOLD_ACCOUNT"], [{ by: "bob" }, "NOT_YOUR_ACCOUNT"],
                   [{ kind: "subscription" }, "UNKNOWN_ACCOUNT_KIND"], [{ secret: " " }, "NO_SECRET"]];
  for (const [o, code] of earlier) assert.equal((await set(o)).code, code, code);
  const due = await set({});
  assert.deepEqual([due.ok, due.code, due.check, due.translation], [false, "DISCLOSURE_DUE", "C-29.40", word("refusal.DISCLOSURE_DUE")]);
  assert.equal(asked.at(-1), "ann", "asked for the acting member, the door's stamp");
  /* through the route too: the same refusal */
  assert.equal((await w.ops("by=ann", { member: "ann", kind: "apikey", secret: "sk-ant-T47-SENTINEL" }).accountreferenceset()).code,
    "DISCLOSURE_DUE");
  assert.equal(w.snapshot(), before, "no refusal writes, and the key is held nowhere");
  assert.equal(w.c.accountReferenceState({ member: "ann", viewer: "member:ann" }).held, false);
  /* control: once shown, the key is held */
  shown.add("ann");
  const ok = await set({});
  assert.deepEqual([ok.ok, ok.kind], [true, "apikey"]);
  assert.equal(w.c.accountReferenceState({ member: "ann", viewer: "member:ann" }).held, true);
  /* the member not active is refused as before (asked before the disclosure) */
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  assert.equal((await w.c.accountReferenceSet({ member: "bob", kind: "apikey", secret: "x", by: "bob" })).code,
    "ACCOUNT_MEMBER_NOT_ACTIVE");
  /* removal is never refused for the disclosure */
  shown.delete("ann");
  assert.deepEqual(w.c.accountReferenceRemove({ member: "ann", by: "ann" }), { ok: true, removed: true });
  /* control: with no read registered (a module test with no instance-setup), no order is held */
  const v = await world().group("ann");
  assert.equal((await v.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "x", by: "ann" })).ok, true);
});
