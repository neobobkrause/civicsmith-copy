# Deploying the wizard, dashboard only

The wizard deploys to the NEW account, the one whose workers.dev prefix is
`believeinoakland` (account `20b533579290b9b93168345edd3b7f72`). It has no
bindings, no secrets, no buckets, and no Durable Objects: one module, pasted
once. That absence is deliberate and load-bearing; see wrangler.jsonc.

## 1. Create the Worker

Sign in to the new account. Workers & Pages, Create, Create Worker. The
dashboard then asks you to select a method. Choose the template method, the
hello-world starter. Do NOT choose "Upload and deploy": that is a static
site uploader, it warns about JavaScript files, and it cannot create a
module Worker.

On the naming step, replace the generated name with exactly `newgroup`,
because the name is the first part of the registered OAuth redirect URL and
a different name breaks the sign-in silently, on Cloudflare's side, before
any page of ours can explain it. Deploy the hello-world it offers.

## 2. Paste the module

Open the Worker, Edit code. Select everything in the editor, delete it, and
paste the entire contents of `dist/newgroup.bundled.mjs`. Deploy.

## 3. Verify the page

Open `https://newgroup.believeinoakland.workers.dev/`. You should see "Create
your new Civicsmith group", drawn in Civicsmith's own typefaces (the installer
serves them itself, under `/app/assets/`). Type a made-up short name, press
Continue, confirm it in the dialog, then press "Continue to Cloudflare": if it
sends you to `dash.cloudflare.com` with a permission screen, the front half
works.

## 4. The first real run

This answers the one question the sandbox could not: whether the token
exchange succeeds. While signed in to the new account (the OAuth client is
private, so only this account's members can authorize it), run a real
install named `bio-smoke`. Approve the permission screen. The progress page
should walk through every step and end with the checks, a one-time password,
the address, and the probe key folded away. Press "Continue to your group's
Civicsmith": it opens the address at `/app/setup` with the one-time password
filled in. Claim it with a real password and confirm setup reaches its end.

If the very first step fails with a handshake error, the suspects in order
are: the redirect URL on the OAuth client not being character-identical to
`https://newgroup.believeinoakland.workers.dev/callback`, and the scope
names on the client not matching `workers-scripts.write`, `workers-r2.write`,
`account-settings.read`, `containers.write`, `connectivity-directory.bind`. The
fourth was added for the assistant's container member (T33-91), the fifth for
binding the Workers VPC service an operator names for a tunnelled security tool
(T36, installer R45). Add each to the OAuth client's registered scopes BEFORE
deploying an installer that asks it, or every sign-in is refused on
Cloudflare's consent screen.

## 5. Clean up the smoke test

Delete the `bio-smoke` Worker in the dashboard, which takes its Durable
Object with it. If R2 buckets were created (only if this account has a card
on file), empty and delete them.

## Rebuilding after a bio-plane change

The wizard carries the release inside itself, and that release is always a
signed one: it builds nothing from the working tree. First cut and sign the
release (`node bio-plane/scripts/release-assemble.mjs --sign`). Then, in
`newgroup/`: `npm run build` copies the signed asset from `release/`,
refuses to embed it unless it hashes to `RELEASE.json`, its signature
verifies against the installer's own keys, it names the version
`bio-plane/package.json` names, and no published token value appears in it,
and produces a fresh `dist/newgroup.bundled.mjs` to paste. Then paste and deploy as in step 2, and existing groups pick the
release up through the wizard's update option.
