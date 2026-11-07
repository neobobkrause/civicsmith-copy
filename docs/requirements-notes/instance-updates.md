# instance-updates — requirement notes

**Status** · Notes of `instance-updates`' job, attempt 1 (7 Nov 2026). The requirements stay in `build/requirements/instance-updates.md`.

## R7, the health sender, as built

- `HEALTH_ADDRESS` is `https://ai-issuer.believeinoakland.workers.dev/ai/health`: `ai-issuer` R26's route (`POST /ai/health`, as `ai-issuer/src/index.mjs` on `job/ai-issuer` serves it) on the issuer host `ai-catalogue`'s `CATALOGUE_ADDRESS` names. The requirement notes say the address is set at START beside `CATALOGUE_ADDRESS`; this START set none, so the job derived it. BOB confirms or names another; changing it is one constant in `bio-plane/src/setup.mjs`.
- The fixed user agent is `HEALTH_SEND_USER_AGENT`, `Civicsmith-health/1`, its own, as `ai-catalogue` and the update check each have theirs.
- The consumer is `health-send`, key `healthsend`, registered in `start` beside `update-check`; its minute of the day is drawn once per store into its own table `health_send_slot` (one row, never exported, exempt from purge as the check's slot). It is due at the next occurrence of that minute after the scheduler's `now`; a day not sent stays in `ai-use` (its R33), so no run log is kept.
- Reports go oldest day first, and a run stops at the first answer that is not `2xx` (or a governor hold, or no answer). `ai-use.healthReport` answers only days after the last day sent, so marking a later day sent would pass over a refused earlier one; stopping keeps "a `500` leaves the day for the next run".
- `ai-use` is read through `deps.aiUse`, else `aiUseOf(ctx)`, only when the sender runs, never at start.

## Provider notice

- `scheduler:748` (`Scheduler.listenTo` changed): this module registers its consumers with `scheduler.register` and never calls `listenTo`, so nothing here changes. Confirmed.
