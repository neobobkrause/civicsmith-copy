/* F2 (coordinator ruling 5 Nov 2026; agent-runner R13, K5576) — NO RUNNER BINDINGS IN THE SUITES.
 *
 * This file once stood up `REMOTE`, `agent-runner`'s remote session, answering its `GET /remote/version`, and `CHECKS`.
 * The remote session is gone and this member binds no runner, so no suite of this module reads `agent-runner`'s wire.
 * `remoteBindings` stays only because `agent-drafts`' suites (its own files) spread it into an `env`: it binds nothing. */
export const remoteBindings = () => ({});
