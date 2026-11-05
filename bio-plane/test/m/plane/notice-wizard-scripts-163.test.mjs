/* Provider notice wizard-scripts:163 (PR 163: the carried screen registry and library read ai-accounts' retired door ops
   as their T53 ops, or as no act; no requirement text changed). The plane's own code reads nothing of wizard-scripts (its
   composition is store-assembly's); what reaches a member through this module is the gated hook's `affordances` answer,
   whose screens and offered scripts the assembled store draws from wizard-scripts. Confirmed with no code change: through
   the plane's gated hook over a real assembled store, each screen answered carries every act the registry gives it for that id
   (the module's `SCREEN_REGISTRY`, read, never listed here, K3268), and every act a screen or an offered script's step
   names is one op-declarations specs or an installer route, so no retired op reaches a member through the plane. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";   /* answers `cloudflare:workers` */
import { gatedOp } from "../../../src/plane/door.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { INSTALLER_ROUTES } from "../../../src/wizard-scripts/data.mjs";

test("notice wizard-scripts:163 (R6): the screens and scripts the plane's gated `affordances` answers are wizard-scripts' registry and library as PR 163 carries them: each screen holding the registry's acts, every act named a specced op or an installer route", async () => {
  const x = await store();
  const stub = { fetch: async (r) => x.s.fetch(r instanceof Request ? r : new Request(String(r))) };
  const env = { ...x.env, STORE: { idFromName: (n) => n, get: () => stub }, CAPTURES: { get: async () => null } };
  const url = new URL("http://x/api/?op=affordances");
  const res = await gatedOp({ req: new Request(url), url, env, op: "affordances", cls: "member", viaSession: true,
    sessMember: "member:ann", sessViewer: "member:ann", sessIdentity: "member:ann", sessRights: [], sessCaps: ["contribute"],
    aiCred: null, storeName: "bio", stub });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body).slice(0, 400));
  const { screens, wizard_scripts: scripts } = body.result;
  assert.ok(screens.length > 0 && scripts.length > 0);
  const registry = Object.fromEntries(SCREEN_REGISTRY.map((s) => [s.id, s.acts]));
  /* the store may add acts of its own to a screen (it does: not this module's to pin); the registry's are all there */
  for (const s of screens) assert.deepEqual((registry[s.id] ?? []).filter((a) => !s.acts.includes(a)), [], s.id);
  const specced = (op) => Object.hasOwn(OPS, op) || INSTALLER_ROUTES.includes(op);
  const unspecced = [...screens.flatMap((s) => s.acts.map((a) => `${s.id}: ${a}`).filter((_, i) => !specced(s.acts[i]))),
    ...scripts.flatMap((w) => w.steps.filter((t) => t.act != null && !specced(t.act)).map((t) => `${w.id}: ${t.act}`))];
  assert.deepEqual(unspecced, []);
});
