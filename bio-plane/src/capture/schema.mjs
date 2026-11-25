/* capture's tables (layers.md ruling 3): the DDL this module owns, moved verbatim from the legacy schema text
 * (T4-4), and the additive columns an older store gains at boot. `Capture#migrate` runs it. SQL comments are `--`
 * lines, dropped before the statements run.
 *
 * `inbox`, `knock_rate`, `knocker_key`, `doorbell_tally`, `doorbell_limit_last`, `knock_key` and the `inbox` additive
 * columns are `doorbell`'s (T42, K2607): its DDL creates them and its declaration holds them; capture's copy of them was
 * deleted in T43 (N849, N864). */
export const CAPTURE_SCHEMA = `
-- What this RUNTIME was observed to allow, as opposed to what we choose to
-- spend. Cloudflare's per-invocation subrequest limit differs by account, can
-- change on either plan without notice, and is not documented anywhere this
-- code can read, so the only honest source for it is having been refused.
--
-- previous and moved_at exist because a ceiling that MOVES is itself a fact the
-- instance should notice: an upgraded plan and a tightened platform look
-- identical in a single scalar, and telling them apart needs the history.
--
-- samples drives re-probing. Once a value has been confirmed enough times the
-- instance deliberately runs without a ceiling again, because a limit only ever
-- learned downward would leave an upgraded account capped forever.
CREATE TABLE IF NOT EXISTS capture_limits (
  runtime     TEXT PRIMARY KEY,
  observed    INTEGER NOT NULL,
  observed_at TEXT NOT NULL,
  first_seen  TEXT NOT NULL,
  samples     INTEGER NOT NULL DEFAULT 1,
  since_probe INTEGER NOT NULL DEFAULT 0,
  previous    INTEGER,
  moved_at    TEXT
);
-- What a HOST has served, across every document captured from it.
--
-- Bytes were always shared: captures are content-addressed, so one stylesheet
-- occupies one R2 object however many documents reference it. FETCHES were not,
-- and fetches are the scarce thing. On a Legistar page roughly forty of the
-- forty-five available subrequests go to site-wide chrome that will be
-- byte-identical on the next document captured from that host.
--
-- stable_since is the last time the sha CHANGED, not the last time it was seen,
-- because "unchanged for three months" and "not looked at for three months" are
-- different facts. Neither licenses reuse. RECENCY OF FETCH does - last_fetched,
-- the last time the source was actually seen serving these bytes, within the
-- freshness window - together with a furniture kind and at least two distinct
-- PAGES on the host (reuseDecision in subresources.mjs). A stability gate was
-- measured live in 0.40.0 and reused nothing, so stable_since is a secondary
-- confidence signal and keeps its own job in nav-change evidence.
--
-- The same table answers chrome detection. An address referenced by fifteen of
-- fifteen captured documents on a host is the site's; one referenced by a single
-- document is that document's own. That works on sites that never write a <nav>
-- element, which is most municipal sites.
CREATE TABLE IF NOT EXISTS site_assets (
  host         TEXT NOT NULL,
  address_norm TEXT NOT NULL,
  address      TEXT NOT NULL,
  sha256       TEXT NOT NULL,
  content_type TEXT,
  bytes        INTEGER NOT NULL DEFAULT 0,
  kind         TEXT,
  first_seen   TEXT NOT NULL,
  last_seen    TEXT NOT NULL,
  last_fetched TEXT NOT NULL,
  stable_since TEXT NOT NULL,
  changes      INTEGER NOT NULL DEFAULT 0,
  last_fetched_by TEXT,
  PRIMARY KEY (host, address_norm)
);
CREATE INDEX IF NOT EXISTS site_assets_host ON site_assets(host);
CREATE INDEX IF NOT EXISTS site_assets_sha ON site_assets(sha256);

-- One row per (asset, primary capture). It replaces an incrementing counter, and
-- it is what makes post-hoc verification possible: when an asset's sha later
-- changes, the captures that REUSED the old bytes are exactly the rows here with
-- reused=1. primary_sha is the content hash of a CAPTURE, not a page: a page
-- whose bytes changed between two captures has two rows. So the distinct-document
-- count joins primary_sha to captured_locators and counts document ADDRESSES
-- (siteAssets and siteChrome in capture/index.mjs, CAP-13), and a primary with no locator
-- row is counted apart as undetermined rather than as a page.
--
-- CAP-14 (CAPTURE-SCALING.md, Job one, RULED 2026-09-21 by BOB #21): a reused
-- part names the capture whose FETCH served its bytes. site_assets.last_fetched_by
-- is the primary capture sha whose fetch set last_fetched, written beside it on
-- every fetched observation and never moved by a reuse. A reusing capture's row
-- here keeps it as reused_from, taken from the capture's own observation so the
-- manifest and the store cannot disagree, and reusedParts reads it from THIS row,
-- never from site_assets, whose value a later fetch moves. Both are NULLABLE and
-- NEVER BACK-FILLED: a reuse recorded before the build is UNDETERMINED as to its
-- source, and matching a ref row at against last_fetched would prove nothing
-- (both whole seconds, and a ref row is overwritten in place).
CREATE TABLE IF NOT EXISTS site_asset_refs (
  host         TEXT NOT NULL,
  address_norm TEXT NOT NULL,
  primary_sha  TEXT NOT NULL,
  at           TEXT NOT NULL,
  reused       INTEGER NOT NULL DEFAULT 0,
  sha256       TEXT NOT NULL,
  reused_from  TEXT,
  PRIMARY KEY (host, address_norm, primary_sha)
);
CREATE INDEX IF NOT EXISTS site_asset_refs_doc ON site_asset_refs(primary_sha);
-- A capture that ran out of subrequest budget, waiting for another tick.
--
-- SCRATCH, not record. The intake doctrine says no intake path writes live
-- state, and that keeps holding: this is a work list with an expiry, it names
-- no bundle, and acquire still returns a provenance document and promotes
-- nothing. The primary capture is complete from the first tick and its bytes
-- are already in the store; what is outstanding here is only support material.
--
-- The primary HTML is deliberately NOT stored here. It is in the store under
-- primary_sha, and a copy in session state would be a second, unverified copy
-- of evidence sitting somewhere nothing checks.
CREATE TABLE IF NOT EXISTS capture_sessions (
  session     TEXT PRIMARY KEY,
  locator     TEXT NOT NULL,
  primary_sha TEXT NOT NULL,
  primary_file TEXT NOT NULL,
  base        TEXT NOT NULL,
  created     TEXT NOT NULL,
  updated     TEXT NOT NULL,
  expires     TEXT NOT NULL,
  ticks       INTEGER NOT NULL DEFAULT 1,
  state       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS capture_sessions_expires ON capture_sessions(expires);
-- Links a captured document made, and what they resolve to.
--
-- Address-keyed, which refs is not: refs is bundle-to-bundle and answers a
-- different question. An UNRESOLVED link has no canonical target and cannot be
-- a citation at all, because C-6.1 rightly refuses a locator as a
-- references[].target. Resolution is the act that makes a link expressible as
-- an edge: once the store holds a capture of the address, there is a canonical
-- ID to point at, and the address rides along as a comment string.
--
-- address_norm is stored ALONGSIDE address, never instead of it, because a
-- normalisation rule that later proves wrong must be re-derivable and a
-- normalisation MISS looks exactly like "not captured".
--
-- The verdict is about CONTEMPORANEITY: whether the capture the store holds of
-- the target is the version the source was pointing at on the day this document
-- was captured. It is three-valued on purpose. undetermined is the resting
-- state and the expected common case, because Last-Modified is absent from most
-- dynamic pages, wrong on many others, and reset by deployments that changed
-- nothing. A binary design silently sorts every undetermined link into one
-- bucket or the other and both errors are bad.
CREATE TABLE IF NOT EXISTS links (
  source_bundle  TEXT,
  source_capture TEXT NOT NULL,
  link_ref       TEXT NOT NULL,
  address        TEXT NOT NULL,
  -- Two keys, deliberately. address_norm identifies the RESOURCE and is what
  -- resolution matches against captured_locators; the server never sees a
  -- fragment, so it has none. citation_norm identifies the CITATION and keeps
  -- the fragment, because scientific and legal practice cite ELEMENTS and BIO
  -- citations support element references: a link to #findings and a link to
  -- #methodology in one report are two citations, and a single key made them
  -- indistinguishable.
  address_norm   TEXT NOT NULL,
  citation_norm  TEXT NOT NULL,
  fragment       TEXT,
  partition      TEXT NOT NULL,
  origin         TEXT,
  chrome         INTEGER NOT NULL DEFAULT 0,
  -- D-340: WHY the link reads as contained in a chrome region (the region it sat in, e.g. <nav> or
  -- role=navigation). NULL on a link that is not, and on one filed before the column existed.
  chrome_basis   TEXT,
  captured_at    TEXT NOT NULL,
  first_seen     TEXT NOT NULL,
  PRIMARY KEY (source_capture, link_ref, citation_norm)
);
CREATE INDEX IF NOT EXISTS links_citation ON links(citation_norm);
CREATE INDEX IF NOT EXISTS links_target ON links(address_norm);
CREATE INDEX IF NOT EXISTS links_source ON links(source_bundle);

-- The verdict, APPENDED and dated, never overwritten. A verdict that changed is
-- itself a fact about the record, for the same reason state history is
-- append-only: the current answer is the newest row, and the older rows are how
-- anyone can tell whether it was always this answer.
CREATE TABLE IF NOT EXISTS link_verdicts (
  source_capture TEXT NOT NULL,
  address_norm   TEXT NOT NULL,
  verdict        TEXT NOT NULL,
  basis          TEXT NOT NULL,
  target_bundle  TEXT,
  target_capture TEXT,
  at             TEXT NOT NULL,
  detail         TEXT,
  PRIMARY KEY (source_capture, address_norm, at)
);
CREATE INDEX IF NOT EXISTS link_verdicts_pair ON link_verdicts(source_capture, address_norm);

-- THE PRODUCER/CONSUMER BOUNDARY, and it is a safety property rather than a
-- transport detail. Bob RULED that an undetermined-authority capture creates a
-- task automatically at capture. If the capture path wrote the task directly
-- then a leaked capture credential could put arbitrary assignees, forged
-- history and chosen subjects in front of a member. It cannot: the capture path
-- reaches only this table, every field here is already bounded at enqueue, and
-- nothing here names an assignee, a status or an actor because those are not
-- the producer's to say.
--
-- A table rather than a Cloudflare Queue, deliberately. Everything stays inside
-- the Durable Object and therefore inside the audit model, which is the same
-- reasoning that keeps the store in the DO. A Queue would buy cross-instance
-- fan-out that a sovereign single-instance record does not want.
--
-- Keyed on (kind, capture_sha) so a noisy re-capture loop cannot flood the
-- queue: re-enqueuing the same capture is a no-op, and the consumer folds the
-- event into the open task rather than spawning a duplicate. capture_sha and
-- NOT a bundle id, because at the moment of capture no bundle exists yet: the
-- consumer resolves the sha through the register once the capture is filed, and
-- an event whose capture has not been promoted simply waits.
CREATE TABLE IF NOT EXISTS task_queue (
  kind        TEXT NOT NULL,
  capture_sha TEXT NOT NULL,
  subject     TEXT NOT NULL,
  locator     TEXT,
  enqueued    TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_try    TEXT,
  PRIMARY KEY (kind, capture_sha)
);

-- The counter the archive fallback will consume. Built BEFORE the fallback
-- exists, and built to exclude governed refusals from the first line, because
-- discovering the exclusion after a spurious fallback would mean we had already
-- fetched from the Internet Archive because WE paced ourselves.
--
-- The distinction this table exists to hold: an outcome the SOURCE produced (a
-- real 4xx or 5xx from the origin, a network failure reaching it) is evidence
-- about the source. Our own governor declining to ask is not evidence about
-- anything except our politeness. Only the first kind moves
-- consecutive_failures.
--
-- governed_refusals is counted anyway, in its own column, rather than dropped.
-- A number that is deliberately excluded from a decision should still be
-- visible, or the exclusion cannot be audited and a future reader cannot tell a
-- source nobody could reach from a source nobody asked.
--
-- Keyed on address_norm, the same normalised document address captured_locators
-- keys on, so reachability is a property of the DOCUMENT rather than of a host:
-- one page can be gone while the rest of a site answers.
CREATE TABLE IF NOT EXISTS source_reachability (
  address_norm         TEXT PRIMARY KEY,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  attempts             INTEGER NOT NULL DEFAULT 0,
  failures_total       INTEGER NOT NULL DEFAULT 0,
  governed_refusals    INTEGER NOT NULL DEFAULT 0,
  last_success         TEXT,
  last_failure         TEXT,
  last_outcome         TEXT,
  last_status          INTEGER,
  first_failure_since  TEXT,
  updated_at           TEXT
);
CREATE INDEX IF NOT EXISTS source_reach_failing ON source_reachability(consecutive_failures);

-- CAP-4: the verdict on a REUSED subresource, APPENDED and dated, never
-- overwritten, the same append-only discipline link_verdicts follows and for the
-- same reason: a verdict that changed is itself a fact about the record, so the
-- current answer is the newest row and the older rows are how anyone tells
-- whether it was always this answer.
--
-- Two producers write here, and the phase column says which. POSTHOC detection
-- is free and unconditional (CAPTURE-SCALING item 6a): when a later direct
-- capture of a host fetches an asset whose bytes differ from the stored ones,
-- every earlier capture that REUSED the old bytes is named here as 'changed' at
-- zero request cost. RATIFY re-fetches every reused part with a PLAIN GET
-- (item 6b/6c) -- our own SHA-256 over what we received is the evidence, where a
-- 304 would be only the origin's assertion -- and records one of four outcomes:
--   confirmed      the re-fetch matched the reused bytes; the strongest claim.
--   changed        the source now serves something else; ratified with the bytes
--                  captured on the day, the divergence a dated fact.
--   unavailable    the source no longer answers; ratified with the bytes
--                  captured, the record now holding what nobody can re-fetch.
--   not_attempted  the invocation's re-fetch budget (the calibrated capture_limits
--                  ceiling, item 6d) could not reach this part; recorded WITH its
--                  reason, never silently omitted.
-- All four are valid ratifications. What is forbidden is ratifying with a reused
-- part and saying nothing: the mandatory part is the ATTEMPT and the RECORD, not
-- the agreement. source_capture is the primary_sha of the capture that reused the
-- part; bundle_id is set for a ratify verdict and null for a posthoc one, which
-- happens at capture time when no bundle exists yet.
CREATE TABLE IF NOT EXISTS reuse_verdicts (
  source_capture TEXT NOT NULL,
  bundle_id      TEXT,
  host           TEXT NOT NULL,
  address_norm   TEXT NOT NULL,
  phase          TEXT NOT NULL,
  verdict        TEXT NOT NULL,
  reused_sha     TEXT NOT NULL,
  observed_sha   TEXT,
  basis          TEXT NOT NULL,
  at             TEXT NOT NULL,
  PRIMARY KEY (source_capture, address_norm, phase, at)
);
CREATE INDEX IF NOT EXISTS reuse_verdicts_bundle ON reuse_verdicts(bundle_id);
CREATE INDEX IF NOT EXISTS reuse_verdicts_pair ON reuse_verdicts(source_capture, address_norm);


-- D-64: the instance's DAILY RENDER ALLOWANCE, spent by the render arm of
-- op=acquire (CLIENT-RENDERED.md, RULED 2026-09-23 by BOB #32 item 3). One row
-- per UTC day. spent_ms is browser time the renderer REPORTED, so it is the
-- renderer's claim summed, not a platform meter. deferred counts the renders
-- this instance declined because the allowance was spent: a deferral is a
-- recorded fact, never a silent fall-back to filing the shell as the content.
-- An operational fact about this instance, not corpus-derived.
-- D-492: reserved_ms is browser time COMMITTED to renders now in flight and not
-- yet reported. spent_ms alone could not bound the allowance, because a render
-- runs in the Worker and reports its cost afterwards, so every render in flight
-- at once was admitted against one spent_ms. A render reserves its maximum cost
-- at admission and releases the reservation when it reports, so the figure the
-- admission test reads is spent_ms + reserved_ms. A render that never reports
-- stays charged for the day: the allowance is then UNDER-used, which is the
-- direction that cannot overrun. Added to an existing store by the additive
-- pass (CAPTURE_ADDITIVE_COLUMNS, Capture#migrate), so a store written before D-492 reads 0.
CREATE TABLE IF NOT EXISTS render_allowance (
  day        TEXT PRIMARY KEY,
  spent_ms   INTEGER NOT NULL DEFAULT 0,
  reserved_ms INTEGER NOT NULL DEFAULT 0,
  renders    INTEGER NOT NULL DEFAULT 0,
  deferred   INTEGER NOT NULL DEFAULT 0,
  last_at    TEXT NOT NULL
);

-- D-520: THE RENDERS RUNNING NOW, one row per admitted render, so the
-- instance can CAP how many run at once (CLIENT-RENDERED.md, RULED by BOB #33:
-- a concurrency cap from the vendor's stated limit, labelled; over the cap a
-- render WAITS). render_allowance is an ACCOUNT of browser time and cannot say
-- how many are in flight. A slot is released when its render reports, and
-- EXPIRES at its admission plus its reservation (the most time the asked
-- environment permits it), so a render that never reports cannot hold a slot
-- for ever. An operational fact about this instance, not corpus-derived.
CREATE TABLE IF NOT EXISTS render_slots (
  slot        TEXT PRIMARY KEY,
  admitted_at TEXT NOT NULL,
  expires_ms  INTEGER NOT NULL
);
`;

/* D-340 / D-702 (R28, R29): the host's navigation, DERIVED per host and regenerable by scan of `links` joined to
   the provenance receipts (`captured_locators`, provenance R48's read contract). One `site_chrome` row per distinct
   navigation of a host (its fingerprint is the digest of the sorted chrome addresses), one `site_chrome_refs` row
   per direct capture of the host that carried chrome, and one `link_chrome` row per contained address with its
   classification: `chrome` only when it recurred on two or more distinct pages of the host, else `undetermined`,
   with its basis and the date it was judged. A classification, never a deletion: every link stays filed. */
export const CAPTURE_DERIVED_SCHEMA = `
CREATE TABLE IF NOT EXISTS site_chrome (
  host           TEXT NOT NULL,
  fingerprint    TEXT NOT NULL,
  links          TEXT NOT NULL,
  first_observed TEXT NOT NULL,
  last_observed  TEXT NOT NULL,
  captures       INTEGER NOT NULL,
  PRIMARY KEY (host, fingerprint)
);
CREATE TABLE IF NOT EXISTS site_chrome_refs (
  host           TEXT NOT NULL,
  source_capture TEXT NOT NULL,
  page           TEXT NOT NULL,
  first_observed TEXT NOT NULL,
  last_observed  TEXT NOT NULL,
  fingerprint    TEXT NOT NULL,
  basis          TEXT NOT NULL,
  PRIMARY KEY (host, source_capture, page)
);
CREATE INDEX IF NOT EXISTS site_chrome_refs_host ON site_chrome_refs(host, first_observed);
CREATE TABLE IF NOT EXISTS link_chrome (
  host         TEXT NOT NULL,
  address_norm TEXT NOT NULL,
  state        TEXT NOT NULL,
  pages        INTEGER NOT NULL,
  basis        TEXT NOT NULL,
  at           TEXT NOT NULL,
  PRIMARY KEY (host, address_norm)
);
-- R73 (acquisition R22; N140, K287): the validators a filed direct capture's own fetch was served with, so a later request for the
-- same document address can be fetched conditionally against the capture the record already holds. One row per
-- (document address, capture); a column the source did not send is NULL. Evidence of what the source said about
-- ITS bytes, never used to name a capture: a 304 answered against these files no capture (acquisition R22).
CREATE TABLE IF NOT EXISTS capture_validators (
  address_norm  TEXT NOT NULL,
  capture_sha   TEXT NOT NULL,
  etag          TEXT,
  last_modified TEXT,
  at            TEXT NOT NULL,
  PRIMARY KEY (address_norm, capture_sha)
);
-- acquisition R16, R69: each member this module stamped as capturing a capture (a member session's acquire, an upload, and doorbell R13's pull of a knock).
-- Several members who captured the same bytes are each its actor. Written once per pair, never removed but by purge.
CREATE TABLE IF NOT EXISTS capture_actors (
  capture_sha TEXT NOT NULL,
  actor       TEXT NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (capture_sha, actor)
);
-- R69: a capturing member's signed account of when and how they captured it. Append-only.
CREATE TABLE IF NOT EXISTS capture_accounts (
  capture_sha TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  by          TEXT NOT NULL,
  text        TEXT NOT NULL,
  signature   TEXT NOT NULL,
  key_b64     TEXT NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (capture_sha, seq)
);
-- R68: late co-attestations, each outcome appended with its instant and what it proves (existence by then, not at
-- capture). Append-only.
CREATE TABLE IF NOT EXISTS late_attestations (
  capture_sha TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  service     TEXT,
  ok          INTEGER NOT NULL,
  at          TEXT NOT NULL,
  by          TEXT,
  outcome     TEXT NOT NULL,
  PRIMARY KEY (capture_sha, seq)
);
-- R79, R81 (DEC-97 (2)): setting held material aside and bringing it back, each act appended with its reason, who and
-- when, never rewritten or removed; a document's latest act decides whether it is set aside.
CREATE TABLE IF NOT EXISTS held_acts (
  bundle_id TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  act       TEXT NOT NULL,
  reason    TEXT NOT NULL,
  author    TEXT NOT NULL,
  at        TEXT NOT NULL,
  PRIMARY KEY (bundle_id, seq)
);
-- R79, R81, R84 (DEC-141; K1618, K1645): the questions a held act is recorded with: one row per (act, question), each a
-- question R83's reader answered as waiting on the document when it was set aside, and the same questions again on the
-- restore that undid that set-aside. Appended with its act, never rewritten or removed.
CREATE TABLE IF NOT EXISTS held_act_questions (
  bundle_id TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  question  TEXT NOT NULL,
  PRIMARY KEY (bundle_id, seq, question)
);
CREATE INDEX IF NOT EXISTS held_act_questions_q ON held_act_questions (question, bundle_id, seq);
-- R94 (T50; N1117; acquisition R47): the questions a member captured bytes for, through acquire's for: one row per
-- (capture, question, asker), written once at the first instant, never rewritten or removed but by purge. A stated
-- read contract, as links is (R57): a later module may join it in its own SQL, and this module changes none of its
-- columns' names or meaning without a change to R94. capture_sha is the digest of the capture; question the
-- question's id as the member gave it (this module decides nothing about it, R94); asker the member's id (R69's
-- spelling, no member: prefix); at the whole-second UTC instant first recorded.
CREATE TABLE IF NOT EXISTS captured_for (
  capture_sha TEXT NOT NULL,
  question    TEXT NOT NULL,
  asker       TEXT NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (capture_sha, question, asker)
);
CREATE INDEX IF NOT EXISTS captured_for_question ON captured_for (question);
-- R104 (fix round 6; G2; K4562): a large capture fetched in the background and filed: one row per capture session, written once when
-- the delivery files the document, never rewritten or removed but by purge. A stated read contract for notice-producers, which tells
-- the opener once (fetchesDone). session the capture session id; document the filed document's bundle id; opener the member's
-- stamp (member:ID); project the project it was filed under, null for none; at the whole-second UTC instant it was recorded.
CREATE TABLE IF NOT EXISTS fetch_done (
  session  TEXT PRIMARY KEY,
  document TEXT NOT NULL,
  opener   TEXT NOT NULL,
  project  TEXT,
  at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fetch_done_at ON fetch_done (at, session);
-- R100 (T51 fix round 3; C9; Intake Doctrine section 8): the projects a held document was filed in as a REFERENCE: one row per
-- (capture, project), written once at the first instant, never rewritten or removed but by purge. A reference and not a second
-- home: the document keeps the one home provenance records (its R2), so no row here moves, copies or re-homes anything. A stated
-- read contract, as links is (R57): a later module may join it in its own SQL, and this module changes none of its columns' names or
-- meaning without a change to R100. capture_sha is the digest of the capture; project the project's id as the member's screen gave it
-- (this module decides nothing about it); by the member's id (R69's spelling, no member: prefix); at the whole-second UTC instant
-- first recorded.
CREATE TABLE IF NOT EXISTS seen_in (
  capture_sha TEXT NOT NULL,
  project     TEXT NOT NULL,
  by          TEXT NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (capture_sha, project)
);
CREATE INDEX IF NOT EXISTS seen_in_project ON seen_in (project);
-- R113 (fix round 9; G127f; K4891): a file sent in parts through the Worker is one upload session until it is completed or abandoned. One row per
-- upload: upload the id handed to the member's browser (this module's, never R2's); sha256 the whole file's digest as the member declared it at
-- the begin (the key of the object, verified at the completion against the digest of all the bytes hashed in order); bytes the declared size;
-- part_bytes the size of every part but the last; by the member's stamp, the only one who may put, complete or abort it; statement, name and
-- type what the begin was given, kept for the filing; r2 the id of R2's own multipart upload (null when the whole was already held); state
-- 'open' until R2's upload is completed, then 'completed' until the filing is done (a retry of the completion then files, and completes nothing
-- twice); parts the JSON list of the parts put so far, in order, each {sha256, etag, bytes}; hash_state the running SHA-256 of those parts in order (a few
-- hundred characters, written with the part that advanced it: G173), so the object taken out of memory between two parts loses nothing; created and expires
-- whole-second UTC instants. The row is removed when the upload is filed, aborted or expired; it holds no byte of the file.
CREATE TABLE IF NOT EXISTS parted_uploads (
  upload     TEXT PRIMARY KEY,
  sha256     TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  part_bytes INTEGER NOT NULL,
  by         TEXT NOT NULL,
  statement  TEXT NOT NULL,
  name       TEXT,
  type       TEXT,
  r2         TEXT,
  state      TEXT NOT NULL DEFAULT 'open',
  parts      TEXT NOT NULL DEFAULT '[]',
  hash_state TEXT,
  created    TEXT NOT NULL,
  expires    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS parted_uploads_expires ON parted_uploads (expires);
CREATE INDEX IF NOT EXISTS parted_uploads_by_sha ON parted_uploads (by, sha256)`;

/* Columns an older store's tables gained after they were first written, added at boot (never back-filled; each
   reason is where the column is read). Moved from the legacy store's additive list. */
export const CAPTURE_ADDITIVE_COLUMNS = [
  ["site_assets", "last_fetched_by", "TEXT"],        // CAP-14: which capture's fetch served a reused part
  ["site_asset_refs", "reused_from", "TEXT"],        // CAP-14
  ["render_allowance", "reserved_ms", "INTEGER NOT NULL DEFAULT 0"],   // D-492: 0 is the measured truth
  ["links", "chrome_basis", "TEXT"],                 // D-340: the region a contained link sat in
  ["parted_uploads", "hash_state", "TEXT"],          // G173: the running digest of the parts put so far, kept beside them
];

/* A derived table whose KEY changed shape is dropped and rebuilt rather than altered: `links` gained
   `citation_norm` when element references became part of a citation, and rows keyed without the fragment had
   already collapsed two citations into one (moved from the legacy store's reshape loop). */
export const CAPTURE_RESHAPE = [["links", "citation_norm"]];

/* record-core R21/R46: what purge clears (whole-store only: none is keyed to a bundle) and what it never clears.
   The exempt tables are operational facts about this instance (the platform's ceiling and the render allowance), not
   corpus-derived. The doorbell's tables are `doorbell`'s to declare (T43; N849, N864). */
export const CAPTURE_PURGED_TABLES = ["task_queue", "source_reachability", "link_verdicts", "links", "site_asset_refs",
  "site_assets", "reuse_verdicts", "capture_sessions", "site_chrome_refs", "site_chrome", "link_chrome", "capture_validators",
  "capture_actors", "capture_accounts", "late_attestations", "held_acts", "held_act_questions", "captured_for", "seen_in", "fetch_done", "parted_uploads"];
export const CAPTURE_EXEMPT_TABLES = ["capture_limits", "render_allowance", "render_slots"];
