/* screens-entry R8–R11, R21 and the screen contract (interface-shell R5, R21, R22), over every screen in its states. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { open, all, texts, WORDS, SCREENS, SCREEN_WORDS, word, hasWord, sentence, unescape, squash, used, scenes, team, act, worldOf } from "./kit.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { currentAct } from "../../../src/wizard-scripts/data.mjs";

const REGISTRY = JSON.parse(fs.readFileSync(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url), "utf8"));
const REG = (REGISTRY.screens || REGISTRY);

// the plane is the real store; every screen is drawn in its states over a team with everything set and over one with nothing (`scenes`)
const SECRET = { otp: "sentinel-otp-4e5f", pw: "sentinel-pw-0a1b2c3d" };   // chosen by the test; the codes, links and invitations are the plane's own

/* the record's own data: every string the page read or was typed, a drawn text that is none of the words is one of these */
const dataOf = (o) => {
  const out = new Set();
  const walk = (v) => { if (typeof v === "string") out.add(squash(v)); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(o.view.data); walk(o.view.ui); walk(o.view.session); walk(o.view.me); walk(o.fields);
  return out;
};

/* interface-shell R5: a drawn text node is a word's text, filled, or the record's own data */
const PATTERNS = [...WORDS.values()].filter((en) => en.replace(/\{\w+\}/g, "").replace(/[\s\p{P}]/gu, "").length >= 3).map((en) => new RegExp("^" + en.replace(/\s+/g, " ").trim().split(/\{\w+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*") + "$"));
const isWord = (t) => PATTERNS.some((p) => p.test(t));
const parts = (t) => t.split(/\s*[·›]\s*/).filter(Boolean);

test("R9 every text a screen draws is a word by key, filled, or the record's own data (interface-shell R5)", async () => {
  const sc = await scenes(true);
  for (const { id, label, o: s } of [...sc.pages, ...sc.acted]) {
    const DATA = dataOf(s);
    for (const t of texts(s.tree)) assert.ok(isWord(t) || DATA.has(t) || parts(t).every((p) => isWord(p) || DATA.has(p)) || t.split(" ").every((p) => DATA.has(p)) || /^[A-Z0-9-]+$/.test(t), `${label}: "${t}" is no word`);   // a monogram of the team's name is drawn in capitals
  }
  // control: a sentence no list holds is found
  assert.ok(!isWord("Welcome to our lovely page, friend."));
});

test("R9 every field has a label and every control a name (interface-shell R22); headings and acts are the shell's (R8–R13)", async () => {
  const sc = await scenes(true);
  for (const { id, label, o: s } of [...sc.pages, ...sc.acted]) {
    const labels = new Set(all(s.tree, (e) => e.tag === "label").map((e) => e.attrs.for).filter(Boolean));
    for (const f of all(s.tree, (e) => ["input", "select", "textarea"].includes(e.tag))) {
      const wrapped = (() => { for (let p = f.parent; p; p = p.parent) if (p.tag === "label") return true; return false; })();
      assert.ok(labels.has(f.attrs.id) || wrapped, `${label}: field ${f.attrs.id} has no label`);
    }
    for (const c of all(s.tree, (e) => e.tag === "button" || (e.tag === "a" && e.attrs.href))) assert.ok(texts(c).join("").trim() || c.attrs["aria-label"], `${label}: a control with no name`);
    assert.equal(all(s.tree, (e) => e.tag === "h1").length, 1, `${label}: one heading`);
    // the public and setup frames' screens draw no rail, tabs or dock of their own
    assert.equal(all(s.tree, (e) => /cs-(rail|tabs|dock)\b/.test(e.attrs.class || "")).length, 0, label);
  }
});

test("R8 sentinels across every flow: no password, one-time password, code, reset or invitation link in an address, a query, a link drawn or a later request", async () => {
  /* the secrets of each flow are the plane's own where the plane makes them (the recovery code, the reset link, the invitation) and the
     test's where a person chooses them (a password, the one-time password) */
  const { world, admin } = await team({ name: "River Town", description: null, logo: false });
  const mai = await world.signIn("mai");
  const code = (await act(world, admin, "recoverycodesissue", { body: {} })).codes[0];
  const reset = (await act(world, admin, "passwordresetlink", { body: { member: "mai" } })).link;
  const invite = (await act(world, admin, "memberadd", { body: { memberId: "zed", cover: "Zed" } })).invite;
  const link = (await act(world, admin, "joinlinkenable", { body: { capabilities: ["contribute"], dailyCap: 5 } })).link;
  const SECRETS = { ...SECRET, login: mai.password, code, reset, invite, join: link };
  const unclaimed = await worldOf({ claimed: false });
  const flows = [
    ["front", { world }, "login", { "fs-handle": "mai", "fs-pw": SECRETS.login }],
    ["forgot", { world }, "recover", { "fg-handle": "founder", "fg-code": SECRETS.code, "fg-pw": SECRETS.pw, "fg-pw2": SECRETS.pw }],
    ["reset", { world, fragment: { reset: SECRETS.reset } }, "passwordreset", { "rs-pw": SECRETS.pw, "rs-pw2": SECRETS.pw }],
    ["setup", { world: unclaimed, fragment: { boot: SECRETS.otp } }, "claim", { "su-handle": "rivera", "su-pw": SECRETS.pw, "su-pw2": SECRETS.pw }],
    ["join", { world, fragment: { invite: SECRETS.invite } }, "enroll", { "jn-handle": "zed", "jn-pw": SECRETS.pw, "jn-pw2": SECRETS.pw }],
  ];
  // the requests whose body may carry the flow's secrets, read from the screens' own declarations (N1073): the acts the
  // flow presses, the reads its screen declares with a body, and front's sign-in act, which a claim and an enrolment
  // send next
  const SIGN_IN = SCREENS.find((x) => x.id === "front").acts[0].op;
  for (const [id, o, op, values] of flows) {
    const s = await open(id, o);
    const pressed = [op];
    if (id === "join") { await s.press("handlecheck", { values: { "jn-handle": "zed" } }); pressed.push("handlecheck"); }
    await s.press(op, { values });
    const spec = SCREENS.find((x) => x.id === id);
    const bodied = Object.values(spec.reads ? spec.reads(s.view) || {} : {}).concat(Object.values(spec.reads ? spec.reads({ ...s.view, ui: {}, me: null }) || {} : {})).filter((r) => r.body).map((r) => r.op);
    const own = new Set([...pressed, ...bodied, ...(["claim", "enroll"].includes(op) ? [SIGN_IN] : [])]);
    for (const r of s.requests) {
      const q = JSON.stringify(r.query || {});
      for (const secret of Object.values(SECRETS)) {
        assert.ok(!q.includes(secret), `${id}: ${r.op}'s address carries a secret`);
        if (JSON.stringify(r.body || {}).includes(secret)) assert.ok(own.has(r.op), `${id}: ${r.op}'s body carries ${secret}`);
      }
    }
    // control: what the flow sends after its own act carries none of its secrets but the password to the sign-in
    for (const r of s.requests.filter((x) => !own.has(x.op))) for (const secret of Object.values(SECRETS)) assert.ok(!JSON.stringify(r.body || {}).includes(secret), `${id}: ${r.op}`);
    const drawn = s.drawn();
    for (const secret of [SECRETS.pw, SECRETS.code, SECRETS.reset, SECRETS.invite, SECRETS.login]) assert.ok(!drawn.includes(secret), `${id}: ${secret} drawn`);
    for (const href of all(s.tree, (e) => e.tag === "a").map((e) => e.attrs.href)) for (const secret of Object.values(SECRETS)) assert.ok(!String(href).includes(secret), `${id}: a link carries a secret`);
    assert.ok(!("pending" in s.view.ui), `${id}: a password left in the page's memory`);
  }
});

test("R10 no place is named in the words this module reads or in anything its screens draw", async () => {
  const PLACES = /Oakland|California|Alameda|Coliseum|Lakeshore|Fresno|Seminary|San Francisco|Berkeley|United States|\bCity of\b|\bthe city\b|\bcouncil\b/i;
  for (const s of SCREENS) for (const k of s.words) if (hasWord(k)) assert.doesNotMatch(sentence(k), PLACES, k);
  /* what a screen draws is its words and the record's own data: the places the plane names (a profile's name and what it covers) are the
     plane's, drawn as it gives them, and are set aside before the module's own text is checked */
  const sc = await scenes(true);
  assert.ok(sc.places.length > 0 && sc.places.some((p) => PLACES.test(p)), "the plane does name places");
  for (const { label, o } of [...sc.pages, ...sc.acted]) {
    const own = sc.places.reduce((text, place) => text.split(place).join(""), o.drawn());
    assert.doesNotMatch(own, PLACES, label);
  }
  assert.match("the Coliseum lease", PLACES, "control");
});

test("R11 each screen is drawn at its address with or without a session record; setup and join never forward a signed-in visitor away", async () => {
  const { world, admin } = await team();
  const mai = await world.signIn("mai");
  for (const id of ["front", "tour", "forgot", "reset", "setup", "join"]) {
    for (const session of [{ state: "none" }, { state: "live", handle: "mai" }]) {
      const s = await open(id, { world, session, as: session.state === "live" ? mai : null, fragment: { boot: SECRET.otp, invite: "an-invitation", reset: "a-reset-link" } });
      assert.ok(all(s.tree, (e) => e.tag === "h1").length === 1, `${id} drawn`);
      assert.deepEqual(s.gone, [], `${id} forwards nowhere`);
      assert.deepEqual(s.signins, [], `${id} hands nothing over by itself`);
    }
  }
  assert.ok(admin);
});

/* a registry act's op: an owed one is spelled `owed:<op> <ruling>` (registry.json, K3265) */
/* T53 (wizard-scripts' RETIRED_ACTS, op-declarations PR 95): a retired op is read as the op that does its act now */
const opOf = (x) => currentAct(String(x.op).replace(/^owed:/, "").split(/\s/)[0]);

test("R9 the contract: six screens, each a registry screen in its frame; every act names an op OPS holds and the registry lists for it (an owed act by its op)", () => {
  assert.deepEqual(SCREENS.map((s) => s.id), ["front", "tour", "forgot", "reset", "setup", "join"]);
  const FRAME = { front: "public", tour: "public", forgot: "public", reset: "public", setup: "setup", join: "setup" };
  for (const s of SCREENS) {
    const reg = REG.find((r) => r.id === s.id);
    assert.ok(reg, s.id);
    assert.equal(reg.frame, FRAME[s.id], s.id);
    assert.ok(Object.isFrozen(s) && Object.isFrozen(s.acts) && Object.isFrozen(s.words));
    for (const a of s.acts) {
      assert.ok(Object.hasOwn(OPS, a.op), `${s.id}: ${a.op} not in OPS`);
      // R34: the time zone step's `factconfirm` (DEC-439, D-B1) is not yet in the registry's `setup` (REPORTed to BOB for the design)
      assert.ok(reg.acts.some((x) => opOf(x) === a.op) || (s.id === "setup" && a.op === "factconfirm"), `${s.id}: ${a.op} is not the registry's`);
    }
    // every registry act of the screen is drawn by it (R1–R7), but join's memberlanguageset, sent once the member's
    // session exists (R7), since no act but a public one is drawn before it
    for (const x of reg.acts) assert.ok(opOf(x) === null || s.acts.some((a) => a.op === opOf(x)) || (s.id === "join" && x.op === "memberlanguageset"), `${s.id}: the registry's ${x.op} is not drawn`);
  }
});

/* R21: the keys this module reads, by key; R24 below: which list they are checked against */
const READS = JSON.parse(fs.readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8")).modules["screens-entry"];
const NAMED = ["signin.handle.help", "forgot.handle.help", "screen.setup.handle", "screen.setup.handle.help", "refusal.NO_HANDLE", "refusal.BAD_HANDLE",
  "refusal.HANDLE_TAKEN", "refusal.HANDLE_FIXED", "refusal.ALREADY_CLAIMED", "founder.handle.title", "founder.handle.says", "founder.handle.choose",
  "founder.handle.later", "founder.handle.later.help", "founder.handle.done", "setup.member.heading", "setup.member.sub", "setup.member.home",
  "setup.codes.once", "setup.codes.copy", "setup.codes.save", "setup.claimed.heading", "setup.claimed.sub"];
const RETIRED = ["screen.forgot.handle.help", "screen.setup.taken", "signin.founderhint"];

test("R21 words by key: no row of its own (SCREEN_WORDS is empty); every key each screen reads is a key the list holds (setup-words hasWord), and the retired rows are read by none", () => {
  assert.ok(Array.isArray(SCREEN_WORDS) && Object.isFrozen(SCREEN_WORDS));
  assert.equal(SCREEN_WORDS.length, 0, "no member-facing English is held here");
  for (const s of SCREENS) {
    assert.ok(s.words.length > 0, s.id);
    for (const k of s.words) {
      assert.equal(typeof k, "string", `${s.id}: a word given as a row, not a key`);
      // act labels and explanations are read where the list holds them (the shell's act())
      if (/^act\./.test(k)) continue;
      assert.ok(hasWord(k), `${s.id}: ${k} is no key of the list`);
    }
    for (const k of RETIRED) assert.ok(!s.words.includes(k), `${s.id} reads the retired ${k}`);
  }
  // control: an unknown key is found
  assert.equal(hasWord("screen.setup.nonesuch"), false);
});

/* R24 (DEC-278; K3421, K3436): the key list is the module's own. words-reads.json's generator, run over T49's code,
   lists neither the act labels these screens read nor T50's setup keys (DEC-279), so the second route R24 names is
   taken: the module's declared keys (each screen's `words`) are each held by hasWord, and every key a screen draws, in
   every state the tests below reach, is one of them. */
const declared = new Set(SCREENS.flatMap((s) => s.words));
const undeclared = (keys) => [...keys].filter((k) => !declared.has(k)).sort();
test("R24 every key the module draws is one it declares and hasWord holds; the two retired keys are in neither; control: a key drawn but not declared fails", async () => {
  for (const k of declared) assert.ok(hasWord(k), `${k} is declared but no word holds it`);
  // R21: every key a requirement here names is read
  for (const k of NAMED) assert.ok(declared.has(k), `${k}, named by a requirement, is not read`);
  // every screen in its states, and the acts that reach the others
  const sc = await scenes(true);   // every screen in its states, drawn (and the keys it draws recorded)
  await scenes(false);
  const s = await open("setup", { fragment: { boot: SECRET.otp }, world: await worldOf({ claimed: false }) });
  await s.press("claim", { values: { "su-handle": "rivera", "su-pw": SECRET.pw, "su-pw2": SECRET.pw } });
  // the founder of a team that keeps its assistant on and holds the team's key
  const f = await open("setup", { world: sc.world, as: sc.admin });
  f.fields["su-ai-1"] = true; await f.tick(300);
  f.fields["su-ai-1"] = false; f.fields["su-ai-0"] = true; f.fields["su-pay-1"] = true; await f.tick(300);
  f.fields["su-site-1"] = true; await f.tick(300);
  // the dates are the shell's (`cs.date`), and the numbered sentences of HOSTING_CONTROL and FORGOT_HELP are read until
  // the first number the list does not hold, which is asked and not drawn
  const probe = /^screen\.(hosting|forgot\.help)\.s\d+$/;
  const drawn = new Set([...used()].filter((k) => !/^date\./.test(k) && !(probe.test(k) && !hasWord(k))));
  for (const k of drawn) assert.ok(hasWord(k), `${k} is drawn and no word holds it`);
  for (const id of ["front", "tour", "forgot", "reset", "setup", "join"]) assert.ok(SCREENS.find((x) => x.id === id).words.length);
  assert.deepEqual(undeclared(drawn), [], "drawn but not declared");
  for (const k of RETIRED) { assert.ok(!declared.has(k), k); assert.ok(!drawn.has(k), k); }
  for (const k of READS.retired) { assert.ok(!declared.has(k), k); assert.ok(!drawn.has(k), k); }
  // control: a key drawn that is not declared is found
  assert.deepEqual(undeclared(new Set(["screen.setup.nonesuch.drawn"])), ["screen.setup.nonesuch.drawn"]);
});

const said1 = (key) => squash(word(key));
test("R21 over the real store, what the screens draw for a sample of their keys equals setup-words' word(key, vars)", async () => {
  const drawnText = (s) => squash(unescape(s.text));
  const { world, admin } = await team({ name: "River Town" });
  const front = await open("front", { world });
  for (const k of ["screen.front.members", "screen.front.doorbell", "signin.handle.help", "session.keep"]) assert.ok(drawnText(front).includes(squash(word(k))), k);
  assert.ok(drawnText(front).includes(squash(word("screen.entry.uses", { group: "River Town" }))));
  const forgot = await open("forgot", { world });
  for (const k of ["forgot.handle.help", "screen.forgot.help.s1"]) assert.ok(drawnText(forgot).includes(squash(word(k))), k);
  const setup = await open("setup", { fragment: { boot: SECRET.otp }, world: await worldOf({ claimed: false }) });
  await setup.press("claim", { values: { "su-handle": "rivera", "su-pw": SECRET.pw, "su-pw2": SECRET.pw } });
  assert.ok(drawnText(setup).includes(squash(word("screen.setup.claimed", { group: said1("screen.entry.group"), handle: "rivera" }))));
  assert.ok(drawnText(setup).includes(squash(word("setup.codes.once"))));
  const mai = await world.signIn("mai");
  const member = await open("setup", { world, as: mai });
  assert.ok(drawnText(member).includes(squash(word("setup.member.sub"))));
  assert.ok(admin);
  // control: word refuses a key the list does not hold, and a placeholder left unfilled
  assert.throws(() => word("screen.setup.nonesuch", {}), /UNKNOWN_WORD/);
  assert.throws(() => word("screen.setup.claimed", { group: "River Town" }), /WORD_VAR_MISSING/);
});
