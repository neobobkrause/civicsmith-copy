/* Provider notice ai-runs:96 (PR 96; ai-runs R9 as T53 restates it): a run names its paying principal `principalAi`; an open
 * that sends the old `principalClaude` is refused AI_RUN_CAPABILITY_UNAVAILABLE. The dock (R13, R6's K3003 clause) and the
 * question's "Ask the assistant to look" (R41, R45) send `principalAi` `member:<whoami.member>`. The body each page sends is
 * opened by ai-runs' real `open` in ai-runs' own test world (its world.mjs, real code), with that world's plane principal. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok } from "../interface-shell/harness.mjs";
import { keepAwayState } from "../ai-accounts/fixtures.mjs";
import { world, OPEN, INQ } from "../ai-runs/world.mjs";
import { open, plane, button, inquiryMd, P, Q } from "./fixtures.mjs";

/* ai-accounts' real keep-away answer, off, where the dock reads `aikeepawaystate` */
const { off: OFF } = await keepAwayState({ reason: "court order" });
const FRAME = { assistantstate: ok({ on: true }), aikeepawaystate: ok(OFF), aipathready: ok({ state: "ready" }),
  aiusage: ok({ ok: true }), agentpack: ok({ ok: true, pack: { version: "civicsmith@3+ab12cd" } }),
  airuns: (r) => ok({ ok: true, context: { type: r.query.contextType, id: r.query.contextId }, runs: [], count: 0 }),
  airunopen: (r) => ok({ run: r.body.run, started: true, status: "running", ticks: 1 }),
  airundispatch: (r) => ok({ run: r.body.run, found: true, dispatched: true, status: "running" }),
  airun: (r) => ok({ found: true, session: { id: r.query.run, status: "running", ticks: 1 } }), airunlog: (r) => ok({ run: r.query.run, found: true, entries: [] }) };

/** the principal fields of a page's `airunopen` body, opened by ai-runs' real code for member `mai` (an account of her own) */
async function openedByAiRuns(body) {
  assert.ok(!("principalClaude" in body) && !("principalClaudeRef" in body), "no argument of the old names");
  const w = world();
  await w.group("mai");
  w.bundle(INQ);
  const { principalAi: _, ...base } = OPEN({ principalPlane: "member:mai", actor: "member:mai", viewer: "member:mai" });
  const principals = Object.fromEntries(Object.entries(body).filter(([k]) => /^principal/.test(k)));
  return w.runs.open({ ...base, ...principals });
}

test("notice ai-runs:96: the dock's airunopen names principalAi, and ai-runs opens it", async () => {
  const p = await open("/app/question/" + Q, { boot: { plane: { ...plane(), ...FRAME } } });
  await p.click(p.root().querySelector('.cs-mast [data-shell="dock"]'));
  await p.settle();
  await p.click(button(p, "airunopen", p.root().querySelector(".cs-dock")));
  await p.settle();
  const body = p.byOp("airunopen")[0].body;
  assert.equal(body.principalAi, "member:mai");
  const answer = await openedByAiRuns(body);
  assert.notEqual(answer.code, "AI_RUN_CAPABILITY_UNAVAILABLE", JSON.stringify(answer).slice(0, 300));
  assert.equal(answer.started, true, JSON.stringify(answer).slice(0, 300));
});

test("notice ai-runs:96: the question's Ask the assistant to look names principalAi, and ai-runs opens it", async () => {
  /* R41 state c: a new question citing nothing offers "Ask the assistant to look" */
  const empty = { [Q]: { "bundle.md": inquiryMd(P, [], { legs: [] }) } };
  const p = await open("/app/question/" + Q, { boot: { plane: { ...plane({ images: empty }), ...FRAME } } });
  const ask = p.root().querySelector('#cs-main button[data-act="airunopen"]');
  assert.ok(ask, "the question offers the ask");
  await p.click(ask);
  await p.settle();
  const body = p.byOp("airunopen")[0].body;
  assert.equal(body.principalAi, "member:mai");
  const answer = await openedByAiRuns(body);
  assert.notEqual(answer.code, "AI_RUN_CAPABILITY_UNAVAILABLE", JSON.stringify(answer).slice(0, 300));
  /* control: the old name is refused by ai-runs, as PR 96 states */
  const w = world();
  await w.group("mai");
  w.bundle(INQ);
  const { principalAi: _, ...base } = OPEN({ principalPlane: "member:mai", actor: "member:mai", viewer: "member:mai" });
  assert.equal((await w.runs.open({ ...base, principalClaude: "member:mai" })).code, "AI_RUN_CAPABILITY_UNAVAILABLE");
});
