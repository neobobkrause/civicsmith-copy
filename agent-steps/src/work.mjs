/* agent-steps — what each row does against the plane (R6–R20, R28–R40; moved from `agent-worker`). */
/* Requirement ids in the comments below are `agent-worker`'s, as they stood when this code moved (T51, K3850); `build/requirements/agent-steps.md` maps them to this module's. */
import { LEVELS, REPORTING_LEVEL, adjustedFrom, emptyLevelCandidates, planDedup, PLAN_READS, PROFILE_FACTS, planSubjectReads, earlierPlans, whyWithUndetermined, disagreementsToSettle } from "../../agent-harness/src/harness.mjs";
import { SUBSESSION_OPS, spawnContract, takeReports, citedAddresses, documentHoldings, holdingsNote } from "../../agent-harness/src/subsession.mjs";
import { BUNDLE_ID_RE } from "../../bio-plane/src/record-grammar/ids.mjs";
import { MEANING } from "../../bio-plane/src/query.mjs";
import { withRecordIds } from "./holdings.mjs";
import { MEANING_ARM, RESPONSE_ID } from "./names.mjs";
import { LOG_DETAIL_MAX } from "./entries.mjs";
import { planeAnswer, meaningRead } from "./plane.mjs";
import { runSubsessions, PARTIAL_MARK } from "./subsessions.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/** WHAT EACH ROW ACTUALLY DOES AGAINST THE PLANE. One `case` per row that has
 *  work, and rows that have none say so by falling through — the table already
 *  says what every row is FOR, and duplicating that here would be a second
 *  description to age. */
export async function performStep(call, state, runId, model = null, logSeq = null) {
  const out = { state, consume: {}, note: null };

  switch (state.step) {
    case "fanout": {
      /* THE FOUR-LEVEL FAN-OUT, ALL FOUR, IN LEVELS ORDER, ONE SUB-SESSION EACH.
         The count is the table's and not a judgement's: a run that searched
         three levels and reported on four is the false-coverage hazard this
         project keeps naming, and `LEVELS.length` is what makes it uncountable
         any other way.

         THE SPAWN PAYLOAD IS THE PLANE'S (PL-12). `op=airunspawn`'s search half
         has NO bias-manifest field by construction — not `bias: null`, no field
         at all — so the fence is the payload's shape rather than this member's
         discipline. Asking for it here rather than composing one is what makes
         that true at runtime and not only in `store.mjs`. */
      const contracts = [];
      for (const level of LEVELS) {
        const p = planeAnswer(await call("airunspawn", { run: runId, half: "search" }), "airunspawn");
        if (p.silent) return { silent: p.silent };
        /* D-276's CLASS, CLOSED-BY-CONSEQUENCE BEFORE AND NAMED NOW. A refused
           spawn used to fall through with `payload = null`, which `spawnContract`
           refuses as SPAWN_PAYLOAD_MISSING — so the run did stop, but it stopped
           saying *"the plane returned no search-half payload"* when what actually
           happened was that the plane REFUSED, for a reason it had named. A
           correct outcome reached by misreporting the cause is still a refusal
           this member re-worded. */
        if (p.refused) return { planeRefusal: p.refused, level };
        const payload = (p.result ?? {}).payload ?? null;

        /* FL-5's SPAWN CONTRACT. The payload is read key by key into a frozen
           brief for ONE level — never spread — so there is no field for a
           manifest to arrive in under any spelling, and two sub-sessions share
           no object with each other or with the parent.

           AND THE SECOND WITNESS IS NOW A REFUSAL RATHER THAN A FLAG, WHICH IS A
           CORRECTION FL-3's OWN SUITE COULD NOT HAVE CAUGHT. FL-3 computed
           `manifest_field_present` into a local that never reached the wire and
           asserted the fence by grepping a trace note that never carries the
           phrase — MEASURED at FL-5: with the plane mock's SEARCH payload made
           to carry a full bias block, FL-3's suite stayed 194/0 and its
           "no search-half spawn payload carried a bias field" arm PASSED. A
           mechanism believed on the strength of its existence rather than its
           behaviour is the defect this project meets most, so the flag is gone
           and `spawnContract` REFUSES the payload instead. */
        /* R97: the level's targets the plan judgement named (the model's `target`, an id with an optional extent) and the
           meaning arms `query-language` declares go into the brief beside the payload's subjects (agent-harness R12). */
        const made = spawnContract({ level, payload, arms: Object.keys(MEANING), targets: levelTargets(state, level) });
        if (!made.ok) return { contract: made, level };
        contracts.push(made.contract);
      }
      out.consume.subsessions = LEVELS.length;
      out.note = localize("agent-steps.work.length_sub_session_contract_s", "{length} sub-session contract(s) composed, one per level, each read-only ({SUBSESSION_OPS}) and with no field for the lens to arrive in", { length: String(contracts.length), SUBSESSION_OPS: String(SUBSESSION_OPS.join(", ")) });
      out.state = { ...state, contracts };

      /* agent-harness R7 — THE SUB-SESSIONS RUN, when model turns do: one per level, each its own conversation under its own
         contract, and each hands back a REPORT that `collect` holds to R20. */
      if (model) {
        /* R52: the reports of this pass a stopped segment took are held; only the levels without one are asked. */
        const held = (state.reports || []).filter((r) => r && typeof r === "object" && r[PARTIAL_MARK] === (Number(state.pass) || 0));
        const ran = await runSubsessions(call, out.state, runId, model, logSeq, contracts, held);
        if (ran.silent || ran.model || ran.stopped || ran.aiStop || ran.roleUnknown) return ran;
        if (ran.dropped.length) out.dropped = ran.dropped;
        out.state = { ...out.state, reports: ran.reports, scope: ran.scope,
                      reportsRefused: [...(out.state.reportsRefused || []), ...ran.refused] };
        out.note += localize("agent-steps.work.sub_session_s_reported_length", "; {reports} sub-session(s) reported, {refused} returned no report", { reports: String(ran.reports.length), refused: String(ran.refused.length) });
      }

      /* THE INTERNET LEVEL REQUESTS ACQUISITION AND DOES NOT PERFORM IT (§4
         group 1, PL-4). One request per internet target the judgement named, and
         each one spends a FETCH from the run's budget. */
      const fetches = (state.targets || []).filter((t) => t && t.level === "internet");
      /* NAMED, AND ALL OF THEM. This used to assign `out.refused` inside the
         loop, so two refused acquisition requests published ONE — the record
         holding fewer refusals than happened, which is the same class as
         D-276 pointing the other way. */
      const acqRefused = [];
      for (const t of fetches) {
        /* FL-12 — THE LOCATOR IS `address`, THE ONE FIELD THE PLANE READS (`captureRequest`:
           `String(args.address ?? "")`, then `isPublicHttpsLocator`). This sent `url`, which the plane
           never reads, so every request a run filed was refused `CAPTURE_REQUEST_NOT_PUBLIC` (C-28.2)
           naming "(none)" — measured by REC-168. The judgement's own field stays `url` (the model's
           vocabulary); the WIRE's is `address`. And the question a request is accountable to defaults
           to the run's target (FL-11's class, one call over): a request naming none is refused
           `CAPTURE_REQUEST_NOT_AN_INQUIRY`. */
        const r = planeAnswer(await call("capturerequest", null,
          { run: runId, target: t.target ?? state.target ?? null, address: t.url ?? null,
            /* R56: the request names the conversation that judged its target */
            ...(Array.isArray(t.produced_by) && t.produced_by.length ? { produced_by: t.produced_by } : {}) }), "capturerequest");
        if (r.silent) return { silent: r.silent };
        /* Already ANSWER-checked before D-276 — routed through `planeAnswer` so
           every refusal this member publishes carries the same three fields
           (code, C-number, the plane's own body) rather than two of them here
           and three of them at `suggest`. */
        if (r.refused) acqRefused.push(r.refused);
      }
      if (acqRefused.length) out.refused = acqRefused;
      if (fetches.length) out.consume.fetches = fetches.length;
      return out;
    }

    case "collect": {
      /* FL-5 / IS-9(a) — THE RETURN CONTRACT, ENFORCED AT THE ROW THAT COLLECTS.
         The four returns arrived as this row's judgement (the sub-sessions'
         reports when model turns run, the caller's on the stubbed path, as
         `judgement_source` states). Every one is held to
         `checkReport`: a REPORT with a citation, never documents.

         A REFUSED RETURN IS NOT DROPPED AND NEVER BECOMES AN ABSENCE. It is
         named, it is published, and its level is UNDETERMINED — because a
         contract violation that fell through to `LOOKED_ABSENT` would let a
         defect MANUFACTURE an empty-level claim, and §9's kind would then be
         written off a report the parent never accepted. */
      const { taken, refused } = takeReports(state.reports);

      /* AND THE PARENT RE-READS BY ADDRESS. §14b.1: *"the parent re-reads by
         address if it needs the bytes"* — a behaviour, not a promise, and the
         suite observes these reads arriving at the plane. It is the same one
         meaning reader `compose` uses: the sub-session hands back an ADDRESS and
         the parent resolves it itself, which is the whole trade the memory model
         is making. Bounded by `citedAddresses`, so a report cannot turn the
         parent's context into the reading it was supposed to replace. */
      /* R100: a cited address is a record id with an optional extent after it (`INFO-… ¶1`, `INFO-…#p1`), else a source
         address. Its record id is the part before the first space or `#`: the re-read and the document count use it,
         and an address that names no held record is read as the address it is. */
      const addresses = citedAddresses(taken);
      const idOf = new Map(addresses.map((a) => [a, splitAddress(a).id]));
      /* D-276: `reread` COUNTS READS THAT ANSWERED, never calls that were made.
         It used to climb once per address regardless of what came back, so a
         refused read was published as `citations_reread` — this member claiming
         to have gone back to the record when the record had said no. A count of
         attempts wearing the name of a count of reads is the same defect as the
         zero below, one field along. */
      let reread = 0;
      const rereadRefused = [];
      for (const [i, address] of addresses.entries()) {
        const record = idOf.get(address);
        const got = await meaningRead(call, { rows: MEANING_ARM, limit: 1, ids: [record] });
        if (got.silent) return { silent: got.silent };
        if (got.refused) rereadRefused.push(got.refused); else reread += 1;
        /* R114 (T50; N1195; K3602, K3637): THE READ IS TICKED AS IT IS MADE, before the next is begun: one entry in R26's
           form whose `detail` names the record, its place in the step's list and whether the plane answered or refused,
           and whose `read` field carries the same as data, so a screen draws "Reading {document} · {n} of {total}" from
           fields and parses no English. A refused re-read is ticked too, as refused. No score and no word of the model's. */
        const total = addresses.length;
        const outcome = got.refused ? "refused" : "answered";
        const ticked = await logSeq.tickEntry({
          level: "meaning", subject: "collect -> re-read", state: "LOOKED_INDETERMINATE", governed: false, condition: null,
          terminal: false, bound: null,
          detail: localize("agent-steps.work.re_read_record_v1_of", "re-read {record} ({v1} of {total}): the plane {v2}", { record: String(record), v1: String(i + 1), total: String(total), v2: String(got.refused
            ? `refused '${String(got.refused.code ?? "?")}'` : "answered") }).slice(0, LOG_DETAIL_MAX),
          read: { record, n: i + 1, total, outcome },
        }, { step: "collect", to: "compose" });
        if (ticked.silent) return { silent: ticked.silent };
        /* The plane ended the run by this tick: the segment is over, and no later read is made. */
        if (ticked.ended) return { state, consume: {}, note: null, planeEnded: ticked.ended };
      }

      /* D-220 — AND THE RUN COUNTS WHAT IT HOLDS IN DOCUMENTS, ITS VERSIONS AS
         VERSIONS (§3, consumer (3)). `reread` above counts READS, one per cited
         string, so sixty captures of one calendar cited by their sixty bundles are
         sixty reads — true — and would be sixty documents if anything took that
         figure as coverage, which is the false-coverage hazard `STORE-AS-CACHE.md`
         names arriving at the document level. The document's identity is the
         RECORD's: `op=versionchain` answers every version at an address off the
         `captured_locators ⋈ register` join (PL-10), and `documentHoldings` groups
         by the `address_norm` it answers with. Never by title or text.

         A citation names a held BUNDLE or an ADDRESS, and the run does not guess
         which: it asks the plane for the bundle first (`op=search`, `id:` — the
         gated, one-compiler read), and a bundle it finds is resolved to the source
         address its own bytes name; a citation that names no held bundle is read
         as the address it is. Every read goes through `planeAnswer`, so a refusal
         makes that citation's document UNDETERMINED and is published, never a zero. */
      const resolved = [];
      /* R115: the cited record ids the plane does not answer to the run's credential. */
      const fenced = [];
      for (const address of addresses) {
        const rid = idOf.get(address);
        const lookup = async (id) => {
          const f = planeAnswer(await call("search",
            { q: `id:"${id.replace(/"/g, "")}"`, limit: 1, facets: "none" }), "search");
          const h = f.result ? (Array.isArray(f.result.hits) ? f.result.hits : []).find((x) => x && x.bundle_id === id) || null : null;
          return { f, h };
        };
        let { f: found, h: hit } = await lookup(rid);
        if (!found.silent && !found.refused && !hit && rid !== address) ({ f: found, h: hit } = await lookup(address));
        if (found.silent) return { silent: found.silent };
        if (found.refused) { rereadRefused.push(found.refused); resolved.push({ citation: address, refused: found.refused }); continue; }
        /* R115 (T50; N1186; K3557; `credentials` R79, `membership` R149): A RUN DOES NOT GO AROUND THE FENCE OF ITS
           CREDENTIAL. A cited record id that `op=search` does not answer under the run's credential is absent as
           `membership` R44 answers a record outside the fence (or was never there: the two read alike), so it is no
           held document and gets no record id and no capture: it is UNDETERMINED, named in the step's note. Nothing
           this member builds widens the credential's reads (R37); it only declines to count what they did not answer.
           An address that is not a record id is read as the address it is (R100). */
        if (!hit && BUNDLE_ID_RE.test(rid)) {
          fenced.push(rid);
          resolved.push({ citation: address, refused: { at: "search", code: "RECORD_NOT_ANSWERED", check: null } });
          continue;
        }
        if (hit && !(typeof hit.source_locator === "string" && hit.source_locator.trim())) {
          resolved.push({ citation: address, bundle: hit.bundle_id, address: null, chain: null,
                          reason: localize("agent-steps.work.the_cited_record_names_no_source", "the cited record names no source address, so no version chain can hold it") });
          continue;
        }
        const target = hit ? hit.source_locator.trim() : address;
        const chain = planeAnswer(await call("versionchain", { address: target, limit: 1000 }), "versionchain");
        if (chain.silent) return { silent: chain.silent };
        if (chain.refused) { rereadRefused.push(chain.refused); resolved.push({ citation: address, refused: chain.refused }); continue; }
        resolved.push({ citation: address, bundle: hit ? hit.bundle_id : null, address: target, chain: chain.result });
      }
      /* R90: beside its `address_norm`, each held document carries the record id and capture a leg can be cited
         by, read off the same chains; compose's facts pass `holdings` on whole. A refused read has none (R21). */
      const holdings = withRecordIds(documentHoldings(resolved), resolved);
      if (rereadRefused.length) out.refused = rereadRefused;

      out.note = localize("agent-steps.work.length_report_s_taken_length", "{length} REPORT(s) taken, {length_2} REFUSED; {reread} of {length_3} citation(s) re-read BY ADDRESS{v1}; {holdingsNote}{v2}. No document was returned by a sub-session and none was loaded", { length: String(taken.length), length_2: String(refused.length), reread: String(reread), length_3: String(addresses.length), v1: String(rereadRefused.length
                  ? localize("agent-steps.work.and_length_read_s_could_not", ", and {length} read(s) could NOT be made — the plane refused '{code}', so what they would have answered is UNREAD rather than empty", { length: String(rereadRefused.length), code: String(rereadRefused[0].code ?? "?") })
                  : ""), holdingsNote: String(holdingsNote(holdings)), v2: String(fenced.length
                  ? localize("agent-steps.work.length_cited_record_s_ids_are", "; {length} cited record(s) ({ids}) are not answered to the run's credential, so each is UNDETERMINED and none is held", { length: String(fenced.length), ids: String(fenced.slice(0, 5).map((f) => `'${f}'`).join(", ")) })
                  : "") });
      out.state = { ...state, reports: taken, rereads: (state.rereads || 0) + reread,
                    reportsRefused: [...(state.reportsRefused || []), ...refused], holdings };
      return out;
    }

    case "compose": {
      /* QUERY, NEVER LOAD (§14b.1). The run holds the inquiry, its versions and
         its working set; everything else it reaches by ASKING. This is PL-9's
         `op=meaningrows` — D-222 option C, the SAME query compiler read at
         meaning grain — CONSUMED and not rebuilt. There is no second reader in
         this Worker and there must not be: D-15's one compilation point is what
         makes the viewer gate a gate. */
      const read = await meaningRead(call, { q: state.q || "", rows: MEANING_ARM, limit: 50 });
      if (read.silent) return { silent: read.silent };

      /* §9's EMPTY-LEVEL KIND, ADDED BY THE TABLE. The model said what it
         observed at each level; `emptyLevelCandidates` decides that an observed
         absence is written down, and it is deterministic for the reason its own
         header gives — if emitting it were judged, the one run the instrument
         exists to catch is the run that would not emit it. */
      const reported = emptyLevelCandidates(state, state.target ?? null);
      /* R104: the meaning level is the one level this step reads, so a report of it EMPTY stands only when that read
         holds no row for the run's target. A row for it contradicts the report, and a read that gave no rows cannot
         confirm it; either way no candidate is composed, and the tick's log says which. */
      const rowsForTarget = Array.isArray(read.result?.rows)
        ? read.result.rows.filter((r) => r && r.bundle_id === (state.target ?? null)).length : null;
      const unconfirmed = rowsForTarget === 0 ? null : (rowsForTarget === null ? "unread" : "contradicted");
      const empties = unconfirmed ? reported.filter((c) => c.level !== REPORTING_LEVEL.meaning) : reported;
      const candidates = [...(state.candidates || []), ...empties];
      const wronged = reported.length - empties.length;
      if (wronged) out.logEntries = [{
        level: "meaning", subject: "compose -> level-empty candidate dropped", state: "LOOKED_INDETERMINATE",
        governed: false, condition: null, terminal: false, bound: null,
        detail: (unconfirmed === "contradicted"
          ? localize("agent-steps.work.the_sub_session_reported_the", "the sub-session reported the meaning level empty, but this step's read of it holds {rowsForTarget} row(s) for the question: the report is contradicted by the read, so 'level-empty-{meaning}' is not composed", { rowsForTarget: String(rowsForTarget), meaning: String(REPORTING_LEVEL.meaning) })
          : localize("agent-steps.work.the_sub_session_reported_the_2", "the sub-session reported the meaning level empty, but this step's read of it gave no rows to confirm that, so 'level-empty-{meaning}' is not composed", { meaning: String(REPORTING_LEVEL.meaning) })).slice(0, LOG_DETAIL_MAX),
      }];

      /* D-276 — THREE OUTCOMES, THREE SENTENCES, AND THE RUN NOTE IS RECORD.
         "the record was not asked", "the record answered and said nothing about
         its shape" and "the record holds N rows" are three different facts and
         only one of them may be written as a zero. What was here computed
         `Array.isArray(got.rows) ? got.rows.length : 0` off a body that had not
         been checked, so all three collapsed into the third — and a REFUSAL
         became the confident sentence `0 meaning-grain row(s) queried`. */
      let said;
      if (read.refused) {
        out.refused = read.refused;
        said = localize("agent-steps.work.the_meaning_layer_was_not", "the meaning layer was NOT READ — the plane refused '{String}'{v1}, so this run knows NOTHING about meaning-grain rows for this query and does not report zero of them", { String: String(String(read.refused.code ?? "?")), v1: String(read.refused.check ? ` (${read.refused.check})` : "") });
      } else if (!Array.isArray(read.result?.rows)) {
        /* UNDETERMINED IS FIRST-CLASS AND IS STATED. This branch is the one that
           makes the note honest even if the refusal check above is ever weakened:
           an answer with no rows collection is NOT zero rows, and the old
           `Array.isArray(got.rows) ? got.rows.length : 0` said it was. */
        said = localize("agent-steps.work.how_many_meaning_grain_row_s", "how many meaning-grain row(s) the record holds for this query is UNDETERMINED — the plane answered without a rows collection this member could read");
      } else {
        said = localize("agent-steps.work.length_meaning_grain_row_s", "{length} meaning-grain row(s) queried at the '{MEANING_ARM}' grain", { length: String(read.result.rows.length), MEANING_ARM: String(MEANING_ARM) });
      }
      out.note = localize("agent-steps.work.said_no_document_was_loaded", "{said}; no document was loaded. {length} level(s) observed EMPTY and written down as §9's kind{v1}", { said: String(said), length: String(empties.length), v1: String(wronged ? localize("agent-steps.work.wronged_reported_empty_and_state", "; {wronged} reported empty and {state}, so not written down", { wronged: String(wronged), state: String(unconfirmed === "contradicted" ? localize("agent-steps.work.contradicted_by_the_read", "contradicted by the read") : localize("agent-steps.work.not_confirmed_by_the_read", "not confirmed by the read")) }) : "") });
      /* R116 (T50; N1187; K3557; `agent-harness` R19): A DISAGREEMENT BETWEEN LEVELS IS STATED AND READ ONCE, NEVER LOOPED.
         For each (record, levels) pair the judgement named that the table has not settled (`disagreementsToSettle`, once
         per pair per run, whatever the pass or segment), the record is read at passage grain through the one reader
         (R19) and one entry says which levels disagree about which record and whether the read answered (with the
         number of passages) or was refused (`unread`); the pair rides in the entry as data (`disagree`), so a screen
         parses no English. No candidate, pass or bound is touched by it, and the model is asked nothing more. */
      const pairs = disagreementsToSettle(state);
      const statements = [];
      for (const pair of pairs) {
        const got = await meaningRead(call, { rows: "passage", limit: 50, ids: [pair.record] });
        if (got.silent) return { silent: got.silent };
        const n = Array.isArray(got.result?.rows) ? got.result.rows.length : null;
        const named = pair.levels.join(" and ");
        statements.push({
          level: pair.levels[0], subject: "compose -> levels disagree", state: "LOOKED_INDETERMINATE", governed: false,
          condition: null, terminal: false, bound: null,
          detail: localize("agent-steps.work.named_disagree_about_record_v1", "{named} disagree about {record}: {v1}", { named: String(named), record: String(pair.record), v1: String(got.refused
            ? localize("agent-steps.work.the_record_was_unread_the_plane", "the record was unread (the plane refused '{code}')", { code: String(got.refused.code ?? "?") })
            : n === null ? localize("agent-steps.work.the_record_was_read_and_the", "the record was read, and the plane answered without a list of passages this member could count")
            : localize("agent-steps.work.the_record_was_read_at_passage", "the record was read at passage grain ({n} passage(s))", { n: String(n) })) }).slice(0, LOG_DETAIL_MAX),
          disagree: { record: pair.record, levels: [...pair.levels] },
        });
        if (got.refused) out.refused = [...(Array.isArray(out.refused) ? out.refused : out.refused ? [out.refused] : []), got.refused];
      }
      if (statements.length) {
        out.logEntries = [...(out.logEntries || []), ...statements];
        out.note += localize("agent-steps.work.disagreement_s_between_levels_stated", "; {length} disagreement(s) between levels stated and each record read once at passage grain", { length: String(statements.length) });
      }
      out.state = { ...state, candidates };
      return out;
    }

    case "dedup": {
      /* DEDUP BEFORE THE WRITE, against what the record already holds. The
         plane checks differs-in-substance too (PL-3's check 3) and that is the
         fence; this is the run doing its own arithmetic first so it does not
         spend a write path to be told something it could have known. Both are
         wanted: §14b.5 is explicit that the run verifies its own work BEFORE
         proposing and that the checks are nevertheless the PLANE'S. */
      const held = planeAnswer(await call("basisversions", { id: state.target || "", limit: 50 }),
                               "basisversions");
      if (held.silent) return { silent: held.silent };
      const proposed = (state.candidates || []).length;
      /* D-276's CLASS, and this site is the one where it cost more than a
         sentence. A refused `op=basisversions` used to leave `names` EMPTY, so
         the note said every candidate had been *"compared against 0 on the
         record"* and every one *"survived"* — a comparison that never happened,
         written down as a comparison against an empty record. The run still goes
         on to submit, because PL-3's check 3 is the fence and this arithmetic
         was only ever the run saving itself a write path; what it may NOT do is
         say it compared. */
      if (held.refused) {
        out.refused = held.refused;
        out.note = localize("agent-steps.work.the_records_own_versions_could", "the record's own versions could NOT be read — the plane refused '{String}'{v1}, so this run compared its {proposed} candidate(s) against NOTHING and says so rather than reporting them all as new. PL-3's check 3 is still the fence", { String: String(String(held.refused.code ?? "?")), v1: String(held.refused.check ? ` (${held.refused.check})` : ""), proposed: String(proposed) });
        out.state = { ...state, queue: [...(state.candidates || [])] };
        return out;
      }
      const body = held.result ?? {};
      const versions = Array.isArray(body.versions) ? body.versions : [];
      const names = new Set(versions.map((v) => String(v && v.name ? v.name : "")).filter(Boolean));
      /* FL-11: the read above is of the RUN's target, so it can only rule on candidates aimed THERE. A
         candidate naming another question was compared against nothing and says so — it survives to the
         plane, which bounds it — rather than being filtered against another question's versions. */
      const aimedHere = (c) => (c.target ?? state.target ?? null) === (state.target ?? null);
      const elsewhere = (state.candidates || []).filter((c) => c && !aimedHere(c)).length;
      const droppedHere = (state.candidates || []).filter((c) => c && aimedHere(c) && names.has(String(c.name ?? "")));
      const queue = (state.candidates || []).filter((c) => c && (!aimedHere(c) || !names.has(String(c.name ?? ""))));
      /* R101: a drop is a look the log must hold, not only the trace: one LOOKED_INDETERMINATE entry per level, at the
         dropped candidate's level (the observation log's spelling of the candidate's), naming each dropped name. A
         candidate that states no level has none to be logged at and stays in the note alone. */
      /* R105: a held version this run wrote itself says so, with the pass that wrote it, rather than reading as someone else's. */
      const mine = (n) => (state.written || []).find((w) => w.name === n) ?? null;
      const ofRun = (n) => (mine(n) ? localize("agent-steps.work.written_by_this_run_in", " (written by this run in pass {pass})", { pass: String(mine(n).pass) }) : "");
      /* R108: a candidate whose level is none of the four is dropped and logged too, at the `meaning` level (the look
         dedup itself makes is of the question), its detail saying it states no level. */
      const byLevel = new Map();
      for (const c of droppedHere) {
        const level = LEVELS.find((l) => REPORTING_LEVEL[l] === c.level) ?? "meaning";
        const n = String(c.name ?? "");
        byLevel.set(level, [...(byLevel.get(level) || []),
          localize("agent-steps.work.n_v1_ofrun_matching_the", "'{n}'{v1}{ofRun}, matching the held version of that name", { n: String(n), v1: String(LEVELS.some((l) => REPORTING_LEVEL[l] === c.level) ? "" : " (stating no level)"), ofRun: String(ofRun(n)) })]);
      }
      if (byLevel.size) out.logEntries = [...byLevel].map(([level, named]) => ({
        level, subject: "dedup -> candidate dropped", state: "LOOKED_INDETERMINATE", governed: false, condition: null,
        terminal: false, bound: null,
        detail: localize("agent-steps.work.dropped_before_any_write_named", "dropped before any write: {named} already held on the question", { named: String(named.join(", ")) }).slice(0, LOG_DETAIL_MAX),
      }));
      out.note = localize("agent-steps.work.proposed_candidate_s_compared_against", "{proposed} candidate(s) compared against {size} on the record; {length} survived{v1}{v2}", { proposed: String(proposed), size: String(names.size), length: String(queue.length), v1: String(droppedHere.length ? localize("agent-steps.work.already_held_dropped_length", "; {length} already held, dropped ({names})", { length: String(droppedHere.length), names: String(droppedHere.map((c) => `'${String(c.name ?? "")}'${ofRun(String(c.name ?? ""))}`).join(", ")) }) : ""), v2: String(elsewhere ? localize("agent-steps.work.named_a_question_other_than_the", "; {elsewhere} named a question other than the run's target and were NOT compared", { elsewhere: String(elsewhere) }) : "") });
      out.state = { ...state, queue };
      return out;
    }

    case "submit": {
      /* ONE CANDIDATE, OFF THE HEAD OF THE QUEUE, AS FORMED (§14b.7). Versions
         are written as they are FORMED rather than in one batch at the end, so a
         run that dies halfway does not lose what it found. There is no batch
         shape here to write one. */
      const queue = [...(state.queue || [])];
      const candidate = queue.shift();
      if (!candidate) return out;
      /* FL-11: a candidate that names no target lands on the RUN's (`runContextTarget`); one that names
         its own keeps it, and the plane bounds it (SUGGEST_OUTSIDE_RUN_CONTEXT, C-27.19) — this member
         does not pre-judge that refusal, it routes it to ADJUST like any other. */
      const res = await call("suggest", null,
        { ...candidate, target: candidate.target ?? state.target ?? null, run: runId });
      if (!res.reached) return { silent: res };
      const answer = res.body?.result ?? res.body ?? {};
      /* R24, R43 — D-276's class: a refusal nested in `result` states `ok: false`, with or without `wrote`. */
      if (res.status === 200 && res.body?.ok === true && answer.ok !== false && answer.wrote !== false) {
        out.submitted = true;
        out.note = `wrote '${String(candidate.name ?? "")}'`;
        /* R105: the write is a look the log holds: its name, its level and the pass that wrote it; the state keeps it
           (this run's, not the record's) so a later pass's dedup drop can name it. */
        const name = String(candidate.name ?? "");
        const pass = Number(state.pass) + 1;
        const level = LEVELS.find((l) => REPORTING_LEVEL[l] === candidate.level);
        if (level) out.logEntries = [{
          level, subject: "submit -> candidate written", state: "LOOKED_INDETERMINATE", governed: false, condition: null,
          terminal: false, bound: null, detail: localize("agent-steps.work.wrote_name_at_level_level", "wrote '{name}' at level {level} in pass {pass}", { name: String(name), level: String(level), pass: String(pass) }).slice(0, LOG_DETAIL_MAX),
        }];
        out.state = { ...state, queue, refusal: null, submission: candidate,
                      written: [...(state.written || []), { name, level: level ?? null, pass }] };
        return out;
      }
      /* F10's OTHER HALF, OBSERVED RATHER THAN ASSUMED. PL-3 answers a verbatim
         resubmit with `repeated: true` and a climbed `repeats` counter WITHOUT
         re-running the six checks. This table exists to keep that counter at
         zero, so when it is not zero this member says so on the wire instead of
         letting the budget discover it later. */
      if (answer.repeated === true) out.verbatim = true;
      out.refused = { at: "suggest", code: answer.code ?? answer.reason ?? null,
                      repeated: answer.repeated === true, repeats: answer.repeats ?? 0,
                      /* THE PLANE'S WORDS, UNCHANGED. This member re-words no
                         refusal: the code, the C-number and the DEC-49 canned
                         translation are the plane's. */
                      plane: answer };
      out.note = localize("agent-steps.work.refused_string_routing_to_adjust", "refused '{String}' — routing to ADJUST, never to a retry", { String: String(String(answer.code ?? answer.reason ?? "?")) });
      out.state = { ...state, queue, refusal: answer, submission: candidate };
      return out;
    }

    case "adjust": {
      /* F10's PRECONDITION IS ANSWERED HERE AND ENFORCED IN THE TABLE. The
         judgement has already run for this row (it is a judged row), so
         `state.submission` is whatever the model handed back. Whether that is a
         CHANGE is not the model's word for it — `adjustedFrom` compares the two
         canonically, and an unchanged submission sets `adjusted: false`, which
         `nextStep` turns into a DROPPED candidate rather than a resend. */
      const changed = adjustedFrom(state.refusedSubmission ?? null, state.submission ?? null);
      const queue = [...(state.queue || [])];
      if (changed) queue.unshift(state.submission);
      out.note = changed
        ? localize("agent-steps.work.the_submission_was_changed", "the submission was changed in answer to the refusal")
        : localize("agent-steps.work.the_refusal_could_not_be_submission", "the refusal could not be answered by changing the submission; the candidate is dropped");
      out.state = { ...state, adjusted: changed, queue };
      return out;
    }

    default:
      return out;
  }
}

/** R50–R52 — WHAT EACH ROW OF `PLAN_FLOW` DOES AGAINST THE PLANE. `read` and `dedup` read; `submit` makes the one
 *  write mode `plan` has, `op=optionpropose`; `adjust` is F10 unchanged. No row spawns, requests a capture, suggests
 *  a version or fetches (R50, R53). */
export async function performPlanStep(call, state, runId) {
  const out = { state, consume: {}, note: null };
  switch (state.step) {
    case "read": {
      /* R51 — UNDER THE RUN'S CREDENTIAL AND NOTHING ELSE. A refused or silent read is UNDETERMINED, carried into every
         proposal's `why`, never an absence and never the segment's end: the plan is proposed to on what could be read. */
      const reads = [], undetermined = [];
      const ask = async ({ op, query }) => {
        const got = planeAnswer(await call(op, query), op);
        const id = Object.values(query || {}).filter((v) => v != null && v !== "").join(" ") || null;
        if (got.silent) { undetermined.push({ op, id, code: null, why: localize("agent-steps.work.the_plane_did_not_answer", "the plane did not answer") }); return null; }
        if (got.refused) { undetermined.push({ op, id, code: got.refused.code ?? null, check: got.refused.check ?? null }); return null; }
        reads.push({ op, query, answer: got.result });
        return got.result;
      };
      let planDoc = null, earlier = [];
      if (!state.planId) undetermined.push({ op: "plan", id: null, code: null, why: localize("agent-steps.work.the_run_names_no_plan", "the run names no plan") });
      else {
        const answered = await ask(PLAN_READS.plan(state.planId));
        planDoc = answered && typeof answered === "object" ? (answered.plan ?? answered) : null;
      }
      const project = planDoc && typeof planDoc.project === "string" && planDoc.project ? planDoc.project : null;
      if (project) {
        const plans = await ask(PLAN_READS.plans(project));
        /* The earlier plans of the SAME project only: another project's plan is never read, and the run's own plan
           is the one read above. */
        earlier = plans ? earlierPlans(plans, project, state.planId) : [];
      } else if (planDoc) undetermined.push({ op: "plans", id: null, code: null, why: localize("agent-steps.work.the_plan_names_no_project", "the plan names no project") });
      for (const r of planDoc ? planSubjectReads(planDoc) : [PLAN_READS.profile()]) {
        const answered = await ask(r);
        if (r.op !== "profiles" || !answered) continue;
        const view = answered.view && typeof answered.view === "object" ? answered.view : answered;
        for (const fact of PROFILE_FACTS)
          if (!(fact in view)) undetermined.push({ op: "profiles", id: fact, code: null,
                                                   why: localize("agent-steps.work.the_plane_s_profile_answer_does", "the plane's profile answer does not publish it") });
      }
      /* R78: a re-examination run reads, besides R51's reads, the recorded response and the procedure guide for its
         action's kind, under the same credential and the same rule: what cannot be read is UNDETERMINED in `why`. */
      if (state.origin === "reexamination") await reexaminationReads(ask, state.response, undetermined);
      /* R51 (T46; N915; action-plans R45): the closing notes of the project's closed plans, as `op=plan`'s `closed`
         block and `op=plans`' `closing_note` answer them, reach the model with the rest of what was read (the compose
         row's facts) and are weighed there; this only counts them, so the trace says what the run had to weigh. */
      const noted = (n) => (n && typeof n === "object" ? typeof n.note === "string" && n.note.trim() : typeof n === "string" && n.trim());
      const notes = [planDoc?.closed, ...earlier.map((p) => p?.closing_note)].filter(noted).length;
      out.note = localize("agent-steps.work.length_read_s_answered_under", "{length} read(s) answered under the run's credential, {length_2} UNDETERMINED (refused, silent or not published) and carried into every proposal's why, never as an absence; {length_3} earlier plan(s) of the same project, {notes} closing note(s) of closed plans among them{v1}", { length: String(reads.length), length_2: String(undetermined.length), length_3: String(earlier.length), notes: String(notes), v1: String(state.origin === "reexamination" ? "; a re-examination after a recorded response, read with it" : "") });
      out.state = { ...state, planDoc, earlier, reads, undetermined };
      return out;
    }

    case "compose": {
      out.note = localize("agent-steps.work.length_candidate_proposal_s_composed", "{length} candidate proposal(s) composed, strongest first", { length: String((state.candidates || []).length) });
      return out;
    }

    case "dedup": {
      /* R52 — BEFORE ANY WRITE, against the plan as the record holds it now: its options and proposals. A plan that
         cannot be read is compared against NOTHING and the note says so; the plane still refuses a duplicate. */
      const held = state.planId ? planeAnswer(await call("plan", { id: state.planId }), "plan") : null;
      const candidates = state.candidates || [];
      if (!held || held.silent || held.refused) {
        if (held?.refused) out.refused = held.refused;
        out.note = localize("agent-steps.work.the_plan_could_not_be", "the plan could NOT be read ({v1}), so {length} candidate(s) were compared against NOTHING and say so rather than being reported new", { v1: String(held?.refused ? localize("agent-steps.work.the_plane_refused_code", "the plane refused '{code}'", { code: String(held.refused.code ?? "?") })
                   : held?.silent ? localize("agent-steps.work.the_plane_was_silent", "the plane was silent") : localize("agent-steps.work.the_run_names_no_plan", "the run names no plan")), length: String(candidates.length) });
        out.state = { ...state, queue: [...candidates] };
        return out;
      }
      const doc = held.result && typeof held.result === "object" ? (held.result.plan ?? held.result) : {};
      const { queue, dropped } = planDedup(candidates, doc);
      out.note = localize("agent-steps.work.length_candidate_s_compared_against", "{length} candidate(s) compared against the plan's options and proposals; {length_2} already held, dropped before any write; {length_3} to propose, in order", { length: String(candidates.length), length_2: String(dropped.length), length_3: String(queue.length) });
      out.state = { ...state, queue };
      return out;
    }

    case "submit": {
      /* ONE PROPOSAL, OFF THE HEAD OF THE QUEUE, IN THE ORDER COMPOSED (R52): the plane stores the run's proposals in the
         order they arrive, which is the assistant's order of strength. The table stamps what could not be read into
         the `why` (R51); the run and the plan are the record's. */
      const queue = [...(state.queue || [])];
      const candidate = queue.shift();
      if (!candidate) return out;
      const body = { ...candidate, why: whyWithUndetermined(candidate.why, state.undetermined),
                     plan: state.planId, run: runId };
      const res = await call("optionpropose", null, body);
      if (!res.reached) return { silent: res };
      const answer = res.body?.result ?? res.body ?? {};
      if (res.status === 200 && res.body?.ok === true && answer.ok !== false) {
        out.submitted = true;
        out.proposed = true;
        out.note = `proposed '${String(candidate.summary ?? "").slice(0, 80)}'`;
        out.state = { ...state, queue, refusal: null, submission: candidate };
        return out;
      }
      if (answer.repeated === true) out.verbatim = true;
      out.refused = { at: "optionpropose", code: answer.code ?? answer.reason ?? null, check: answer.check ?? null,
                      repeated: answer.repeated === true, plane: answer };
      out.note = localize("agent-steps.work.refused_string_routing_to_adjust_2", "refused '{String}' — routing to ADJUST, never to a retry", { String: String(String(answer.code ?? answer.reason ?? "?")) });
      out.state = { ...state, queue, refusal: answer, submission: candidate };
      return out;
    }

    case "adjust": {
      /* R25 unchanged: resent only when changed, at the head of the queue, so it keeps its place. */
      const changed = adjustedFrom(state.refusedSubmission ?? null, state.submission ?? null);
      const queue = [...(state.queue || [])];
      if (changed) queue.unshift(state.submission);
      out.note = changed
        ? localize("agent-steps.work.the_proposal_was_changed", "the proposal was changed in answer to the refusal, and keeps its place")
        : localize("agent-steps.work.the_refusal_could_not_be_proposal", "the refusal could not be answered by changing the proposal; it is dropped");
      out.state = { ...state, adjusted: changed, queue };
      return out;
    }

    default:
      return out;
  }
}

/** R78 (T45; N887; Actions D21; v0.2 rules 16, 19) — WHAT A RE-EXAMINATION RUN READS BESIDES R51's: the recorded
 *  response, as its correspondence entry on the action (`op=action`) and its capture's extracted text (`op=reading`,
 *  the readers' text only, R63), and the procedure guide for the action's kind (`op=procedureguides`, `reading-guides`
 *  R13). `response` is the run's (ai-runs R77), `<action>#<ord>`: the action and the entry's place in its ledger. Each
 *  read goes through `ask`, R51's one door, so an answer reaches the model only as the row's facts and a refused or
 *  silent one is UNDETERMINED in `why`; a response this member cannot take apart, an entry the action does not hold,
 *  an entry with no capture and an action of no kind are each UNDETERMINED and named, never an absence. It writes
 *  nothing. */
export async function reexaminationReads(ask, response, undetermined) {
  const m = typeof response === "string" ? RESPONSE_ID.exec(response) : null;
  if (!m) {
    undetermined.push({ op: "action", id: typeof response === "string" ? response.slice(0, 200) : null, code: null,
                        why: localize("agent-steps.work.the_run_s_recorded_response_names", "the run's recorded response names no action entry this member can read") });
    return;
  }
  const action = m[1], ord = Number(m[2]);
  const answered = await ask({ op: "action", query: { id: action } });
  if (!answered) return;
  const doc = answered && typeof answered.action === "object" && answered.action ? answered.action : answered;
  const entry = (Array.isArray(doc.correspondence) ? doc.correspondence : []).find((e) => e && Number(e.ord) === ord);
  if (!entry)
    undetermined.push({ op: "action", id: response, code: null, why: localize("agent-steps.work.the_action_answered_holds_no", "the action answered holds no such correspondence entry") });
  else if (typeof entry.artifact_sha === "string" && entry.artifact_sha)
    await ask({ op: "reading", query: { sha256: entry.artifact_sha } });
  else
    undetermined.push({ op: "reading", id: response, code: null,
                        why: localize("agent-steps.work.the_response_is_a_member_s", "the response is a member's account or a non-response, with no capture to read") });
  const kind = typeof doc.kind === "string" && doc.kind ? doc.kind : null;
  if (kind) await ask({ op: "procedureguides", query: { kind } });
  else undetermined.push({ op: "procedureguides", id: action, code: null, why: localize("agent-steps.work.the_action_answered_names_no", "the action answered names no kind") });
}

/** R97 — the targets the plan judgement named for one level, as `agent-harness` R12 takes them, `{id, extent}`. A
 *  target names its subject in `target` (an id), optionally followed by an extent (` ¶n`, `#…`, R100's form); one that
 *  names none, or whose level is another, is not this level's. An internet target's `url` is the fetch's (R18), not a subject. */
export function levelTargets(state, level) {
  const out = [];
  for (const t of Array.isArray(state.targets) ? state.targets : []) {
    if (!t || typeof t !== "object" || t.level !== level || typeof t.target !== "string" || !t.target.trim()) continue;
    const { id, extent } = splitAddress(t.target.trim());
    out.push({ id, extent });
  }
  return out;
}

/** R100, R102 — a cited address as a record id and the extent after it: the id is the part before the first space,
 *  `#` or `¶`, the extent what follows (` ¶1`, `¶1`, `#p1`, the `¶` kept), or null. */
export function splitAddress(address) {
  const at = address.search(/[\s#¶]/);
  if (at <= 0) return { id: address, extent: null };
  return { id: address.slice(0, at), extent: address.slice(at).trim() || null };
}
