/* ai-runs' published fixtures (fix round 10; K4990, K4993, K4995, K5044): each is made by ai-runs' real code over the real
   modules it uses (./world.mjs) when a test calls it, never stored. A user takes the refusal from here and never builds
   one by hand. Each is checked by `fixtures.test.mjs`, which calls it and compares the real answer. */
import { world, OPEN, INQ, PROJ, ORG, T0, USAGE, agentWorker } from "./world.mjs";
import { AI_RUN_MODE_WRITES } from "../../../src/ai-runs/index.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";

const STORE = { idFromName: (n) => `id:${n}` };
const must = (r, what) => {
  if (!r || (r.ok === false) || r.started === false) throw new Error(`fixture ${what} refused: ${JSON.stringify(r).slice(0, 300)}`);
  return r;
};

/** A world where ann's run `R1` in `mode` is hers (opened by her own session, carried by her held sign-in), with bob a
 *  member beside her: the shape `dispatchMemberRun` is driven in. */
async function memberRun(mode = "check") {
  const w = world({ env: { AGENT_WORKER: agentWorker(), STORE, AI_RUN_DISPATCH_WAIT_MS: "50" },
                    deployedModes: mode === "check" ? ["check"] : ["check", mode] });
  await w.group("ann", "bob", { noAccount: ["ann"] });
  await w.signin("ann");
  await w.account("bob");
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  if (mode !== "check") {
    await w.runs.open(OPEN({ run: "V" }));
    must(w.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }), "verification");
  }
  must(await w.runs.open(OPEN({ mode, principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann",
                                viewer: "member:ann" })), `open ${mode}`);
  return w;
}

/** R18: the refusals of `dispatchMemberRun` (`op=airundispatch`'s relay of it) by their code, each made by the real code
 *  that gives it: `MEMBER_RUN_MODE_NOT_ADMITTED` (a run of a mode other than check or plan, on her own sign-in) and
 *  `AI_RUN_NOT_PRINCIPAL` (another member's act on her run), ai-runs'; `ACCOUNT_MEMBER_NOT_ACTIVE` (ai-accounts' row, given
 *  by credentials' mint for a member who is not active, which the dispatch answers unchanged with `dispatched: false`)
 *  and `AI_RUN_CREDENTIAL_MALFORMED` (credentials' row for a mint naming no run). Answers the real answer. */
export async function airunDispatchRefusal(code) {
  if (code === "MEMBER_RUN_MODE_NOT_ADMITTED") {
    const w = await memberRun("investigate");
    return w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  }
  if (code === "AI_RUN_NOT_PRINCIPAL") {
    const w = await memberRun();
    return w.runs.dispatchMemberRun({ run: "R1", by: "member:bob" });
  }
  const writes = [...AI_RUN_MODE_WRITES.check];
  if (code === "ACCOUNT_MEMBER_NOT_ACTIVE") {
    const w = await memberRun();
    return w.credentials.aiRunCredentialMint({ member: "member:ghost", run: "R1", writes });
  }
  if (code === "AI_RUN_CREDENTIAL_MALFORMED") {
    const w = await memberRun();
    return w.credentials.aiRunCredentialMint({ member: "member:ann", run: "", writes });
  }
  throw new Error(`airunDispatchRefusal: no dispatch refusal ${code}`);
}

/** R52, R78, B6: the refusals of `airunopen` by their code: `AI_RUN_MODE_NOT_DEPLOYED` (a mode whose test bar is not held)
 *  and `AI_NO_ACCOUNT` (the member who started it holds no account), ai-runs'; `AI_LIMIT_REACHED` is ai-use's own answer
 *  to a use over a spent ceiling (`{whose, period, use, when}`), which the open relays. Answers the real answer. */
export async function airunOpenRefusal(code) {
  if (code === "AI_RUN_MODE_NOT_DEPLOYED") {
    const w = world({ bars: [] });
    await w.group("ann");
    w.bundle(INQ);
    return w.runs.open(OPEN({ mode: "check" }));
  }
  if (code === "AI_NO_ACCOUNT") {
    const w = world();
    await w.group("dan", { noAccount: ["dan"] });
    w.bundle(INQ);
    return w.runs.open(OPEN({ principalAi: "member:dan" }));
  }
  if (code === "AI_LIMIT_REACHED") {
    /* ai-use's own refusal (its R3), relayed by the open: ann's own account holds a limit of one call a day, spent. */
    const w = world();
    await w.group("ann");
    w.bundle(INQ);
    const use = aiUseOf(w.ctx);
    must(use.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 1, by: "ann", at: T0 }), "limit");
    must(use.countUsage({ owner: "member:ann", member: "member:ann", use: "run", mode: "check", usage: USAGE(),
                          calls: 1, at: T0, act: "R0" }), "count");
    return w.runs.open(OPEN());
  }
  throw new Error(`airunOpenRefusal: no open refusal ${code}`);
}

/** R5, R37: the refusals of the run's acts and reads for a caller who may not take them, through the ops the control
 *  plane serves: `notPrincipal` is `airunclose` by a caller who is not the run's principal (`AI_RUN_NOT_PRINCIPAL`,
 *  C-22.12, with its translation), `tickNotPrincipal` the same for `airuntick`; `unseenRead` and `unseenLog` are `airun`
 *  and `airunlog` asked by a viewer who cannot see the run (`found: false`, as for a run that is not there). */
export async function airunRefusal() {
  const w = world();
  await w.group("ann", "bob");
  w.project(PROJ, "ann");
  w.bundle(INQ);
  const ann = { principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" };
  must(await w.runs.open(OPEN({ run: "R1", ...ann })), "open on a question");
  must(await w.runs.open(OPEN({ run: "R2", contextType: "project", contextId: PROJ, ...ann })), "open in a project");
  const bob = { principal: "member:bob", actor: "member:bob", viewer: "member:bob" };
  return {
    run: "R1", hiddenRun: "R2",
    notPrincipal: await w.op("airunclose", bob, { run: "R1", bound: "completed" }),
    tickNotPrincipal: await w.op("airuntick", bob, { run: "R1" }),
    unseenRead: await w.op("airun", { run: "R2", viewer: "member:bob" }),
    unseenLog: await w.op("airunlog", { run: "R2", viewer: "member:bob" }),
    unknownRead: await w.op("airun", { run: "R404", viewer: "admin" }),
  };
}

/** R45 (C-22.18): the real `airuntick` refusal for a state over the ceiling (`AI_RUN_STATE_MAX_BYTES`, 262,144 bytes of
 *  its JSON): `AI_RUN_STATE_TOO_LARGE` with the bytes the state measures and the limit. `bytes` is the figure asked for. */
export async function tickStateTooLarge({ bytes = 262144 + 1 } = {}) {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  must(await w.runs.open(OPEN()), "open");
  const state = { s: "x".repeat(bytes - 8) };
  return { state, bytes, answer: await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, state }) };
}
