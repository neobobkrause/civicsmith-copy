# stewards: notes for the requirements' reader

## R24 to R26 (T53, job stewards attempt 1)

- `RULE_PARTS` is `["1", "2", "3", "4"]`, exported from `stewards/src/config.mjs` and `index.mjs`. A part sent as the whole number (`2`) is read as `"2"`; anything else is `RULE_PART_UNKNOWN`.
- The rule text's version is the plain variable `LISTING_RULE_TEXT_VERSION` (`2026-10-15` in `stewards/wrangler.jsonc`), a `YYYY-MM-DD` date stored on each listing withdrawal. R24 gives no answer for an unset or malformed value; the service refuses a `public_listing` withdrawal with 503 `RULE_TEXT_VERSION_UNSET`, writing nothing, after R24's own refusals. The other two services do not read it. BOB may rule otherwise.
- The part and version are columns on `decisions` (added by `ALTER TABLE` to a store made earlier). They show in the steward's report page and its JSON only; the public register, the steward's register JSON and the notice carry neither.
- R26's sentence is the word `stewards.ui.tell_group_listing` (number, part's words, reason), shown on the steward's report page for each listing withdrawal, with either the contact the report gave (`stewards.ui.tell_group_send`) or the note that none was given and no public status line exists (`stewards.ui.tell_group_no_contact`). The contact is the report's own optional contact, erased by R15 as before. The service sends nothing new.

## R7 stays open

R7's T46 amendment has the guide's words read from `newgroup/README.md`, which installer R48 writes only once Bob names the stewards' address (K2799, K2878). That README does not exist on tranche, so the interim (`stewards/guide.md`) stands and R7 is named in a `test.todo`.
