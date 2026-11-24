/* screens-settings at the screen contract (interface-shell R21, R38, R5; draft-T46-interface §4 (1)): the screens are
   registry screens, each lists exactly its registry acts (an owed act by the op it owes), every act names an op `OPS`
   holds, every function is self-contained (K2854 T1: it runs the same when rebuilt from its own source, with nothing
   in scope), and every word a screen names is a word of `setup-words`' list (R39). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OPS, OP_ALIASES } from "../../../src/op-declarations/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { SCREENS, SCREEN_WORDS, KEYS } from "../../../src/screens-settings/index.mjs";
import { open, said, day, storeWorld } from "./kit.mjs";
import { interfacePage, interfaceScript, interfaceScriptHash, checkScreens, RE_POINTS } from "../../../src/interface-shell/index.mjs";
import { teamNamed } from "./seed-common.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const PATH = "docs/development/ux-substrate/screens/registry.json";
// the registry as merged into tranche/T47 at L11's START (PR #33's head; wizard-scripts R35)
const registry = () => JSON.parse(readFileSync(join(ROOT, PATH), "utf8"));
const IDS = ["settings", "members", "teamai", "account", "connect", "notes", "group", "group-identity", "places", "recovery", "security", "translations", "updates", "glossary", "grouprules", "bias"];

test("the screens are the registry's, each listing exactly its registry acts, an owed act by the op it owes (interface-shell R38)", () => {
  const reg = registry().screens;
  assert.deepEqual(SCREENS.map((s) => s.id), IDS);
  for (const s of SCREENS) {
    const r = reg.find((x) => x.id === s.id);
    assert.ok(r, `${s.id} is a registry screen`);
    // the registry's acts, and the re-points the shell names for the screen until the registry lists them (interface-shell R21, R73)
    const want = new Set([...r.acts.map((a) => (/^owed:/.test(a.op) ? a.op.slice(5).split(" ")[0] : a.op)), ...(RE_POINTS[s.id] || [])]);
    assert.deepEqual(new Set(s.acts.map((a) => a.op)), want, `${s.id}'s acts`);
    assert.equal(s.acts.length, want.size, `${s.id} lists each act once`);
  }
  // DEC-197: Your account draws no handle change
  assert.ok(!SCREENS.find((s) => s.id === "account").acts.some((a) => a.op === "handlechange"));
});

test("every act names an op OPS holds (owed:infolevelset's op among them, op-declarations R50), and every read too", async () => {
  for (const s of SCREENS) for (const a of s.acts) {
    const op = OP_ALIASES[a.op] || a.op;
    assert.ok(OPS[op], `${s.id}: ${a.op} is served`);
  }
  // the session an administrator's page reads as: the world's own answer to `whoami`
  const w = await storeWorld(), me = await (await w.signIn("founder")).read("whoami");
  for (const s of SCREENS) for (const [n, r] of Object.entries(s.reads({ me, subject: "ana" }))) {
    assert.ok(OPS[r.op], `${s.id}: read ${n} (${r.op}) is served`);
  }
});

test("the shell serves the screens: interfacePage passes its R21 check, and the page runs each screen from its own source (self-contained), drawing it", async () => {
  assert.equal(checkScreens(SCREENS), true);
  // the shell and its screens are one external, versioned script (interface-shell R1, R2): the page names it by its hash, the screens are in it
  const html = interfacePage(SCREENS), script = interfaceScript(SCREENS);
  assert.ok(html.includes(`integrity="${interfaceScriptHash(SCREENS)}"`), "the page names its script by its hash");
  assert.ok(!/<script[^>]*nonce=/.test(html), "no inline script, no nonce");
  for (const s of SCREENS) for (const a of s.acts) assert.ok(script.includes(a.op), `${s.id}'s ${a.op} is in the script`);
  // each screen over the team that holds what it draws, as the administrator who finds it (the 26,000 words of the list are not drawn in a test's time: seed-group's `onlyWords`)
  const t = await teamNamed("full");
  const tables = { translations: { translations: t.only } };
  for (const s of SCREENS) {
    const o = await open(s.id, { world: t.w, as: t.founder, table: tables[s.id], subject: s.id === "translations" ? "es" : null });
    assert.ok(o.text.includes(said(`screen.${s.id}.name`)), `${s.id} drawn`);
    assert.ok(!o.tree.children.some((c) => c.attrs && c.attrs["data-state"] === "failed"), `${s.id}'s render ran from its source`);
  }
  // a screen whose function reaches outside itself fails in the page, so this check would see it
  const leaky = { ...SCREENS.find((x) => x.id === "notes"), render(cs) { return cs.title() + NOT_IN_SCOPE; } };
  const o = await open("notes", { world: t.w, as: t.founder, screens: SCREENS.map((x) => (x.id === "notes" ? leaky : x)) });
  assert.ok(o.html.includes('data-state="failed"'), "control: a leaky render is drawn as failed");
});

/* R39 (T49; K3366, K3368; DEC-257, DEC-258; setup-words R11–R13): this module holds no member-facing English, only keys; each is a word of
   setup-words' list; what it draws equals `word(key, vars)`. */
const READS = () => JSON.parse(readFileSync(join(ROOT, "docs/development/ux-substrate/screens/words-reads.json"), "utf8")).modules["screens-settings"];

test("R39 words by key: the module holds no row, every key it reads is a word of the list (hasWord), the design's reads list is met and its retired row is gone", () => {
  assert.ok(Object.isFrozen(SCREEN_WORDS) && SCREEN_WORDS.length === 0, "no row of English is held");
  const reads = READS();
  /* the design's reads list for this module also names keys of screens and acts that are another module's or are owed and not yet
     built: the acts `captureupload*` (screens-intake's), the AI and install pages the registry marks owed, and `plan`'s writing help
     (screens-action's). None of them is drawn here, and this module draws no key to satisfy the list (SCREENS-SETTINGS #19, K5148):
     a key of the list that `KEYS` lacks must be of that kind, and every other key of the list is in `KEYS` */
  const NOT_DRAWN_HERE = [/^act\.captureupload[a-z]+\.does$/, /^act\.owed_(ai|install)[a-z]+\.does$/, /^screen\.ai[a-z]+\.(name|purpose)$/, /^act\.writinghelp\.label\.plan$/];
  const elsewhere = (k) => NOT_DRAWN_HERE.some((re) => re.test(k));
  for (const k of reads.reads) assert.ok(KEYS.includes(k) || elsewhere(k), `${k} is a key this module reads, or one of another module's`);
  for (const k of KEYS) assert.ok(hasWord(k), `${k} is a word`);
  // the design's list no longer carries a retired list; the one row known retired stays asserted absent by name (DEC-256)
  for (const k of [...(reads.retired ?? []), "screen.updates.skip.noreason"]) assert.ok(!KEYS.includes(k) && !hasWord(k), `${k} is retired`);
  for (const s of SCREENS) for (const k of s.words) {
    assert.equal(typeof k, "string", `${s.id}: its words are keys, never rows`);
    assert.ok(hasWord(k), `${s.id}: ${k}`);
  }
  // the keys the requirements name besides the reads list
  for (const k of ["refusal.UPDATE_SKIP_NO_REASON", "member.founder.unnamed", "member.founder.unnamed.help", "connect.ifnot", "connect.notnow", "refusal.reference", "updates.running.release_setup", "updates.earlier.installed_setup"])
    assert.ok(hasWord(k), k);
  /* the design's own `unkeyed` list is not counted (K4641): an entry stands only with its reason (a non-empty `why`) */
  for (const u of reads.unkeyed ?? []) assert.ok(typeof u.why === "string" && u.why.trim() !== "", `${u.file}:${u.line} stays in source with no reason`);
});

test("R39 what a screen draws for a sample of its keys equals word(key, vars)", async () => {
  const t = await teamNamed("full");
  const a = await open("members", { world: t.w, as: t.founder });
  for (const k of ["screen.members.col.handle", "screen.members.col.status", "screen.members.invite.heading"])
    assert.ok(a.text.includes(unescapeHtml(word(k))), k);
  // the count is of the active members and of the administrators among them, as the roster lists them
  const active = (await t.founder.read("memberlist")).members.filter((m) => m.status === "active");
  assert.ok(a.text.includes(unescapeHtml(word("screen.members.count", { members: active.length, administrators: active.filter((m) => m.role === "admin").length }))));
  const ai = await open("teamai", { world: t.w, as: t.founder });
  for (const k of ["screen.teamai.sub", "screen.panel.uses.heading", "screen.panel.limits.heading"]) assert.ok(ai.text.includes(unescapeHtml(word(k))), k);
  const c = await open("connect", { world: (await teamNamed("connect-none")).w, as: (await teamNamed("connect-none")).dev });
  for (const k of ["screen.connect.way.field", "screen.connect.way.subscription", "screen.connect.signin.step1", "connect.ifnot"]) assert.ok(c.text.includes(unescapeHtml(word(k))), k);
  const u = await open("updates", { world: t.w, as: t.founder });
  const ready = (await t.founder.read("updatenotice")).ready;
  assert.ok(u.text.includes(unescapeHtml(word("updates.ready.release", { version: ready.version, date: day(ready.date) }))));
  // a word the list lacks, or a fill it names that the screen does not give, throws: it is never drawn as the key or empty
  assert.throws(() => word("screen.members.nosuchword"), (e) => e.code === "UNKNOWN_WORD");
  assert.throws(() => word("screen.members.count", { members: 1 }), (e) => e.code === "WORD_VAR_MISSING");
});
const unescapeHtml = (t) => String(t).replace(/\s+/g, " ").trim();
