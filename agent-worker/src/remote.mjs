/* F2 (coordinator ruling 5 Nov 2026, 20:18) — THE RUNNER, BOUND.
 *
 * A member's own Claude sign-in runs in that member's own `agent-runner` instance, reached through the Container
 * Durable Object namespace of `agent-runner`'s class `AgentRunner`. The configuration declares it as `RUNNER`, the
 * binding `agent-runner`'s own manifest names (`fleet-member.json` `bind`), with `script_name` `agent-runner`, which
 * each deployment's tooling names for its own environment (`p3dev`, `deploy-fleet`, the installer). `remoteOf` answers
 * that namespace when it is bound, and null otherwise; every path hands its answer to `agent-model` as the `runner` it
 * takes (`/ask`, `/run`, `/draft`, `/transcribe`) or relays to it (`/signin`). Unbound, a sign-in is refused
 * `ASSISTANT_REMOTE_NOT_READY` (`why: "absent"`) before any model call (`index.mjs`' `assistantReady`, R110), and
 * `/signin` answers `RUNNER_NOT_CONFIGURED` (R66). The cross-script `REMOTE` (`RemoteSession`) stays unbound: that class
 * answers no conversation and is deleted by agent-runner R13. */

/** A Durable Object namespace: one that names an instance and reaches it. */
const isNamespace = (ns) => !!ns && typeof ns.idFromName === "function" && typeof ns.get === "function";

/** F2 — the runner namespace when `RUNNER` is bound, else null. Never reads `REMOTE`. */
export const remoteOf = (env) => (isNamespace(env?.RUNNER) ? env.RUNNER : null);
