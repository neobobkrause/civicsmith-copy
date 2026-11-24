/* screens-entry R6, R17–R20, R22, R23: `setup`, the founder's claim with the handle she chooses, the team's first
   settings drawn as the design draws them (numbered parts that open and close, choices that open only what they need,
   "Skip for now", the second administrator), the handle chosen later by a founder from before T49, the state of anyone
   else, and DEC-246's two states, walked over the real store from the claim to "Finished", at the module's interface. The plane is
   `store-request`'s `storeWorld()`: the claim, the sign-in, the codes and every part's act are the real ones, and a state a test
   needs (a name, a key, an office, a second administrator, a scanner that holds no signatures) is made by the founder's real acts. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { open, served, has, lacks, said, date, all, texts, textOf, actOps, links, word, sentence, unescape, squash, SCREENS, worldOf, act, viaDoor, scannerBinding, SEAL, enrol } from "./kit.mjs";

const OTP = "otp-sentinel-5d1e";
const PW = "founder long password";
const HANDLE = "rivera";

/* an unclaimed team, with the platform's sealing secret (a team keeps a key sealed under it) */
const fresh = ({ env = {} } = {}) => worldOf({ claimed: false, env: { ACCOUNT_SEAL_SECRET: SEAL, ...env } });
/* the founder's session on a team she claimed before the handle was asked (credentials R1: a claim with no handle holds none) */
async function oldFounder(opts) {
  const world = await fresh(opts);
  await world.claim({ password: PW });
  const login = (await viaDoor(world, "login", { body: { handle: "admin", password: PW, device: "own" } })).json.result;
  return { world, as: { token: login.token } };
}
/* the founder's password asked again, as the shell asks it before an act that changes administrators or keeps a key (credentials R66) */
const reauth = (world, as) => act(world, as, "reauth", { body: { password: PW } });

async function claimed({ env, after, page } = {}) {
  const world = await fresh({ env });
  const o = await open("setup", { fragment: { boot: OTP }, world, page });
  await o.press("claim", { values: { "su-handle": HANDLE, "su-pw": PW, "su-pw2": PW } });
  o.world = world; o.as = { token: o.token };
  // what the team already holds when the founder comes back to a part: made by her own real acts, then the page reads again
  if (after) { await after({ world, as: o.as, o }); await o.readAll(null); }
  return o;
}
/* the founder signed in on a team set up already (the page opened as she comes back to it) */
async function returned({ env, after } = {}) {
  const c = await claimed({ env, after });
  const o = await open("setup", { world: c.world, as: c.as });
  o.world = c.world; o.as = c.as;
  return o;
}

// a part as drawn (R22): its element, its state, whether it is open
const partOf = (o, key) => all(o.tree, (e) => e.attrs["data-part"] === key)[0];
const stateOf = (o, key) => partOf(o, key).attrs["data-state"];
const isOpen = (o, key) => "open" in partOf(o, key).attrs;
/* R34: acts `setup` draws that the design's registry has not yet listed for it */
const OWED_TO_REGISTRY = ["factconfirm"];
const PARTS = ["claim", "group", "places", "offices", "assistant", "court", "security", "admins"];

test("R6 R17 the claim: the one-time password filled from #boot=, then 'Choose your handle', then the founder's password twice; only the claim is offered before a session", async () => {
  const o = await open("setup", { fragment: { boot: OTP }, world: await fresh() });
  assert.deepEqual(o.requests.map((r) => r.op), ["bootstrap", "groupidentity"]);
  assert.equal(all(o.tree, (e) => e.attrs.id === "su-otp")[0].attrs.value, OTP);
  assert.deepEqual(actOps(o.tree), ["claim"]);
  has(o, "screen.setup.claim"); has(o, "screen.hosting.heading"); has(o, "screen.hosting.s1");
  has(o, "screen.setup.handle"); has(o, "screen.setup.handle.help"); has(o, "screen.setup.own.help");
  // the handle between the one-time password and the founder's password
  const inputs = all(o.tree, (e) => e.tag === "input").map((e) => e.attrs.id);
  assert.deepEqual(inputs, ["su-otp", "su-handle", "su-pw", "su-pw2"]);
  assert.equal(all(o.tree, (e) => e.tag === "input" && e.attrs.type === "password").length, 2);
});

test("R17 the real store walked from the claim with a chosen handle: claim sends it, login signs in by the handle the claim answers on an own device, then recoverycodesissue", async () => {
  const o = await claimed();
  assert.deepEqual(o.requests.slice(2, 5).map((r) => [r.op, r.body]), [
    ["claim", { bootstrapToken: OTP, password: PW, handle: HANDLE }],
    ["login", { handle: HANDLE, password: PW, device: "own" }],
    ["recoverycodesissue", {}],
  ]);
  const token = o.requests[3].answer.value.token;
  assert.deepEqual(o.signins.map((s) => [s.answer.token, s.opts]), [[token, { device: "own", handle: HANDLE, stay: true }]]);
  assert.equal(o.requests[4].header, true, "the codes asked under the new session");
  assert.equal(o.view.me.handle, HANDLE, "the plane holds the handle she chose");
  // the claim's next step names the group ("Your group" while unnamed) and her handle
  has(o, "screen.setup.claimed", { group: said("screen.entry.group"), handle: HANDLE });
  assert.ok(!("pending" in o.view.ui), "the password left the page's memory");
  // the sign-in is by the handle the claim answers
  assert.equal(o.requests[2].answer.value.handle, HANDLE);
  assert.deepEqual(o.requests.find((r) => r.op === "login").body.handle, o.requests[2].answer.value.handle);
});

test("R17 control: no request or drawn word in the claim's flow holds admin as a handle", async () => {
  const o = await claimed({ after: ({ world, as }) => act(world, as, "groupnameset", { body: { name: "River Town" } }) });
  for (const r of o.requests) assert.ok(!(r.body && r.body.handle === "admin"), `${r.op} sends admin as a handle`);
  assert.deepEqual(o.signins.map((s) => s.opts.handle), [HANDLE]);
  assert.doesNotMatch(o.drawn(), /\badmin\b/, "a drawn word names admin");
  assert.equal(o.view.me.handle, HANDLE, "the plane signs her in by it, not by admin");
});

test("R17 refusals: NO_HANDLE, BAD_HANDLE, HANDLE_TAKEN and HANDLE_FIXED drawn by their keys, the handle kept and the passwords cleared; control: no login is sent", async () => {
  /* the plane's own refusals of a claim: a handle that is not one, one that is taken (`admin` is the plane's own), and the founder's
     handle once fixed (a claim re-armed by a replaced bootstrap credential, credentials R1, finds her handle held) */
  const rearmed = async () => {
    const world = await fresh();
    await act(world, null, "claim", { body: { password: PW, handle: HANDLE } });
    world.env.ADMIN_TOKEN = "a-replaced-bootstrap-credential-9z";
    return world;
  };
  const cases = [["BAD_HANDLE", await fresh(), "Bad Handle!"], ["HANDLE_TAKEN", await fresh(), "admin"], ["HANDLE_FIXED", await rearmed(), "rivera-other"]];
  for (const [code, world, typed] of cases) {
    const o = await open("setup", { fragment: { boot: OTP }, world });
    const r = await o.press("claim", { values: { "su-handle": typed, "su-pw": PW, "su-pw2": PW } });
    assert.equal(o.requests.find((x) => x.op === "claim").answer.code, code, "the plane's own refusal");
    assert.equal(r.refused, true, code);
    assert.equal(o.refused.text, said("refusal." + code), code);
    assert.equal(o.fields["su-handle"], typed, code + ": the handle kept");
    assert.equal(o.fields["su-pw"], "", code); assert.equal(o.fields["su-pw2"], "", code);
    assert.ok(!o.view.ui.pending, code + ": no password left in the page's memory");
    assert.deepEqual(o.requests.map((x) => x.op), ["bootstrap", "groupidentity", "claim"], code + ": nothing more is sent");
    assert.deepEqual(actOps(o.tree), ["claim"], code + ": the step is kept");
  }
  /* the plane never answers NO_HANDLE to a claim (a claim with no handle holds none, K3337) and the page sends none without one, so the
     refusal's drawing is checked on an answer made for the purpose */
  // fixtures-generic: NO_HANDLE (screens-entry R17: the claim's refusal map names it; the plane gives it to no claim, credentials R1)
  const n = await open("setup", { fragment: { boot: OTP }, world: await fresh(), table: { claim: { ok: false, code: "NO_HANDLE" } } });
  await n.press("claim", { values: { "su-handle": HANDLE, "su-pw": PW, "su-pw2": PW } });
  assert.equal(n.refused.text, said("refusal.NO_HANDLE"));
  assert.equal(n.fields["su-handle"], HANDLE); assert.equal(n.fields["su-pw"], "");
  assert.ok(!n.requests.some((x) => x.op === "login"));
});

test("R6 R17 control: two passwords that differ, a short one, no one-time password, or no handle send nothing", async () => {
  const o = await open("setup", { fragment: {}, world: await fresh() });
  const base = { "su-otp": OTP, "su-handle": HANDLE, "su-pw": PW, "su-pw2": PW };
  for (const [values, key] of [[{ ...base, "su-pw2": PW + "x" }, "screen.entry.differ"], [{ ...base, "su-pw": "short", "su-pw2": "short" }, "screen.entry.short"],
    [{ ...base, "su-otp": "" }, "screen.setup.nootp"], [{ ...base, "su-handle": "  " }, "refusal.NO_HANDLE"]]) {
    assert.deepEqual((await o.press("claim", { values })).sent, []);
    assert.equal(o.refused.key, key);
  }
});

test("R20 the ten codes shown once under setup.codes.once, with 'Copy them' and 'Save them as a file'; control: the codes are in no storage and drawn once", async () => {
  const o = await claimed();
  const CODES = o.requests.find((r) => r.op === "recoverycodesissue").answer.value.codes;
  assert.equal(CODES.length, 10);
  has(o, "screen.setup.codes.intro"); has(o, "setup.codes.once");
  assert.ok(isOpen(o, "claim"), "part 1 open while the codes are shown");
  const pre = all(o.tree, (e) => e.tag === "pre");
  assert.equal(pre.length, 1);
  assert.deepEqual(pre[0].children.map((c) => c.text).join("").split("\n"), CODES);
  // copied, or saved as a file made in the page (interface-shell R47), the codes and nothing else, each by its own key
  const copy = all(o.tree, (e) => e.attrs["data-shell"] === "copy"), save = all(o.tree, (e) => e.attrs["data-shell"] === "save");
  assert.equal(copy.length, 1); assert.equal(save.length, 1);
  assert.equal(copy[0].children.map((c) => c.text).join(""), word("setup.codes.copy"));
  assert.equal(save[0].children.map((c) => c.text).join(""), word("setup.codes.save"));
  assert.equal(o.saves.at(-1).name, "recovery-codes.txt");
  assert.deepEqual(o.saves.at(-1).text.trim().split("\n"), CODES);
  assert.deepEqual(o.copies.at(-1).split("\n"), CODES);
  // shown once: the screen opened again holds them in no state of its own, and the act that issues them is not offered
  // once she holds codes (the plane says so: recoverycodesstate)
  const again = await open("setup", { world: o.world, as: o.as });
  assert.equal(again.requests.find((r) => r.op === "recoverycodesstate").answer.value.held, true);
  assert.ok(!again.drawn().includes(CODES[0]));
  assert.ok(!actOps(again.tree).includes("recoverycodesissue"));
  for (const c of CODES) assert.ok(!JSON.stringify(o.view.data).includes(c), "a code kept in the screen's read state");
});

test("R20 state c, 'Already claimed': drawn for a claim refused ALREADY_CLAIMED and for a visit to a claimed instance, with 'Sign in' opening front; control: an unclaimed instance draws the claim", async () => {
  const taken = await fresh();
  await taken.claim({ password: PW, handle: HANDLE });
  const visit = await open("setup", { fragment: { boot: OTP }, world: taken });
  /* the page read an unclaimed team; someone else claims it before she presses */
  const beaten = await fresh();
  const r = await open("setup", { fragment: { boot: OTP }, world: beaten });
  await beaten.claim({ password: PW, handle: "somebody-else" });
  await r.press("claim", { values: { "su-handle": HANDLE, "su-pw": PW, "su-pw2": PW } });
  assert.equal(r.requests.find((x) => x.op === "claim").answer.code, "ALREADY_CLAIMED", "the plane's own refusal");
  assert.equal(r.requests.filter((x) => x.op === "login").length, 0, "a refused claim sends nothing more");
  assert.ok(!r.view.ui.pending, "no password left in the page's memory");
  for (const o of [visit, r]) {
    has(o, "setup.claimed.heading"); has(o, "setup.claimed.sub"); has(o, "refusal.ALREADY_CLAIMED"); has(o, "screen.entry.signin");
    assert.ok(links(o.tree).includes("/app/front"));
    assert.deepEqual(actOps(o.tree), []);
    assert.equal(all(o.tree, (e) => e.tag === "input").length, 0);
  }
  const unclaimed = await open("setup", { fragment: { boot: OTP }, world: await fresh() });
  lacks(unclaimed, "setup.claimed.heading"); assert.deepEqual(actOps(unclaimed.tree), ["claim"]);
});

test("R6 not armed says so; a claim whose sign-in fails says sign in, linking front", async () => {
  /* a copy with no bootstrap credential bound is not armed (the platform's binding, left out of the world) */
  const unarmed = await worldOf({ claimed: false, env: { ADMIN_TOKEN: undefined } });
  has(await open("setup", { world: unarmed }), "screen.setup.unarmed");
  // the sign-in after the claim is not served (unanswered: the harness's fault)
  const n = await open("setup", { fragment: { boot: OTP }, world: await fresh(), table: { login: "none" } });
  await n.press("claim", { values: { "su-handle": HANDLE, "su-pw": PW, "su-pw2": PW } });
  // the handle she chose, never admin (R17)
  has(n, "screen.setup.claimed.nosignin", { handle: HANDLE });
  assert.doesNotMatch(n.drawn(), /\badmin\b/);
  assert.ok(links(n.tree).includes("/app/front"));
  assert.ok(!n.requests.some((r) => r.op === "recoverycodesissue"));
});

test("R18 a founder of a group claimed before T49 (whoami: rootOfTrust, handle null) is asked her handle once: 'Choose this handle' sends founderhandleset with the handle in the body only, then says so with Home", async () => {
  const { world, as } = await oldFounder();
  const o = await open("setup", { world, as, session: { state: "live", handle: "" } });
  assert.equal(o.view.me.handle, null);
  assert.equal(o.view.me.rootOfTrust, true);
  assert.deepEqual(o.requests, [], "nothing is read for the step");
  for (const k of ["founder.handle.title", "founder.handle.says", "screen.setup.handle.help", "founder.handle.choose", "founder.handle.later", "founder.handle.later.help"]) has(o, k);
  assert.deepEqual(actOps(o.tree), ["founderhandleset"], "the step alone, before Home");
  const r = await o.press("founderhandleset", { values: { "su-fh": ` ${HANDLE} ` } });
  assert.deepEqual(r.sent.map((x) => [x.op, x.body, x.query, x.header]), [["founderhandleset", { handle: HANDLE }, {}, true]]);
  has(o, "founder.handle.done", { handle: HANDLE });
  assert.ok(links(o.tree).includes("/app"), "Home");
  assert.deepEqual(actOps(o.tree), []);
  assert.equal((await viaDoor(world, "whoami", {}, as.token)).json.result.handle, HANDLE, "the plane holds it now");
});

test("R18 refusals drawn by their keys, the step kept; 'Later' sends nothing and opens Home; control: a member, and a founder holding a handle, never see the step", async () => {
  /* the plane's refusals: a handle that is not one, one a member holds, and (the founder having chosen it elsewhere meanwhile) one fixed already */
  for (const code of ["BAD_HANDLE", "HANDLE_TAKEN", "HANDLE_FIXED"]) {
    const { world, as } = await oldFounder();
    const o = await open("setup", { world, as });
    if (code === "HANDLE_TAKEN") await enrol(world, as, PW, "ann");
    if (code === "HANDLE_FIXED") await act(world, as, "founderhandleset", { body: { handle: "chosen-elsewhere" } });
    await o.press("founderhandleset", { values: { "su-fh": code === "BAD_HANDLE" ? "Bad Handle" : code === "HANDLE_TAKEN" ? "ann" : "rivera" } });
    assert.equal(o.requests.at(-1).answer.code, code, "the plane's own refusal");
    assert.equal(o.refused.text, said("refusal." + code), code);
    assert.deepEqual(actOps(o.tree), ["founderhandleset"], code);
  }
  const { world, as } = await oldFounder();
  const e = await open("setup", { world, as });
  assert.deepEqual((await e.press("founderhandleset", { values: { "su-fh": "" } })).sent, []);
  assert.equal(e.refused.key, "refusal.NO_HANDLE");
  // "Later": a link to Home, no act
  const later = all(e.tree, (x) => x.tag === "a" && x.children.map((c) => c.text).join("") === word("founder.handle.later"));
  assert.deepEqual(later.map((x) => x.attrs.href), ["/app"]);
  assert.deepEqual(e.requests, []);
  // control: a member, an administrator who is not the founder, and the founder holding a handle (the plane's own whoami)
  const held = await claimed();
  const mai = await enrol(held.world, held.as, PW, "mai");
  const dev = await enrol(held.world, held.as, PW, "dev", { admin: true });
  for (const who of [mai, dev, held.as]) {
    const o = await open("setup", { world: held.world, as: who });
    lacks(o, "founder.handle.title"); lacks(o, "founder.handle.says");
    assert.ok(!actOps(o.tree).includes("founderhandleset"));
  }
});

test("R19 a member, or an administrator who is not the founder, opening setup sees her own state: set up, with Home; no founder words, no admin name, no codes act and nothing read", async () => {
  const f = await claimed();
  for (const handle of ["mai", "dev"]) {
    const who = await enrol(f.world, f.as, PW, handle, { admin: handle === "dev" });
    const o = await open("setup", { world: f.world, as: who, session: { state: "live", handle } });
    assert.equal(o.view.me.rootOfTrust, false);
    assert.equal(o.view.me.administer, handle === "dev");
    assert.deepEqual(o.requests, [], "nothing is read");
    has(o, "setup.member.heading"); has(o, "setup.member.sub"); has(o, "setup.member.home");
    assert.ok(links(o.tree).includes("/app"));
    assert.deepEqual(actOps(o.tree), [], "no act, 'Show my recovery codes' among them");
    for (const k of ["screen.setup.claimed", "screen.setup.claim", "screen.setup.lede", "screen.entry.codes.heading", "founder.handle.title"]) lacks(o, k, { group: said("screen.entry.group"), handle });
    assert.doesNotMatch(o.drawn(), /\badmin\b/);
  }
  // control: the founder at her first sign-in sees the claim's next step, and "Show my recovery codes" before she has
  // seen her codes
  has(f, "screen.setup.claimed", { group: said("screen.entry.group"), handle: HANDLE });
  const world = await fresh();
  await world.claim({ password: PW, handle: HANDLE });
  const login = (await viaDoor(world, "login", { body: { handle: HANDLE, password: PW, device: "own" } })).json.result;
  const before = await open("setup", { world, as: { token: login.token } });
  assert.equal(before.requests.find((r) => r.op === "recoverycodesstate").answer.value.held, false);
  assert.ok(actOps(before.tree).includes("recoverycodesissue"));
  lacks(before, "setup.member.heading");
});

// a choice made on the page (R22): the radio checked, its others not, and the page's clock moved past the watch
async function choose(o, name, i, n = 2) {
  for (let k = 0; k < n; k++) o.fields[`${name}-${k}`] = k === i;
  await o.tick(300);
}
const PLACE = "oakland-alameda";   // the one profile the world's store knows
const nameOfPlace = (o) => o.view.data.profiles.value.choices.find((c) => c.id === PLACE).name;
// every choice that opens an act made: a place the team works in, a website, the team paying for the assistant (its key kept)
async function opened({ env = {}, after } = {}) {
  const o = await claimed({ env: { FILE_SCANNER: scannerBinding(), ...env }, after: async (c) => {
    await act(c.world, c.as, "profilesset", { body: { profiles: [PLACE] } });
    await reauth(c.world, c.as);
    await act(c.world, c.as, "groupkeyset", { body: { key: "sk-held-key-1234567890" } });
    if (after) await after(c);
  } });
  await choose(o, "su-site", 1);
  await choose(o, "su-pay", 1);
  return o;
}

test("R6 after the claim every part is the registry's act for it, each drawn once its choice opens it", async () => {
  const o = await opened();
  // the parts are the registry's acts for setup (its own declaration, N1073), but the claim (before a session), the
  // codes (shown once, R20), the founder's handle (R18), and the acts a choice opens instead of another
  const REG = JSON.parse(fs.readFileSync(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url), "utf8"));
  const parts = (REG.screens || REG).find((r) => r.id === "setup").acts.map((x) => String(x.op).replace(/^owed:/, "").split(/\s/)[0])
    .filter((op) => !["claim", "recoverycodesissue", "founderhandleset"].includes(op));
  assert.ok(parts.length >= 10);
  /* R34: DEC-439 (D-B1) gives the time zone step its words and names `factconfirm`, but the registry's `setup` does not yet list the act
     (REPORTed to BOB for the design); the union makes this hold the day the registry lists it, with the same set */
  parts.push(...OWED_TO_REGISTRY);
  // with the place known and the assistant paid for by the team: all but `placewanted` (a place not known) and
  // `aikeepaway` (keeping AI out), each drawn when chosen
  const drawn = actOps(o.tree);
  assert.deepEqual(drawn, [...new Set(parts)].filter((op) => !["placewanted", "aikeepaway"].includes(op)).sort());
  o.fields["su-pick"] = "other"; await o.tick(300);
  assert.ok(actOps(o.tree).includes("placewanted") && !actOps(o.tree).includes("officesseed"));
  await choose(o, "su-ai", 1);
  assert.ok(actOps(o.tree).includes("aikeepaway"));
  for (const k of ["places", "offices", "assistant", "court", "security", "admins", "finished"]) has(o, "screen.setup." + k);
  has(o, "screen.setup.part.group");
  assert.ok(links(o.tree).includes("/app"), "Finished links /app");
});

test("R6 the real store walked from the claim to Finished: each part sends its act's body", async () => {
  const o = await opened();
  const sent = async (op, values, data) => (await o.press(op, { values, data })).sent.filter((x) => x.op === op).map((x) => x.body);
  const answerOf = (op) => o.requests.findLast((x) => x.op === op).answer;
  assert.deepEqual(await sent("groupnameset", { "su-name": " River Town Tenants " }), [{ name: "River Town Tenants" }]);
  assert.equal((await viaDoor(o.world, "groupidentity", {}, o.token)).json.result.display_name, "River Town Tenants", "the plane holds the name");
  assert.deepEqual(await sent("groupdomainset", { "su-domain": "walked-team.example" }), [{ domain: "walked-team.example" }]);
  assert.deepEqual(await sent("profilesset", { "su-pick": PLACE }), [{ profiles: [PLACE] }]);
  assert.deepEqual(await sent("officesseed", {}), [{}]);
  assert.ok(answerOf("officesseed").value.seeded.length > 0, "the plane seeded the place's public offices");
  assert.deepEqual(await sent("entitycreate", { "su-office": "The records office", "su-office-note": "Where the team files its requests" }), [{ kind: "office", label: "The records office", note: "Where the team files its requests" }]);
  has(o, "screen.setup.office.added", { label: "The records office" });
  assert.deepEqual(await sent("groupkeyset", { "su-key0": "sk-sentinel-key-9876543210" }), [{ key: "sk-sentinel-key-9876543210" }]);
  assert.ok(!o.drawn().includes("sk-sentinel-key"), "the key never drawn");
  assert.deepEqual(await sent("groupkeyswitch", {}, { on: "on" }), [{ on: true }]);
  assert.deepEqual(await sent("ailimitset", { "su-limit": "$5.00" }), [{ owner: "group", scope: "per_member", unit: "usd", period: "day", amount: 5 }]);
  assert.deepEqual(await sent("courtnoticeset", { "su-court-0": false, "su-court-1": true }), [{ choice: "dont" }]);
  assert.deepEqual(await sent("hostingaccessset", { "su-holders": "Two members, on the team's account", "su-hnote": "" }), [{ holders: "Two members, on the team's account", note: null }]);
  await reauth(o.world, o.as);   // changing administrators asks her password again, as the shell does
  assert.deepEqual(await sent("memberadd", { "su-adm-id": "dev", "su-adm-cover": "Dev, from the block" }), [{ memberId: "dev", cover: "Dev, from the block", role: "admin" }]);
  const invite = answerOf("memberadd").value;
  has(o, "screen.setup.admins.shown", { date: { html: date(invite.expires) } });
  assert.ok(o.text.includes("https://group.example/#invite=" + invite.invite), "the invitation shown once");
  const entry = o.view.data.catalogue.value.offered[0];
  const t = await o.press("securitytooladd", { values: { "su-st-0-cfg-0": "eu1", "su-st-0-cred-0": "tool-key", "su-st-0-cred-1": "tool-secret", "su-st-0-keep": true }, data: { tool: "0" } });
  assert.deepEqual(t.sent.map((x) => [x.op, x.body]), [
    ["securitytooladd", { providerId: entry.provider_id, config: { region: "eu1" }, credentials: { api_key: "tool-key", api_secret: "tool-secret" }, handlingDigest: entry.handling_digest, confirmRetention: true, use: "on_request" }],
    ["securitytooltest", { toolId: t.sent[0].answer.value.tool_id }],
    ["securitytools", undefined],
  ]);
  has(o, "screen.setup.security.passed", { tool: [entry.vendor, entry.product].join(" · ") });
  // a place not yet known: "Somewhere else" names it, and chooses no profile
  o.fields["su-pick"] = "other"; await o.tick(300);
  assert.deepEqual(await sent("placewanted", { "su-place": "A place not held" }), [{ name: "A place not held" }]);
  assert.deepEqual(await sent("profilesset", { "su-pick": "other" }), [{ profiles: [] }], "choosing none is allowed");
  // keeping AI out, with the founder's reason
  await choose(o, "su-ai", 1);
  assert.deepEqual(await sent("aikeepaway", { "su-why": "We hold tips from employees." }, { on: "on" }), [{ on: true, reason: "We hold tips from employees." }]);
});

test("R6 control: a refused part keeps the step and sends nothing more; a part with its field empty sends nothing", async () => {
  /* a team's keys are sealed under the platform's secret: with none bound, the plane refuses to keep a security tool's key */
  const u = await claimed({ env: { ACCOUNT_SEAL_SECRET: undefined, FILE_SCANNER: scannerBinding() }, after: ({ world, as }) => act(world, as, "profilesset", { body: { profiles: [PLACE] } }) });
  await choose(u, "su-site", 1); await choose(u, "su-pay", 1);
  const before = u.requests.length;
  // a name longer than a line is refused by the plane (instance-setup R6)
  const r = await u.press("groupnameset", { values: { "su-name": "x".repeat(200) } });
  assert.equal(u.requests.at(-1).answer.code, "GROUP_DISPLAY_NAME_MALFORMED", "the plane's own refusal");
  assert.equal(r.refused, true);
  assert.deepEqual(u.requests.slice(before).map((x) => x.op), ["groupnameset"], "nothing more is sent");
  assert.ok(isOpen(u, "group"), "the refused part stays open");
  assert.equal(stateOf(u, "group"), "optional");
  const s = await u.press("securitytooladd", { values: { "su-st-0-cfg-0": "eu1", "su-st-0-cred-0": "k", "su-st-0-cred-1": "s" }, data: { tool: "0" } });
  assert.equal(u.requests.findLast((x) => x.op === "securitytooladd").answer.code, "ACCOUNT_SEAL_UNAVAILABLE", "the plane's own refusal");
  assert.deepEqual(s.sent.map((x) => x.op), ["securitytooladd"], "no test after a refused add");
  u.fields["su-pick"] = "other"; await u.tick(300);
  for (const [op, values, key, data] of [["groupnameset", { "su-name": "" }, "screen.setup.name.empty"], ["placewanted", { "su-place": "" }, "screen.setup.place.empty"],
    ["entitycreate", { "su-office": "" }, "screen.setup.office.empty"], ["ailimitset", { "su-limit": "lots" }, "screen.setup.limit.bad"], ["courtnoticeset", {}, "screen.setup.court.pick"],
    ["hostingaccessset", { "su-holders": "" }, "screen.setup.hosting.empty"], ["memberadd", { "su-adm-id": "dev", "su-adm-cover": "" }, "screen.setup.admins.incomplete"],
    ["securitytooladd", { "su-st-0-cfg-0": "", "su-st-0-cred-0": "k" }, "screen.setup.security.missing", { tool: "0" }]]) {
    assert.deepEqual((await u.press(op, { values, data })).sent, [], op);
    assert.equal(u.refused.key, key, op);
  }
  await choose(u, "su-ai", 1);
  assert.deepEqual((await u.press("aikeepaway", { values: { "su-why": "" }, data: { on: "on" } })).sent, []);
  assert.equal(u.refused.key, "screen.setup.keepaway.noreason");
});

test("R6 every part is resumable: what the reads answer is drawn as done, and the scanner's sentence only while part_scanner is true", async () => {
  /* a team that has set up already: its name, its website (verified by the file it serves), the court notice, the hosting account, the assistant
     kept away, an office and a security tool, and a second administrator, each by the founder's real act */
  const o = await returned({ env: { FILE_SCANNER: scannerBinding() }, after: async ({ world, as }) => {
    await act(world, as, "groupnameset", { body: { name: "River Town" } });
    // the website: the claim's file is served as the plane gave it, so the check finds it
    const claim = await act(world, as, "groupdomainset", { body: { domain: "resumed-team.example" } });
    world.script(/resumed-team\.example\/\.well-known\//, () => new Response(JSON.stringify(claim.well_known.body), { headers: { "content-type": "application/json" } }));
    await act(world, as, "groupdomainset", { body: { domain: "resumed-team.example" } });
    await act(world, as, "courtnoticeset", { body: { choice: "tell" } });
    await act(world, as, "hostingaccessset", { body: { holders: "The treasurer", note: null } });
    await act(world, as, "aikeepaway", { body: { on: true, reason: "Tips." } });
    await act(world, as, "profilesset", { body: { profiles: [PLACE] } });
    await act(world, as, "entitycreate", { body: { kind: "office", label: "City Clerk", note: "Takes our requests" } });
    const cat = (await act(world, as, "securitytoolcatalogue", {})).offered[0];
    await act(world, as, "securitytooladd", { body: { providerId: cat.provider_id, config: { region: "eu1" }, credentials: { api_key: "k", api_secret: "s" }, handlingDigest: cat.handling_digest, confirmRetention: true, use: "on_request" } });
    await reauth(world, as);
    await act(world, as, "memberadd", { body: { memberId: "dev", cover: "Dev", role: "admin" } });
  } });
  has(o, "screen.setup.name.now", { name: "River Town" }); has(o, "screen.setup.domain.verified", { domain: "resumed-team.example" });
  has(o, "screen.setup.court.now.tell"); has(o, "screen.group.hosting.now.setup", { date: { html: date(o.requests.findLast((r) => r.op === "hostingaccess").answer.value.current.at) } });
  assert.ok(o.text.includes("The treasurer"), "who holds the hosting account");
  has(o, "screen.setup.keepaway.on");
  const cat = o.view.data.catalogue.value.offered[0];
  has(o, "screen.setup.security.held", { tool: [cat.vendor, cat.product].join(" · ") });
  assert.ok(o.text.includes("City Clerk"), "the team's offices listed");
  assert.deepEqual(PARTS.map((k) => stateOf(o, k)), ["done", "done", "done", "done", "off", "done", "done", "done"]);
  has(o, "screen.setup.security.scanner");
  const off = await claimed();
  lacks(off, "screen.setup.security.scanner");
});

test("R6 the words setup reads: no sentence says administrators see spending by member (DEC-188 (5)); 'file scanner' and 'safe view' only (DEC-200 (5))", () => {
  // each sentence read through setup-words' word, its placeholders left as named (R21: no English held here)
  const read = SCREENS.find((s) => s.id === "setup").words.filter((k) => !/^act\./.test(k)).map((k) => [k, sentence(k)]);
  for (const [k, en] of read) {
    assert.doesNotMatch(en, /(see|sees|seeing)[^.]*(spend|spending|use)[^.]*by member|each member's (spending|use)[^.]* (seen|visible)/i, k);
    assert.doesNotMatch(en, /virus scanner|antivirus|sandbox|safe-view maker|\bsafe copy maker\b/i, k);
  }
  // control: the pattern finds one
  assert.match("administrators see spending by member", /(see|sees|seeing)[^.]*(spend|spending|use)[^.]*by member/i);
  assert.ok(read.some(([, en]) => /file scanner/.test(en)) && read.some(([, en]) => /safe view/.test(en)));
});

// ---- R22: setup drawn as the design draws it (DEC-279) ----
const tipOf = (e) => squash(unescape(e.attrs["data-tip"] || ""));
const summaryOf = (o, key) => all(partOf(o, key), (e) => e.tag === "summary")[0];
const sharedScanner = () => ({ FILE_SCANNER: scannerBinding() });

test("R22 before the claim only part 1, 'Make it yours', is open; the seven parts that follow are shown closed beneath it under screen.setup.coming", async () => {
  const o = await open("setup", { fragment: { boot: OTP }, world: await fresh() });
  assert.deepEqual(all(o.tree, (e) => e.attrs["data-part"]).map((e) => e.attrs["data-part"]), PARTS);
  assert.equal(partOf(o, "claim").tag, "details");
  assert.ok(isOpen(o, "claim")); assert.equal(stateOf(o, "claim"), "needed");
  has(o, "screen.setup.part.claim.why"); has(o, "screen.setup.state.needed"); has(o, "screen.setup.claim.intro"); has(o, "screen.setup.coming");
  for (const k of PARTS.slice(1)) {
    assert.equal(partOf(o, k).tag, "div", k + ": shown, not opened");
    assert.equal(stateOf(o, k), "later");
    assert.equal(all(partOf(o, k), (e) => ["input", "button", "select"].includes(e.tag)).length, 0, k);
    has(o, "screen.setup.part." + k + ".why");
  }
  // the numbers in order, every field and act inside part 1
  assert.deepEqual(all(o.tree, (e) => e.attrs.class === "n").map((e) => e.children.map((c) => c.text).join("")), ["1", "2", "3", "4", "5", "6", "7", "8"]);
  for (const f of all(o.tree, (e) => e.tag === "input" || e.attrs["data-act"])) assert.ok(all(partOf(o, "claim"), (e) => e === f).length === 1, "outside part 1");
  // the long explanations behind explained terms: the one-time password's and the handle's
  const tips = all(o.tree, (e) => /\bcs-card\b/.test(e.attrs.class || "")).map(tipOf);
  for (const k of ["screen.setup.otp.tip", "screen.setup.handle.tip"]) assert.ok(tips.includes(said(k)), k);
  lacks(o, "screen.setup.otp.tip"); lacks(o, "screen.setup.handle.tip");
  // the act as the design names it
  assert.equal(all(o.tree, (e) => e.attrs["data-act"] === "claim")[0].children.map((c) => c.text).join(""), word("screen.setup.claim.button"));
  // the head names the short name (the team's, as the plane answers it) until the team is named
  const slug = o.requests.find((r) => r.op === "groupidentity").answer.value.group;
  assert.deepEqual(all(o.tree, (e) => e.attrs.class === "muted").map((e) => e.children.map((c) => c.text).join("")), [slug]);
});

test("R22 just claimed: screen.setup.after heads the parts, each with its number, its name, what it is for and its state; part 1 done", async () => {
  const o = await claimed();
  has(o, "screen.setup.after"); lacks(o, "screen.setup.coming"); lacks(o, "screen.setup.lede");
  for (const k of PARTS) {
    assert.equal(partOf(o, k).tag, "details", k);
    const sum = summaryOf(o, k);
    for (const c of ["n", "t", "why", "cs-due"]) assert.equal(all(sum, (e) => e.attrs.class === c).length, 1, `${k}: ${c}`);
  }
  assert.equal(stateOf(o, "claim"), "done");
  assert.deepEqual(PARTS.slice(1).map((k) => stateOf(o, k)), ["optional", "optional", "optional", "optional", "optional", "optional", "optional"], "a team just claimed has set nothing");
  for (const st of ["optional"]) has(o, "screen.setup.state." + st);
  // the parts in the design's order, under their names
  for (const [k, t] of [["group", "part.group"], ["places", "places"], ["offices", "offices"], ["assistant", "assistant"], ["court", "court"], ["security", "security"], ["admins", "admins"]]) {
    assert.equal(all(summaryOf(o, k), (e) => e.attrs.class === "t")[0].children.map((c) => c.text).join(""), word("screen.setup." + t), k);
  }
  // part 2 open on the team's name (R14), the rest closed but the codes'
  assert.ok(isOpen(o, "claim") && isOpen(o, "group"));
  for (const k of PARTS.slice(2)) assert.ok(!isOpen(o, k), k);
});

test("R22 a saved name draws screen.setup.name.now with the accepted mark beside the field, and the team's name replaces the short name in the head; its help explains what changes", async () => {
  const o = await claimed();
  const slug = o.requests.find((r) => r.op === "groupidentity").answer.value.group;
  assert.deepEqual(all(o.tree, (e) => e.attrs.class === "muted").map((e) => e.children.map((c) => c.text).join("")), [slug], "the short name until named");
  await o.press("groupnameset", { values: { "su-name": "River Town" } });
  const mark = all(o.tree, (e) => e.attrs["data-state"] === "named")[0];
  assert.equal(mark.attrs["data-due"], "met");
  has(o, "screen.setup.name.now", { name: "River Town" });
  assert.ok(all(partOf(o, "group"), (e) => e === mark).length === 1, "beside the field, in part 2");
  assert.equal(stateOf(o, "group"), "done");
  assert.deepEqual(all(o.tree, (e) => e.attrs.class === "grp").map((e) => e.children.map((c) => c.text).join("")), ["River Town"]);
  assert.equal(all(o.tree, (e) => e.attrs.class === "muted").length, 0, "the short name gone from the head");
  assert.ok(all(o.tree, (e) => /\bcs-card\b/.test(e.attrs.class || "")).map(tipOf).includes(said("screen.setup.name.tip")));
  // control: a name not yet saved draws no "now"
  lacks(await claimed(), "screen.setup.name.now", { name: "River Town" });
});

test("R22 the website: 'No' draws nothing more; 'Yes', explained by screen.setup.site.tip, opens the address and groupdomainset", async () => {
  const o = await claimed();
  const choice = all(o.tree, (e) => e.tag === "fieldset" && e.attrs.id === "su-site")[0];
  assert.equal(choice.attrs.class, "cs-choice");
  assert.ok(all(choice, (e) => /\bcs-card\b/.test(e.attrs.class || "")).map(tipOf).includes(said("screen.setup.site.tip")));
  assert.ok(!actOps(o.tree).includes("groupdomainset") && all(o.tree, (e) => e.attrs.id === "su-domain").length === 0, "no: nothing more");
  await choose(o, "su-site", 1);
  assert.ok(actOps(o.tree).includes("groupdomainset") && all(o.tree, (e) => e.attrs.id === "su-domain").length === 1);
  assert.ok(isOpen(o, "group"), "the part that holds the choice stays open");
  await choose(o, "su-site", 0);
  assert.ok(!actOps(o.tree).includes("groupdomainset"));
  // a team that holds a website opens on "Yes"
  const held = await returned({ after: ({ world, as }) => act(world, as, "groupdomainset", { body: { domain: "held-team.example" } }) });
  assert.ok(actOps(held.tree).includes("groupdomainset"));
});

test("R22 the assistant: 'no' sends aikeepaway on with the reason and then hides every other element about AI in setup (screen.setup.ai.off); the part is off", async () => {
  const o = await claimed();
  assert.equal(stateOf(o, "assistant"), "optional");
  assert.equal(all(o.tree, (e) => e.tag === "fieldset" && e.attrs.id === "su-ai")[0].attrs.class, "cs-choice");
  has(o, "screen.setup.ai.yes.help");
  assert.ok(all(partOf(o, "assistant"), (e) => /\bcs-card\b/.test(e.attrs.class || "")).map(tipOf).includes(said("screen.setup.leaves.what")));
  await choose(o, "su-ai", 1);
  assert.ok(actOps(o.tree).includes("aikeepaway"));
  assert.equal(all(o.tree, (e) => e.attrs.id === "su-pay").length, 0, "no pay choice under 'no'");
  const r = await o.press("aikeepaway", { values: { "su-why": "We hold tips." }, data: { on: "on" } });
  assert.deepEqual(r.sent.filter((x) => x.op === "aikeepaway").map((x) => x.body), [{ on: true, reason: "We hold tips." }]);
  has(o, "screen.setup.ai.off"); has(o, "screen.setup.keepaway.on");
  assert.equal(stateOf(o, "assistant"), "off"); has(o, "screen.setup.state.off");
  // no AI field, key or pay choice is drawn after, whatever the page's radios say
  const ai = partOf(o, "assistant");
  assert.equal(all(ai, (e) => ["input", "select", "textarea"].includes(e.tag) && !/^su-skip-/.test(e.attrs.id || "")).length, 0);
  assert.deepEqual(actOps(ai), []);
  for (const k of ["screen.setup.pay.q", "screen.setup.key", "screen.setup.limit", "screen.setup.ai.q"]) lacks(o, k);
});

test("R22 control: choosing 'yes' draws no key field until 'your team pays' is chosen; the team's key, its switch and the limit only then", async () => {
  const o = await claimed();
  const keyed = () => all(o.tree, (e) => /^su-key/.test(e.attrs.id || "")).length;
  assert.equal(keyed(), 0); assert.ok(!actOps(o.tree).includes("groupkeyset"));
  has(o, "screen.setup.pay.q");
  await choose(o, "su-pay", 1);
  assert.equal(keyed(), 1);
  for (const op of ["groupkeyset", "ailimitset"]) assert.ok(actOps(o.tree).includes(op), op);
  has(o, "screen.setup.key.told");
  assert.ok(all(o.tree, (e) => /\bcs-card\b/.test(e.attrs.class || "")).map(tipOf).includes(said("screen.setup.key.tip")));
  await choose(o, "su-pay", 0);
  assert.equal(keyed(), 0);
});

test("R6 an office is never sent without its note: entities R1 refuses one, so the page asks the note and sends nothing; control: with its note the plane records it", async () => {
  const o = await opened();
  const before = o.requests.length;
  const r = await o.press("entitycreate", { values: { "su-office": "The records office", "su-office-note": "  " } });
  assert.deepEqual(r.sent, [], "no office without a note leaves the page");
  assert.equal(o.refused.key, "refusal.ENTITY_NO_NOTE");
  assert.deepEqual(o.requests.slice(before).map((x) => x.op), [], "nothing more is read or sent");
  assert.ok(!(await act(o.world, { token: o.token }, "entitieskind", { query: { kind: "office", limit: "500" } })).entities.some((e) => e.label === "The records office"), "the plane holds no such office");
  const ok = await o.press("entitycreate", { values: { "su-office": "The records office", "su-office-note": "Where the team files its requests" } });
  assert.deepEqual(ok.sent.filter((x) => x.op === "entitycreate").map((x) => x.body), [{ kind: "office", label: "The records office", note: "Where the team files its requests" }]);
  assert.equal(o.requests.findLast((x) => x.op === "entitycreate").answer.kind, "ok");
});

test("R22 the place: screen.setup.place.other opens placewanted, and the offices part then says offices are added by hand", async () => {
  const o = await claimed({ after: async ({ world, as }) => {
    await act(world, as, "profilesset", { body: { profiles: [PLACE] } });
    await act(world, as, "placewanted", { body: { name: "Fresno" } });
  } });
  has(o, "screen.setup.offices.what", { place: nameOfPlace(o) });
  assert.ok(actOps(o.tree).includes("officesseed") && !actOps(o.tree).includes("placewanted"));
  o.fields["su-pick"] = "other"; await o.tick(300);
  assert.ok(actOps(o.tree).includes("placewanted") && !actOps(o.tree).includes("officesseed"));
  has(o, "screen.setup.offices.none", { place: "Fresno" }); lacks(o, "screen.setup.offices.what", { place: nameOfPlace(o) });
  assert.ok(actOps(o.tree).includes("entitycreate"), "an office added by hand");
  assert.ok(isOpen(o, "places"));
});

test("R22 each part's state is the one its read gives; control: a read that fails or does not answer leaves its part optional, never done", async () => {
  const doneAll = async ({ world, as }) => {
    await act(world, as, "groupnameset", { body: { name: "River Town" } });
    await act(world, as, "entitycreate", { body: { kind: "office", label: "City Clerk", note: "Takes our requests" } });
    await act(world, as, "courtnoticeset", { body: { choice: "dont" } });
    const cat = (await act(world, as, "securitytoolcatalogue", {})).offered[0];
    await act(world, as, "securitytooladd", { body: { providerId: cat.provider_id, config: { region: "eu1" }, credentials: { api_key: "k", api_secret: "s" }, handlingDigest: cat.handling_digest, confirmRetention: true, use: "on_request" } });
    await reauth(world, as);
    await act(world, as, "memberadd", { body: { memberId: "dev", cover: "Dev", role: "admin" } });
    await act(world, as, "profilesset", { body: { profiles: [PLACE] } });
  };
  const o = await returned({ after: doneAll });
  assert.deepEqual(PARTS.map((k) => stateOf(o, k)), ["done", "done", "done", "done", "optional", "done", "done", "done"]);
  // the founder alone, or a second person who is not an administrator, is no second administrator
  const one = await returned({ after: async ({ world, as }) => { await enrol(world, as, PW, "mai"); } });
  assert.equal(stateOf(one, "admins"), "optional");
  // reads that fail or do not answer (the harness's faults) leave every part after the name optional
  const world = o.world, as = o.as;
  for (const fail of [{ ok: false }, "none"]) {
    const f = await open("setup", { world, as, table: { profiles: fail, entitieskind: fail, courtnotice: fail, securitytools: fail, memberlist: fail, aikeepawaystate: fail } });
    assert.deepEqual(PARTS.slice(2).map((k) => stateOf(f, k)), ["optional", "optional", "optional", "optional", "optional", "optional"], JSON.stringify(fail));
  }
});

test("R22 the drawing's five states over the real store: unclaimed, just claimed, a founder with no handle, already claimed, a member opening setup", async () => {
  const e = await open("setup", { fragment: { boot: OTP }, world: await fresh() });
  has(e, "screen.setup.lede"); assert.equal(all(e.tree, (x) => x.tag === "details" && "open" in x.attrs).length, 1);
  const a = await claimed();
  has(a, "screen.setup.after"); has(a, "screen.setup.claimed", { group: said("screen.entry.group"), handle: HANDLE });
  // the claimed state marked as the release walk finds it (journey-check)
  assert.equal(all(summaryOf(a, "claim"), (x) => x.attrs["data-state"] === "claimed").length, 1);
  const old = await oldFounder();
  const b = await open("setup", { world: old.world, as: old.as });
  assert.deepEqual(all(b.tree, (x) => x.tag === "h1").map((x) => x.children.map((c) => c.text).join("")), [word("founder.handle.title")]);
  assert.equal(all(b.tree, (x) => x.attrs["data-part"]).length, 0);
  const taken = await fresh();
  await taken.claim({ password: PW, handle: HANDLE });
  const c = await open("setup", { fragment: { boot: OTP }, world: taken });
  assert.deepEqual(all(c.tree, (x) => x.tag === "h1").map((x) => x.children.map((t) => t.text).join("")), [word("setup.claimed.heading")]);
  assert.equal(all(c.tree, (x) => /\bcs-gap\b/.test(x.attrs.class || "")).length, 1);
  const mai = await enrol(a.world, a.as, PW, "mai");
  const d = await open("setup", { world: a.world, as: mai });
  assert.deepEqual(all(d.tree, (x) => x.tag === "h1").map((x) => x.children.map((t) => t.text).join("")), [word("setup.member.heading")]);
  for (const s of [b, c, d]) assert.equal(all(s.tree, (x) => x.attrs["data-part"]).length, 0, "no parts");
});

// ---- R23: Skip for now, and the second administrator ----
test("R23 every part after part 1 carries 'Skip for now', explained by setup.skip_does; skipping each sends no request and marks it skipped, closed", async () => {
  const o = await claimed();
  assert.equal(all(partOf(o, "claim"), (e) => e.attrs["data-skip"]).length, 0, "part 1 has none");
  for (const k of PARTS.slice(1)) {
    const skip = all(partOf(o, k), (e) => e.attrs["data-skip"] === k);
    assert.equal(skip.length, 1, k);
    assert.equal(skip[0].children.filter((c) => c.text).map((c) => c.text).join("").trim(), word("setup.skip"));
    assert.equal(tipOf(skip[0]), said("setup.skip_does"));
  }
  for (const k of PARTS.slice(1)) {
    const before = o.requests.length;
    const was = stateOf(o, k);
    o.fields["su-skip-" + k] = true;
    await o.tick(300);
    assert.deepEqual(o.requests.slice(before), [], k + ": nothing sent");
    assert.equal(partOf(o, k).attrs["data-skipped"], "true", k);
    assert.ok(!isOpen(o, k), k + ": closed");
    assert.equal(stateOf(o, k), was, k + ": left as it is");
  }
  // un-skipped, it is as it was
  o.fields["su-skip-group"] = false; await o.tick(300);
  assert.equal(partOf(o, "group").attrs["data-skipped"], undefined);
  // control: nothing is kept but the page: setup opened again shows no part skipped
  const again = await open("setup", { world: o.world, as: o.as });
  assert.equal(all(again.tree, (e) => e.attrs["data-skipped"]).length, 0);
});

test("R23 part 8's act is setup.admin.invite, explained by setup.admin.invite_does, sending memberadd with role admin; no plain invitation to a member is offered", async () => {
  const o = await claimed();
  const btn = all(partOf(o, "admins"), (e) => e.attrs["data-act"] === "memberadd");
  assert.equal(btn.length, 1);
  assert.equal(btn[0].children.map((c) => c.text).join(""), word("setup.admin.invite"));
  assert.equal(tipOf(btn[0].parent), said("setup.admin.invite_does"));
  assert.equal(all(o.tree, (e) => e.attrs["data-act"] === "memberadd").length, 1, "one invitation, the administrator's");
  await reauth(o.world, o.as);   // changing administrators asks her password again, as the shell does
  const r = await o.press("memberadd", { values: { "su-adm-id": "dev", "su-adm-cover": "Dev" } });
  assert.deepEqual(r.sent.filter((x) => x.op === "memberadd").map((x) => x.body), [{ memberId: "dev", cover: "Dev", role: "admin" }]);
  const shown = r.sent[0].answer.value;
  has(o, "screen.setup.admins.shown", { date: { html: date(shown.expires) } });
  // control: refused, the step is kept and nothing more is sent (the plane holds `dev` already: the id is taken)
  const n = await claimed();
  await enrol(n.world, n.as, PW, "dev");
  await reauth(n.world, n.as);
  const before = n.requests.length;
  await n.press("memberadd", { values: { "su-adm-id": "dev", "su-adm-cover": "Dev" } });
  assert.deepEqual(n.requests.slice(before).map((x) => x.op), ["memberadd"]);
  assert.equal(n.requests.at(-1).answer.kind, "refused", "the plane's own refusal");
  assert.ok(isOpen(n, "admins") && actOps(partOf(n, "admins")).includes("memberadd"));
  lacks(n, "screen.setup.admins.shown", { date: { html: date(shown.expires) } });
});

// ---- R25: a skipped part reads "Skipped" ----
test("R25 a skipped part shows screen.setup.state.skipped with its help in the place of its state mark, sends nothing, and un-skipping restores the state its read gives; control: part 1 has no skip, a part never skipped draws its read's state, a refused part keeps its step", async () => {
  const o = await claimed();
  const mark = (k) => all(summaryOf(o, k), (e) => (e.attrs.class || "").includes("cs-due"))[0];
  const markText = (k) => squash(unescape(mark(k).children.filter((c) => c.text).map((c) => c.text).join("")));
  const was = stateOf(o, "places");
  assert.equal(markText("places"), squash(word("screen.setup.state." + was)));
  const before = o.requests.length;
  o.fields["su-skip-places"] = true; await o.tick(300);
  assert.deepEqual(o.requests.slice(before), [], "nothing sent");
  assert.equal(markText("places"), squash(word("screen.setup.state.skipped")));
  assert.equal(tipOf(mark("places")), said("screen.setup.state.skipped.help"));
  assert.ok(!isOpen(o, "places"));
  // the other parts keep what their reads give
  assert.equal(markText("court"), squash(word("screen.setup.state." + stateOf(o, "court"))));
  // un-skipping restores the state its read gives
  o.fields["su-skip-places"] = false; await o.tick(300);
  assert.equal(markText("places"), squash(word("screen.setup.state." + was)));
  assert.equal(tipOf(mark("places")), "");
  // control: part 1 has no skip and is never skipped
  assert.equal(all(partOf(o, "claim"), (e) => e.attrs["data-skip"]).length, 0);
  assert.equal(partOf(o, "claim").attrs["data-skipped"], undefined);
  // control: a refused part keeps its step (the court notice answers a choice it does not know with its own refusal)
  const n = await claimed();
  const b = n.requests.length;
  await n.press("courtnoticeset", { values: { "su-court-0": true } });
  assert.deepEqual(n.requests.slice(b).map((x) => x.op), ["courtnoticeset", "courtnotice"]);
  assert.ok(isOpen(n, "court"));
  // and the same part refused by the plane: a name longer than a line
  const r = await claimed();
  const c = r.requests.length;
  await r.press("groupnameset", { values: { "su-name": "x".repeat(200) } });
  assert.deepEqual(r.requests.slice(c).map((x) => x.op), ["groupnameset"]);
  assert.ok(isOpen(r, "group"));
});

// ---- the security tools are named by the catalogue's display name, never by an id (journey-check R27; K4097) ----
test("R6 a security tool is drawn by its vendor and product from the catalogue read, never by its provider id; control: a tool the catalogue does not name draws no id", async () => {
  const o = await claimed({ env: sharedScanner() });
  const cat = o.view.data.catalogue.value.offered[0];
  const display = [cat.vendor, cat.product].join(" · ");
  const legends = all(partOf(o, "security"), (e) => e.tag === "legend").map((e) => squash(e.children.map((c) => c.text || "").join("")));
  // the first tool the catalogue offers by its vendor and product; every legend is a vendor and product of the catalogue read, none an id
  assert.equal(legends[0], display);
  assert.equal(legends.length, o.view.data.catalogue.value.offered.length);
  for (const t of o.view.data.catalogue.value.offered) assert.ok(!legends.includes(t.provider_id), t.provider_id + " drawn as a legend");
  await o.press("securitytooladd", { values: { "su-st-0-cfg-0": "eu1", "su-st-0-cred-0": "tool-key", "su-st-0-cred-1": "tool-secret", "su-st-0-keep": true }, data: { tool: "0" } });
  has(o, "screen.setup.security.held", { tool: display });
  has(o, "screen.setup.security.passed", { tool: display });
  assert.ok(!o.drawn().includes(cat.provider_id), "the provider's id drawn");
  // control: the catalogue cannot be read, so the held tool is named by nothing the page knows: no id is drawn in its place
  const blind = await open("setup", { world: o.world, as: o.as, table: { securitytoolcatalogue: "none" } });
  assert.equal(blind.requests.find((r) => r.op === "securitytools").answer.value.tools.length, 1, "the plane holds the tool");
  assert.ok(!blind.drawn().includes(cat.provider_id), "no id drawn for a tool the catalogue does not name");
  assert.ok(!blind.text.includes("scanii-"), "nor the tool's own id");
});

// ---- R26: the team's website file, drawn from the answer ----
// The file is whatever the plane answers as `well_known`; the tests read it back from the answer and never build one.
/* each team claims a website of its own: the world's network script is the process's, so a domain is never shared between two teams (REPORT 4) */
let sites = 0;
const folds = (o) => all(o.tree, (e) => e.tag === "details" && "data-domainfile" in e.attrs);
const gapsOf = (n) => all(n, (e) => /\bcs-gap\b/.test(e.attrs.class || "")).map((e) => squash(textOf(e)));
const verifierWords = ["malformed", "absent", "mismatched", "undetermined", "notadmin"].map((k) => "screen.domainfile.refused." + k);
/* the team holds a website claim, as the founder's real `groupdomainset` makes it; the website answers as `serve` says (the network is the
   platform's: none, a missing file, another file, the claim's own file) */
async function withClaim(serve = "none", { env } = {}) {
  let claim;
  const DOMAIN = `team-${++sites}.example`;
  const o = await returned({ env, after: async ({ world, as }) => {
    const web = {
      none: null,
      absent: () => new Response("not here", { status: 404 }),
      mismatched: () => new Response(JSON.stringify({ instance: "https://another.example", group: "another" }), { headers: { "content-type": "application/json" } }),
      served: () => new Response(JSON.stringify(claim.well_known.body), { headers: { "content-type": "application/json" } }),
    }[serve];
    if (serve === "served") { claim = await act(world, as, "groupdomainset", { body: { domain: DOMAIN } }); }
    if (web) world.script(new RegExp(DOMAIN.replace(/\./g, "\\.")), web);
    claim = await act(world, as, "groupdomainset", { body: { domain: DOMAIN } });
  } });
  return { o, domain: DOMAIN, claim: o.requests.find((r) => r.op === "groupidentity").answer.value.domain_claim };
}

test("R26 setup with a website entered draws the file from the answer's well_known, a save and a copy of it, and the steps to place it", async () => {
  const { o, claim, domain: DOMAIN } = await withClaim("served");
  const wk = claim.well_known;
  assert.deepEqual(wk.path, "/.well-known/civicsmith-group.json");
  const [fold] = folds(o);
  assert.equal(folds(o).length, 1);
  assert.equal(all(fold, (e) => e.tag === "summary")[0].children.map((c) => c.text).join(""), said("screen.domainfile.summary"));
  has(o, "screen.domainfile.what"); has(o, "screen.domainfile.steps"); has(o, "screen.domainfile.daily");
  const file = wk.path.split("/").filter(Boolean).at(-1), folder = wk.path.split("/").filter(Boolean)[0];
  const pre = all(fold, (e) => e.tag === "pre")[0];
  assert.deepEqual(JSON.parse(textOf(pre)), wk.body, "the file's text is the answer's body");
  assert.ok(texts(fold).includes(file), "the file is named by the last segment of the answer's path");
  assert.equal(o.saves.at(-1).name, file);
  assert.deepEqual(JSON.parse(o.saves.at(-1).text), wk.body);
  assert.deepEqual(JSON.parse(o.copies.at(-1)), wk.body);
  const shellActs = all(fold, (e) => e.tag === "button" && e.attrs["data-shell"]).map((e) => e.attrs["data-shell"]).sort();
  assert.deepEqual(shellActs, ["copy", "save"]);
  assert.ok(texts(fold).some((t) => t.includes(said("screen.domainfile.download"))));
  const steps = all(fold, (e) => e.tag === "li").map((e) => squash(textOf(e)));
  assert.deepEqual(steps, [
    said("screen.domainfile.step1"), said("screen.domainfile.step2", { folder }), said("screen.domainfile.step3"),
    said("screen.domainfile.step4", { address: "https://" + DOMAIN + wk.path }), said("screen.domainfile.step5"),
  ]);
  for (const k of verifierWords) assert.ok(o.text.split(said(k)).length - 1 === 1, `${k} is drawn once, in the fold, for a verified claim`);
  // the page sends nothing to draw it
  assert.ok(!o.requests.some((r) => r.op === "groupdomainset"), "drawing the file asks nothing of the team");
});

test("R26 control: an answer with no file draws the steps without one; no claim draws no fold", async () => {
  /* a team whose store records no producing name has no file to look for (instance-setup R100): the record is removed by the test, and the
     plane then answers `well_known: null` itself */
  const { o } = await withClaim("none");
  const [before] = folds(o);
  assert.ok(before, "the fold is drawn");
  o.world.sql.exec("DELETE FROM instance_group");
  await o.readAll(null);
  const [fold] = folds(o);
  assert.equal(o.requests.findLast((r) => r.op === "groupidentity").answer.value.domain_claim.well_known, null, "the plane gives no file");
  assert.equal(all(fold, (e) => e.tag === "pre").length, 0);
  assert.equal(all(fold, (e) => e.tag === "button").length, 0, "no save, no copy");
  assert.deepEqual(all(fold, (e) => e.tag === "li").map((e) => squash(textOf(e))), [said("screen.domainfile.step1"), said("screen.domainfile.step3"), said("screen.domainfile.step5")]);
  has(o, "screen.domainfile.what"); has(o, "screen.domainfile.refused.summary");
  const none = await claimed();
  await choose(none, "su-site", 1);
  assert.equal(folds(none).length, 0);
  lacks(none, "screen.domainfile.summary");
  const { o: no } = await withClaim("none");
  await choose(no, "su-site", 0);
  assert.equal(folds(no).length, 0, "the choice 'No' draws nothing more");
});

test("R26 the verifier's refusals are drawn by their words: the claim's latest check beside the act, and each refusal in its fold", async () => {
  for (const verdict of ["absent", "mismatched", "undetermined"]) {
    const { o } = await withClaim(verdict === "undetermined" ? "none" : verdict);
    assert.equal(o.requests.find((r) => r.op === "groupidentity").answer.value.domain_claim.latest.verdict, verdict, "the plane's own verdict");
    const key = "screen.domainfile.refused." + verdict;
    assert.equal(o.text.split(said(key)).length - 1, 2, `${verdict}: beside the act and in the fold`);
    assert.ok(gapsOf(o.tree).includes(said(key)));
    const fold = folds(o)[0];
    const inner = all(fold, (e) => e.tag === "details" && e !== fold)[0];
    assert.deepEqual(gapsOf(inner), verifierWords.map((k) => said(k)));
  }
  const { o: ok } = await withClaim("served");
  assert.equal(ok.requests.find((r) => r.op === "groupidentity").answer.value.domain_claim.latest.verdict, "verified");
  assert.equal(gapsOf(folds(ok)[0]).length, 5);
  assert.equal(ok.text.split(said("screen.domainfile.refused.absent")).length - 1, 1);
});

test("R26 groupdomainset refused GROUP_DOMAIN_MALFORMED or NOT_AN_ADMIN draws its words in the design's, and sends nothing more", async () => {
  const { o } = await withClaim("none");
  const r = await o.press("groupdomainset", { values: { "su-domain": "https://rivertown.example/page" } });
  assert.deepEqual(r.sent.map((x) => x.op), ["groupdomainset"]);
  assert.equal(r.sent[0].answer.code, "GROUP_DOMAIN_MALFORMED", "the plane's own refusal");
  assert.equal(o.refused.text, said("screen.domainfile.refused.malformed"));
  /* NOT_AN_ADMIN is the plane's answer to an act of someone who is no administrator; the founder is the root of trust and cannot be made
     one (`adminresign` is refused ROOT_OF_TRUST), so no act of hers reaches it and the refusal's drawing is checked on an answer made for the purpose */
  // fixtures-generic: NOT_AN_ADMIN (screens-entry R26: the plane gives it to no act of the founder, who is the root of trust, membership R84)
  const n = await withClaim("none");
  const refused = await open("setup", { world: n.o.world, as: n.o.as, table: { groupdomainset: { ok: false, code: "NOT_AN_ADMIN" } } });
  await choose(refused, "su-site", 1);
  const x = await refused.press("groupdomainset", { values: { "su-domain": "rivertown.example" } });
  assert.deepEqual(x.sent.map((y) => y.op), ["groupdomainset"]);
  assert.equal(refused.refused.text, said("screen.domainfile.refused.notadmin"));
});

// ---- R30: who recorded the hosting account ----
test("R30 where setup shows who recorded hosting access, the setup and the system have their words; control: a member's is as before", async () => {
  const holders = "The treasurer";
  /* the founder's own act is recorded as `admin`, which setup reads as the setup; the installer's and the operator's records are the system's:
     no act of the door records a hosting account by the system, so those rows are written to the table the plane reads (K5192) */
  const seed = (world, by) => world.sql.exec("INSERT INTO hosting_access (holders, note, recorded_by, at) VALUES (?,?,?,?)", holders, null, by, "2026-10-01T00:00:00Z");
  for (const [by, key] of [["admin", "screen.group.hosting.now.setup"], ["bootstrap", "screen.group.hosting.now.setup"], ["system:seed", "screen.group.hosting.now.system"], ["token:ops", "screen.group.hosting.now.system"]]) {
    const o = await returned({ after: async ({ world, as }) => { if (by === "admin") await act(world, as, "hostingaccessset", { body: { holders, note: null } }); else seed(world, by); } });
    const at = o.requests.findLast((r) => r.op === "hostingaccess").answer.value.current.at;
    assert.equal(o.requests.findLast((r) => r.op === "hostingaccess").answer.value.current.recorded_by, by, "the plane's record");
    has(o, key, { date: { html: date(at) } });
    assert.ok(o.text.includes(holders));
    lacks(o, "screen.setup.hosting.now", { holders });
    for (const other of ["screen.group.hosting.now.setup", "screen.group.hosting.now.system"].filter((k) => k !== key)) lacks(o, other, { date: { html: date(at) } });
  }
  // control: a second administrator's own record is drawn as before (a member's)
  const member = await returned({ after: async ({ world, as }) => {
    const dev = await enrol(world, as, PW, "dev", { admin: true });
    await act(world, dev, "hostingaccessset", { body: { holders, note: null } });
  } });
  const cur = member.requests.findLast((r) => r.op === "hostingaccess").answer.value.current;
  assert.equal(cur.recorded_by, "dev");
  const at = cur.at;
  has(member, "screen.setup.hosting.now", { holders });
  lacks(member, "screen.group.hosting.now.setup", { date: { html: date(at) } }); lacks(member, "screen.group.hosting.now.system", { date: { html: date(at) } });
});

// ---- R33: step 7 draws the scanner's true state (C83) ----
// The scanner is the platform's binding, stood in by file-safety's own double (`scannerBinding`), told what signatures it holds; the plane's
// `scanstatus` is the real one. `last_error` is what the scanner states of its last download.
const NOSIG = (last_error, last_attempt = "2026-10-15T03:00:00Z") => ({ signatures: { versions: null, published: null, mirrored_at: null, last_attempt, last_error } });
const securityText = (o) => squash(textOf(partOf(o, "security")));

test("R33 a scanner holding no signatures draws since when and why, from the answer, and not the checked sentence; control: signatures held draw the checked sentence and none of those words", async () => {
  const o = await returned({ env: { FILE_SCANNER: scannerBinding(NOSIG("REFUSED:main.cvd:403")) } });
  assert.ok(o.requests.some((r) => r.op === "scanstatus" && r.header), "the administrator's own read, under her session");
  const ns = o.requests.find((r) => r.op === "scanstatus").answer.value.no_signatures;
  assert.equal(ns.since, "2026-10-15T03:00:00.000Z", "the plane's own date");
  const text = securityText(o);
  assert.ok(text.includes(said(ns.key, { date: date(ns.since) })), "since when");
  assert.ok(text.includes(said(ns.reason_key, { status: "403" })), "why, in words");
  assert.ok(!text.includes(said("screen.setup.security.scanner")), "not 'checked'");
  assert.ok(!o.drawn().includes("REFUSED:main.cvd"), "never the scanner's own code");
  // the date and the reason follow the answer
  const other = await returned({ env: { FILE_SCANNER: scannerBinding(NOSIG("ENOTFOUND", "2026-09-02T00:00:00Z")) } });
  const ns2 = other.requests.find((r) => r.op === "scanstatus").answer.value.no_signatures;
  const t2 = securityText(other);
  assert.ok(t2.includes(said(ns2.key, { date: date(ns2.since) })));
  assert.equal(ns2.reason_key, "file-safety.index.signatures_failed");
  assert.ok(t2.includes(said(ns2.reason_key)));
  assert.ok(!t2.includes(said("file-safety.index.signatures_refused", { status: "403" })));
  // no date known, no download yet: the answer's other keys
  const none = await returned({ env: { FILE_SCANNER: scannerBinding(NOSIG(null, null)) } });
  const ns3 = none.requests.find((r) => r.op === "scanstatus").answer.value.no_signatures;
  const t3 = securityText(none);
  assert.ok(t3.includes(said(ns3.key)) && t3.includes(said(ns3.reason_key)), "the answer's keys: " + [ns3.key, ns3.reason_key]);
  assert.ok(!t3.includes(said("screen.setup.security.scanner")));
  // control: signatures held (the answer carries no `no_signatures`)
  const held = await returned({ env: { FILE_SCANNER: scannerBinding() } });
  assert.equal(held.requests.find((r) => r.op === "scanstatus").answer.value.no_signatures, undefined);
  const th = securityText(held);
  assert.ok(th.includes(said("screen.setup.security.scanner")), "checked");
  assert.ok(!/no signatures/i.test(th));
  assert.ok(!held.drawn().includes(said("file-safety.index.no_signatures")), "none of the no-signature words");
});

test("R33 control: no scanner part draws neither the checked sentence nor a no-signature state; a read that does not answer, or a scanner that cannot be reached, draws no 'checked'", async () => {
  // no scanner bound: the part is not built in (part_scanner false), whatever the scanner would say
  const off = await returned({});
  assert.equal(off.requests.find((r) => r.op === "bootstrap").answer.value.part_scanner, false);
  const text = securityText(off);
  assert.ok(!text.includes(said("screen.setup.security.scanner")));
  assert.ok(!text.includes(said("file-safety.index.no_signatures_since", { date: date("2026-10-15") })));
  for (const fail of [{ ok: false }, "none"]) {
    const o = await returned({ env: sharedScanner() });
    const f = await open("setup", { world: o.world, as: o.as, table: { scanstatus: fail } });
    assert.ok(!securityText(f).includes(said("screen.setup.security.scanner")), JSON.stringify(fail));
    assert.deepEqual(PARTS.map((k) => stateOf(f, k)).slice(1, 2), ["optional"], "the rest of the page is as before");
  }
  // a scanner that is bound but cannot be reached: the plane answers that it is unreachable
  const down = scannerBinding({ throwOn: new Set(["version"]) });
  const lost = await returned({ env: { FILE_SCANNER: { calls: down.calls, fetch: async (input, init) => { const r = new Request(input, init); if (new URL(r.url).pathname === "/version" && new URL(r.url).hostname !== "file-scanner") throw new Error("the scanner is not reached"); return down.fetch(r); } } } });
  const st = lost.requests.find((r) => r.op === "scanstatus").answer;
  assert.ok(!securityText(lost).includes(said("screen.setup.security.scanner")), "unreachable");
  assert.ok(st);
});

/* R34: the team's time zone, as the plane holds it. The zone the step writes is read back where `jurisdictions.governingZone` reads it
   (record-core's setting `team_time_zone`, local-facts R22), never composed by the page. */
const zoneHeld = (world) => { const r = world.sql.exec("SELECT value FROM settings WHERE name='team_time_zone' ORDER BY rowid DESC LIMIT 1").toArray()[0]; return r ? JSON.parse(r.value) : null; };
const zoneMark = (o) => all(o.tree, (e) => e.attrs["data-state"] === "zonedone");
const ZONE = { "su-zone": "America/Denver", "su-zone-how": "how-typed-by-the-founder", "su-zone-src": "source-typed-by-the-founder" };

test("R34 setup carries the step screen.setup.zone with its help; its act writes the zone the plane then holds, and the step is done", async () => {
  const o = await claimed();
  has(o, "screen.setup.zone"); has(o, "screen.setup.zone.help");
  assert.ok(actOps(o.tree).includes("factconfirm"), "the step's act is drawn");
  assert.equal(zoneMark(o).length, 0, "no zone stated: the step is not done");
  assert.equal(zoneHeld(o.world), null);
  const r = await o.press("factconfirm", { values: ZONE });
  assert.equal(r.refused, false);
  assert.deepEqual(r.sent[0].body, { act: "correct", value: "America/Denver", how: ZONE["su-zone-how"], source: ZONE["su-zone-src"], path: "@team/time_zone" });
  assert.equal(zoneHeld(o.world), "America/Denver", "the setting jurisdictions.governingZone reads");
  assert.equal(zoneMark(o).length, 1, "a confirmed zone draws the step done");
  has(o, "screen.group.timezone.governs.local", { zone: said("label.timezones.America/Denver") });
});

/* S-1 (re-walk 11): the page holds each screen function as its own text, so a name the module declares at its own scope is not there.
   The step is drawn, read and acted from the served source, for a signed founder with a handle (the walker's case). */
test("R34 setup: the founder's reads, the zone step and its act, as the served page holds them (self-contained, interface-shell R21)", async () => {
  const setup = SCREENS.find((s) => s.id === "setup");
  const me = { session: true, member: "m1", handle: "rivera", rootOfTrust: true, administer: true };
  const page = served(setup);
  assert.deepEqual(Object.keys(page.reads({ me })).sort(), Object.keys(setup.reads({ me })).sort(), "every read is asked");
  assert.deepEqual(page.reads({ me }).zone, setup.reads({ me }).zone);
  const o = await claimed({ page: true });
  assert.ok(o.requests.some((r) => r.op === "factstatus"), "the zone is read");
  assert.ok(o.requests.some((r) => r.op === "recoverycodesstate"), "the founder's other reads are asked");
  has(o, "screen.setup.zone"); has(o, "screen.setup.zone.help");
  assert.equal(zoneMark(o).length, 0);
  const r = await o.press("factconfirm", { values: ZONE });
  assert.equal(r.refused, false);
  assert.equal(r.sent[0].body.path, "@team/time_zone");
  assert.equal(zoneHeld(o.world), "America/Denver");
  assert.equal(zoneMark(o).length, 1, "the confirmed zone draws the step done");
  has(o, "screen.group.timezone.governs.local", { zone: said("label.timezones.America/Denver") });
});

test("R34 control: from the served source a zone that is not one of the named seven is still drawn by its own name", async () => {
  const done = await returned({ after: ({ world, as }) => act(world, as, "factconfirm", { body: { act: "correct", value: "America/Boise", how: "how-given", source: "source-given", path: "@team/time_zone" } }) });
  const page = await open("setup", { world: done.world, as: done.as, page: true });
  assert.equal(zoneMark(page).length, 1);
  assert.ok(textOf(partOf(page, "places")).includes("Boise"));
});

test("R34 control: a zone confirmed before draws the step done and offers no act; a zone only a place gives, or none, is not done; a refusal sends nothing more", async () => {
  const done = await returned({ after: ({ world, as }) => act(world, as, "factconfirm", { body: { act: "correct", value: "America/Chicago", how: "how-given", source: "source-given", path: "@team/time_zone" } }) });
  assert.equal(zoneMark(done).length, 1);
  has(done, "screen.setup.zone");
  assert.ok(!actOps(done.tree).includes("factconfirm"), "a stated zone is changed under Settings");
  // a place gives a zone, but the team has not stated it
  const placed = await returned({ after: ({ world, as }) => act(world, as, "profilesset", { body: { profiles: [PLACE] } }) });
  assert.equal(zoneMark(placed).length, 0);
  assert.ok(actOps(placed.tree).includes("factconfirm"));
  assert.equal(zoneHeld(placed.world), null, "a place's zone is no stated team zone");
  // how it was checked is required by the owner: nothing is written, and the step stays
  const o = await claimed();
  const r = await o.press("factconfirm", { values: { ...ZONE, "su-zone-how": "" } });
  assert.equal(r.refused, true);
  assert.equal(zoneHeld(o.world), null);
  assert.equal(zoneMark(o).length, 0);
  assert.deepEqual(o.requests.filter((x) => x.op === "factconfirm").length, 1, "one request, no more");
  // a read that fails draws the step failed, never done
  for (const fail of [{ ok: false }, "none"]) {
    const f = await open("setup", { world: o.world, as: o.as, table: { factstatus: fail } });
    assert.equal(zoneMark(f).length, 0, JSON.stringify(fail));
  }
});

test("R34 the step sits in part 3, 'Where your team works', so skipping that part skips it and sends nothing", async () => {
  const o = await claimed();
  assert.ok(textOf(partOf(o, "places")).includes(said("screen.setup.zone")), "the step is drawn inside part 3");
  assert.ok(!textOf(partOf(o, "group")).includes(said("screen.setup.zone")));
  const before = o.requests.length;
  o.fields["su-skip-places"] = true;
  await o.tick(250);
  assert.equal(partOf(o, "places").attrs["data-skipped"], "true");
  assert.equal(o.requests.length, before, "skipping sends nothing");
});
