Length: 34 lines. Last section: "Suggestions".

# credentials-tables: requirements

Next number: 84

## Public

### Purpose

The credentials' tables and refusal rows as data: the DDL `credentials` owns with its additive columns and the tables exempt from purge (`schema.mjs`), and the rows and words of every refusal it answers, with the sign-in window's figures (`checks.mjs`). Pure: `credentials` runs the schema and answers each refusal with its row here.

### Provides

**Tables (plan T33, Rules (6))**
- **R30** [met] This module declares every table explicitly through `record-core.declareTable` (its R21), keeping R18's purge exemption: account references, keyed-service keys, password hashes, sessions and AI credentials `export: "never"`; account references `sight: "owner"`. (T35) The tables T35 adds are declared the same way, each `export: "never"` and exempt from purge: R38's window, R46's recovery codes and their recoveries, R44's tally (`sight: "group"`; administrator-only reading is R45's own, as `ai-accounts` R6's is), and `ai-accounts` R18's connected subscriptions (`sight: "owner"`). (T40) The project keys' table is declared `export: "never"`, exempt from purge but deleted with its project, and readable only through `ai-accounts` R10's service. Material-limit rows are declared as `ai-accounts` R20's. (T48; K3101) It declares its own fourteen tables only: `credentials`, `sessions`, `bootstrap`, `signers`, `ai_credentials`, `keyed_services`, `ai_grants`, `signin_window`, `security_counts`, `security_pending`, `security_key`, `recovery_codes`, `recoveries` and `password_reset_links`. The eleven AI-account tables (account references, the group key's three, the material limits' two, connected subscriptions, a project's account's three and the change history) are declared by `ai-accounts` (its R28), and this module stops declaring them in the commit that creates `ai-accounts` in its factory (R72).

**The words members read** (DEC-149; N664)
- **R48** [met] (DEC-149, Bob's "S4: B"; K1779, K1785) Every member- or founder-facing string this module answers (the `translation` of each of its rows, every refusal's `detail` and `remedy`) calls the group's own Civicsmith "your group's Civicsmith", or is reworded so it needs no name, and never "copy", "instance", "plane" or "server" for it ("on this instance" becomes "in your group's Civicsmith"; "whoever hosts this copy" becomes "whoever hosts your group's Civicsmith"; "this copy's seal secret" is turned round, "the seal secret of your group's Civicsmith"; a seal secret not "bound" but "set"). "Copy" keeps only its other meanings. The sweep's rows for this module (`build/plan/draft-T35-dec149-l1-l7.md`; `bio-plane/src/credentials/` as numbered there) are `checks.mjs`:21, :27 (C-63.1, C-63.2), :39 (C-29.1), :53 (C-29.3), :66 (C-29.5), :153, :154 (C-29.22) and `index.mjs`:231, :237 (R4's `SIGN_IN_REFUSED` detail), :342, :588, :631, :794, :822, :880, :1060, :1243: 17 rows, each applied where it lands and named by a test. Codes, op names, binding and field names, and comments are not member-facing and stay. (T48) It holds for this module's own rows; the AI accounts' rows are `ai-accounts`' (its R30).

## Private

### Uses

- `setup-words`: `word`, `localize` (each row's translation and the sign-in window's sentence by key; R48).

### Invariants

- **R18** [met] (`membership` R59's share) Credentials, sessions, signer keys and AI credentials are declared exempt from `purge`. (T48; K3101) This holds for its own tables (R30); the AI accounts' tables are `ai-accounts`' (its R28, R29).

### Suggestions

- **Rows.** C-96.15, C-96.16 and C-96.17 (R9), today in `membership/checks.mjs`, move into this module's `checks.mjs` with their ids, their `where`s naming this module's functions (a row change for promotion's stamp this layer).
- **T35 (T35-15).** The new codes (`SIGN_IN_PAUSED`, `NOT_SIGNED_IN`, `AI_CREDENTIAL_BAD_EXPIRY`, `SUBSCRIPTION_LOGIN_REFUSED`, `SECURITY_KIND_UNKNOWN`, `SECURITY_PERIOD_INVALID`, `RECOVERY_REFUSED`) are this fold's; their rows take the next free numbers of this module's families (C-29, C-63, C-96), the job's choice, and await promotion's stamp (T35-16), with the six rows R48 moves (C-29.1, .3, .5, .22, C-63.1, .2). R38's bounds (10 per source, 10 per role, in 10 minutes), R42's (1 to 365 days, 90 by default), R44's 90 days and R45's threshold are BOB's under K1881, reported to Bob as done. R44's counts may be kept in the module's own table or written to Workers Analytics Engine and read through the Analytics SQL binding (`plan/study-cloudflare-security.md` §3); either meets R44 and R45 if the 90 days and the place rule hold. The pending place of R44 may be held as the role's HMAC under a key kept as `doorbell` R12 keeps its own. The window's role bucket may share that key.
