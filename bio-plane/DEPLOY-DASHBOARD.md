# Deploying bio-plane 0.2.0 from the Cloudflare dashboard

No command line. No API token. Everything below is clicks and pastes in
`dash.cloudflare.com`.

The artifact you paste is `dist/bio-plane.bundled.mjs`, a single ESM file that
esbuild produced from the four `src/*.mjs` modules. It is built, never
committed: take `bio-plane.bundled.mjs` from the development release (its
`civicsmith-copy-p3dev-<version>.tar.gz` asset), or build it from the repository
root with `npm --prefix bio-plane ci && node docs/development/ux-substrate/screens/build_words.mjs && node bio-plane/src/setup-words/build.mjs
&& node bio-plane/src/case-checker/build-program.mjs && node bio-plane/scripts/build-plane.mjs`. It is not a rewrite. It has
been run through the same livefire battery as the source tree and returns the
same 16/16 with the same confinement refusal, so what you paste is what was
tested.

## Order matters

Buckets before Worker, if you are setting up R2 at all. The Worker will not
deploy with an R2 binding pointing at a bucket that does not exist.

## 1. Optional: buckets

R2 is optional as of 0.3.0. A new instance runs entirely on the built-in
database with no card on file; skip this step and the two R2 rows in the
bindings table, and the selftest reports storage as "not configured", which
is healthy. When large-file storage is needed later, do this step then, and
add both bindings together, never one without the other.

R2 Object Storage, Create bucket, twice.

- `bio-captures`, location Automatic, **keep it private**
- `bio-published`, location Automatic

Do not enable public access on `bio-captures`. The fence is the bucket
boundary. A published-scope query cannot reach unratified material because that
corpus has never seen it, and that property is only true if the two buckets stay
what they are.

`bio-published` gets public read later, as the act of publication. Not now.

## 2. Worker

Workers & Pages, Create, Start with Hello World, name it `bio-plane`, Deploy.
Accept the placeholder. You are about to replace it.

Then Edit code. Select all in the editor, delete, paste the entire contents of
`dist/bio-plane.bundled.mjs` (built as above). Deploy.

It will fail or warn about missing bindings. Expected. Bindings come next.

## 3. Bindings

Worker, Settings, Bindings, Add.

| Type | Name | Target |
|---|---|---|
| Durable Object | `STORE` | class `Store` |
| R2 bucket, only with step 1 | `CAPTURES` | `bio-captures` |
| R2 bucket, only with step 1 | `PUBLISHED` | `bio-published` |
| Environment variable | `VERSION` | `0.3.0` |

**The one step to get right.** When you add the `STORE` binding, the dashboard
creates the Durable Object namespace. It must be SQLite-backed. SQLite cannot be
enabled on an already-deployed Durable Object class, so a wrong choice here is
not repairable by editing config: it needs a new class name and a fresh
namespace.

Since Cloudflare's change of July 9, 2026, accounts with no pre-existing
key-value backed namespace can no longer create one at all, so on a clean
account SQLite is the only outcome available and there is nothing to choose.
If the dashboard offers you a storage backend choice, that means this account
already has a key-value namespace somewhere, and you want SQLite explicitly.

After the bindings are saved, Deploy again. This deploy should be clean.

## 4. Secrets

Same Settings page, Variables and Secrets, Add, type Secret, three times. Values
are in `dist/SECRETS.txt`.

- `ADMIN_TOKEN`
- `MEMBER_TOKEN`
- `PROBE_TOKEN`

Secrets are write-only once saved. The dashboard will not show them back to you,
which is why the file exists. Keep `ADMIN_TOKEN` and `MEMBER_TOKEN`. Rotate any
of the three at any time by overwriting the secret and redeploying.

## 5. Confirm

Settings, Domains & Routes. Enable the `workers.dev` route if it is not already
on, and copy the hostname. Then open:

```
https://bio-plane.<subdomain>.workers.dev/?op=selftest&token=<PROBE_TOKEN>
```

Expect `ok: true` and all six of `STORE`, `CAPTURES`, `PUBLISHED`,
`ADMIN_TOKEN`, `MEMBER_TOKEN`, `PROBE_TOKEN` reporting true. In the local run,
`ok` was false purely because the harness sets only `PROBE_TOKEN`. On a correct
deploy all six are true.

Then:

```
https://bio-plane.<subdomain>.workers.dev/?op=livefire&token=<PROBE_TOKEN>
```

Run server-side and returned as JSON. With R2 configured it reports
`18/18 assertions passed`, store `scratch`, token hygiene checks, R2 round
trip with server-side checksum and range read, and capture throughput at
0.1, 1, 8 and 25MB. Without R2 it reports the same battery with the R2
section replaced by two assertions declaring storage not configured.

Paste either response back and I will read it.

The probe token travels in the URL, which is why the probe class exists. It
reads anything and mutates only the `scratch` namespace, and a request naming
any other store is refused rather than redirected. That refusal is asserted in
the battery, not assumed.

## If the hostname does not resolve

`*.workers.dev` is on the container allowlist but could not be confirmed from
here, because a workers.dev subdomain gets a DNS record only once a Worker is
actually deployed behind it, and none was. The wildcard may also match only one
label, where the real hostname has two.

Fallback, already proven in this project: a custom hostname under
`believeinoakland.org`, matching the existing accelerator proxy pattern.
`data.believeinoakland.org` serves from the container today at 121 to 186ms
warm. Add a route in Workers, Domains & Routes, Add Custom Domain.

## What this path does not do

The manual CLI path in `DEPLOY.md` and the API-token path in `docs/archive/bio-plane-SESSION-HANDOFF.md` (archived with the old process's documents)
both remain valid. This one exists so that deploying costs no credential and no
terminal.
