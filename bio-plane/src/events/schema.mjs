/* events' tables (T33-26; `build/requirements/events.md`), created by `migrate` (index.mjs) at every boot, idempotently.
   Two objects, held apart (ladders §2 EVENTS): a DATED FACT is a document's own stated date; an EVENT is a happening
   one or more records attest. Nothing here holds an amount, an absence, a sequence or the group's own acts (R39, R41). */
export const EVENTS_SCHEMA = `
-- R1-R5: A DOCUMENT'S OWN DATE. Keyed by its digest over (capture, extent, source row, kind, value), so a repeat writes
-- nothing. bundle_id is the capture's home when it was held (the sight of the row, R40). grade is the capture's own
-- (R2), never a caller's. precision and zone are civil-time's; zone NULL when the view gave none.
CREATE TABLE IF NOT EXISTS dated_facts (
  dated_fact_id TEXT PRIMARY KEY,
  capture_sha   TEXT NOT NULL,
  bundle_id     TEXT,
  extent        TEXT NOT NULL,
  source_row    INTEGER,
  kind          TEXT NOT NULL,
  value         TEXT NOT NULL,
  precision     TEXT NOT NULL,
  zone          TEXT,
  method        TEXT NOT NULL,
  grade         TEXT,
  upper_bound   INTEGER NOT NULL DEFAULT 0,
  by_actor      TEXT,
  at            TEXT NOT NULL,
  question      TEXT
);
CREATE INDEX IF NOT EXISTS dated_facts_capture ON dated_facts(capture_sha, extent);
CREATE INDEX IF NOT EXISTS dated_facts_bundle ON dated_facts(bundle_id);
-- R6, R37: AN EVENT. alias_of is set when a merge absorbed it (R14): it then resolves to its kept event.
CREATE TABLE IF NOT EXISTS events (
  event_id   TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  status     TEXT NOT NULL,
  where_text TEXT,
  by_actor   TEXT,
  at         TEXT NOT NULL,
  alias_of   TEXT
);
CREATE INDEX IF NOT EXISTS events_kind ON events(kind);
-- R7: what attests an event: a held dated fact, a capture extent with no date of its own, or a member's testimony
-- (graded D). serves is 'event' (it attests the event) or 'relation' (it cites a relation, R17, and never governs
-- the event's when). bundle_id is the attesting capture's home, or the project a testimony is fenced in (NULL: group-wide).
CREATE TABLE IF NOT EXISTS event_attestations (
  attestation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id       TEXT NOT NULL,
  form           TEXT NOT NULL,
  serves         TEXT NOT NULL DEFAULT 'event',
  dated_fact_id  TEXT,
  capture_sha    TEXT,
  extent         TEXT,
  source_row     INTEGER,
  statement      TEXT,
  value          TEXT,
  precision      TEXT,
  zone           TEXT,
  bundle_id      TEXT,
  grade          TEXT,
  by_actor       TEXT,
  at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS event_attestations_event ON event_attestations(event_id, attestation_id);
CREATE INDEX IF NOT EXISTS event_attestations_bundle ON event_attestations(bundle_id);
CREATE INDEX IF NOT EXISTS event_attestations_capture ON event_attestations(capture_sha);
-- R6: what an event concerns: a registered entity or another event.
CREATE TABLE IF NOT EXISTS event_concerns (
  event_id TEXT NOT NULL,
  end_id   TEXT NOT NULL,
  by_actor TEXT,
  at       TEXT NOT NULL,
  PRIMARY KEY (event_id, end_id)
);
CREATE INDEX IF NOT EXISTS event_concerns_end ON event_concerns(end_id);
-- R11-R13, R37: who took part, in what role, on which attestation. A corrected row stays, superseded (R13).
CREATE TABLE IF NOT EXISTS event_participants (
  participant_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id         TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  role             TEXT NOT NULL,
  vote_value       TEXT,
  attestation_id   INTEGER NOT NULL,
  by_actor         TEXT,
  at               TEXT NOT NULL,
  superseded_by    INTEGER,
  superseded_actor TEXT,
  superseded_at    TEXT,
  superseded_why   TEXT
);
CREATE INDEX IF NOT EXISTS event_participants_entity ON event_participants(entity_id);
CREATE INDEX IF NOT EXISTS event_participants_event ON event_participants(event_id);
-- R17-R20: cited relations between two events. Withdrawn, never deleted (R20).
CREATE TABLE IF NOT EXISTS event_relations (
  relation_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  from_event       TEXT NOT NULL,
  to_event         TEXT NOT NULL,
  kind             TEXT NOT NULL,
  attestation_id   INTEGER NOT NULL,
  by_actor         TEXT,
  at               TEXT NOT NULL,
  withdrawn_actor  TEXT,
  withdrawn_at     TEXT,
  withdrawn_why    TEXT
);
CREATE INDEX IF NOT EXISTS event_relations_from ON event_relations(from_event);
CREATE INDEX IF NOT EXISTS event_relations_to ON event_relations(to_event);
-- R9, R10, R37: THE DERIVED when, rebuilt from the governing attestation in the transaction that changes it.
CREATE TABLE IF NOT EXISTS event_when_cache (
  event_id  TEXT PRIMARY KEY,
  start     TEXT,
  end       TEXT,
  precision TEXT,
  zone      TEXT,
  value     TEXT,
  attestation_id INTEGER
);
-- R8: each member's choice of the governing attestation, never erased.
CREATE TABLE IF NOT EXISTS event_choices (
  choice_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id       TEXT NOT NULL,
  attestation_id INTEGER NOT NULL,
  reason         TEXT,
  by_actor       TEXT,
  at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS event_choices_event ON event_choices(event_id, choice_id);
-- R21: an ACT- id held as an alias of one event.
CREATE TABLE IF NOT EXISTS event_aliases (
  alias    TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  by_actor TEXT,
  at       TEXT NOT NULL
);
-- R14, R25: what changed an event (a merge, a split, an import's changed source value), with who, when and why.
CREATE TABLE IF NOT EXISTS event_changes (
  change_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id  TEXT NOT NULL,
  kind      TEXT NOT NULL,
  other     TEXT,
  detail    TEXT,
  reason    TEXT,
  by_actor  TEXT,
  at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS event_changes_event ON event_changes(event_id, change_id);
CREATE INDEX IF NOT EXISTS event_changes_other ON event_changes(other);
-- R22, R25, R38: a source row a following import wrote, by its source-native key, so a re-import is idempotent.
CREATE TABLE IF NOT EXISTS event_sources (
  source_key  TEXT PRIMARY KEY,
  target      TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  facts       TEXT NOT NULL,
  capture_sha TEXT NOT NULL,
  at          TEXT NOT NULL
);
-- R43-R45, R47, R48 (T35): A USE OF A POWER's facet, one row beside its event (kind discretion, waiver or assessment).
-- The provision is an opaque standards key (standard, portion). reason_stated is 1 for a cited reason, 0 for "none"
-- (NULL for an assessment). reason, outcome_cite, scope and each of conditions are cited passages
-- {capture_sha, bundle_id, extent, content_id}; expiry a civil-time date-time. Never edited: withdrawn, never deleted.
CREATE TABLE IF NOT EXISTS event_uses (
  event_id           TEXT PRIMARY KEY,
  kind               TEXT NOT NULL,
  provision_standard TEXT,
  provision_portion  TEXT,
  reason_stated      INTEGER,
  reason             TEXT,
  outcome            TEXT,
  outcome_cite       TEXT,
  scope              TEXT,
  conditions         TEXT,
  expiry             TEXT,
  question           TEXT,
  by_actor           TEXT,
  at                 TEXT NOT NULL,
  withdrawn          INTEGER NOT NULL DEFAULT 0,
  withdrawn_actor    TEXT,
  withdrawn_at       TEXT,
  withdrawn_why      TEXT
);
CREATE INDEX IF NOT EXISTS event_uses_provision ON event_uses(provision_standard, provision_portion);
CREATE INDEX IF NOT EXISTS event_uses_kind ON event_uses(kind, withdrawn);
-- R44, R47: an assessment's standards found unmet, each with the cited passage stating it.
CREATE TABLE IF NOT EXISTS event_unmet (
  unmet_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id           TEXT NOT NULL,
  provision_standard TEXT NOT NULL,
  provision_portion  TEXT,
  cite               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS event_unmet_event ON event_unmet(event_id, unmet_id);
CREATE INDEX IF NOT EXISTS event_unmet_provision ON event_unmet(provision_standard, provision_portion);
-- R4: the capture classes whose readings' stated dates are held after read, changed only by an administrator's act.
CREATE TABLE IF NOT EXISTS event_read_optin (
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  classes  TEXT NOT NULL,
  by_actor TEXT NOT NULL,
  at       TEXT NOT NULL
);
`;

/* Columns added after a table's first release, added at boot to a store that predates them (R48, T35). */
export const EVENTS_ADDED_COLUMNS = Object.freeze([["dated_facts", "question", "TEXT"]]);
