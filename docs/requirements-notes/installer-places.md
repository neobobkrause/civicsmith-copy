# installer-places: notes for BOB

Job installer-places, replacement session (7 Nov 2026), after the paths were widened to the installer's page, `/begin`, words and fixture (PR 882). For BOB, who merges and routes.

## Met on this branch

- **R21, as R94 amends it** (`newgroup/src/ui.mjs`). The places offered are `jurisdictions.layers()` of Civicsmith's own origin. That leaves out the test profile and the team layer. Each place is shown by its name and the place it covers. The old combined profile (`oakland-alameda`) is no longer offered, because R94 governs where the two differ (K5452). Choosing none is still allowed: the `profile-none` choice clears every box, the federal one included.
- **R94** (`ui.mjs`, `index.mjs`). The heading asks where the work focuses. The page groups the places by state (one fieldset per state, with its counties and cities after it). Only the federal layer is preselected. The page says that Civicsmith ships United States places only, what removing the federal layer means, and that a team may add its counties' and cities' facts to its team layer. When a place is checked, the page's script checks the layers it sits within and marks them "added"; unchecking a layer unchecks what sits within it. The script names no place of its own (R31): it works by position. Whatever the page sends, `/begin` adds the layers each chosen place sits within (`placesBound`) and binds them in `jurisdictions`' order. So choosing the state alone binds federal and the state, and choosing a county and a city binds federal, the state, the county and the city. Removing federal and choosing nothing binds none.
- **R96** (`ui.mjs`, `index.mjs`). Before the choice, the page shows the region the founder's request is near (`locationHintFor(req.cf)`) and states that the choice is made once (`screen.install.region.final`). It then offers two choices:
  - **Near me**: a list of the regions the word table names, with the founder's own preselected.
  - **Keep my data in this region**: EU, US or FedRAMP.

  `/begin` takes `region: {hint}` or `region: {jurisdiction}` and refuses anything else by name, including both at once and any region on an update. It passes the choice to `installer-steps`' `placementFor`, so a picked hint overrides the default and a jurisdiction carries no hint. The install sends `storeJurisdiction` to `uploadInstall`, and `{jurisdiction}` to `ensureBuckets`, so both buckets are created in the jurisdiction. With no `cf` and no pick, the install is what it was before (R83). A check keeps the pick, so its "Install now" begins the install with it.

Tests: `bio-plane/test/m/installer-places/places.test.mjs` and `region.test.mjs`. Each fails when the `newgroup/src` change is reverted. The installer's own R21 and R50 tests (`newgroup/test/requirements.test.mjs`, `t47.test.mjs`) follow the amended page.

## Not met, and why

- **R95** waits on `runtime-limits`' `levelOf` and the level rows (no declared level or design stage exists in the installer).
- **R97** waits on `installer-steps` R47's read through the jurisdiction's endpoint, R48 (the import step) and `corpus-export`'s whole-record export. No import path exists.
- **R98** waits on R97. Its test needs an import: the new copy's first screen reads the export's `not_carried` list, and the old copy is unchanged after an import. Without an import there is nothing at the interface to test. The design's words for it exist (`screen.install.move.*`).

## For the design lane (UX-DESIGN)

The design's table had no words for these sentences. Each is written once at its use as `localize(id, en)` (situation `job.md`, K3943) and is in `KEYS`:

- `installer.places.focus`
- `installer.places.usonly`
- `installer.places.federal.what`
- `installer.places.teamlayer`
- `installer.places.added`
- `installer.region.near.label`
- `installer.region.keep.none`
- `installer.begin.region`
- `installer.begin.region.update`

`installer.places.heading` is no longer read. The installer entry of `words-reads-mod-5.json` (the design's file) does not yet list the new keys or the `screen.install.region.*` keys the page now reads.

## For installer-steps

The jurisdiction choice creates the buckets with `cf-r2-jurisdiction`, and the plane upload binds `STORE_JURISDICTION`. The plane's `r2_bucket` bindings in `uploads.mjs` do not yet carry the bucket's `jurisdiction`. That gap is `installer-steps` R47's, and it is not verified against Cloudflare here.
