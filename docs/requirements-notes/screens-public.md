# screens-public — notes

**Status** · Job screens-public, attempt 1, 5 Nov 2026. Reader: BOB.

## What this job did

- **R86** is met by the code already in `bio-plane/src/screens-publish/doorbell.mjs` (the screens-publish T53 job). This module's own test, `bio-plane/test/m/screens-public/t53.test.mjs`, checks it through the real doorbell: "What to keep" heads the receipt with the reference first, then fingerprint, size, pseudonym and made phrase; the sample receipt folds under "What you get back" before a send; the court line stands without its card; control, a receipt with no reference draws no heading and R49's content is kept. Its mark is struck.

## What this job could not do

- **R84, R100, R101, R102, R104** need new drawing in `bio-plane/src/screens-publish/` (`published.mjs`, `published-parts.mjs`, `docket-public.mjs`, `review-outside.mjs`, `keys.mjs`) and, for R102 and R104, new words. This module's paths (`build/modules.json`) hold only its requirements file and tests, and its START lets it change nothing else, so the code is not changed and the marks stay. Each stands as a `test.todo` in `t53.test.mjs`.
- To meet them: give screens-public the code paths it rules (move `published*.mjs`, `doorbell.mjs`, `docket-public.mjs` and the public half of `keys.mjs` out of `screens-publish`), or hand the five marks back to a `screens-publish` job.
