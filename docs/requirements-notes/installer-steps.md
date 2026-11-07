# installer-steps: notes for BOB

Job installer-steps, attempt 3 (7 Nov 2026), carrying over attempt 2 (5 Nov). For BOB, who merges and routes.

## Met on this branch

- **R46** (`newgroup/src/steps/bindings.mjs`, `uploads.mjs`). `placementFor({hint, jurisdiction, cf})` answers `{hint}`, `{jurisdiction}` or `{}`: a picked hint overrides `locationHintFor(cf)`, a jurisdiction carries no hint, and both chosen throw `PLACEMENT_CONFLICT`. `storeLocationBinding` answers `STORE_JURISDICTION` for `eu`, `us` or `fedramp`. `uploadInstall` takes `opts.storeJurisdiction` and refuses a hint and a jurisdiction together before it reads or writes anything. `heldPlace` restates a held `STORE_JURISDICTION`, and `planeInSync` never compares it. `JURISDICTIONS` is checked against `runtime-limits`' `STORE_JURISDICTIONS` by a parity test, with no import (R35). Tests: `newgroup/test/steps/r46-r47-placement.test.mjs`.
- **R47** (`newgroup/src/steps/probes.mjs`). `ensureBuckets(token, acct, names, {jurisdiction})` creates both buckets with Cloudflare's `cf-r2-jurisdiction` header. It refuses a jurisdiction that is not on the list before making any call, and throws `BUCKET_JURISDICTION` if Cloudflare answers that a bucket is in a different jurisdiction. A refused creation throws Cloudflare's message, so the room upload that follows never happens. `r2Endpoint(acct, j)` gives the jurisdiction's own S3 host. Same test file.

## Owed by others before the installer uses R46 and R47

- `installer` (`newgroup/src/index.mjs`, not in this job's paths) still passes only `storeLocation` from `locationHintFor(req.cf)`. To finish R46 and R47 end to end, it needs to: show the founder the hint list and the jurisdiction choice; call `placementFor`; pass `storeJurisdiction` to `uploadInstall` and `{jurisdiction}` to `ensureBuckets`; and send bucket calls on a jurisdiction copy (`deleteResources`, `countsViaApi`) with the same header. That last item belongs to a later job of this module or of `installer`.
- Two sentences are still stand-ins (`installer.fleet.why.program`). The design rows owed are `installer-steps.storage.jurisdiction` (a bucket could not be made in the chosen jurisdiction) and the `PLACEMENT_CONFLICT` refusal (a sentence for the installer page).

## Not met, and why

- **R45.** `missingScopes` already answers whatever `needed` lacks. The rest of R45 is outside these paths: leaving the two AI Gateway scopes out of `needed` (`installer`'s `CFG.SCOPES`, which has no gateway scope today, and `ready.mjs`'s `neededScopes`), the plain-words line, and the plane registering no gateway port (`ai-accounts` R44/R73 already refuses `GATEWAY_UNAVAILABLE` when no port is registered). Owner: `installer`, together with whatever composes the plane's gateway port.
- **R48.** Waits on `corpus-export` R17 and R18 (the whole-record manifest and its parts), both still marked not yet met, and on a new `modules.json` edge. Without the provider's real manifest there is nothing to test against (K4990).
- **R49.** The "What you need" list is drawn by the installer page and by civicsmith.org, not by `steps/`. Owner: `installer` and `site`, with the design's keys.
- **R26, R31.** Still parked with the assistant's remote route (K3718 (2)).
