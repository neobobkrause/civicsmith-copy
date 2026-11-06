# The BIO installer

Rewritten July 23, 2026. This replaces every earlier version of this file.
Two claims in the old version were wrong and are corrected throughout: a
static page with no backend cannot provision anything, because the
management API answers no CORS preflight; and the Sync-fork update story
only ever applied to the deploy-button path. What follows describes what is
built and tested.

## The shape: three parts, three owners

| Part | Lives at | Owned by | Job |
|---|---|---|---|
| 1. Invitation | `believeinoakland.org/newgroup` | BIO | Explain what a group copy is. State the prerequisites honestly. One deliberate button to part 2. |
| 2. Wizard | `newgroup.believeinoakland.workers.dev` | BIO | Get consent via OAuth, provision the group's instance into their own account server-side, hand off. |
| 3. Setup | the new group's own instance, at its root | the group | Claim the copy, choose a real password. Nothing routes through BIO again. |

The audience is community activists who will not open a terminal under any
circumstances. That is the requirement, not a preference.

Part 1 is `bio-plane/public/newgroup/index.html`, a static page with a
button and no logic. Part 2 is the `newgroup/` Worker tree. Part 3 is
embedded in the bio-plane module itself (`src/setup.mjs`) and served at the
instance's root, so the OAuth upload path needs no asset machinery.

## Why the wizard is server-side

Tested directly, twice: the management API returns HTTP 400 with zero CORS
headers to a preflight, even from an origin registered on the OAuth client.
`allowed_cors_origins` governs the OAuth endpoints only. A browser can never
send `api.cloudflare.com` a request carrying an Authorization header, so a
page alone can never create a bucket or upload a Worker. The wizard Worker
does the provisioning itself, same origin as the page it serves.

## The flow

1. The browser posts the chosen name to `/begin`. The wizard mints a PKCE
   verifier and a state value, parks them in an HttpOnly Secure SameSite=Lax
   cookie with a 15-minute life, and returns the authorize URL.
2. Cloudflare shows the consent screen for exactly three scopes:
   `workers-scripts.write`, `workers-r2.write`, `account-settings.read`.
3. Cloudflare sends the browser to `/callback`, the registered return
   address. The wizard checks the state against the cookie, exchanges the
   code server-side (PKCE, no client secret), and streams the progress page
   while it provisions:
   - find the account
   - refuse if a copy with that name already exists (pointing at update)
   - try to create `bio-captures` and `bio-published`; refusal is a normal
     state, not an error (see Optional R2)
   - upload the release with the `new_sqlite_classes: ["Store"]` migration,
     three freshly generated credentials, and R2 bindings only if the
     buckets exist
   - enable the workers.dev route, registering an account prefix if the
     account has none, and saying so on the page
   - verify with a live selftest before declaring success
4. The success screen shows the address, the one-time password, and the
   member and probe credentials, once. The handover button opens the new
   instance with the one-time password in the URL fragment, which never
   leaves the browser.
5. On the instance's own setup page the group spends the one-time password
   and chooses a real password. From here on, nothing touches BIO.

## Token custody

The access token exists in a local variable for the seconds provisioning
takes. The wizard Worker has no storage bindings of any kind, so there is
nowhere to write it even by mistake; statelessness is structural. The test
suite asserts the token appears in no byte the wizard emits. The token is
scoped to the three permissions above, granted on a consent screen the user
reads, and revocable from their dashboard.

The obligation this creates: the manual, no-installer path stays documented
and supported permanently, so a group can stand up an instance if BIO
disappears. `SETUP.md` and `DEPLOY-DASHBOARD.md` are that path.

## Optional R2

Storage is by role, not size: only registered captures go to R2, spilling at
1MB. A new group has nothing over 1MB, so everything lives in SQLite in the
Durable Object, on the free plan, with no card. The wizard attempts the
buckets and degrades cleanly when refused; selftest and livefire both treat
"not configured" as a first-class healthy state distinct from "configured
and broken", and both fail on half a fence (one bucket without the other).
A group adds R2 later by putting a card on file, and both buckets arrive
together.

This removes the payment method from the prerequisites entirely. The
invitation page says so.

## The update path

There is no fork and no CI/CD on the OAuth path, so updates are the wizard's
job. The wizard's update option re-uploads the current release into the
existing script with `keep_bindings: ["secret_text",
"durable_object_namespace", "r2_bucket"]` and no migrations block. Secrets,
the store, and the buckets are preserved exactly; only the code and the
VERSION binding change. Updates therefore cannot touch passwords or the
record, and the page says so. Verification reads the instance's public
`bootstrap` op and confirms the version.

This is strictly better than the fork-sync story: no git host account, no
public fork of the group's own, and the migration under our control.

## The deploy-button path, now the fallback

Cloudflare's Deploy button clones a public repository into the user's git
account and wires CI/CD. It requires a GitHub or GitLab account and remains
documented as the fallback. The landmine stays defused: the button pre-fills
secret prompts from the example vars file, so `.dev.vars.example` ships with
all values empty. Beyond that, the runtime itself now refuses: any token
value that has ever been published in this repository is denylisted by
SHA-256 in `src/tokens.mjs` and can never authenticate or arm a claim, and
an empty token authenticates nothing. Livefire asserts both on the deployed
instance. A copy that somehow ships with a published credential runs closed,
not open.

## Redirect URL discipline

Cloudflare matches the registered redirect string character-exactly and
never follows a redirect to bridge a mismatch. A mismatch fails on
Cloudflare's side before the user returns, so it is the one failure the
wizard cannot put a sentence on screen for. `CFG.REDIRECT` in
`newgroup/src/index.mjs` must equal the registered
`https://newgroup.believeinoakland.workers.dev/callback` exactly. When the
domain moves: add the new redirect URL alongside the old on the OAuth
client, deploy, verify a real run, then remove the old.

## The release payload

`newgroup/scripts/embed-release.mjs` embeds the SIGNED plane asset from
`release/` into the wizard as a string, so an install uploads exactly one
module and depends on no repository and no second fetch. It builds nothing:
it refuses unless the asset hashes to `RELEASE.json`'s sha256, the signature
verifies against the wizard's own `ARMED_SIGNERS` (`newgroup/src/signers.mjs`),
and the version equals `bio-plane/package.json`'s. It also refuses a bundle
containing any published token value. (Until 2026-09-18 it built the working
tree instead, so between releases `npm test` replaced the signed embed with an
unsigned build under the signed version's name.) So the wizard is re-cut only
AFTER a release is signed: `npm run build` in `newgroup/`. Its output,
`newgroup/dist/newgroup.bundled.mjs`, is built and never committed: the
development release carries it as `newgroup.bundled.mjs`, and from the
repository root the whole build is
`npm --prefix bio-plane ci && npm --prefix newgroup ci && node docs/development/ux-substrate/screens/build_words.mjs && node bio-plane/src/setup-words/build.mjs && node docs/development/ux-substrate/screens/words-reads.src.mjs . --build && npm --prefix newgroup run build`.

## Order of operations from here

1. Deploy the wizard to the new account (`newgroup/DEPLOY.md`).
2. First real run answers the one untested question: whether the token
   exchange at `dash.cloudflare.com/oauth2/token` succeeds. It could not be
   exercised from the sandbox (egress refuses that host) and every other leg
   of the conversation is tested against a scripted upstream.
3. Use the installer to stand up BIO's own instance. If the flow cannot
   stand up BIO's own copy, it cannot stand up anyone's.
4. Then decommission the old deployment and continue the data plane
   migration.
