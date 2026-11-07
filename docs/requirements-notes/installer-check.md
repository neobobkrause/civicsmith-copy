# installer-check: notes for BOB

Job installer-check, replacement session (7 Nov 2026), after the paths were widened to the installer's files (PR 855). For BOB, who merges and routes.

## Met on this branch

- **R86** (`newgroup/src/index.mjs`, `ready.mjs`). `POST /begin` takes `mode: check`; the slug is validated and the scopes asked are R2's. The callback of a check runs `runChecks(token, account, slug)` against the account the sign-in lists (or the one chosen, R84 (6)), draws the list, names the account, clears `bio_wiz` and keeps nothing. It takes no lock, registers no workers.dev prefix and makes no bucket; its only write is the plan probe (`establishPlan`), deleted at once, and a probe it could not delete is named (`screen.install.check.probe.left`). A permission that does not reach asks for approval again (R71), and that approval begins the check again.
- **R87** (`ready.mjs`). `CHECK_LINES` (frozen): `plan`, `containers`, `limits`, `name`, `card`. Each line is judged on its own; a line that errors is `unknown` and stops no other. The `name` line and the install's `fresh` step both call `nameTaken` (moved out of `index.mjs`, with `slugOk` and `memberNamesOf`), so there is one copy. A line answering `permission` asks for approval again instead of drawing.
- **R88** (`ready.mjs`). The `card` line is derived from the plan line and `storageEntitlement`; it makes no write of its own and says the plan's probe is the only write.
- **R89** (`ready.mjs`). "Check again" begins the check again with the choices kept, on every list. A `Lasting` answer (429 past the bound) draws its line `unknown` with `screen.install.check.unknown.busy`.
- **R90** (`index.mjs`, `ready.mjs`). A check whose lines are all ready sets `chk` (slug and instant only, HttpOnly, Secure, SameSite=Lax, 30 minutes, unsigned). A check that is not ready clears it. Install-mode `/begin` without a passed `chk` for the same slug is refused 400 `CHECK_NOT_PASSED` (`refusal.CHECK_NOT_PASSED`) before any sign-in. Update, removal and check need none. When R84 stops an install that a check passed, `screen.install.refused.rare` is drawn. The check's callback is answered whole (`bufferedPage`) so that its headers can carry `chk`; the install's callback still streams.
- **R91** (`guide.mjs`, `ui.mjs`). Each of the first three guide steps has a button (new tab) from `GET_READY_LINKS`, with the line about what the founder will see there. The last step ends with `screen.install.getready.done`, and its act ("Check my account") leads to the short name, where the first page's act now begins a check.
- **R92** (`ready.mjs`). `GET_READY_LINKS` and `FIX_LINKS` hold every Cloudflare page a reader follows. The sign-up link moved out of `ui.mjs`; `ui.mjs` and `guide.mjs` hold none of their own.
- **R93** (`words.mjs`). Every new key is in `KEYS` and is held by the word table.

Tests: `bio-plane/test/m/installer-check/check.test.mjs`, one per requirement. Each fails when the `newgroup/` change is reverted.

## Fixture

`newgroup/test/fixture.mjs`: `begin` sends a passed `chk` for install mode by default (`chk: false` sends none; a string sends that value). Every install-mode `/begin` sent to the Worker through the fixture's process also gets a passed check for its own slug, unless it already carries `chk` or sets `NO_CHECK`. That covers the installer tests that post `/begin` themselves.

## Owed by others

- **Installer's tests that pin the old first page.** These assert that the first page's act begins `mode: install`; R91 changes it to begin a check: `newgroup/test/requirements.test.mjs:70` (R1) and about `:1999` (R41), `newgroup/test/t47.test.mjs:76, :94` (R50), and `newgroup/test/wizard.test.mjs:274`. `newgroup/test/realsize-child.mjs:177` posts an install `/begin` without `chk`. Asked of BOB: widen to those files, or give them to installer's job.
- **The ux lane:** the `installer` entry of `words-reads.json` comes from `words-reads-mod-5.json`, which is in the design folder. It needs regenerating (`words-reads-mod-5.src.mjs`) to list the new keys.
- **The ux lane:** the name line's fix button reads `screen.install.check.limits.open` ("Open your Workers"). There is no `screen.install.check.name.open` key yet.

## Not verified

- No run against a real Cloudflare account; Cloudflare's answers come from the fixture's shapes. The dashboard deep links (`?to=/:account/...`) were not opened.
- A check whose wait on Cloudflare runs to the 5-minute bound answers only at the end, because the page is answered whole. Not measured against the platform's request time limit.
