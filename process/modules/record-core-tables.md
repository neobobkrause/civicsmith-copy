Length: 45 lines. Last section: "Suggestions".

# record-core-tables: requirements

Next number: 92

## Public

### Purpose

The record's own tables as data: their definitions, `RECORD_SCHEMA` (`schema.mjs`), with the read contract they hold for later modules (R37), and the rows of every refusal `record-core` answers, C-59, C-75 and C-102 with their translations (`checks.mjs`). Pure: `record-core` runs the schema in its `migrate()` and answers each refusal with its row here.

### Provides

**listByType({type, after, limit}) → `{ids, cursor}`; the `bundles` read contract; evidenceStore() → `{head, get, put}`** (K57)
- **R37** [met] The table `bundles` and its columns `bundle_id` and `object_type` are a stated read contract: a later module may join them in its own SQL (a projection bounded by SQL, as membership's directory is, D-497), and this module changes neither column's name, type or meaning without a requirement change carried to every such reader (P5). The columns `current_state`, `title` and `criticality` are part of it too, on the same terms (N64, K96: `affordances` and `queue` read them). The tables `files` and `history`, with their columns `bundle_id`, `path` and `sha256` (and `history.snap_key`), and the columns `bundles.created` and `bundles.last_updated`, are part of it too, on the same terms (N83: `provenance` reads them). The column `files.content`, the live file's inline text exactly as `commit` was given it and NULL when the file is blob-backed (`blob_sha` set), is part of it too, on the same terms (N162, K233: `reevaluation`, `inquiry`, `retrieval` and `run-productions` scan it). The columns `files.bytes` (the live file's size in bytes as `commit` recorded it) and `files.blob_sha` (the blob address of a blob-backed file, NULL for an inline one), `bundles.bundle_sha` and `bundles.row_version` (R41's `bundleSha` and `rowVersion`), `history.created`, and the table `manifest` with its columns `bundle_id`, `snap_key`, `kind`, `base`, `author`, `created`, `writer` and `operation` (R42's entry), are part of it too, on the same terms, and so is `manifest`'s `rowid`, which ranks a bundle's entries in the order this module recorded them (R16; the tie-break under `created` those readers use) (N213, N484: `corpus-export`'s working-corpus export, its R1, moved from `publication` by K1024, reads `bundles`' `bundle_id`, `object_type`, `title`, `current_state`, `bundle_sha`, `row_version`, `created` and `last_updated`, `files`' `path`, `sha256`, `bytes`, `blob_sha` and whether `content` is set, `manifest`'s columns and `rowid`, and `history`'s `snap_key`, `path`, `sha256` and `created`; `ratification`'s rows read them). The columns `bundles.group_id` (R44's `group`: the producing group as the committer gave it, kept when a later commit gives none; the empty string for a bundle created naming none) and `bundles.prior_state` (R44's `priorState` as last given; NULL when none was given at creation) are part of it too, on the same terms (N287: `retrieval`'s `projection`, `query-language`'s `bundles` relation and `inquiry`'s `divide` read them). The column `bundles.project` (R34's `project`) is part of it too, on the same terms (N426: `membership`'s `viewerPredicate`, its R43, fences a bundle that belongs to a project by it). No other column is part of the contract. The projection columns on `bundles` and `fts_id` are `retrieval`'s (its migrate declares them and only its projection writes them), not this module's, until they move to a table of retrieval's own (K144, N106).

**T34: the declaration's older refusals get their rows** (T34-9; N554, K1545; DEC-49)
- **R80** [met] `declareTable` (R21) and `declarePurge`, its default form, answer their two older refusals with their rows, each declaring nothing, as every other refusal of the declaration does: `TABLE_NAME_INVALID` (C-102.26) when a table's name, or a column or table named in one of its lists (`keys`, `clears`, R77's `from`), is not a plain identifier; `TABLE_DECLARED` (C-102.27) when a table is already declared, by this module or another, or is named twice in one call. Each answers `{ok: false, reason, code, check, translation, detail, table, module}`, `reason` and `code` the refusal's name, `check` and `translation` its row's (this module's, beside C-102.21 and C-102.22), and `detail` one fixed sentence naming the table and saying nothing was declared; `TABLE_DECLARED` also keeps `declaredBy`, the module holding the table. The fields they answer today (`table`, `module`, `declaredBy`) keep their names and meaning.

**T35: the lease's and the settings' refusals get their rows** (T35-13; N655, K1754; DEC-49)
- **R81** [met] `ANONYMOUS_LEASE` (R10, R61) and the four refusals of `setSetting` (R25: `SETTING_NAME_REQUIRED`, `SETTING_BY_REQUIRED`, `SETTING_VALUE_REQUIRED`, `SETTING_INVALID`) are answered with their rows, as every other refusal of this module is (DEC-49): each answers `{ok: false, reason, code, check, translation, detail}`, `reason` and `code` the refusal's name, `check` and `translation` its own row's (this module's row table, `where` naming the function that refuses), and `detail` one fixed sentence. `ANONYMOUS_LEASE`'s `detail` is today's sentence, unchanged, and its `translation` tells a member that an edit is held only under the name of whoever is editing, that this request carried none, and that nothing was held, ended or changed. Each `SETTING_*` `detail` names what was missing or wrong and says nothing was recorded; `SETTING_INVALID` keeps `name` and says what the setting takes (R26: an ordered list of distinct profile ids). The translations of `SETTING_NAME_REQUIRED`, `SETTING_BY_REQUIRED` and `SETTING_VALUE_REQUIRED` are build faults and end with the `BUILD_FAULT` sentence as R82 words it; `SETTING_INVALID`'s says the setting was not changed. Nothing else in R10, R11, R25, R26 or R61 changes; the fields they answer today keep their names.

**T35: the words members read** (T35-13; N664, DEC-149; K1779, K1785)
- **R82** [met] (DEC-149, Bob's "S4: B") Every member-facing string this module answers (the `translation` of each of its rows, the `detail` of R62's `MINT_EXHAUSTED`, and R81's new ones) calls the group's own Civicsmith "your team's Civicsmith", or is reworded so it needs no name, and never "copy", "instance", "plane" or "server" for it; "whoever runs this instance" becomes "whoever hosts your team's Civicsmith". The `BUILD_FAULT` sentence reads "This is a fault in how your team's Civicsmith was built, not in the record, and nothing in the record changed.", and C-102.13 and C-102.14, which spell it inline, read the same. The sweep's rows for this module (`build/plan/draft-T35-dec149-l1-l7.md`; `bio-plane/src/record-core/` as numbered there) are `checks.mjs`:33 (`BUILD_FAULT`, which moves sixteen translations: C-102.1, .2, .15–.24, .26, .27, C-59.7, C-59.9), :38, :40–41, :45, :46–47, :51, :52, :65, :70, :82, :88, :95, :100, :107, :114, :118, :124, :129, :135, :140, :146, :151, :157, :162, :169 and `index.mjs`:129 (26 rows), each applied where it lands and named by a test. Codes, op names, field names and comments are not member-facing and stay. (T51, K3472, K3975: "team" for "group" in text people read; wording only.)

## Private

### Uses

- `setup-words`: `word`, `localize` (each row's translation by key; R82).

### Invariants

- **R55** [met] **C-75.** The set form's five refusals (R50, R52) move here as an invariant with their test (K6): C-75.1–C-75.5.

### Satisfies

- DEC-49 (a refusal answers with its row: R80, R81); DEC-149 ("your group's Civicsmith": R82).

### Suggestions

- C-59.6 is held in this module's own row table (K174), beside C-59.5, which stays in the catalogue until it moves here.
- **T35 (T35-13).** R81's rows take the next free numbers of the families this module holds (K174), the job's choice, and await promotion's stamp (T35-16). Control-plane's `lease.test.mjs` pins `ANONYMOUS_LEASE`'s old shape and is re-pinned by control-plane's own T35 job (T35-72; plan rule 9 (7)); no other test pins the `SETTING_*` shapes. The rows whose translation R82 moves (C-59.6–.9, C-102.1, .2, .13–.27) await the same stamp.
- **T47 (T47-6).** R84's code is `SETTING_NOT_JSON`, not `SETTING_INVALID` (BOB's, P17): C-102.32 `SETTING_INVALID` already holds R26's condition with a translation about the jurisdictions, and one code names one row (DEC-49), so a different condition takes a new row. No caller passes such a value today (N939); `t35.test.mjs` pins the other four `SETTING_*` rows and stays as it is.
