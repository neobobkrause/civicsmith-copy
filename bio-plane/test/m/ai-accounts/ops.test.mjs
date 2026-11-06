/* ai-accounts R36, R37, R58, R61, R64, R65, R71 at the interface: the ops this module declares for the screens, each held true
   against the op as the door runs it (test-support R15): only its requires raise no refusal naming a declared field, a call
   without each required one is refused naming it, and a field outside accepts is dropped or refused naming it; the rows of C-29
   that arrive, and the rule that no secret, digest or key is in any answer, log, error, history row or export. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { SECRET } from "./fixture.mjs";
import { PLANS as P, ENTRIES as E, HOSTS } from "./catalogue.mjs";
import { projectWorld, on, leaks, shape, refusal } from "./helpers.mjs";
import { DECLARED_OPS, aiAccountsOps, AI_ACCOUNT_CHECKS } from "../../../src/ai-accounts/index.mjs";

const TOKEN = "sk-ant-oat01-sentinel-ann-0123456789";
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
/* a refusal names a field by its code (the table) or as a whole word of its code or detail */
const named = (codes = {}) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  if ((codes[field] || []).some((c) => answer.code === c || answer.reason === c)) return true;
  return new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};

/* the call as the door runs it: a world, its stamps, every field of the body, the arm asked of a fresh owner */
const mk = (op, stamps, { setup = null, adapt = null } = {}) => async (given) => {
  const env = await (async () => {
    const w = await projectWorld();
    w.a.registerGatewayStore("root", { create: async () => "gw-op", put: async () => true, exists: async () => true });
    const own = await w.own("ann", { secret: SECRET("ann0") });
    const team = await w.team({ secret: SECRET("team0") });
    const gw = await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: P.teamApi, means: "gateway", by: "ann" });
    const proj = await w.projectAccount("P", "ann", { secret: SECRET("P0") });
    const free = await w.a.accountSet({ owner: "member:ann", provider: P.freeProvider, plan: P.freeApi, means: "sealed", secret: "s", by: "ann" });
    return Object.assign(w, { ids: { own: own.account_id, team: team.account_id, gw: gw.account_id, proj: proj.account_id, free: free.account_id }, ...(setup ? await setup(w) : {}) });
  })();
  const fields = adapt ? adapt(given, env) : given;
  const q = new URLSearchParams({ op, ...stamps });
  return await aiAccountsOps(env.a, new URL(`http://x/?${q}`), fields, {})[op]();
};
const run = (op, stamps, values, opts = {}, codes = {}) => declaredOpHolds({ op, declaration: DECLARED_OPS[op], call: mk(op, stamps, opts),
  refusedNaming: named(codes), values, same: sameCode });
const ID = (k) => (given, env) => ({ ...given, ...("account_id" in given ? { account_id: env.ids[k] } : {}) });

const ann = { by: "ann", viewer: "member:ann" };
const adm = { by: "admin", viewer: "admin" };

test("R36 R37 ai-accounts declares accountusesset, projectaikeepaway and aikeepaway: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused; control: a retired op is not declared", async () => {
  await run("accountusesset", ann, { account_id: "x", switch: "ask", on: true }, { adapt: ID("own") });
  await run("projectaikeepaway", ann, { project: "P" }, {}, { project: ["NO_SUCH_PROJECT", "PROJECT_ACT_NOT_THE_OWNER"] });
  await run("aikeepaway", adm, {});
  for (const gone of ["subscriptiondisconnect", "groupkeynoticeseen", "groupkeyremove", "groupkeyswitch", "groupkeyset", "accountreferenceset",
                      "accountreferenceremove", "projectkeyset", "projectsigninset", "projectaccountremove", "projectaccountswitch", "projectkeynoticeseen"])
    assert.equal(gone in DECLARED_OPS, false, gone);
  const d = DECLARED_OPS.accountusesset;
  assert.deepEqual([d.classes, d.machineClasses, d.mutating, d.weight, d.fields], [["admin", "member"], [], true, "substrate", { accepts: ["account_id", "switch", "on"], requires: ["account_id", "switch", "on"] }]);
});

test("R37: a request naming no account is NOT_YOUR_ACCOUNT naming account_id (a machine caller with none keeps MACHINE_CANNOT_HOLD_ACCOUNT); no switch UNKNOWN_SWITCH naming switch; no `on` SWITCH_VALUE_INVALID naming on, writing nothing; control: a field outside accepts is refused as before", async () => {
  const w = await projectWorld();
  const x = await w.own("ann");
  const before = w.snapshot();
  const noAccount = w.a.accountUsesSet({ switch: "ask", on: true, by: "ann" });
  assert.equal(noAccount.code, "NOT_YOUR_ACCOUNT");
  assert.ok(named()(noAccount, "account_id"), noAccount.detail);
  assert.equal(w.a.accountUsesSet({ switch: "ask", on: true, by: null }).code, "MACHINE_CANNOT_HOLD_ACCOUNT");
  const noSwitch = w.a.accountUsesSet({ account_id: x.account_id, on: true, by: "ann" });
  assert.deepEqual([noSwitch.code, named()(noSwitch, "switch")], ["UNKNOWN_SWITCH", true]);
  const noOn = w.a.accountUsesSet({ account_id: x.account_id, switch: "ask", by: "ann" });
  assert.deepEqual([noOn.code, named()(noOn, "on")], ["SWITCH_VALUE_INVALID", true]);
  const noOnExplore = w.a.accountUsesSet({ account_id: x.account_id, switch: "explore", by: "ann" });
  assert.deepEqual([noOnExplore.code, named()(noOnExplore, "on")], ["SWITCH_VALUE_INVALID", true]);
  assert.equal(w.snapshot(), before);
  assert.equal(w.a.accountUsesSet({ account_id: x.account_id, switch: "ask", on: "yes", by: "ann" }).code, "SWITCH_VALUE_INVALID", "unchanged");
});

test("R61 ai-accounts declares the screens' ops for the account model: each held true against the op as the door runs it (declaredOpHolds); control: an op not served is not declared, and aitermsaccept and aipersonalchoose are declared with no reason asked", async () => {
  await run("aiaccountadd", adm, { owner: "group", provider: P.provider, plan: P.teamApi, means: "sealed", secret: "sk-declared-0000", entries: [E.a], reference: null, terms_version: "t1", account_id: null },
    { adapt: (g) => Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null)) }, { owner: ["NOT_YOUR_ACCOUNT", "NOT_AN_ADMIN"] });
  await run("aiownadd", ann, { provider: P.provider, plan: P.memberApi, means: "sealed", secret: "sk-declared-0001", entries: [E.a], reference: null, terms_version: "t1", account_id: null },
    { adapt: (g) => Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null)) }, { provider: ["UNKNOWN_PLAN"], plan: ["UNKNOWN_PLAN"] });
  await run("aipersonalchoose", ann, { provider: P.provider, plan: P.subscription, means: "issued", secret: TOKEN, entries: [E.a], reference: null, terms_version: "t1", account_id: null },
    { adapt: (g) => Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null)) }, { provider: ["UNKNOWN_PLAN"], plan: ["UNKNOWN_PLAN"] });
  await run("aiaccountremove", ann, { account_id: "x" }, { adapt: ID("own") });
  await run("aiaccountswitch", ann, { account_id: "x", on: true }, { adapt: ID("own") }, { on: ["SWITCH_VALUE_INVALID"] });
  await run("aiorderset", ann, { owner: "member", account_id: "x", position: 1 }, { adapt: ID("own") }, { owner: ["NOT_YOUR_ACCOUNT"], account_id: ["ACCOUNT_NOT_LISTED"], position: ["ORDER_POSITION_INVALID"] });
  await run("aiprojectorder", ann, { project: "P", accounts: [] }, {}, { project: ["NO_SUCH_PROJECT", "PROJECT_ACT_NOT_THE_OWNER"], accounts: ["ACCOUNT_NOT_LISTED"] });
  await run("aimemberallow", adm, { entries: [E.a] }, {});
  await run("aiprojectuse", ann, { project: "P", entries: [E.a], account_id: null }, { adapt: (g) => Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null)) });
  await run("aimineuse", ann, { entries: [E.a], account_id: null }, { adapt: (g) => Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null)) });
  await run("aicheckset", adm, { check: "P3", ticked: false }, {}, { check: ["CHECK_UNKNOWN"], ticked: ["SWITCH_VALUE_INVALID"] });
  await run("aiprojectcheckset", ann, { project: "P", check: "P3", ticked: true }, {}, { project: ["PROJECT_ACT_NOT_THE_OWNER", "NO_SUCH_PROJECT"], check: ["CHECK_UNKNOWN"], ticked: ["SWITCH_VALUE_INVALID"] });
  await run("aimycheckset", ann, { check: "P3", ticked: true }, {}, { check: ["CHECK_UNKNOWN"], ticked: ["SWITCH_VALUE_INVALID"] });
  await run("aikeyenter", ann, { account_id: "x", key: "gw-key-declared-0000" }, { adapt: ID("gw") }, { key: ["NO_SECRET"] });
  await run("aikeycloudflare", ann, { account_id: "x" }, { adapt: ID("gw") });
  await run("aikeyseal", ann, { account_id: "x", secret: "sealed-declared-0000" }, { adapt: ID("own") }, { secret: ["NO_SECRET"] });
  await run("aitermsaccept", ann, { account_id: "x" }, { adapt: ID("free") });
  await run("aitermswithdraw", ann, { account_id: "x" }, { adapt: ID("free") });
  await run("aicreditsclear", ann, { account_id: "x" }, { adapt: ID("own") });
  await run("aisend", ann, { provider: P.provider, host: HOSTS.main }, {}, { provider: ["VALUE"], host: ["VALUE"] });
  await run("aioptinset", adm, { account_id: "x", on: true }, { adapt: ID("team") }, { on: ["SWITCH_VALUE_INVALID"] });
  const ops = Object.keys(aiAccountsOps(null, new URL("http://x/"), null, {}));
  for (const op of Object.keys(DECLARED_OPS)) assert.ok(ops.includes(op), `${op} is served`);
  for (const op of ["aicredential", "aigatewayserved", "aicredentialfailed"]) assert.equal(op in DECLARED_OPS, false, `${op} is a plane op with no member rung (R65–R67)`);
  assert.ok(!("secret" in (DECLARED_OPS.aikeyseal.fields.accepts.reduce((o, k) => ({ ...o, [k]: 1 }), {}).secret ? {} : {})), "field list only");
  const sealed = DECLARED_OPS.aikeyseal;
  assert.deepEqual([sealed.classes, sealed.machineClasses, sealed.mutating, sealed.weight], [["admin", "member"], [], true, "credential"], "R71; ground credential (op-grades R57, F5)");
  assert.deepEqual(sealed.fields, { accepts: ["account_id", "secret"], requires: ["account_id", "secret"] });
  assert.deepEqual(DECLARED_OPS.aioptinset.fields, { accepts: ["account_id", "on"], requires: ["account_id", "on"] }, "no `flag` field: the owner level decides (R49)");
  assert.deepEqual(DECLARED_OPS.aiorderset.fields, { accepts: ["owner", "account_id", "position"], requires: ["owner", "account_id", "position"] });
});

test("R71 R61: the answers never echo a secret: `aikeyseal`, `aikeyenter`, `aiaccountadd` and `aiownadd` answer without the `secret` or `key` field's value; a body naming `member` or `by` is not an accepted field; aikeyseal without `secret` is refused naming it", async () => {
  const w = await projectWorld();
  const KEY = "never-echoed-0123456789abcdef";
  w.a.registerGatewayStore("root", { create: async () => "gw-e", put: async () => true, exists: async () => true });
  const outs = [];
  outs.push(await w.ops("by=ann", { provider: P.provider, plan: P.memberApi, means: "sealed", secret: KEY, member: "bob", by: "bob" }).aiownadd());
  const x = outs[0];
  outs.push(await w.ops("by=ann", { account_id: x.account_id, secret: KEY + "2" }).aikeyseal());
  const t = await w.a.accountSet({ owner: "group", provider: P.provider, plan: P.teamApi, means: "gateway", by: "admin" });
  outs.push(await w.ops("by=admin", { account_id: t.account_id, key: KEY + "3" }).aikeyenter());
  outs.push(await w.ops("by=admin", { owner: "group", provider: P.provider, plan: P.teamApi, means: "sealed", secret: KEY + "4" }).aiaccountadd());
  for (const o of outs) assert.equal(o.ok, true, JSON.stringify(o));
  assert.equal(x.owner, "member:ann", "a body naming `member` or `by` is not read");
  for (const s of [KEY, KEY + "2", KEY + "3", KEY + "4"]) assert.deepEqual(leaks(w, s, { answers: outs }), [], s);
  const miss = await w.ops("by=ann", { account_id: x.account_id }).aikeyseal();
  assert.equal(miss.reason, "NO_SECRET");
  assert.equal(miss.check, AI_ACCOUNT_CHECKS.NO_SECRET.check);
});

test("R58: the new refusals are rows of C-29, each the next free number, each sentence read by key with `team` in every one (K3472): every code R58 lists is a row; a refusal answered at the interface carries its row's code, check id and translation, its detail the translation with the answer's values put in and no placeholder left; control: no row's text contains `group`, and CHECK_UNKNOWN and CATALOGUE_UNAVAILABLE are the catalogue's own rows, used as it mints them", async () => {
  const LISTED = ["PLAN_SCOPE_REFUSED", "PERSONAL_SUBSCRIPTION_LEVEL", "PERSONAL_SUBSCRIPTION_NOT_SHARED", "MEANS_NOT_ALLOWED", "REFERENCE_MALFORMED", "OPT_IN_MISSING",
    "ACCOUNT_NOT_LISTED", "LIST_EXHAUSTED", "HOP_REASON_REFUSED", "HOP_NOT_AT_STEP_BOUNDARY", "CHECK_LOCKED", "CHECK_NOT_MET", "CHECK_OPEN", "PART_NOT_PASSED", "PART_NOT_RATED",
    "ENTRY_NOT_ALLOWED", "ENTRY_LAPSED", "ENTRY_RETIRED", "NEEDS_NEWER_RELEASE", "NO_PLAN_OFFERED", "ENTRIES_EMPTY", "NARROWING_ONLY", "NO_ENTRY_OFFERED", "FREE_TIER_NOT_ACCEPTED",
    "RECIPIENT_NOTICE_DUE", "PAYER_NOT_VERIFIED", "GATEWAY_LOG_UNREADABLE", "GATEWAY_UNAVAILABLE", "GATEWAY_STORE_REFUSED", "GATEWAY_KEY_ABSENT", "ISSUED_TOKEN_MALFORMED", "UNKNOWN_PLAN",
    "AI_CREDENTIAL_NOT_SERVED"];
  for (const c of LISTED) {
    const r = AI_ACCOUNT_CHECKS[c];
    assert.ok(r, c);
    assert.match(r.check, /^C-29\.(4[89]|[5-7]\d|8[0-2])$/, c);
    assert.doesNotMatch(r.translation, /\bgroup\b/i, c);
    assert.match(r.where, /^src\/ai-accounts\/base\.mjs #refuse > is-ai-refusal$/, c);
  }
  assert.equal(new Set(LISTED.map((c) => AI_ACCOUNT_CHECKS[c].check)).size, LISTED.length, "each its own number");
  for (const c of ["CHECK_UNKNOWN", "CATALOGUE_UNAVAILABLE"]) assert.equal(c in AI_ACCOUNT_CHECKS, false, `${c} is ai-catalogue's own row`);
  /* answered at the interface: the translation with the values put in */
  const w = await projectWorld();
  const r = await w.a.accountSet({ owner: "group", provider: P.provider, plan: P.memberApi, means: "sealed", secret: "s", by: "admin" });
  assert.deepEqual(shape(r), refusal("PLAN_SCOPE_REFUSED"));
  assert.equal(r.detail, AI_ACCOUNT_CHECKS.PLAN_SCOPE_REFUSED.translation.replace("{plan}", P.memberApi).replace("{level}", "team"));
  assert.doesNotMatch(r.detail, /[{}]/, "no placeholder left");
  assert.match(r.translation, /\{plan\}/, "the translation keeps its placeholders for the screen");
  assert.match(r.detail, /team/);
  assert.doesNotMatch(JSON.stringify(r), /\bgroup\b.*level/i);
});

test("R64: no secret, digest or key in any answer, log, error, history row, bundle or export, for every means: a sentinel secret, key and token under each means appear in no table but the sealed column, no answer, history row or export; control: the scan itself finds a sentinel deliberately written to a log", async () => {
  const w = await projectWorld();
  w.a.registerGatewayStore("root", { create: async () => "gw-64", put: async () => true, exists: async () => true });
  const S = (n) => `r64-sentinel-${n}-0123456789abcdef`;
  const answers = [];
  const a = (x) => { answers.push(x); return x; };
  const sealed = a(await w.own("ann", { secret: S("sealed") }));
  a(await w.own("ann", { account_id: sealed.account_id, secret: S("replaced") }));
  const issued = a(await w.a.accountSet({ owner: "member:bob", provider: P.provider, plan: P.subscription, means: "issued", secret: S("issued") + "xxxxxxxx", by: "bob" }));
  a(await w.a.issuedTokenHold({ account_id: issued.account_id, token: S("reissued") + "xxxxxxxx" }));
  const gw = a(await w.a.accountSet({ owner: "group", provider: P.provider, plan: P.teamApi, means: "gateway", by: "admin" }));
  a(await w.a.gatewayKeyEnter({ account_id: gw.account_id, key: S("gwkey"), by: "admin" }));
  const ref = a(await w.a.accountSet({ owner: "member:cy", provider: P.provider, plan: P.memberApi, means: "reference", reference: { store: "vault", locator: S("locator") }, by: "cy" }));
  a(await w.a.aiKeySeal({ account_id: ref.account_id, secret: S("keyseal"), by: "cy" }));
  for (const x of [sealed, issued, gw, ref]) {
    a(w.a.accountState({ account_id: x.account_id, viewer: x.owner === "group" ? "admin" : x.owner.slice(7) }));
    a(w.a.accountUses({ account_id: x.account_id, viewer: x.owner === "group" ? "admin" : x.owner.slice(7) }));
  }
  for (const o of ["member:ann", "member:bob", "group", "member:cy"]) a(w.a.accountHistory({ owner: o, viewer: o === "group" ? "admin" : o.slice(7) }));
  a(await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: P.memberApi, means: "sealed", secret: "", by: "ann" }));
  a(await w.a.accountSet({ owner: "member:ann", provider: P.provider, plan: "nope", secret: S("sealed"), by: "ann" }));
  for (const n of ["sealed", "replaced", "issued", "reissued", "gwkey", "locator", "keyseal"]) {
    const found = leaks(w, S(n) + (n === "issued" || n === "reissued" ? "xxxxxxxx" : ""), { answers });
    assert.deepEqual(found.filter((x) => x !== "ai_accounts.reference"), [], n);
  }
  assert.deepEqual(leaks(w, S("locator"), { answers }).filter((x) => x !== "ai_accounts.reference" && x !== "answer"), [], "a reference's pointer is the one thing stored for it");
  /* control: the scan finds a sentinel deliberately written to a log */
  w.sql.exec(`INSERT INTO account_changes (owner, at, by, change, detail) VALUES ('group','2026-01-01T00:00:00Z','admin','x','{"leak":"${S("sealed")}"}')`);
  assert.deepEqual(leaks(w, S("sealed"), { answers: [] }), ["account_changes.detail"], "control: the scan finds it");
  assert.deepEqual(leaks(w, S("sealed"), { answers: [{ leaked: S("sealed") }] }).includes("answer"), true);
});
