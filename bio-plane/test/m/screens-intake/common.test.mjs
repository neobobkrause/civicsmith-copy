/* screens-intake R8, R9 and the screen contract (interface-shell R21, R5, R10, R12) over all five screens, on the real
 * served page: `interfacePage(SCREENS)` through interface-shell's harness, over the REAL store (fix round 10, K5054): the team holds a page, an archive, a captured
 * address, a file the scanner held, a knock and a question, all made by the owners' own acts; the scanner is the environment's double (file-safety's own scripted
 * `FILE_SCANNER`). A read that fails or never answers is a fault, the only scripted answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { interfacePage, interfaceScript, interfaceScriptHash, checkScreens, SHELL_OPS } from "../../../src/interface-shell/index.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { WORD_ROWS } from "../../../src/setup-words/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { OPS, SESSION_OPS, NEEDS } from "../../../src/op-declarations/index.mjs";
import { pending } from "../interface-shell/harness.mjs";
import { openWorld, members, html, text, main, refused, MEMBER, rawKeys, fill, press, word, hasWord } from "./page.mjs";
import { scanner } from "../file-safety/fixture.mjs";
import { makeZip } from "../../make-zip.mjs";

const CAN = ["contribute", "create_projects"];
/* the ops a screen reads: its own declared reads, over a subject and a viewer (the four states are made by failing or holding them all) */
const SHA = "a".repeat(64);   /* an address no team holds: the empty team's */
/* the screens' declared reads over a capture's address, and the three they ask in a state that address does not reach (a question to file under, a scan not yet reported, a source's rung) */
const READS = [...new Set([...SCREENS.flatMap((s) => Object.values(s.reads({ subject: SHA, me: MEMBER, data: {}, ui: {} })).map((r) => r.op)), "search", "scanstatus", "sourcerung"])];

/* The team's reach to its assistant (interface-shell R20): the administrator's real acts set and switch on the team's key. */
async function reach(world) {
  const admin = await world.signIn("admin");
  await admin.act("reauth", { body: { password: admin.password } });
  await admin.act("groupkeyset", { body: { key: "sk-ant-api03-" + "w".repeat(40) } });
  await admin.act("groupkeyswitch", { body: { on: true } });
  await admin.act("groupkeynoticeseen", { body: {} });
  return admin;
}
const daemon = (world, op) => world.door({ url: `/api/?op=${op}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, { token: world.env.DAEMON_TOKEN });
const ring = async (world, contentText, note) => (await world.door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentText, note }) } })).json;

/* A team that holds every kind of thing these screens show, made by real acts. `mai` reads and writes; `rosa` holds no capability at all. */
async function team({ filled = true } = {}) {
  const bad = new Set();
  const t = await members({ mai: CAN, rosa: [] }, { ai: true, env: { FILE_SCANNER: scanner({ clamav: (sha) => (bad.has(sha) ? { result: "found", findings: ["Eicar-Test-Signature"] } : { result: "clean" }) }) } });
  const admin = await reach(t.world);
  await admin.act("membercaps", { body: { memberId: "rosa", capabilities: [] } });
  const out = { ...t, admin, bad };
  if (!filled) return out;
  const w = t.world;
  out.project = await w.recipes.project(t.mai, "The Coliseum lease");
  await t.mai.act("projectinvite", { query: { projectId: out.project, handle: "rosa" } });
  await t.rosa.act("projectjoin", { query: { projectId: out.project } });
  out.question = (await w.recipes.question(t.mai, out.project, { title: "The garage", text: "Was the garage inspected?" })).id;
  out.page = await w.recipes.page(t.mai, "The inspection report", { project: out.project });
  out.archive = await w.recipes.hold(t.mai, "Inspection files", makeZip([{ name: "a.txt", data: "alpha text" }, { name: "b.txt", data: "beta text" }]), out.project, { type: "application/zip" });
  out.warned = await w.recipes.hold(t.mai, "Handed-in sheet", "A sheet somebody handed in.\n", out.project);
  out.held = await w.recipes.hold(t.mai, "Flagged sheet", "A sheet the scanner flags.\n", out.project);
  bad.add(out.held.sha);
  /* a document fetched from its address by the team's own capture request: the only kind the file-safety threat reads low */
  const address = "https://records.example.gov/inspections/2019.html";
  w.script(address, async () => new Response("<html><head><title>Inspections 2019</title></head><body><p>The garage was inspected.</p></body></html>", { status: 200, headers: { "content-type": "text/html" } }));
  const asked = await t.mai.act("capturerequest", { body: { address, target: out.question } });
  const drained = await daemon(w, "capturerequestdrain");
  const done = ((drained.json.result || {}).captured || []).find((c) => c.request === asked.request);
  assert.ok(done && done.promoted && done.promoted.ok, "the owner fetched the address and filed it");
  out.fetched = { sha: done.sha, bundle: done.promoted.bundle_id };
  const fresh = await ring(w, "The sheets they do not publish.", "Inspection sheets");
  out.knock = fresh.knockId;
  const pulled = await ring(w, "Another handed-in sheet.", "Pulled one");
  await t.mai.act("inboxpull", { body: { knockId: pulled.knockId, reason: "It bears on our question." } });
  await daemon(w, "scanbatch");
  return out;
}
let TEAM;
const full = () => (TEAM ||= team());
const pathsOf = (F) => ({ capture: ["/app/capture/address", `/app/capture/address/${F.question || "INQ-2026-0001-q"}`, "/app/capture/file", "/app/capture/saw"], held: ["/app/held"],
  archive: [`/app/archive/${F.archive ? F.archive.sha : SHA}`], "open-file": [`/app/open-file/${F.warned ? F.warned.sha : SHA}`],
  inbox: ["/app/inbox", `/app/inbox/${F.knock || "KNOCK-2026-10-03-9c1f0a2b"}`] });
const READ_FAULTS = (answer) => Object.fromEntries(READS.map((op) => [op, answer]));
/* the ops a screen declares: its reads' and its acts' */
const declared = (id) => { const s = SCREENS.find((x) => x.id === id); return [s, Object.values(s.reads({ subject: SHA, me: MEMBER, data: {}, ui: {} })).map((r) => r.op), s.acts.map((a) => a.op)]; };

test("R8 R15 SCREENS meets interface-shell R21: eight registry screens, archive and the three of the T51 fix round among them, served by interfacePage without a throw", async () => {
  await full();   /* the world registers the owners' declarations the screens' acts are held to */
  assert.deepEqual(SCREENS.map((s) => s.id), ["capture", "held", "archive", "open-file", "inbox", "about-knocker", "leads", "watching"]);
  assert.ok(Object.isFrozen(SCREENS));
  assert.equal(checkScreens(SCREENS), true);
  /* interface-shell R1, R2 (fix round 3): the page loads the shell as one external script named by its hash, with no inline script and no nonce;
     the screens' functions are in that script */
  const page = interfacePage(SCREENS, { version: "9" });
  assert.equal((page.match(/<script\b/g) || []).length, 1, "one script element");
  assert.match(page, /<script src="\/app\/shell-9\.js" integrity="sha256-[^"]+"><\/script>/);
  assert.ok(!/<script nonce=/.test(page) && !/nonce/.test(page), "no nonce slot");
  assert.ok(page.includes(`integrity="${interfaceScriptHash(SCREENS, {})}"`), "named by its hash");
  assert.ok(interfaceScript(SCREENS).includes("capture"), "the screens are in the external script");
  for (const s of SCREENS) {
    assert.equal(typeof s.reads, "function");
    assert.equal(typeof s.render, "function");
    for (const a of s.acts) assert.equal(typeof a.send, "function", `${s.id} ${a.op}`);
  }
});

test("R8 every act names one op OPS holds and a member's session reaches, the registry's for its screen or its re-point; every registry act is drawn", async () => {
  await full();
  for (const s of SCREENS) {
    const reg = SCREEN_REGISTRY.find((r) => r.id === s.id);
    const listed = new Set([...(reg.acts || []).map((a) => (typeof a === "string" ? a : a.op)), ...(reg.owed || []).map((o) => o.op)]);
    if (listed.has("capture")) listed.add("captureupload");   /* draft-T46-interface.md §3 item 1 */
    for (const a of s.acts) {
      assert.ok(OPS[a.op], `${s.id}: ${a.op} in OPS`);
      /* interface-shell R12: SESSION_OPS gates mutating ops alone; a read is reached when the session's class is among its OPS classes */
      assert.ok(OPS[a.op].mutating ? SESSION_OPS.member.has(a.op) : OPS[a.op].classes.includes("member"), `${s.id}: ${a.op} reached by a member's session`);
      assert.ok(listed.has(a.op), `${s.id}: ${a.op} the registry's`);
    }
    for (const op of listed) if (op !== "capture") assert.ok(s.acts.some((a) => a.op === op), `${s.id} draws ${op}`);
  }
});

test("R8 after an act the screen reads again what it changed (every read, or none on a screen with none)", async () => {
  await full();
  for (const s of SCREENS) {
    const reads = Object.keys(s.reads({ subject: s.id === "capture" ? "address" : SHA, me: MEMBER, data: {}, ui: {} }));
    for (const a of s.acts) {
      /* what an act changed is read again, not every read (C14: an act does not read a whole list it did not change): an act names
         reads the screen has, or names none (it reads all); a screen with no reads has nothing to name */
      if (reads.length) assert.ok(a.rereads === undefined || [...a.rereads].every((n) => reads.includes(n)), `${s.id} ${a.op} names reads the screen has`);
      else assert.deepEqual([...(a.rereads || [])], [], `${s.id} ${a.op}`);
    }
  }
});

test("R8 (interface-shell R5, R10) every screen in each read's four states draws only words, and failed never as empty", async () => {
  const F = await full();
  const E = await team({ filled: false });
  /* ok: the team that holds each thing; empty: a team that holds nothing; failed and loading: the team's own reads failing, or never answering (faults) */
  const states = { ok: [F, {}], empty: [E, {}], failed: [F, READ_FAULTS(refused("STORE_SILENT", "store silent (test fixture)"))], loading: [F, READ_FAULTS(pending)] };
  for (const [state, [t, plane]] of Object.entries(states)) for (const paths of Object.values(pathsOf(t))) for (const path of paths) {
    const p = await openWorld(path, { world: t.world, as: t.mai, plane });
    assert.deepEqual(rawKeys(p), [], `${path} ${state}`);
    if (state === "ok" && path === "/app/held") assert.ok(text(p).includes("The inspection report"), "the team's held page is drawn, so the ok state is not an empty one");
    const marks = main(p).querySelectorAll("[data-state]").map((e) => e.getAttribute("data-state"));
    if (state === "failed") assert.ok(!marks.includes("empty"), `${path}: a failed read is never drawn empty`);
    if (state === "loading" && !path.startsWith("/app/capture")) assert.ok(marks.includes("loading"), `${path} loading`);
    if (state === "failed" && !path.startsWith("/app/capture")) assert.ok(marks.includes("failed"), `${path} failed`);
  }
});

test("R26 (interface-shell R5) each screen's words are the keys it reads, all of them words of the list; the module holds none of its own English", async () => {
  const mod = await import("../../../src/screens-intake/index.mjs");
  assert.equal(mod.SCREEN_WORDS, undefined, "no list of the module's own sentences");
  for (const s of SCREENS) {
    assert.ok(Object.isFrozen(s.words), s.id);
    assert.equal(new Set(s.words).size, s.words.length, `${s.id}: keys distinct`);
    for (const w of s.words) {
      assert.equal(typeof w, "string", `${s.id}: a key, never a [key, en] row`);
      assert.ok(hasWord(w), `${s.id}: ${w} is a word of the list`);
    }
  }
  assert.ok(SCREENS.every((s) => s.words.every((w) => WORD_ROWS.some((r) => r[0] === w))));
});

test("R26 word(key, vars): a missing placeholder and an unknown key throw their codes, so a screen never draws a key or a half-filled sentence", () => {
  assert.throws(() => word("screen.held.age", {}), /WORD_VAR_MISSING/);
  assert.throws(() => word("screen.nothing.here"), /UNKNOWN_WORD/);
});

test("R8 (interface-shell R12) an act is drawn only when the session may do it: without contribute no act needing it appears", async () => {
  const F = await full();
  assert.deepEqual((await F.rosa.read("whoami")).capabilities, [], "the member holds no capability");
  const withIt = await openWorld("/app/capture/address", { world: F.world, as: F.mai });
  assert.ok(Array.from(main(withIt).querySelectorAll("button[data-act]")).some((b) => NEEDS[b.getAttribute("data-act")]), "control: a member who may contribute is offered acts that need it");
  for (const path of Object.values(pathsOf(F)).flat()) {
    const p = await openWorld(path, { world: F.world, as: F.rosa });
    if (path.startsWith("/app/open-file/")) assert.ok(main(p).querySelector("[data-risk]"), "control: she reads the file's risk, a participant of its project");
    for (const b of main(p).querySelectorAll("button[data-act]")) {
      const op = b.getAttribute("data-act");
      assert.ok(NEEDS[op] === null || NEEDS[op] === undefined, `${path}: ${op} needs ${NEEDS[op]}, drawn without it`);
    }
  }
});

test("R9 no act or read records which member opened which file: every request is an op naming no member, and the screens store nothing", async () => {
  const F = await full();
  /* the shell's own frame reads, `bootstrap` among them (interface-shell R36: public, once, for the test-instance band), read from
     the shell's declaration of them (N1073) */
  const FRAME = new Set(SHELL_OPS);
  const ours = new Set([...SCREENS.flatMap((s) => s.acts.map((a) => a.op)), ...READS, "allocid", "promote", "select", "image", "heldat", "projectquestions", "captureseenin", "knocksof", "reading", "readheld"]);
  const pages = [];
  const at = (path, t = F) => openWorld(path, { world: t.world, as: t.mai });
  /* the ops that name only the capture are open-file's own: the reads it asks for a capture, and its five acts (R5) */
  const [OF, ofReads, ofActs] = declared("open-file");
  const OF_OPS = new Set([...Object.values(OF.reads({ subject: SHA, me: MEMBER, data: {}, ui: {} })).filter((r) => r.query && r.query.capture).map((r) => r.op), ...ofActs]);
  assert.ok(OF_OPS.size >= 9 && ofReads.length >= 5);
  /* open-file, every act pressed: a handed-in file the scanner found nothing in is opened with the warning, a safe view and a deeper check are asked; a file fetched by the team is opened
     as it is; the file the scanner held has its hold released */
  const f = await at(`/app/open-file/${F.warned.sha}`);
  fill(f, { "co-device": true, "co-macros": true });
  await press(f, "openwithwarning");
  await press(f, "safeview", { reason: "r" });
  await press(f, "deepercheck", { reason: "r" });
  pages.push(f);
  const l = await at(`/app/open-file/${F.fetched.sha}`);
  await press(l, "openoriginal");
  pages.push(l);
  const h = await at(`/app/open-file/${F.held.sha}`);
  await press(h, "releasescanhold", { reason: "r" });
  pages.push(h);
  for (const path of [...pathsOf(F).held, ...pathsOf(F).archive, ...pathsOf(F).inbox, ...pathsOf(F).capture]) pages.push(await at(path));
  for (const p of pages) {
    for (const r of p.requests) {
      if (FRAME.has(r.op)) continue;
      assert.ok(ours.has(r.op), `request ${r.op} is one of the screens' ops`);
      /* R4 (fix round 10, cause 33; DEC-97 clause 1): the Held list's own filter, the `member` of `heldcaptures` (the op's own field), names the viewer's own id and no
         file; no other request names a member (R9 is about which member opened which file) */
      const own = (k) => k === "member" && r.op === "heldcaptures" && r.query.member === MEMBER.member;
      for (const k of [...Object.keys(r.query).filter((x) => x !== "op"), ...Object.keys(r.body && typeof r.body === "object" ? r.body : {})])
        assert.ok(own(k) || !["member", "viewer", "by", "author", "who", "opened_by", "session", "token"].includes(k), `${r.op} names ${k}`);
      if (OF_OPS.has(r.op)) assert.deepEqual(Object.keys(r.query).filter((k) => !["op", "override"].includes(k)), ["capture"], r.op);
    }
    /* the page's storage holds only the shell's own keys: the session record (interface-shell R32, in local storage) and
       its level, theme and width; nothing of these screens */
    assert.deepEqual([...p.store.keys()].filter((k) => k !== "bio-session:frame"), [], "session storage holds nothing");
    assert.ok(p.local.has("bio-session"), "the session record, in local storage");
    for (const k of p.local.keys()) assert.match(k, /^(cs-|bio-session(:active)?$)/, `local storage key ${k} is the shell's`);
  }
});
