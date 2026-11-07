/* agent-worker — T41 (T41-31): a project's account (R71; D34, K2373) through R6, R10, R29, R32, R33 and R57, and the
 * standing path on a member's own sign-in (R57's N796 sentence; Bob K2425, K2472), AT THE MEMBER'S INTERFACE: the pure
 * cascade (`src/cascade.mjs`'s exports) and the default export `fetch(request, env)`, driven in this process with a
 * recording plane binding and the global `fetch` replaced by a scripted model API (agent-model's API-key path). No
 * runner is bound (F2): a sign-in's model turns are refused before any model call or plane write.
 * Nothing here reads the member's source text.
 *
 * Every arm that admits has its refusing counterpart beside it (K874): a project's account naming no project, carrying
 * its project at another level, a sign-in carrying a secret, the wrong member on a run, and, for the standing path,
 * the sign-in's `standing` use off (no grant minted, or the plane refusing the grant), so a check that admitted
 * everything, or refused everything, fails here. `test/t41.control.mjs` breaks the source and finds this suite red.
 */
import worker from "../src/index.mjs";
import { CASCADE_ORDER, LEVEL_KINDS, resolveClaudeCascade, cascadeToken } from "../src/cascade.mjs";
import { MEMBER } from "./account.mjs";
import { word } from "../../bio-plane/src/setup-words/index.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
const section = (s) => console.log(`\n--- ${s} ---`);

const SAM = "member:sam";
const PROJECT = "PRJ-41";
const AIK = "aik-" + "e".repeat(64);
const GRANT = "aig-t41-fixture-grant-never-echoed";
const PROJECT_KEY = "sk-ant-t41-project-key-fixture-never-echoed";
const MEMBER_KEY = "sk-ant-t41-member-key-fixture-never-echoed";
/* credentials R56's cascade step 1, carried in R6's wire shape (`key` named `secret`; R71). */
const PKEY = (member = MEMBER) => ({ kind: "apikey", level: "project", project: PROJECT, secret: PROJECT_KEY, member });
/* R82 (T47; K3060 D10): a sign-in carries its `secret`, the token credentials holds for that one member. */
const SIGNIN_TOKEN = "sk-ant-oat-t41-signin-fixture-never-echoed";
const PSIGNIN = (member = MEMBER) => ({ kind: "signin", level: "project", project: PROJECT, member, secret: SIGNIN_TOKEN, suggestions: false });
const MKEY = (member = MEMBER) => ({ kind: "apikey", level: "member", secret: MEMBER_KEY, member });
const SIGNIN = (member = MEMBER) => ({ kind: "signin", level: "member", member, secret: SIGNIN_TOKEN, suggestions: false });
/* R82: the credential a sign-in's conversation sends in its first frame (agent-model R16). */
const SIGNIN_CREDENTIAL = JSON.stringify({ kind: "signin", member: MEMBER, secret: SIGNIN_TOKEN });
const PACK = { id: "investigative-session", version: "pack@t41", resident: { objective: "answer from the record" },
               disclosed: { ask: { body: "closed book" }, suggestions: { body: "labelled suggestions only" } } };
const STANDING_OFF = { ok: false, reason: "STANDING_SWITCH_OFF", code: "STANDING_SWITCH_OFF", check: "C-29.26",
                       translation: "Your sign-in's standing use is off." };

/* The plane: records every call; `payer` is the member the run's record names (R10); `refuseGrant` refuses every call
   under the grant as the plane would a grant it did not mint. */
function plane(cfg = {}) {
  const calls = [];
  const ok = (result) => Response.json({ ok: true, result, tokenClass: "ai", version: "t41" });
  const S = { status: "running" };
  return { calls, binding: { async fetch(url, init) {
    const u = new URL(url);
    const op = u.searchParams.get("op");
    let body = null; try { body = init?.body ? JSON.parse(init.body) : null; } catch { body = null; }
    calls.push({ op, token: String(init?.headers?.authorization ?? "").replace(/^Bearer /, "") || null, body,
                 raw: String(url) + (init?.body ?? "") });
    if (cfg.refuseGrant) return Response.json(cfg.refuseGrant, { status: 403 });
    switch (op) {
      case "askceiling": return ok({ ok: true, reached: false });
      case "agentpack": return Response.json({ ok: true, fences: [], pack: PACK, tokenClass: "ai" });
      case "askcheck": return ok({ ok: true, answer: { ...(body?.answer || {}) }, withheld: [] });
      case "askusage": return ok({ ok: true });
      case "whoami": return ok({ tokenClass: "ai", session: false, member: null });
      case "airun": return ok({ found: true, session: { id: "RUN-41", mode: "check", status: S.status, max_passes: 1,
        principal: { plane: cfg.payer ?? MEMBER, claude: cfg.owner ?? cfg.payer ?? MEMBER, ref: cfg.payer ?? MEMBER, skill: PACK.version },
        context: { type: "inquiry", id: "INQ-1" },
        budget: [{ bound: "fetches", allowed: 9 }, { bound: "subsessions", allowed: 9 }, { bound: "wallclock", allowed: 9e5 },
                 { bound: "runtime", allowed: 900 }].map((b) => ({ ...b, consumed: 0 })) } });
      case "airunlog": return ok({ found: true, entries: [], truncated: false });
      case "airunspawn": return ok({ found: true, half: "search", payload: { run: "RUN-41", context: { type: "inquiry", id: "INQ-1" },
                                                                            mode: "check", skill: PACK.version, standard_pair: null } });
      case "basisversions": return ok({ versions: [] });
      case "airuntick": return ok(cfg.tick ? cfg.tick(body)
                                             : { ticked: true, appended: (body?.log || []).length, refused: [] });
      case "airunclose": S.status = "finished"; return ok({ terminated: true });
      default: return ok({ op, rows: [{ id: "EVT-1" }] });
    }
  } } };
}

/* The final tool's answer for each conversation, whichever path carries it. */
function answerFor(names, prompt) {
  if (names.includes("done_reading")) return ["done_reading", { question_as_read: "who held the seat in March" }];
  if (names.includes("answer"))
    return ["answer", { question_as_read: "who held the seat in March", clarifying: null, summary: "S1",
                        sentences: [{ text: "Ruth held it.", kind: "quote", support: ["EVT-1"] }], label: "machine work" }];
  if (names.includes("report")) return ["report", { state: "LOOKED_ABSENT", summary: "nothing" }];
  const judge = [...String(prompt).matchAll(/calling (judge_\w+)/g)].pop()?.[1];
  return [judge && names.includes(judge) ? judge : names.find((n) => n.startsWith("judge_")), {}];
}

/* The model API (agent-model's API-key path), recording the key each request carries. */
function model() {
  const calls = [];
  const fn = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ key: init.headers["x-api-key"], raw: init.body });
    const names = (body.tools || []).map((x) => x.name);
    const [name, input] = answerFor(names, JSON.stringify(body.messages));
    return Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: `u${calls.length}`, name, input }], usage: { input_tokens: 3, output_tokens: 2 } });
  };
  return { calls, fn };
}

async function drive(path, body, { planeCfg = {} } = {}) {
  const p = plane(planeCfg), m = model();
  const saved = globalThis.fetch;
  globalThis.fetch = m.fn;
  try {
    const res = await worker.fetch(new Request(`http://agent-worker/${path}`, { method: "POST", body: JSON.stringify(body) }),
                                   { VERSION: "t41", PLANE: p.binding });
    const text = await res.text();
    const lines = res.headers.get("content-type") === "application/x-ndjson"
      ? text.trim().split("\n").map((l) => JSON.parse(l)) : null;
    let out = null; if (!lines) try { out = JSON.parse(text); } catch { out = null; }
    return { status: res.status, text, lines, out, plane: p.calls, model: m.calls };
  } finally { globalThis.fetch = saved; }
}
const runBody = (account, extra = {}) => ({ run_id: "RUN-41", store: "scratch", credential: AIK, account, ...extra });
const stubbed = (account, extra) => runBody(account, { judgements: [], ...extra });
const askBody = (account, extra = {}) => ({ question: "Who held the seat in March?", grant: GRANT, account, ...extra });
const last = (r) => (r.lines ? r.lines[r.lines.length - 1] : null);
/* F2: a sign-in's model path is refused before any model call or plane write (a run reads only `whoami` first, R8). */
const signinRefused = (r) => [r.status, r.out?.code, r.out?.why, r.model.length, r.plane.map((c) => c.op).filter((op) => op !== "whoami")];
const SIGNIN_REFUSED = [503, "ASSISTANT_REMOTE_NOT_READY", "absent", 0, []];
const secretsIn = (r) => [PROJECT_KEY, MEMBER_KEY, SIGNIN_TOKEN].filter((s) => r.text.includes(s));

section("R32, R71 · the cascade judges a project's account at its own level, carrying its project, never a secret");
{
  t("R32, R71: the levels are a project's, the member's own and the group's, and the project level holds an API key "
    + "or a sign-in", [[...CASCADE_ORDER], [...LEVEL_KINDS.project]], [["project", "member", "group"], ["apikey", "signin"]]);
  const k = await resolveClaudeCascade(PKEY());
  t("R32, R71: a project's API key is available at the project level, for the member whose act it serves, naming its "
    + "project and no secret", [k.available, k.level, k.kind, k.member, k.project, JSON.stringify(k).includes(PROJECT_KEY)],
    [true, "project", "apikey", MEMBER, PROJECT, false]);
  const s = await resolveClaudeCascade(PSIGNIN());
  t("R32, R71: a project's sign-in is available at the project level, for its one member, naming its project",
    [s.available, s.level, s.kind, s.member, s.project], [true, "project", "signin", MEMBER, PROJECT]);
  for (const [why, acct] of [["naming no project", { ...PKEY(), project: undefined }], ["naming an empty project", { ...PKEY(), project: "" }],
                             ["naming a project that is not a string", { ...PKEY(), project: 7 }],
                             ["with an empty key", { ...PKEY(), secret: "" }],
                             ["a sign-in naming no member", { ...PSIGNIN(), member: "" }],
                             ["of a kind no level holds", { ...PKEY(), kind: "subscription" }]]) {
    const n = await resolveClaudeCascade(acct);
    t(`R32, R71 (control): a project's account ${why} is NO_ACCOUNT at the project level, carrying no project`,
      [n.available, n.reason, n.level, n.levels, "project" in n], [false, "NO_ACCOUNT", "project", [{ level: "project", state: "unset" }], false]);
  }
  const m = await resolveClaudeCascade(MKEY());
  t("R32 (control): a member's own reference names no project", [m.available, m.level, "project" in m], [true, "member", false]);
}

section("R33, R71 · the reference handed to agent-model: a project's key as a key, a project's sign-in as the member's own");
{
  t("R33, R71: a project's API key becomes {kind: apikey, key} at the project level, naming no project",
    await cascadeToken(PKEY()), { level: "project", reference: { kind: "apikey", key: PROJECT_KEY } });
  const own = { kind: "signin", member: MEMBER, secret: SIGNIN_TOKEN };
  t("R33, R71, R82: a project's sign-in becomes exactly the member's own {kind: signin, member, secret} (agent-model R16)",
    [await cascadeToken(PSIGNIN()), (await cascadeToken(PSIGNIN()))?.reference ?? null, (await cascadeToken(SIGNIN()))?.reference ?? null],
    [{ level: "project", reference: own }, own, own]);
  t("R33, R71 (control): null for a project's account naming no project, or with no key",
    [await cascadeToken({ ...PKEY(), project: "" }), await cascadeToken({ ...PKEY(), secret: "" }), await cascadeToken({ ...PSIGNIN(), member: "" }),
     await cascadeToken({ ...PSIGNIN(), secret: "" })],
    [null, null, null, null]);
}

section("R6, R29, R71 · through POST /run: a project's account is taken, named with its project, and never echoed");
{
  const k = await drive("run", stubbed(PKEY()));
  t("R6, R29, R71: a run carrying a project's API key for its starter's act drives, claude_account naming the project",
    [k.status, k.out?.claude_account, secretsIn(k)],
    [200, { available: true, kind: "apikey", level: "project", member: MEMBER, project: PROJECT }, []]);
  const s = await drive("run", stubbed(PSIGNIN()));
  t("R6, R29, R71: a run carrying a project's sign-in drives, named as a sign-in at the project level",
    [s.status, s.out?.claude_account], [200, { available: true, kind: "signin", level: "project", member: MEMBER, project: PROJECT }]);
  const own = await drive("run", stubbed(MKEY()));
  t("R29 (control): a member's own account's claude_account names no project",
    [own.status, own.out?.claude_account], [200, { available: true, kind: "apikey", level: "member", member: MEMBER }]);
  const cases = [
    ["a project's account naming no project", { ...PKEY(), project: undefined }, 400, "BAD_ACCOUNT"],
    ["a project's account naming an empty project", { ...PKEY(), project: "" }, 400, "BAD_ACCOUNT"],
    ["a project's account whose project is not a string", { ...PKEY(), project: ["PRJ-41"] }, 400, "BAD_ACCOUNT"],
    ["a project's account naming a project of over 200 characters", { ...PKEY(), project: "P".repeat(201) }, 400, "BAD_ACCOUNT"],
    ["a member's own account carrying a project", { ...MKEY(), project: PROJECT }, 400, "BAD_ACCOUNT"],
    ["the team's API key carrying a project", { kind: "apikey", level: "group", secret: MEMBER_KEY, member: MEMBER, project: PROJECT }, 400, "BAD_ACCOUNT"],
    ["a project's sign-in carrying no secret (R82, T47)", { ...PSIGNIN(), secret: undefined }, 409, "SIGNIN_NOT_HELD"],
    ["a project's sign-in carrying an empty secret (R82, T47)", { ...PSIGNIN(), secret: "" }, 409, "SIGNIN_NOT_HELD"],
    ["a project's sign-in with suggestions not a boolean (T46)", { ...PSIGNIN(), suggestions: "on" }, 400, "BAD_ACCOUNT"],
    ["a project's sign-in naming no member", { ...PSIGNIN(), member: "" }, 400, "BAD_ACCOUNT"],
    ["a project's account of a retired kind", { ...PKEY(), kind: "subscription" }, 400, "BAD_ACCOUNT"],
    ["a project's account with an empty key", { ...PKEY(), secret: "" }, 409, "NO_ACCOUNT"],
  ];
  for (const [why, account, status, code] of cases) {
    const r = await drive("run", stubbed(account));
    t(`R6, R71 (control): ${why}: ${status} ${code}, no plane call, no secret echoed`,
      [r.status, r.out?.code, r.plane.length, secretsIn(r)], [status, code, 0, []]);
  }
}

section("R10, R57, R71 · a run is continued only under the account serving the member whose act started it, at the project level too");
{
  const wrong = await drive("run", stubbed(PKEY(MEMBER)), { planeCfg: { payer: SAM } });
  t("R10, R57, R71: a project's key serving Ruth's act, on Sam's run, is REFUSED by name before any step, naming both "
    + "members and no secret",
    [wrong.status, wrong.out?.code, wrong.out?.recorded, wrong.out?.supplied, wrong.plane.map((c) => c.op), secretsIn(wrong)],
    [409, "RUN_NAMES_A_DIFFERENT_PAYER", SAM, MEMBER, ["whoami", "airun"], []]);
  const wrongSi = await drive("run", stubbed(PSIGNIN(MEMBER)), { planeCfg: { payer: SAM } });
  t("R10, R57, R71: a project's sign-in of Ruth's, on Sam's run, is REFUSED the same way",
    [wrongSi.status, wrongSi.out?.code, wrongSi.out?.recorded, wrongSi.out?.supplied], [409, "RUN_NAMES_A_DIFFERENT_PAYER", SAM, MEMBER]);
  const right = await drive("run", stubbed(PKEY(SAM)), { planeCfg: { payer: SAM } });
  t("R10, R57, R71 (control): the project's key serving Sam's own act on Sam's run drives, still Sam's act",
    [right.status, right.out?.claude_account?.member, right.out?.claude_account?.level], [200, SAM, "project"]);
}

section("R10, R57 (ai-runs R52, K2489) · the run's member is principal.ref; principal.claude names who pays and is never compared");
{
  const GROUP = (member = MEMBER) => ({ kind: "apikey", level: "group", secret: MEMBER_KEY, member });
  const pk = await drive("run", stubbed(PKEY()), { planeCfg: { owner: `project:${PROJECT}` } });
  t("R10, R57, R71: a run the project's key pays (principal.claude project:<id>, principal.ref Ruth) drives on that key "
    + "serving Ruth's act", [pk.status, pk.out?.claude_account?.level, pk.out?.claude_account?.member], [200, "project", MEMBER]);
  const ps = await drive("run", stubbed(PSIGNIN()), { planeCfg: { owner: `project:${PROJECT}` } });
  t("R10, R57, R71: a run the project's sign-in pays drives on it, Ruth's own", [ps.status, ps.out?.claude_account?.kind], [200, "signin"]);
  const g = await drive("run", stubbed(GROUP()), { planeCfg: { owner: "group" } });
  t("R10, R57: a run the group's key pays (principal.claude group) drives on that key serving Ruth's act",
    [g.status, g.out?.claude_account?.level, g.out?.claude_account?.member], [200, "group", MEMBER]);
  const gSam = await drive("run", stubbed(GROUP(MEMBER)), { planeCfg: { owner: "group", payer: SAM } });
  t("R10, R57 (control): the group's key serving Ruth's act on a group-paid run of Sam's is refused, recorded naming "
    + "principal.ref, never the owner who pays",
    [gSam.status, gSam.out?.code, gSam.out?.recorded, gSam.out?.supplied], [409, "RUN_NAMES_A_DIFFERENT_PAYER", SAM, MEMBER]);
  const pSam = await drive("run", stubbed(PKEY(MEMBER)), { planeCfg: { owner: `project:${PROJECT}`, payer: SAM } });
  t("R10, R57, R71 (control): the project's key serving Ruth's act on a project-paid run of Sam's is refused the same way",
    [pSam.status, pSam.out?.code, pSam.out?.recorded], [409, "RUN_NAMES_A_DIFFERENT_PAYER", SAM]);
}

section("R26 (ai-runs R72, agent-model R13) · a tick's usage carries agent-model's figures as it answers them, the estimate included");
{
  const usageOf = (r) => r.plane.filter((c) => c.op === "airuntick").flatMap((c) => c.body?.usage || []);
  const k = await drive("run", runBody(PKEY()));
  const ku = usageOf(k);
  t("R26: on a project's key every usage entry carries estimated_cost_usd, a number, beside the five figures",
    [ku.length > 0, ku.every((e) => typeof e.usage?.estimated_cost_usd === "number")], [true, true]);
}

section("R26 (T41 B6) · a tick the plane answers `found: false` (no such run) appended nothing: refused, never `logged`");
{
  /* The plane's own answer for a run it does not hold (ai-runs: `{run, found: false, note}`, no `ok: false`): the REC-100
     fixture's run was never opened (AI_RUN_MODE_NOT_DEPLOYED) and every tick answered so, yet `logged` read 1. */
  const NO_RUN = { run: "RUN-41", found: false, note: word("ai-runs.note.run_either_existed") };
  const look = { judgements: [{ targets: [], level: "document", observed: "LOOKED_INDETERMINATE" }] };
  const sent = (r) => r.plane.filter((c) => c.op === "airuntick").reduce((n, c) => n + (c.body?.log || []).length, 0);
  const tickRefusals = (o) => (o?.refusals || []).filter((x) => x.at === "airuntick" && x.plane?.result?.found === false);
  const gone = await drive("run", runBody(MKEY(), look), { planeCfg: { tick: () => NO_RUN } });
  const go = last(gone) ?? gone.out;
  t("R26: every tick answered `found: false` counts nothing in `logged`, and each is in `refusals` in the plane's words",
    [sent(gone) > 0, go?.logged, tickRefusals(go).length > 0,
     tickRefusals(go).every((x) => x.plane.result.note === NO_RUN.note)], [true, 0, true, true]);
  const held = await drive("run", runBody(MKEY(), look));
  const ho = last(held) ?? held.out;
  t("R26 (control): the same run on a plane that holds it counts each entry it appended, and names no such refusal",
    [sent(held) > 0, ho?.logged, tickRefusals(ho).length], [true, sent(held), 0]);
}

section("R71, R57, F2 · model turns on a project's account: its key to the Messages API; a sign-in is refused, no runner being bound");
{
  const k = await drive("run", runBody(PKEY()));
  t("R71, R57: a run's turns on a project's key go to the Messages API under that key only",
    [k.status, k.out?.judgement_source, k.model.length > 0, [...new Set(k.model.map((c) => c.key))], secretsIn(k)],
    [200, "model", true, [PROJECT_KEY], []]);
  t("F2: a run's turns on a project's sign-in are refused ASSISTANT_REMOTE_NOT_READY (absent), no model call, no plane write",
    signinRefused(await drive("run", runBody(PSIGNIN()))), SIGNIN_REFUSED);
  t("R57, F2: an ask on a project's sign-in passes its account checks and is refused the same way, before any model call or plane call",
    signinRefused(await drive("ask", askBody(PSIGNIN()))), SIGNIN_REFUSED);
}

section("R57 (N796, K2425, K2472) · a standing question's AI half: on its author's own reference; on a sign-in, refused (F2)");
{
  const ref = await drive("ask", askBody(MKEY()));
  t("R57: the author's own reference serves the AI half, every plane call carrying the standing grant and nothing else",
    [ref.status, last(ref)?.event, [...new Set(ref.plane.map((c) => c.token))]], [200, "answer", [GRANT]]);
  t("R57, F2: the author's own sign-in is taken as an account (never BAD_ACCOUNT for being one), then refused ASSISTANT_REMOTE_NOT_READY (absent), no model call and no plane call",
    signinRefused(await drive("ask", askBody(SIGNIN()))), SIGNIN_REFUSED);
  /* Off: credentials R32 refuses the grant STANDING_SWITCH_OFF and answers R19 holds the AI half back; no grant exists. */
  const offNone = await drive("ask", askBody(MKEY(), { grant: undefined }));
  t("R57 (control): the standing use off, no grant was minted: refused NO_GRANT, with no plane call and no model call",
    [offNone.status, offNone.out?.code, offNone.plane.length, offNone.model.length], [401, "NO_GRANT", 0, 0]);
  const offRefused = await drive("ask", askBody(MKEY()), { planeCfg: { refuseGrant: STANDING_OFF } });
  t("R57 (control): the standing use off, a grant the plane refuses STANDING_SWITCH_OFF: the plane's refusal relayed "
    + "unchanged, no turn taken",
    [offRefused.status, offRefused.out?.code, offRefused.out?.plane?.code, offRefused.model.length],
    [403, "PLANE_REFUSED", "STANDING_SWITCH_OFF", 0]);
  const runOn = await drive("run", stubbed(SIGNIN()));
  t("R57: a standing run whose record names its author is taken on the author's own sign-in (the stubbed path, no turn)",
    [runOn.status, runOn.out?.claude_account], [200, { available: true, kind: "signin", level: "member", member: MEMBER }]);
  const runOther = await drive("run", stubbed(SIGNIN(SAM)));
  t("R57 (control): another member's sign-in on that run is refused by name, no turn taken",
    [runOther.status, runOther.out?.code, runOther.model.length], [409, "RUN_NAMES_A_DIFFERENT_PAYER", 0]);
}

console.log(`\nt41: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
