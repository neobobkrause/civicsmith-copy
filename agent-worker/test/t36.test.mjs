/* agent-worker — T36's requirements (T36-24; N695, K2126): the pack read apart, from `op=agentpack`, never from
 * `op=affordances`, by a run (R48), an ask and a draft (R59), and the op declarations that say so (R37), AT THE
 * MEMBER'S INTERFACE: its default export `fetch(request, env)`, driven in this process by `test/inprocess.mjs` with a
 * recording `PLANE` binding and the global `fetch` answered as the model API answers. Every request that reached the
 * binding is captured, so "never `op=affordances`" is counted, not read off the source.
 *
 * Why it matters at the release (K2126): once control-plane drops `pack` and `fences` from `op=affordances` (T36-37),
 * a member that still read them there would refuse every segment and every ask. The drives below include a plane from
 * before that change, whose `affordances` still carries a pack, so a member that fell back to it would be seen. */
import worker from "../src/index.mjs";
import { PLANE_OPS, ASK_PLANE_OPS, ASK_OPS } from "../src/ops.mjs";
import { driveOne, driveMember, AIK, GRANT, CLAUDE_TOKEN, PACK_VERSION } from "./inprocess.mjs";
import { MEMBER } from "./account.mjs";
import { machineWork, MACHINE_WORK } from "./label.mjs";
import { PLANE_OPS_PINNED } from "./owners.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
const section = (s) => console.log(`\n--- ${s} ---`);

const ACCOUNT = { kind: "apikey", level: "member", secret: CLAUDE_TOKEN, member: MEMBER };
const ON = { ...ACCOUNT, suggestions: true };
/* The draft's pack carries the writing-help layer its draft is instructed by (skills R36); same version as the run's. */
const DRAFT_PACK = { id: "investigative-session", edition: "inprocess", version: PACK_VERSION,
  resident: { objective: { text: "find what the record holds" }, disclosable: [] },
  disclosed: { writing_help: { load_when: "a draft", sourcing: "authored", body: "the member's own words" } } };

const runBody = { run_id: "run-t36", store: "scratch", credential: AIK, account: ACCOUNT };
const askBody = { question: "who held the seat in March?", grant: GRANT, account: ACCOUNT };
const draftBody = { task: { op: "writinghelp", act: "noteadd", field: "text" }, told: "I saw the crossing guard leave.",
                    account: ON, grant: GRANT };

const ops = (rec) => rec.planeCalls.map((c) => c.op);
const count = (rec, op) => ops(rec).filter((o) => o === op).length;
const packCalls = (rec) => rec.planeCalls.filter((c) => c.op === "agentpack");
const last = (rec) => rec.answers[rec.answers.length - 1];
const lastEvent = (rec) => { const lines = last(rec).text.trim().split("\n"); try { return JSON.parse(lines[lines.length - 1]); } catch { return null; } };

const run = await driveOne({ mode: "check" }, "run", runBody);
const ask = await driveOne({ mode: "check", ask: true }, "ask", askBody);
const draft = await driveOne({ mode: "check", ask: true, pack: DRAFT_PACK }, "draft", draftBody);
const CASES = [["a run", run, AIK], ["an ask", ask, GRANT], ["a draft with a grant", draft, GRANT]];

section("R48 · a run, an ask and a draft read the pack from op=agentpack once, under their credential, and op=affordances never");
{
  t("R48: the three drives answered: the run 200 with model turns, the ask's last event an answer, the draft 200",
    [last(run).status, last(run).out?.judgement_source, lastEvent(ask)?.event, last(draft).status, last(draft).out?.ok],
    [200, "model", "answer", 200, true]);
  for (const [what, rec, cred] of CASES) {
    t(`R48: ${what}: op=agentpack was asked exactly once, and op=affordances never`,
      [count(rec, "agentpack"), count(rec, "affordances")], [1, 0]);
    t(`R48: ${what}: the pack read carried its credential in the Authorization header and nowhere in the address (R60)`,
      [packCalls(rec).map((c) => c.token), packCalls(rec).filter((c) => c.url.includes(cred) || "token" in c.query).length],
      [[cred], 0]);
  }
}

section("R48 · no pack on op=agentpack: a run refused 409 naming pack_absent, an ask and a draft 502 PACK_UNDETERMINED, no model call");
{
  const noRun = await driveOne({ mode: "check", noPack: true }, "run", runBody);
  t("R48: a run with pack: null and pack_absent -> 409 SKILL_VERSION_MISMATCH, the version UNDETERMINED, pack_absent named, no turn",
    [last(noRun).status, last(noRun).out?.code, last(noRun).out?.recorded, last(noRun).out?.rendered,
     last(noRun).out?.rendered_basis, last(noRun).out?.pack_absent, noRun.globalFetches.length],
    [409, "SKILL_VERSION_MISMATCH", PACK_VERSION, null, "UNDETERMINED", "renderPack: no fences published", 0]);
  const noAsk = await driveOne({ mode: "check", ask: true, noPack: true }, "ask", askBody);
  t("R48: an ask with no pack -> 502 PACK_UNDETERMINED, no model call",
    [last(noAsk).status, last(noAsk).out?.code, noAsk.globalFetches.length], [502, "PACK_UNDETERMINED", 0]);
  const noDraft = await driveOne({ mode: "check", ask: true, noPack: true }, "draft", draftBody);
  t("R48: a draft with a grant and no pack -> 502 PACK_UNDETERMINED, no model call",
    [last(noDraft).status, last(noDraft).out?.code, noDraft.globalFetches.length], [502, "PACK_UNDETERMINED", 0]);
  t("R48: none of the three asked op=affordances",
    [noRun, noAsk, noDraft].map((r) => count(r, "affordances")), [0, 0, 0]);
}

section("R48 · a plane from before T36-37, whose op=affordances still carries a pack, is never read for it");
{
  const old = { mode: "check", ask: true, noPack: true, affordancesPack: true, pack: DRAFT_PACK };
  const oldRun = await driveOne({ ...old }, "run", runBody);
  const oldAsk = await driveOne({ ...old }, "ask", askBody);
  const oldDraft = await driveOne({ ...old }, "draft", draftBody);
  t("R48: with the pack only on op=affordances, a run, an ask and a draft each refuse as having no pack, and none falls back",
    [[last(oldRun).status, last(oldRun).out?.code], [last(oldAsk).status, last(oldAsk).out?.code],
     [last(oldDraft).status, last(oldDraft).out?.code], [oldRun, oldAsk, oldDraft].map((r) => count(r, "affordances")),
     [oldRun, oldAsk, oldDraft].map((r) => r.globalFetches.length)],
    [[409, "SKILL_VERSION_MISMATCH"], [502, "PACK_UNDETERMINED"], [502, "PACK_UNDETERMINED"], [0, 0, 0], [0, 0, 0]]);
}

section("R37 · PLANE_OPS is exactly R37's list, agentpack among the reads, and no call of this member reads op=affordances");
{
  t("R37, R78: PLANE_OPS' reads and writes are exactly R37's (with R53's plan-mode ops and R78's re-examination reads), agentpack read and affordances absent",
    [Object.keys(PLANE_OPS).filter((o) => !PLANE_OPS[o].mutating).sort(), Object.keys(PLANE_OPS).filter((o) => PLANE_OPS[o].mutating).sort()],
    PLANE_OPS_PINNED);  /* N1073: read from the owners (owners.mjs) */
  t("R37: an ask's own calls name agentpack for its pack and not affordances, and neither is in ASK_OPS",
    [Object.keys(ASK_PLANE_OPS).sort(), ["agentpack", "affordances"].filter((o) => ASK_OPS.includes(o))],
    [["agentpack", "askceiling", "askcheck", "askusage"], []]);
  const { drives } = await driveMember();
  const every = [...Object.values(drives), run, ask, draft];
  t("R37: across a supplied run, a model run, a plan run, the refusals, an ask and a draft, no request named op=affordances",
    [every.reduce((n, r) => n + r.planeCalls.length, 0) > 50, every.flatMap((r) => ops(r)).filter((o) => o === "affordances")],
    [true, []]);
  t("R37: every op a run reached is in PLANE_OPS", [run, drives.model, drives.supplied, drives.plan]
    .flatMap((r) => ops(r)).filter((o) => !(o in PLANE_OPS)), []);
}

section("R59 · a draft with a grant reads the pack by op=agentpack under it; without one it uses the pack the door sent");
{
  t("R59: with a grant, the pack and the read went to the plane under the grant: agentpack, then search",
    [ops(draft), [...new Set(draft.planeCalls.map((c) => c.token))]], [["agentpack", "search"], [GRANT]]);
  t("R59, F4: …and its draft was made, labelled machine work {kind: machine, ai}", [last(draft).out?.draft, machineWork(last(draft).out?.label)],
    [{ text: "a labelled draft" }, MACHINE_WORK]);
  const { grant: _g, ...noGrant } = draftBody;
  const bare = await driveOne({ mode: "check", ask: true }, "draft", { ...noGrant, account: ACCOUNT, pack: DRAFT_PACK });
  t("R59: without a grant no plane call is made at all: the pack is the one the door sent beside the draft",
    [last(bare).status, last(bare).out?.ok, bare.planeCalls.length], [200, true, 0]);
  const refusedPack = await (async () => {
    const binding = { fetch: async (url) => (new URL(url).searchParams.get("op") === "agentpack"
      ? Response.json({ ok: false, reason: "GRANT_EXPIRED", check: "C-29.30" }, { status: 403 })
      : Response.json({ ok: false }, { status: 400 })) };
    const res = await worker.fetch(new Request("http://agent-worker/draft", { method: "POST", body: JSON.stringify(draftBody) }),
      { PLANE: binding });
    return { status: res.status, out: await res.json() };
  })();
  t("R59: a refused op=agentpack under the grant -> 403 PLANE_REFUSED at agentpack, the plane's body unchanged",
    [refusedPack.status, refusedPack.out.code, refusedPack.out.at, refusedPack.out.plane?.reason], [403, "PLANE_REFUSED", "agentpack", "GRANT_EXPIRED"]);
}

console.log(`\nt36: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
