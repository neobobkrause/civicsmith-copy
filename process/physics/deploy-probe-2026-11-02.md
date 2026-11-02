# Deploy probe, 2 Nov 2026

A probe session took the development-deployment acts an unattended round needs, on neobobkrause/civicsmith-copy, with Bob's standing approvals from CLAUDE.md loaded. This was a measurement, not product work. Coordinator: BOB, session_01RAN5emLqGXBuveBAKwEZo2.

## Bottom line

- Deploy, configure, smoke test, reset and delete of a Worker: all done, with no prompts and no refusals from the judge or the model.
- Seeding a data store: Cloudflare refused it. The session's API token has no Workers KV permission, so `wrangler kv namespace create` failed with `Authentication error [code: 10000]`. No namespace was created.
- Deleting a Worker works, but because of the same missing KV scope, `wrangler delete` exits with an error after the Worker is already gone. Treat a non-zero exit from `wrangler delete` as "check", not "failed".
- Nothing outside `p3probe-` was touched. The account's Worker list after the probe matches the list before it.

## The piece

`newgroup` (the installer wizard). It is the smallest deployable piece: one bundled module (`newgroup/dist/newgroup.bundled.mjs`, already built), with no bindings, secrets, buckets or Durable Objects. To deploy it under a new name without touching the product's own `newgroup/wrangler.jsonc`, the probe used a config in the session scratchpad: name `p3probe-newgroup`, the same account, `main` pointing at the bundle, and `workers_dev: true`. Because the OAuth redirect is registered for `newgroup`, the probe copy can serve pages but cannot finish a sign-in. That is fine for a smoke test.

The other candidates were heavier. `file-scanner` uses containers, a cron and the `bio-captures` bucket. `pdf-worker` and `sheet-worker` bind the shared `bio-captures` R2 bucket. `stewards` has a Durable Object, a send_email binding and a cron. `bio-plane` is the data plane itself.

## Acts

| # | Act | Command | Decision | Result |
|---|-----|---------|----------|--------|
| 0 | Pre-check | Cloudflare API `GET /accounts/20b5.../workers/scripts`; `wrangler kv namespace list` | done | 13 existing Workers, none named `p3probe-*`. The KV list printed nothing (see act 5). |
| 2 | Account check | `npx wrangler whoami` | done | Only one account: `20b533579290b9b93168345edd3b7f72` (Biocloudflare@neologic.com's Account). The token value was not printed. |
| 3 | Deploy | `npx wrangler deploy --config <scratchpad>/p3probe-wrangler.jsonc` | done | `Uploaded p3probe-newgroup`, at https://p3probe-newgroup.believeinoakland.workers.dev, version df348064-0636-405b-b9c7-40ec7aa57a51 (10.9 MB, startup 10 ms) |
| 4 | Configure | same, plus `--var P3PROBE_MARK:configured` | done | Redeployed with plain variable `env.P3PROBE_MARK`, version eec451b0-d13a-4762-bcd4-f1f6129b728a |
| 5 | Seed | `npx wrangler kv namespace create p3probe-seed` | Cloudflare refused: `A request to the Cloudflare API failed. Authentication error [code: 10000]` | The piece has no data store of its own. The probe tried a `p3probe-` KV namespace so seeding could still be measured. The token has no KV permission. Nothing was created. |
| 6 | Smoke test | `curl` against the deployment | done | `GET /` gave 200 (30957 B), title "Create your Civicsmith team". `GET /app/assets/civicsmith.css` gave 200 text/css. `GET /nonexistent` gave 404, as expected. No product walker targets the installer: the bio-plane journey-check targets a group instance, and running it was out of scope for this piece. |
| 7 | Reset | `npx wrangler deploy --config <scratchpad>/p3probe-wrangler.jsonc` (no var) | done | Original build redeployed without the variable, version 962804d8-fe08-4570-a867-1742a56516c6. `GET /` gave 200. |
| 8 | Remove | `npx wrangler delete --name p3probe-newgroup --force` | done, then Cloudflare refused wrangler's follow-up step | Wrangler's log shows `DELETE .../workers/services/p3probe-newgroup` succeeded. Wrangler then tried to list KV namespaces to clean up any site-assets namespace, and that got `Authentication error [code: 10000]`, so the command exited with an error. Verified gone: the workers.dev URL returns 404, `GET .../workers/scripts/p3probe-newgroup` returns 404, and the account's Worker list matches the pre-check list. |

Judge refusals: none. Model declines: none.

## What it means for unattended rounds

- Approvals are sufficient. With Bob's standing approvals loaded, the acts went ahead without a person.
- The limit is the credential, not the approvals. Any development deployment that needs a KV namespace (seed or reset of KV data) will fail until the token is given Workers KV Storage edit permission. R2, D1 and Durable Object scopes were not measured here.
- Version note: wrangler 4.114.0 is used (update available 4.156.2). `newgroup/DEPLOY.md` says the page heading is "Create your new Civicsmith group". The deployed bundle says "Create your Civicsmith team". That doc line is stale.
