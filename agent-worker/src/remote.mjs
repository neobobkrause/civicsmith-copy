/* F2 (coordinator ruling 5 Nov 2026; agent-runner R13, K5576; K5457) — NO REMOTE SESSION.
 *
 * `agent-runner`'s `RemoteSession` class, which this member once bound cross-script as `REMOTE`, is deleted in the same
 * change that removes the binding, so this member binds no runner of any kind: neither `REMOTE` nor the container's
 * `RUNNER` (R109). `remoteOf` stays only because the draft paths (`agent-drafts`' files) hand its answer to
 * `agent-model` as the `runner` it takes: it answers null whatever the environment holds, so no path reaches a runner.
 * A member's own sign-in is refused before any model call (`index.mjs`' `assistantReady`, R110), and `/signin` answers
 * `RUNNER_NOT_CONFIGURED` (R66) until the adapter's connect flow replaces the relay (R66 as T53 amends it). */

/** F2, R109 — no runner is bound: null for every environment, `env.REMOTE` and `env.RUNNER` unread. */
export const remoteOf = () => null;
