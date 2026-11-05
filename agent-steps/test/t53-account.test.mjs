/* agent-steps R2 (T53; AIR25, BR18) — the payer check compares the member, and an account never changes silently. The
 * run's `session.segments` are ai-runs' own (R19, R91, R92), produced by its real code on its test world when the test
 * runs: a dispatch, then either a `limit` hop onto the member's next account or nothing. They are laid over this suite's
 * fake plane's run (`world.mjs`), and the segment is driven through `driveHarness`. */
import "../../bio-plane/test/sandbox.mjs";
import { world as runsWorld, OPEN, PROJ, T0, ENTRIES, agentWorker } from "../../bio-plane/test/m/ai-runs/world.mjs";
import { driveHarness } from "../src/index.mjs";
import { HOST } from "./shell.mjs";
import { ACCOUNT } from "./account.mjs";
import { world, CHECK, AIK, PACK_VERSION } from "./world.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};

const ANN = { principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" };
const TICK = { caller: "member:ann", viewer: "member:ann", actor: "member:ann" };

/** ai-runs' own record of ann's run R1: dispatched on her first account, then (`hop`) stopped on `limit` and hopped onto
 *  her second. Answers the session's `segments` as ann reads them, and her two account ids. */
async function recorded({ hop }) {
  const w = runsWorld({ env: { AGENT_WORKER: agentWorker({ status: 202, body: { accepted: true, run_id: "R1" } }),
                               STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", "bob", { noAccount: ["ann"] });
  for (let i = 0; i < 2; i++) await w.account("ann", "apikey", `secret-${i}-of-ann-0123456789`, { entries: [ENTRIES.a] });
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.project(PROJ, "ann");
  const o = await w.runs.open(OPEN({ contextType: "project", contextId: PROJ, at: T0, ...ANN }));
  if (o.started !== true) throw new Error(`ai-runs did not open R1: ${JSON.stringify(o).slice(0, 300)}`);
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 });
  if (d.dispatched !== true) throw new Error(`ai-runs did not dispatch R1: ${JSON.stringify(d).slice(0, 300)}`);
  if (hop) {
    const h = await w.runs.tickAndContinue({ run: "R1", ...TICK, at: "2026-07-01T00:01:00Z",
      segment_end: { by: "ai", done: false, refusals: [], ai_stop: { reason: "limit", class: "rate_limit" } } });
    if (h.segment_end?.stop?.decision !== "hopped") throw new Error(`ai-runs did not hop: ${JSON.stringify(h.segment_end).slice(0, 300)}`);
  }
  const s = (await w.runs.read({ run: "R1", viewer: "member:ann" })).session;
  return { segments: s.segments, accounts: w.accountsOf("member:ann") };
}

async function drive(segments, account, principal = null) {
  const w = world({ session: { segments, ...(principal ? { principal } : {}) } });
  const out = await driveHarness(HOST, { PLANE: { fetch: w.fetch } },
    { runId: "RUN-W", store: "scratch", credential: AIK, account, judgements: CHECK(), maxSteps: 400 });
  const body = out.refusal ? await out.refusal.json() : null;
  return { status: out.refusal ? out.refusal.status : 200, body, ops: w.rec.calls.map((c) => c.op), out };
}

console.log("\n--- R2 (T53) · a recorded hop continues on the new owner's account for the same member ---");
{
  const { segments, accounts: [a1, a2] } = await recorded({ hop: true });
  t("R2 (fixture): ai-runs recorded two segments, the second begun by a limit hop from a1 to a2",
    segments.map((s) => [s.account_id === a1 ? "a1" : s.account_id === a2 ? "a2" : "?", s.hop_in?.reason ?? null]), [["a1", null], ["a2", "limit"]]);
  const hopped = await drive(segments, { ...ACCOUNT, account_id: a2 });
  t("R2: the segment on the hop's account proceeds for the same member", [hopped.status, hopped.out.ended?.by ?? null], [200, "the table"]);
}

console.log("\n--- R2 (T53) · with no hop row, ACCOUNT_CHANGE_UNRECORDED, before any step ---");
{
  const { segments, accounts: [a1, a2] } = await recorded({ hop: false });
  t("R2 (fixture): ai-runs recorded one segment, on a1, with no hop", segments.map((s) => [s.account_id === a1, s.hop_in]), [[true, null]]);
  const moved = await drive(segments, { ...ACCOUNT, account_id: a2 });
  t("R2: an account other than the last segment's, with no hop recorded, is 409 ACCOUNT_CHANGE_UNRECORDED naming both ids",
    [moved.status, moved.body?.code, moved.body?.recorded === a1, moved.body?.supplied === a2], [409, "ACCOUNT_CHANGE_UNRECORDED", true, true]);
  t("R2: before any step: only the run was read", moved.ops, ["airun"]);
  t("R2: no secret is in the refusal", JSON.stringify(moved.body).includes(ACCOUNT.secret), false);
  const same = await drive(segments, { ...ACCOUNT, account_id: a1 });
  t("R2 (control): the last segment's own account proceeds", same.status, 200);
}

console.log("\n--- R2 (control) · another member is RUN_NAMES_A_DIFFERENT_PAYER ---");
{
  const { segments, accounts: [, a2] } = await recorded({ hop: true });
  const other = await drive(segments, { ...ACCOUNT, account_id: a2 },
    { plane: "member:ruth", claude: "member:ruth", ref: "member:somebody-else", skill: PACK_VERSION });
  t("R2 (control): a hop's account still serves only the run's member: another member is 409 RUN_NAMES_A_DIFFERENT_PAYER",
    [other.status, other.body?.code, other.ops], [409, "RUN_NAMES_A_DIFFERENT_PAYER", ["airun"]]);
}

console.log(`\nt53 account: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
