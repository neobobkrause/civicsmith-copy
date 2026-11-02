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

## Second pass: R2, Durable Objects, containers, token scopes

BOB asked for this pass after the first record, under the same hard limits. `wrangler whoami` again showed only account `20b533579290b9b93168345edd3b7f72`. The pre-check listed five R2 buckets (bio-captures, bio-captures-plat-s1, bio-published, bio-published-plat-s1, bio-walks), none named `p3probe-*`.

### Bottom line

- R2: all done. Created the bucket, deployed an ocr-worker copy bound to it, seeded an object, read it back through both the API and the worker, then deleted the object, the worker and the bucket. No refusal touched R2.
- Durable Objects: all done. Deployed a trimmed stewards copy, made a request that went through its Durable Object, and deleted the copy. Wrangler removed the Durable Object namespace along with the script.
- Containers: the read-only list was allowed, and it showed the account's three container applications. No container was deployed.
- Judge refusals: none. Model declines: none. Every refusal came from Cloudflare, and every one was the same: `Authentication error [code: 10000]` on Workers KV. On every `wrangler delete` it hits after the delete has already succeeded, so the command exits with an error even though the act worked.

### Acts

| # | Act | Command | Decision | Result |
|---|-----|---------|----------|--------|
| R1 | Create bucket | `wrangler r2 bucket create p3probe-r2` | done | Created. |
| R2 | Deploy bound worker | `wrangler deploy --config ocr-worker/p3probe-wrangler.jsonc` (name `p3probe-ocr`, `CAPTURES` bound to `p3probe-r2`, same bundle, wasm and model) | done | Version 35376526-4843-4891-9631-9fc18122990a. `GET /version` returned 200 with `engine_loaded: true`. |
| R3 | Seed | `wrangler r2 object put p3probe-r2/scratch/captures/<sha> --remote` | done | One 24-byte text object. |
| R4 | Read back via API | `wrangler r2 object get ... --pipe --remote` | done | The seed text came back as written. |
| R5 | Read back via worker | `POST /transcribe {capture_sha, store:"scratch", pages:[1]}` | done | Seeded key: 200 `PAGE_NOT_RENDERABLE` / `NOT_A_PDF` ("the bytes do not carry a %PDF- header"), so the worker found and read the object. Absent key: 404 `NOT_FOUND`. |
| R6 | Delete object | `wrangler r2 object delete ... --remote` | done | `Delete complete.` |
| R7 | Delete worker | `wrangler delete --name p3probe-ocr --force` | done, then Cloudflare refused wrangler's KV cleanup: `Authentication error [code: 10000]` on `/storage/kv/namespaces` | Script API returns 404, URL returns 404. |
| R8 | Delete bucket | `wrangler r2 bucket delete p3probe-r2` | done | `Deleted bucket p3probe-r2`. The bucket list matches the pre-check. |
| D1 | Deploy DO worker | `wrangler deploy --config stewards/p3probe-wrangler.jsonc` (name `p3probe-do`; `STORE` Durable Object with its v1 sqlite migration; no `send_email`, no cron). To open the service: placeholder address `p3probe@example.invalid`, a steward-key hash of random bytes nobody holds, and a `SOURCE_KEY` generated for the probe and never printed, all passed as plain `--var` values. | done | Version 5a1cdba7-de2f-4e9d-996e-d2964404fa59. |
| D2 | Touch the DO | `GET /withdrawals` with `accept: application/json` | done | 200 `[]`. The route calls the store's `register` op through the Durable Object stub, and a store failure would have thrown. `GET /` and `GET /steward` also returned 200. |
| D3 | Delete | `wrangler delete --config ... --force` | done, then the same KV cleanup refusal (code 10000) | Script API returns 404. The Durable Object namespace list no longer has a `p3probe-do` entry. The workers.dev URL still served 200 just after the delete, then 404 within a minute (edge lag). |
| C1 | Containers, read only | `wrangler containers list` | done | Listed file-scanner-safeviewrenderer (ready), file-scanner-filescanner (active, 2 live), and agent-runner-agentrunner (ready). No deploy was attempted. |

The probe config files were written into `ocr-worker/` and `stewards/` so their relative imports resolved. They were never staged, and both were removed afterwards. The working tree is clean.

### Token scopes

Cloudflare's refusals do not name the missing permission. Code 10000 is a generic authentication error. Wrangler's own hints name only user-level read scopes it wanted for display: `User->Memberships->Read` and `User->User Details->Read`. Both are warnings, not failures. To fill the gap, I sent read-only GETs to each product's list endpoint:

| Area | Evidence | Status |
|------|----------|--------|
| Workers Scripts edit | deploy and delete, both passes | held |
| Workers R2 Storage edit | bucket create and delete, object put, get and delete | held |
| Durable Objects (via Workers Scripts) | migration applied on deploy, namespace removed on delete | held |
| Workers subdomain read | `GET /workers/subdomain` returned 200 | held |
| Containers read | `wrangler containers list`, and `GET /containers/applications` returned 200 | held (edit not measured) |
| Queues read | `GET /queues` returned 200 | held (not used by the product) |
| Email Routing addresses read | `GET /email/routing/addresses` returned 200 | held (send_email deploy not measured) |
| Workers KV Storage | `GET /storage/kv/namespaces` returned 401, code 10000 | missing |
| D1 | `GET /d1/database` returned 401, code 10000 | missing (not used by the product) |
| Account API Tokens / token introspection | `GET /accounts/<id>/tokens/verify` returned code 1000 "Invalid API Token". `GET /user/tokens/verify` returned active, so this is a user token, not an account token. | n/a |

Browser rendering was not measured: its endpoints are POST-only, and a GET returned 404, which says nothing about scope. Service bindings need no scope beyond Workers Scripts.

What the developer's steps must ask for, from what this pass measured: Workers Scripts Edit, Workers R2 Storage Edit, and Containers Edit (read is confirmed; deploying file-scanner or agent-runner needs edit, not measured). Add Workers KV Storage Read, so that `wrangler delete` exits cleanly, even though the product uses no KV. Optionally add User Memberships Read and User Details Read to quiet wrangler's warnings. Browser Rendering and Email Sending still need their own measurement before they go on the list.

## Third pass: containers, browser rendering, send_email

BOB asked for this pass under the same hard limits. A new probe session, started from the tranche, with Bob's standing approvals loaded. Wrangler 4.156.2 this time (fetched by `npx`). `npx wrangler whoami` showed only account `20b533579290b9b93168345edd3b7f72`. Pre-check: the same 13 Workers as before, none named `p3probe-*`; three container applications (agent-runner-agentrunner, file-scanner-filescanner, file-scanner-safeviewrenderer).

### Bottom line

- Containers: all done. A trimmed reader-container copy deployed as `p3probe-container`, its container started on the first request and answered, and the worker and its container application were removed. No image was built: Docker's client is installed here but no daemon runs, and none was needed, because the product's container configs name an image already published to Docker Hub by digest (and the product's rule K1898 says images are never built in a session). Wrangler pulled the image by reference on Cloudflare's side.
- Containers need one extra removal step. `wrangler delete` removes the script and its Durable Object namespace but leaves the container application behind. `wrangler containers delete <application id>` removes it.
- Browser rendering: done. With `@cloudflare/puppeteer` 1.4.0 a minimal worker loaded https://example.com and returned its title. With 1.0.4, `puppeteer.launch` hung until the request was cut off. The binding itself answered at once (`puppeteer.limits`), so the hang was the library version, not a permission.
- send_email: the deploy was allowed with the binding restricted to `p3probe@example.invalid`. Nothing was sent; the worker had no route and its code never calls `send`.
- Judge refusals: none. Model declines: none. The only refusal was Cloudflare's, the same as before: every `wrangler delete` exits with `Authentication error [code: 10000]` on `/storage/kv/namespaces` after the delete has already succeeded.

### Acts

| # | Act | Command | Decision | Result |
|---|-----|---------|----------|--------|
| T0 | Account check | `npx wrangler whoami` | done | One account, `20b533579290b9b93168345edd3b7f72`. |
| T1 | Pre-check | `GET .../workers/scripts`; `GET .../containers/applications` | done | 13 Workers, 3 container applications, none `p3probe-*`. |
| T2 | Image build | `docker info` | not attempted | Docker client 29.9.2 present; daemon absent (`dial unix /var/run/docker.sock: connect: no such file or directory`). Not needed: the config names `docker.io/civicsmith/reader-container@sha256:c1422b26...`, which Cloudflare pulls itself. Remote build of a Dockerfile was not tried (K1898). |
| C2 | Deploy container worker | `wrangler deploy --config <scratchpad>/container/wrangler.jsonc` (name `p3probe-container`; the committed reader-container bundle; `ReaderContainer` class, its sqlite migration, the published image by digest, `standard-1`, `max_instances: 1`; `workers_dev: true`; no secrets) | done | Version 6b45fa96-8eb8-4ff2-a70f-cb44dcf935ba. Created container application `p3probe-container-readercontainer` (a0388950-b0ad-4af5-aabf-6b34d8ddbd89) and Durable Object namespace 3a9da76fe49e4f8bbc695ba9167b1b8a. |
| C3 | Start the container | `curl .../version` | done | 200 after 22.4 s (cold start), `{"ok":true,"tools":{"libreoffice":"LibreOffice 7.4.7.2 ...","imagemagick":"6.9.11-60 ...","exiftool":"12.57","sevenzip":"7-Zip 26.02 ..."}}`. |
| C4 | Delete worker | `wrangler delete --config ... --force` | done, then the KV cleanup refusal (code 10000) | Script API 404. The container application was still listed. |
| C5 | Delete container application | `wrangler containers delete a0388950-b0ad-4af5-aabf-6b34d8ddbd89` | done | `Your container has been deleted`. Application list matches the pre-check. URL returns 404. |
| B1 | Deploy browser worker | `wrangler deploy --config <scratchpad>/browser/wrangler.jsonc` (name `p3probe-browser`, `browser: {binding: BROWSER}`, `@cloudflare/puppeteer` 1.0.4) | done | Version 4d20e06a-aebd-4d82-b309-e9797375c50b. Wrangler names the binding "Browser Run". |
| B2 | Load the page | `curl /` | done, request failed | `curl: (56) Failure when receiving data from the peer` after 46 s. A retry timed out at 80 s with no bytes. `wrangler tail` could not hold its connection through the proxy. The proxy reported no relay failures. |
| B3 | Diagnose | redeploy with a time budget per step and a `/limits` route (version 28816fe0-bc2b-4283-a16f-a25db006b78e) | done | `/limits` 200 in 1.2 s: 0 active sessions, 200 max concurrent, 10 acquisitions allowed. `/` 500: `timeout: launch after 20000 ms`. |
| B4 | Upgrade library | `npm install @cloudflare/puppeteer@1.4.0`, redeploy (version d10fb735-818f-427c-97f3-c28bef277ed9) | done | |
| B5 | Load the page | `curl /` | done | 200 in 2.1 s, `{"ok":true,"title":"Example Domain","steps":["launched","page","goto"]}`. |
| B6 | Delete | `wrangler delete --config ... --force` | done, then the KV cleanup refusal (code 10000) | Script API 404, URL 404. |
| E1 | Deploy email worker | `wrangler deploy --config <scratchpad>/email/wrangler.jsonc` (name `p3probe-email`, `send_email: [{name: MAIL, destination_address: p3probe@example.invalid}]`, `workers_dev: false`) | done | Version dbe7d7cb-36c5-44f8-b790-7e565964e7e2. `env.MAIL (p3probe@example.invalid) Send Email`. No targets deployed, no request made, nothing sent. Cloudflare did not require the destination to be a verified Email Routing address at deploy time. |
| E2 | Delete | `wrangler delete --config ... --force` | done, then the KV cleanup refusal (code 10000) | Script API 404. |
| T3 | Post-check | Worker list, container application list, Durable Object namespaces | done | Worker list identical to the pre-check. Container application list identical to the pre-check. No Durable Object namespace with `p3probe` in its name or script. |

Probe configs and the puppeteer install lived only in the session scratchpad. Nothing in the product's tree was changed.

### Token scopes, updated

| Area | Evidence | Status |
|------|----------|--------|
| Containers edit | application created on deploy, deleted by `wrangler containers delete` | held |
| Browser Rendering | `puppeteer.limits` and a full page load through the binding | held |
| Email Sending (send_email binding deploy) | deploy with a restricted destination accepted | held for deploy; sending not measured |
| Workers KV Storage | the same code 10000 on every `wrangler delete` | still missing |

### What it means for unattended rounds

- Approvals are sufficient for every binding the product uses. No judge refusal and no model decline in three passes.
- The token now has every scope the product's own deploys need. The only gap remains Workers KV Storage Read, which only makes `wrangler delete` exit non-zero.
- A container teardown must also run `wrangler containers delete` on the application, or the application outlives its worker.
- Any product code that drives the BROWSER binding through `@cloudflare/puppeteer` should use 1.4.0 or later. bio-plane does not depend on that package (it speaks devtools over the binding itself), so this is a note for walkers and probes, not a product fault.
