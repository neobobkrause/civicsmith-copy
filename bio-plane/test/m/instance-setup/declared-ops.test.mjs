/* instance-setup R101 (T51 fix round; K4168, K4202): each op this module serves that the screens send is declared in
   DECLARED_OPS beside the ops map, and the declaration is held true against the op as the door runs it (test-support R15):
   only its requires raise no refusal naming a declared field, a call without each required one is refused naming it, and a
   field outside accepts is dropped or refused naming it. The ops map is called as the door calls it, the stamps in the
   address and the fields as the body; `runtime` and `selftest` are answered at the Worker (`instanceSetupOp`). */
import test from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, instanceSetupOps, instanceSetupOp } from "../../../src/setup.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { boot, providers, stubOver, envOver, io } from "./fixture.mjs";
import { NS_RELEASE_NOTICE, releaseNoticeStatement } from "../../../src/sshsig.mjs";
import { signSshsig, signerPublicLine } from "../../../scripts/sign-sshsig.mjs";

const OPS = ["assistantreadiness", "declaredstakeset", "disclosureshown", "groupdomainset", "grouplanguagesset", "grouplogoset", "groupnameset", "infolevelset",
  "layersset", "maildomainset", "maildoorset", "mailsetup", "memberlanguageset", "officesseed", "placewanted", "profilesset", "runtime", "selftest", "updatelater", "updateskip", "updatestart"];

/* a refusal names a field by its code, where the code is the field's own refusal, or by the field as a whole word of its detail */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes = {}) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  if ((codes[field] || []).some((c) => answer.code === c || answer.reason === c)) return true;
  return new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};
/* the same answer is the same refusal or the same success: the instants and counts inside an answer are not compared */
const sameCode = (x, y) => !!x && !!y && x.ok === y.ok && (x.code ?? x.reason ?? null) === (y.code ?? y.reason ?? null) && x.status === y.status;

const world = async (env = { INSTANCE_NAME: "river-town" }) => {
  const w = await boot({ env });
  w.prov.answer = () => new Response("", { status: 404 });
  return w;
};
/* the ops map called as the door calls it: the stamps in the address, the request's fields as the body */
const route = (op, stamps, make = world) => async (fields) => {
  const w = await make();
  const url = new URL("http://x/?" + new URLSearchParams({ op, ...stamps }));
  return instanceSetupOps(w.m, url, fields)[op]();
};

/* ---- the update acts need a release ready to install: a notice signed with a throwaway release key, found by the check ---- */
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const SEED = `BIOKEY-RAW1.bio-release.${b64(new Uint8Array(32).map((_, i) => (i * 41 + 9) % 256))}`;
const KEYS = [signerPublicLine(SEED)];
const NOTICE = { version: "0.85.0", date: "2026-10-14", manifest: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", security: false,
  notes: { members: "Searching is faster.", administrators: "You decide when to update.", must_do: "" } };
const readyWorld = async () => {
  const w = await boot({ prov: providers({ admins: ["admin", "second"] }), now: () => Date.parse("2026-10-14T20:00:00Z"),
    env: { VERSION: "0.84.0", INSTANCE_NAME: "river-town" }, more: { releaseKeys: KEYS, drawMinute: () => 615 } });
  const sig = signSshsig(SEED, releaseNoticeStatement(NOTICE), NS_RELEASE_NOTICE);
  w.prov.answer = () => new Response(JSON.stringify({ ...NOTICE, sig, signer: KEYS[0] }), { status: 200 });
  assert.equal((await w.m.updateCheckTick()).updatecheck.outcome, "found");
  return w;
};

/* ---- the Worker-side ops: the door resolves the store and the class and hands them in ---- */
const LIVE = "a-live-admin-token-0123456789";
const atWorker = (op) => async (fields) => {
  const w = await world();
  const store = stubOver(w.m, { stats: async () => ({ bundles: 0 }), capturelimit: async () => ({ ceiling: 50 }) });
  const env = envOver(store, { ADMIN_TOKEN: LIVE, PROBE_TOKEN: LIVE + "p" });
  const url = new URL("http://x/api/?" + new URLSearchParams({ op, ...fields }));
  return instanceSetupOp(op, url, env, "bio", { cls: "admin", viewer: "class:admin", ...io });
};

const PNG = b64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]));
const holds = (op, call, rest = {}) => declaredOpHolds({ op, declaration: DECLARED_OPS[op], call, same: sameCode, refusedNaming: named(), ...rest });

test("R101 instance-setup declares exactly the ops the screens send that it serves, each as a frozen row of classes, mutating, weight, description and fields", () => {
  assert.deepEqual(Object.keys(DECLARED_OPS).sort(), [...OPS].sort());
  assert.ok(Object.isFrozen(DECLARED_OPS));
  for (const [op, row] of Object.entries(DECLARED_OPS)) {
    assert.ok(Array.isArray(row.classes) && typeof row.mutating === "boolean" && typeof row.weight === "string" && row.weight, op);
    assert.ok(typeof row.description === "string" && row.description, op);
    assert.ok(Array.isArray(row.fields.accepts) && Array.isArray(row.fields.requires), op);
    /* a field a call cannot do without is a field it accepts */
    for (const r of row.fields.requires) for (const f of Array.isArray(r) ? r : [r]) assert.ok(row.fields.accepts.includes(f), `${op}: ${f}`);
  }
  /* an op that writes nothing is a read and a writing act is not (op-grades R49) */
  assert.deepEqual(OPS.filter((op) => DECLARED_OPS[op].mutating === false), ["assistantreadiness", "mailsetup", "runtime", "selftest"]);
  assert.deepEqual(OPS.filter((op) => DECLARED_OPS[op].weight === "read"), ["assistantreadiness", "mailsetup", "runtime", "selftest"]);
});

test("R101 each description is read by its key, instance-setup.declared.<op>, written once with localize (K874: every new id is named)", () => {
  assert.equal(DECLARED_OPS.assistantreadiness.description, localize("instance-setup.declared.assistantreadiness", "read: whether the team's assistant is ready: a team account on, a project's only, or none; it names no member's own account"));
  assert.equal(DECLARED_OPS.declaredstakeset.description, localize("instance-setup.declared.declaredstakeset", "setting: the group's declared stake in its own words, carried beside its public identity on what it sends or publishes from then; an administrator's act, every earlier value kept; moves no bundle"));
  assert.equal(DECLARED_OPS.disclosureshown.description, localize("instance-setup.declared.disclosureshown", "personal state, keyed by member: the assistant's disclosure shown to them, with its version"));
  assert.equal(DECLARED_OPS.groupdomainset.description, localize("instance-setup.declared.groupdomainset", "the group's claimed domain — the subject is the instance's identity, not a bundle"));
  assert.equal(DECLARED_OPS.grouplanguagesset.description, localize("instance-setup.declared.grouplanguagesset", "setting: the languages the group works in; an administrator's act, a later one replacing it; moves no bundle"));
  assert.equal(DECLARED_OPS.grouplogoset.description, localize("instance-setup.declared.grouplogoset", "setting: the group's logo, PNG or JPEG, or none; an administrator's act, a later one replacing it; moves no bundle"));
  assert.equal(DECLARED_OPS.groupnameset.description, localize("instance-setup.declared.groupnameset", "the group's public display name — the subject is the instance's identity, not a bundle"));
  assert.equal(DECLARED_OPS.infolevelset.description, localize("instance-setup.declared.infolevelset", "personal state, keyed by member: how quickly explanations open, promptly or after a longer pause; nothing is hidden"));
  assert.equal(DECLARED_OPS.memberlanguageset.description, localize("instance-setup.declared.memberlanguageset", "personal state, keyed by member: the language the interface speaks to them"));
  assert.equal(DECLARED_OPS.officesseed.description, localize("instance-setup.declared.officesseed", "the instance's configuration: seeds the active profiles' offices and bodies as entities; an administrator's"));
  assert.equal(DECLARED_OPS.placewanted.description, localize("instance-setup.declared.placewanted", "the instance's configuration: the place the group wants its profile for; an administrator's"));
  assert.equal(DECLARED_OPS.profilesset.description, localize("instance-setup.declared.profilesset", "the instance's active jurisdiction profiles — the subject is the instance's configuration, not a bundle; refused PROFILES_NOT_ADMIN to a caller who is not an administrator"));
  assert.equal(DECLARED_OPS.runtime.description, localize("instance-setup.declared.runtime", "read: what the instance was measured to cost and where its limits lie (the runtime's measurements, the CPU probe's trail, the subrequest ceiling)"));
  assert.equal(DECLARED_OPS.selftest.description, localize("instance-setup.declared.selftest", "read: whether the deployment is healthy (its bindings, the store's stats and a storage round trip); it never returns a secret"));
  assert.equal(DECLARED_OPS.updatelater.description, localize("instance-setup.declared.updatelater", "release-directed: keyed by a verified release notice, reached from Settings › Updates and the administrators' queue; an administrator's choice, recorded with who and when; installs nothing (the installer installs, with Cloudflare's consent)"));
  assert.equal(DECLARED_OPS.updateskip.description, localize("instance-setup.declared.updateskip", "release-directed: keyed by a verified release notice, reached from Settings › Updates and the administrators' queue; an administrator's choice, recorded with who and when; installs nothing (the installer installs, with Cloudflare's consent)"));
  assert.equal(DECLARED_OPS.updatestart.description, localize("instance-setup.declared.updatestart", "release-directed: keyed by a verified release notice, reached from Settings › Updates and the administrators' queue; an administrator's choice, recorded with who and when; installs nothing (the installer installs, with Cloudflare's consent)"));
});

test("R101 instance-setup declares declaredstakeset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("declaredstakeset", route("declaredstakeset", { by: "admin" }), { values: { stake: "We run a food bank on this street." } });
});

test("R101 instance-setup declares disclosureshown: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("disclosureshown", route("disclosureshown", { by: "member:ada" }), { values: { member: "member:ada", version: "D311-1" } });
});

test("R101 instance-setup declares groupdomainset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("groupdomainset", route("groupdomainset", { by: "admin", origin: "https://river.example" }), { values: { domain: "river.example.org" } });
});

test("R101 instance-setup declares grouplanguagesset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("grouplanguagesset", route("grouplanguagesset", { by: "admin" }), { values: { languages: ["en", "es"] } });
});

test("R101 instance-setup declares grouplogoset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  /* the refusal for no file is LOGO_REFUSED and does not name the field: the field is mapped to it (K4210) */
  await holds("grouplogoset", route("grouplogoset", { by: "admin" }), { values: { raw: PNG, rawType: "image/png" }, refusedNaming: named({ raw: ["LOGO_REFUSED"] }) });
});

test("R101 instance-setup declares groupnameset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("groupnameset", route("groupnameset", { by: "admin" }), { values: { name: "River Town Watch" } });
});

test("R101 instance-setup declares infolevelset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("infolevelset", route("infolevelset", { by: "member:ada" }), { values: { level: "pause", asked: true } });
});

test("R101 instance-setup declares memberlanguageset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("memberlanguageset", route("memberlanguageset", { by: "member:ada" }), { values: { language: "es" } });
});

test("R101 instance-setup declares officesseed: it reads no field from the request, so a field outside accepts is dropped", async () => {
  await holds("officesseed", route("officesseed", { by: "admin" }));
});

test("R101 instance-setup declares placewanted: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("placewanted", route("placewanted", { by: "admin" }), { values: { name: "Riverton" }, refusedNaming: named({ name: ["PLACE_NAME_MALFORMED"] }) });
});

test("R101 instance-setup declares profilesset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("profilesset", route("profilesset", { by: "admin" }), { values: { profiles: [] } });
});

test("R101 instance-setup declares updatestart: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("updatestart", route("updatestart", { by: "admin" }, readyWorld), { values: { version: "0.85.0" } });
});

test("R101 instance-setup declares updatelater: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("updatelater", route("updatelater", { by: "admin" }, readyWorld), { values: { version: "0.85.0" } });
});

test("R101 instance-setup declares updateskip: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("updateskip", route("updateskip", { by: "admin" }, readyWorld), { values: { version: "0.85.0", reason: "We wait for the next one." } });
});

test("R107 instance-setup declares layersset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await holds("layersset", route("layersset", { by: "admin" }), { values: { layers: [] } });
});

test("R114 instance-setup declares maildomainset, maildoorset and mailsetup: the requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped", async () => {
  await holds("maildomainset", route("maildomainset", { by: "admin" }), { values: { domain: "mail.example.org" }, refusedNaming: named({ domain: ["MAIL_DOMAIN_MALFORMED"] }) });
  await holds("maildoorset", route("maildoorset", { by: "admin" }), { values: { on: false }, refusedNaming: named({ on: ["MAIL_SWITCH_MALFORMED"] }) });
  await holds("mailsetup", route("mailsetup", { viewer: "admin" }));
});

test("F1 instance-setup declares assistantreadiness (R115): it reads no field from the request, the viewer being the stamp, so a field outside accepts is dropped", async () => {
  await holds("assistantreadiness", route("assistantreadiness", { viewer: "member:ada" }));
});

test("R101 instance-setup declares runtime: it reads no field from the request, so a field outside accepts is dropped", async () => {
  await holds("runtime", atWorker("runtime"));
});

test("R101 instance-setup declares selftest: it reads no field from the request, so a field outside accepts is dropped", async () => {
  await holds("selftest", atWorker("selftest"));
});

test("R101 control: a declaration that names a field the op does not read, or omits one it refuses without, is caught by the same helper", async () => {
  const wrong = { ...DECLARED_OPS.groupnameset, fields: { accepts: ["name", "colour"], requires: ["name", "colour"] } };
  await assert.rejects(declaredOpHolds({ op: "groupnameset", declaration: wrong, call: route("groupnameset", { by: "admin" }), same: sameCode, refusedNaming: named(),
    values: { name: "River Town Watch", colour: "red" } }), /groupnameset.*colour/);
  const lax = { ...DECLARED_OPS.groupnameset, fields: { accepts: ["name"], requires: [] } };
  await assert.rejects(declaredOpHolds({ op: "groupnameset", declaration: lax, call: route("groupnameset", { by: "admin" }), same: sameCode, refusedNaming: named(),
    values: { name: "River Town Watch" } }), /groupnameset/);
});
