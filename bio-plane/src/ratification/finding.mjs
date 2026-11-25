/* ratification — one finding's crossing (R4–R6), in the pieces `op=ratify` (`./ops.mjs`) and a sitting (R52) share: the
 * gate facts' refusals before the signature (R4), the parts a finding's image publishes (R5, D-556), the commit's
 * arguments (R5), the copy to the published store and its re-verification (R6), the reuse re-fetch (CAP-4) and the
 * answer. `op=ratify` calls them in its order and answers as it always did; `op=caseratify` and `op=publishat` call them
 * for each member of a sitting (R52), and the scheduled publisher (R42) for each member it holds. Moved from `./ops.mjs`'s
 * `ratifyOp` with their comments (T47-72). Nothing here reads the store but through what the caller hands it. */

import { publishedGraphEdges } from "../publication/index.mjs";
import { partsHeld } from "../provenance/index.mjs";
import { userAgent } from "../acquisition/index.mjs";
import { parseFrontmatter, normalizeType, isPublicHttpsLocator } from "../record-grammar/index.mjs";
import { rowOf, isCaseMemberBytes, completenessFields } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

/** R4: the refusals `op=ratify` answers from the gate facts before the signature is weighed, in its order (C-58.1,
 *  C-53.10, C-53.11, C-92.12, RATIFY_STALE), as `{body, status}` without the envelope's `store` and `tokenClass`, or null.
 *  `statedInSitting` (R52) is the observations the case document signed in the same sitting states a chosen level for:
 *  that document is the ratified case document C-92.12 asks for, committed in the same transaction. */
export function findingFactsRefusal(facts, { bundleId, expectedSha, statedInSitting = null }) {
  /* DEC-49 REGION is-ratify-project-bundle — REC-140 / C-58.1. BIO_Publication_v0_1.md
     §3 rule 2 as BOB #15 applied it to D-429 (2026-09-18): *"Only findings that are
     part of a project can be published"*, and a project's own document is not a
     finding — a project publishes THROUGH ITS CASES. So a project bundle is refused
     by TYPE, whoever signs and whoever delivers, its owner included; there is no
     signer rule to weigh because there is nothing here to authorise. Below sight
     (the gate facts answered ABSENT to a caller who cannot see it), above the
     signature, so the refusal costs the caller no key and tells them nothing new. */
  if (normalizeType(facts.row.object_type) === "project")
    return { status: 409, body: { ok: false, reason: "RATIFY_PROJECT_BUNDLE", ...rowOf("RATIFY_PROJECT_BUNDLE"),
      bundleId,
      detail: localize("ratification.finding.bundleid_is_a_projects_own", "{bundleId} is a project's own document, and a project is published through its cases, never directly (BIO_Publication_v0_1.md §3 rule 2; D-429). Nothing was published.", { bundleId: String(bundleId) }) } };
  /* END DEC-49 REGION is-ratify-project-bundle */
  /* DEC-49 REGION is-testimony-publish-bundle — MK-1 (A) / C-53.10, C-53.11, NARROWED BY MK-7.
     MEASURED before MK-1 built it (`test/mk1-publish-probe.mjs`): op=ratify on an observation whose bytes
     were in the working bucket PUBLISHED its words, its provenance document and the observer's handle.
     Since MK-6 an observation's files name nobody (§4.1), so what stays fenced here is an observation
     written BEFORE that, which still names its author in its own files, and a finding resting on one:
     no level can hide a name the bundle prints. Below the scope check and the machine fence, before the
     signature is weighed. */
  const legacy = Array.isArray(facts.testimonyLegacy) ? facts.testimonyLegacy : [];
  if (facts.testimony && facts.testimony.self.length && legacy.includes(bundleId))
    return { status: 409, body: { ok: false, reason: "TESTIMONY_UNPUBLISHABLE", ...rowOf("TESTIMONY_UNPUBLISHABLE"),
      bundleId,
      detail: localize("ratification.finding.bundleid_is_a_members_observation", "{bundleId} is a member's observation whose own files name its author (written before §4.1), or cannot be read to show they do not; publishing it could publish that name at any level (MEMBER-KNOWLEDGE-DESIGN.md §4.1)", { bundleId: String(bundleId) }) } };
  if (facts.testimony && facts.testimony.via.some((v) => legacy.includes(v.observation)))
    return { status: 409, body: { ok: false, reason: "TESTIMONY_CITED_UNPUBLISHABLE", ...rowOf("TESTIMONY_CITED_UNPUBLISHABLE"),
      bundleId, rests_on: facts.testimony.via.filter((v) => legacy.includes(v.observation)),
      detail: localize("ratification.finding.bundleid_rests_on_an_observation", "{bundleId} rests on an observation whose own files name its author (written before §4.1) or cannot be read to show they do not ({map})", { bundleId: String(bundleId), map: String(facts.testimony.via.filter((v) => legacy.includes(v.observation)).slice(0, 5).map((v) => v.observation).join(", ")) }) } };
  /* END DEC-49 REGION is-testimony-publish-bundle */
  /* DEC-49 REGION is-attribution-ratify — MK-7 / C-92.12. THE LIFT OF C-53.10 for an observation in
     §4.1's form: its own bytes cross only as a ratified case's evidence (D-431 (b), in the committer) AND
     only once a RATIFIED case document states the level its author chose for it (§4.3). D-431 alone would
     let them cross beside no statement of whose they are. A finding resting on one needs nothing more
     here: it crosses only as a member of a ratified case (D-431 (a)), and op=caseratify refused that case
     until every observation it reaches was chosen (C-92.10). R52: in a sitting, the case document signed
     with it states the level (C-92.10 and C-92.11 passed for it), and commits in the same transaction. */
  const stated = facts.attributionStated
    || (statedInSitting instanceof Set && facts.testimony && facts.testimony.self.every((o) => statedInSitting.has(o)));
  if (facts.testimony && facts.testimony.self.length && !stated)
    return { status: 409, body: { ok: false, reason: "ATTRIBUTION_UNSTATED", ...rowOf("ATTRIBUTION_UNSTATED"),
      bundleId,
      detail: localize("ratification.finding.no_ratified_case_document_states", "no ratified case document states an attribution for {bundleId}; sign the case edition that uses it (op=caseratify) first, and its author's chosen level is published with it", { bundleId: String(bundleId) }) } };
  /* END DEC-49 REGION is-attribution-ratify */
  if (facts.row.bundle_sha !== expectedSha)
    return { status: 409, body: { ok: false, reason: "RATIFY_STALE",
      detail: localize("ratification.finding.the_record_has_changed", "the record has changed since it was reviewed; read it again and re-sign"),
      expected: facts.row.bundle_sha, got: expectedSha } };
  return null;
}

const hexOf = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** R5, D-556: the parts an image publishes, `{shas, partShaSet}`: each text file by the SHA-256 of its bytes, each
 *  capture by its blob hash and the register's size, and each capture the gate admitted as held in parts (`partedRows`,
 *  whole hash to parts) as its parts. */
export async function findingShas(image, partedRows, registers) {
  /* REC-22: a capture part's SIZE, taken from the register the store already
     handed us with the gate facts. The public file manifest states per-file
     sha AND bytes, and a blob part is the one kind whose length is not in
     the image — reading it here costs nothing (the rows are already in
     memory) and beats a HEAD per part against R2. Absent means absent: a
     part the register does not size stays `null` rather than being given a
     plausible number. */
  const registerBytes = new Map((registers || []).map((r) => [r.path, r.bytes]));
  const shas = [];
  for (const [path, v] of Object.entries(image || {})) {
    if (path.startsWith("_history/")) continue;
    if (typeof v === "string") {
      const sha = hexOf(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
      shas.push({ sha256: sha, path, kind: path === "bundle.md" ? "bundle" : "file",
                  bytes: new TextEncoder().encode(v).length, text: v });
    } else if (v && !partedRows.has(v.blobSha)) {
      shas.push({ sha256: v.blobSha, path, kind: "capture",
                  bytes: registerBytes.has(path) ? registerBytes.get(path) : null });
    }
  }
  /* D-556 (BOB #34, 2026-09-25 00:00Z): a capture the gate admitted as HELD IN PARTS is published AS its
     parts, each under its own hash, because no object exists under the whole's. A part the image already
     carries as a file of its own (C-18.1's filing) is published once, under that path; any other part the
     record names joins the list. The whole's identity and its parts travel in the bundle's own
     data/provenance.json, published beside them, so a reader can reassemble it. */
  const partShaSet = new Set();
  for (const [whole, parts] of partedRows) {
    const at = (registers || []).find((r) => r.capture_sha === whole)?.path || whole;
    parts.forEach((p, i) => {
      partShaSet.add(p.sha256);
      if (!shas.some((s) => s.sha256 === p.sha256))
        shas.push({ sha256: p.sha256, path: p.file || `${at}.part${i + 1}`, kind: "capture_part", bytes: p.bytes });
    });
  }
  return { shas, partShaSet };
}

/** R5: the commit's arguments (`publish`), every fact of the finding read out of the RATIFIED BYTES, the act's own facts
 *  (signature, key, member, gate version, deliverer) beside them. */
export function findingPublishArgs({ bundleId, expectedSha, image, shas, sig, keyB64, attestorMember, gateVersion,
                                     deliveredBy }) {
  /* REC-14 / DEC-12: the EDITION, the frozen pair, the declared bar and the
     completeness assertion all come out of the RATIFIED BYTES -- never off
     the request and never re-derived here. The signature covers this
     document, so anything committed beside it must be inside the hash the
     member signed; re-deriving the strength at this point would put a
     number in the public projection that nobody attested. An inquiry that
     is not `published` ratifies exactly as before with edition 1, which is
     what every information bundle is. */
  const ratifiedFm = typeof image["bundle.md"] === "string"
    ? (parseFrontmatter(image["bundle.md"]).data || {}) : {};
  /* CASE-4 / DEC-72: THE CASE RELATION, read out of the SIGNED BYTES exactly
     as the state word was. A member finding no longer wears `published`; it
     asserts membership of a case edition, and that assertion is inside the
     hash the member signed for REC-44's own reason. Left keyed on the state
     word, this would be FALSE for every document published after this item —
     and everything it gates would then quietly take its non-case default:
     edition 1, no frozen strength, no frozen completeness, no case. A case
     would ratify as though it were an information bundle, with the suite
     green, which is why this line is the most dangerous one in the change.
     (CASE-5b: the case's own facts are committed by op=caseratify out of the case document; this act commits one
     finding's own published row, and the store resolves its case from the pin.) */
  const isCase = normalizeType(ratifiedFm.object_type) === "inquiry" && isCaseMemberBytes(ratifiedFm);
  const edition = isCase && Number.isInteger(ratifiedFm.edition) ? ratifiedFm.edition : 1;
  const frozenStrength = isCase && Array.isArray(ratifiedFm.published_strength) ? ratifiedFm.published_strength : null;
  const frozenCompleteness = isCase ? {
    ...completenessFields(ratifiedFm),
    subject_position: ratifiedFm.completeness?.subject_position ?? null,
    author: ratifiedFm.completeness?.author ?? null,
    at: ratifiedFm.completeness?.at ?? null,
  } : null;
  /* REC-22 / R4, D-431: THE PUBLISHED GRAPH, read out of the RATIFIED BYTES through publication's one classification
     (`publishedGraphEdges`): references are candidates for a SERVE edge, admitted only to a published target and held
     privately otherwise (R5, R16; Bob, K283); a division's parent and siblings are name-only. Do not spell the list
     here again. */
  const edges = publishedGraphEdges(ratifiedFm);
  return {
    bundleId, bundleSha: expectedSha, deliveredBy,
    attestorKey: keyB64, attestorMember: attestorMember ?? null,
    gateVersion, sigArmored: sig,
    /* Only a CASE names its edition, and it names it in the signed bytes. Everything else leaves it to the store,
       which appends the next one — an information bundle has no authored edition to assert. */
    ...(isCase ? { edition } : {}), title: ratifiedFm.title ?? null,
    completeness: frozenCompleteness, strength: frozenStrength,
    /* D-442 / BIO_Publication_v0_1.md §3 rule 12: a member published under rule 12 carries no frozen block in its
       own bytes (`isCase` false), and the store reads its edition and frozen pair from the RATIFIED case documents
       pinning these bytes instead. Legacy bytes carry their own, read above exactly as before (rule 12 (e)). */
    memberCarriesBlocks: isCase,
    /* CASE-5b: `required` is not sent: the bar is the CASE's (DEC-72 clause 2), read by `publish()` from
       `published_cases.bar`. */
    group: ratifiedFm.group ?? null,
    edges,
    shas: shas.map(({ text, ...s }) => s),
  };
}

/** R6: the ratified bytes copied content-addressed into the published bucket (existing keys immutable and skipped;
 *  captures streamed from the working bucket where the gate just verified them), and every part re-verified at the
 *  destination (D-556). Answers `{copied, present, r2state, partsPublished}`. */
export async function copyFinding(env, storeName, { shas, partShaSet, partedRows }) {
  const r2 = typeof env?.CAPTURES?.head === "function";
  let copied = 0, present = 0, r2state = "not configured";
  if (typeof env?.PUBLISHED?.put === "function" && r2) {
    r2state = "ok";
    /* R60 (G120): the parts are copied in groups of 8, each group's together; the outcomes are counted in the parts' order. */
    const one = async (s) => {
      const key = `${storeName}/published/${s.sha256}`;
      if (await env.PUBLISHED.head(key)) return "present";
      if (s.kind === "capture" || s.kind === "capture_part") {
        const obj = await env.CAPTURES.get(`${storeName}/captures/${s.sha256}`);
        if (!obj) return "vanished";
        if (!partShaSet.has(s.sha256)) await env.PUBLISHED.put(key, obj.body);
        /* D-556: a part is put with its digest, so R2 refuses bytes that do not hash to it; a refused put
           leaves the part absent, and the re-verification below names it. */
        else try { await env.PUBLISHED.put(key, obj.body, { sha256: s.sha256 }); } catch { return "refused"; }
      } else {
        await env.PUBLISHED.put(key, new TextEncoder().encode(s.text));
      }
      return "copied";
    };
    for (let i = 0; i < shas.length; i += 8)
      for (const state of await Promise.all(shas.slice(i, i + 8).map(one))) {
        if (state === "present") present++;
        else if (state === "vanished") r2state = "INCOMPLETE: capture vanished between gate and copy";
        else if (state === "copied") copied++;
      }
  }
  /* D-556 (BOB #34, 2026-09-25 00:00Z): EVERY PART, RE-VERIFIED AT THE DESTINATION. A part copied or found
     already present is headed in the published bucket and its digest checked by the same `partsHeld` the
     gate ran on the working one; a part that is not there, or whose digest fails or cannot be checked, is
     NAMED in the answer and the copy is INCOMPLETE, never reported ok. */
  const partShas = [...new Map([...partedRows.values()].flat().map((p) => [p.sha256, p])).values()];
  let partsPublished = null;
  if (partShas.length && r2state !== "not configured") {
    const v = await partsHeld(env.PUBLISHED, (s) => `${storeName}/published/${s}`, partShas);
    const bad = [...v.missing, ...v.disagree, ...v.unverified];
    partsPublished = { parts: partShas.length, verified: partShas.length - bad.length,
                       ...(v.missing.length ? { missing_parts: v.missing } : {}),
                       ...(v.disagree.length ? { disagreeing_parts: v.disagree } : {}),
                       ...(v.unverified.length ? { unverified_parts: v.unverified } : {}) };
    if (bad.length)
      r2state = `INCOMPLETE: ${bad.length} of ${partShas.length} parts did not verify in the published `
              + `bucket: ${bad.map((p) => p.file || p.sha256).join(", ")}`;
  }
  return { copied, present, r2state, partsPublished };
}

/** CAP-4 / CAPTURE-SCALING item 6 (R6): the reused parts re-fetched at ratification, each recorded with its outcome;
 *  `ask(path, init)` reads the store as the caller's `doAnswer` does. Answers the reuse report, or null when nothing was
 *  reused. */
export async function reuseCheck({ env, ask, bundleId, silentReason, silentDetail }) {
  /* CAP-4 / CAPTURE-SCALING item 6: re-fetch the reused parts at
     ratification, which is where a working capture's reuse becomes evidence.
     MANDATORY as an ATTEMPT AND A RECORD, never as agreement (item 6b): the
     four outcomes -- confirmed, changed, unavailable, not_attempted -- all
     ratify and say different things, and the one forbidden thing is ratifying
     with a reused part and saying nothing. A PLAIN GET, not If-None-Match
     (item 6c): both cost the one scarce subrequest, but our own SHA-256 over
     what we received is the evidence the record is keyed on, where a 304 would
     be only the origin's assertion. Bounded by the calibrated capture_limits
     ceiling (item 6d): parts the budget cannot reach are recorded
     `not_attempted` WITH the reason, never silently omitted. Ratification is
     rare and deliberate, so the budget is available exactly when the stakes
     rise; this does not gate -- every outcome still ratifies. */
  /* REC-53, THE ITEM'S SECOND NAMED SITE. A silence made `reused` undefined,
     the guard below fell through, `reuseReport` stayed null and the `reuse`
     key was simply ABSENT from the answer — which reads as "no part of this
     bundle was reused", a statement about WHAT THE GROUP DID, manufactured
     out of a failure to look. Post-commit, so it states the undetermined rather than refusing. */
  const reusedOut = await ask(`http://do/reusedparts?id=${encodeURIComponent(bundleId)}`);
  const reused = reusedOut.result;
  if (!reusedOut.answered)
    return { ok: false, reason: silentReason, op: "ratify/reusedparts", detail: silentDetail,
             note: word("ratification.note.record_reused_part") };
  if (!(reused && Array.isArray(reused.parts) && reused.parts.length)) return null;
  /* REC-53: a silence here left `observed` null, which is ALSO what a
     genuine "nothing calibrated yet" answers — so the recorded basis of
     every not_attempted part said "none observed" about a ceiling nobody
     read, and that sentence is written into the RECORD by
     recordreuseverdicts below. The two are separated by `ceilingRead`. */
  const limOut = await ask("http://do/capturelimit?runtime=subrequests");
  const ceilingRead = limOut.answered;
  const lim = limOut.result;
  const observed = ceilingRead && lim && lim.observed ? lim.observed : null;
  const ceilingWord = !ceilingRead
    ? "UNREAD -- the store did not answer the capture-limit read, so this budget is our own appetite "
      + "and not a calibrated ceiling"
    : observed == null ? "none observed" : String(observed);
  /* Our APPETITE is ours and constant; the runtime's CAPACITY is the
     observed ceiling, discovered by being refused (capture_limits doctrine).
     A margin is reserved for the plane's own DO/R2 subrequests during this
     ratification so re-fetching does not itself trip the ceiling. */
  const appetite = Number(env.RATIFY_REFETCH_BUDGET) || 500;
  const margin = env.RATIFY_REFETCH_MARGIN !== undefined ? (Number(env.RATIFY_REFETCH_MARGIN) || 0) : 4;
  const budget = observed != null ? Math.min(appetite, Math.max(0, observed - margin)) : appetite;
  const verdicts = [];
  let spent = 0;
  for (const p of reused.parts) {
    const base = { source_capture: p.primary_sha, host: p.host,
                   address_norm: p.address_norm, reused_sha: p.reused_sha };
    if (!p.address || !isPublicHttpsLocator(p.address)) {
      verdicts.push({ ...base, verdict: "unavailable", observed_sha: null,
        basis: word("ratification.basis.reused_part_re") });
      continue;
    }
    if (spent >= budget) {
      verdicts.push({ ...base, verdict: "not_attempted", observed_sha: null,
        basis: word("ratification.basis.ratification_re_fetch", { budget: String(budget), ceiling_word: String(ceilingWord) }) });
      continue;
    }
    spent++;
    let r = null;
    try { r = await fetch(p.address, { redirect: "follow", headers: { "user-agent": userAgent(env, "ratify") } }); }
    catch { r = null; }
    if (!r || !r.ok) {
      verdicts.push({ ...base, verdict: "unavailable", observed_sha: null,
        basis: word("ratification.basis.plain_get_returned", { error: String(r ? r.status : word("ratification.basis.network_error")) }) });
      continue;
    }
    const got = hexOf(await crypto.subtle.digest("SHA-256", new Uint8Array(await r.arrayBuffer())));
    if (got === p.reused_sha)
      verdicts.push({ ...base, verdict: "confirmed", observed_sha: got,
        basis: "a plain GET re-fetched the reused part and our own SHA-256 over what we received "
             + "matches the reused bytes" });
    else
      verdicts.push({ ...base, verdict: "changed", observed_sha: got,
        basis: word("ratification.basis.plain_get_returned_different") });
  }
  const at = new Date().toISOString();
  /* REC-53: this write was FIRE-AND-FORGET, so a silence left the verdicts
     out of the record while the report below handed the caller the
     outcomes and the sentence "every reused part carries an outcome" —
     true of the response, false of the record it names. R6's test of this silence (`test/m/ratification/
     converted-c.test.mjs`, ratify-envelope site 8) covers it. */
  const vOut = await ask("http://do/recordreuseverdicts", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ bundleId, at, verdicts }) });
  const tally = (k) => verdicts.filter((v) => v.verdict === k).length;
  return {
    reused_parts: reused.parts.length, budget,
    /* Both spreads are EMPTY on the answered path, so a working instance's
       answer is byte-identical to what it was before this item; the extra
       field exists only where the answer used to be a claim nobody could
       support. */
    ...(ceilingRead ? { ceiling: observed }
                    : { ceiling_unread: { reason: silentReason, op: "ratify/capturelimit", detail: silentDetail } }),
    confirmed: tally("confirmed"), changed: tally("changed"),
    unavailable: tally("unavailable"), not_attempted: tally("not_attempted"),
    outcomes: verdicts.map((v) => ({ address_norm: v.address_norm, source_capture: v.source_capture,
                                     verdict: v.verdict, observed_sha: v.observed_sha, basis: v.basis })),
    note: word("ratification.note.reused_part_carries"),
    ...(vOut.answered ? {}
                      : { recorded: { ok: false, reason: silentReason,
                                      op: "ratify/recordreuseverdicts", detail: silentDetail,
                                      note: word("ratification.note.outcomes_ratification_observed") } }),
  };
}

/** R6, R57 (G54): whether a case edition's state says its case file is still owed: complete, and either no manifest was
 *  recorded or publication's ledger (`casefile_state`) says an attempt did not end `built` (a manifest recorded whose bytes
 *  were never stored is owed too). A state that carries no ledger field is judged by its manifest alone, as it was. */
export const owesCaseFile = (cs) => !!(cs && cs.complete
  && (!cs.manifest_sha || (cs.casefile_state && cs.casefile_state !== "built")));

/** R6: the case editions a finding's commit answers complete and not yet assembled (`pub.case`, or, for a sha several
 *  cases pin, `pub.containerCases`; D-442, IC-74). */
export function casesToAssemble(pub) {
  if (pub && pub.case && owesCaseFile(pub.case)) return [pub.case];
  return Array.isArray(pub?.containerCases) ? pub.containerCases.filter((cs) => owesCaseFile(cs)) : [];
}

/** R57 (G54): an error as the record states it, its message cut, never its stack. */
export const errorText = (e) => String((e && e.message) || e).slice(0, 160);

/** R57 (G54): a copy that threw (the published bucket refused or the store did not answer) stated where it would have
 *  counted: nothing copied is claimed, and the answer says why. */
export const failedCopy = (e) => ({ copied: 0, present: 0, r2state: "COPY_FAILED", partsPublished: null,
                                    failed: { reason: "COPY_FAILED", detail: errorText(e) } });

/** R57 (G54): what the caller's own copy knew when it reached the assembly (public-read's R6 `prior`): the materials it could
 *  not copy, each `{sha, absent}` (`absent` true when the evidence store ANSWERED it gone), `absent` true when there are some
 *  and every one is (the confirmation the ledger's writer needs to stop an edition), and the copy that threw (its text and
 *  code), else null. */
export const priorOf = ({ missing = [], absent = [], copyError = null } = {}) => {
  const gone = new Set(absent);
  return { materials_missing: missing.map((sha) => ({ sha, absent: gone.has(sha) })),
           copy_error: copyError ? errorText(copyError) : null, copy_code: copyError ? "BUCKET_FAILED" : null,
           absent: missing.length > 0 && missing.every((sha) => gone.has(sha)) };
};

/** R6, R57 (G54): the assembly of one case edition's case file, after the commit, whoever calls it, and never a throw:
 *  `assemble` is public-read's one assembly (its R6), which records the attempt itself and answers a statement; should it
 *  throw all the same, the failure is recorded here through public-read's `recordFailure` (step `build`, the assembly's
 *  own) and the statement is `ASSEMBLY_FAILED`. The recording never changes the answer and never throws. */
export async function assembleEdition({ assemble, recordFailure, env, stub, storeName, cs, via, prior }) {
  try {
    return await assemble({ env, stub, storeName, cs, via, prior });
  } catch (e) {
    return recordedFailure({ recordFailure, stub, cs, via, step: "build", error: e });
  }
}

/** R57 (G54): a failure the caller met before the assembly was reached (`step` `copy`) or inside it (`build`), recorded
 *  for the edition through public-read's `recordCaseFileFailure`; answers the statement for the act's answer. A recorder
 *  that is absent, throws or does not answer changes nothing: the statement stands, and the sweep owes the edition. */
export async function recordedFailure({ recordFailure, stub, cs, via, step, error }) {
  let recorded = null;
  try { if (typeof recordFailure === "function") recorded = await recordFailure({ stub, cs, via, step, error }); }
  catch { recorded = null; }
  return { ok: false, reason: step === "copy" ? "COPY_FAILED" : "ASSEMBLY_FAILED", detail: errorText(error),
           ...(recorded && typeof recorded === "object" && recorded.code ? { code: recorded.code } : {}) };
}

/** R4–R6: `op=ratify`'s answer for a committed finding, without the envelope's `store` and `tokenClass`. */
export function findingAnswer({ bundleId, expectedSha, pub, container, attestorMember, gateVersion, deliveredBy, copy,
                                reuseReport, shaCount }) {
  return { ok: true, bundleId, bundleSha: expectedSha,
           edition: pub.edition,
           /* REC-22: the manifest's own hash IS the container's identity — every
              part is named and hashed by it — so it is also the address the zip
              is served at (op=publishedbytes&sha256=<manifest_sha>&format=zip),
              and `graph` reports what the published edges did: how many the
              surface may SERVE, how many it may only NAME, and how many
              references to material not yet published were held privately
              (counts, as publication answers them; a held target's id is never
              published, R5). */
           /* REC-58, 2026-08-05: THIS PICK IS A FENCE AND IS NAMED AS
              ONE. `pub.case` is `#caseEditionState`'s WHOLE return,
              arriving over the internal `do/publish` hop, and it
              carries `opened` — the only route by which that field can
              leave the store. Five fields are forwarded and `opened` is
              not among them, so it stops here. KEEP THIS A PICK: a
              `...pub.case` would put an unconsumed field on a public answer with
              nobody having decided to publish it. R6's tests
              (`test/m/ratification/converted-d.test.mjs`, REC-58;
              `ratify-op.test.mjs`) assert the block's keys are exactly the
              named fields and that `opened` is absent. */
           ...(pub.caseId ? { caseId: pub.caseId,
                              case: { edition: pub.case?.edition ?? null,
                                      complete: !!pub.case?.complete,
                                      awaiting: pub.case?.awaiting ?? [],
                                      findings: (pub.case?.findings ?? []).map((f) => f.bundle_id),
                                      detail: pub.case?.detail ?? null } } : {}),
           container: container
             ?? (pub.case && pub.case.manifest_sha
               ? { manifest_sha: pub.case.manifest_sha,
                   zip: `op=publishedbytes&sha256=${pub.case.manifest_sha}&format=zip` }
               : null),
           graph: pub.edges ?? null,
           /* D-442 / BIO_Publication_v0_1.md §3 rule 12: where this edition's number and
              frozen pair were read from — the finding's own bytes (legacy), the case
              documents pinning them, or neither — and whether those documents disagreed
              about the pair. Two scalars, forwarded by name like every field here. */
           frozenFrom: pub.frozenFrom ?? null,
           ...(pub.strengthUndetermined ? { strengthUndetermined: true } : {}),
           existed: pub.existed, ratifiedAt: pub.ratifiedAt,
           attestor: attestorMember ?? null, gateVersion,
           /* REC-128: who DELIVERED this request (a retry that `existed`
              wrote nothing; the record keeps its first deliverer). */
           deliveredBy,
           published: { shas: shaCount, copied: copy.copied, alreadyPresent: copy.present, r2: copy.r2state,
                        ...(copy.failed ? copy.failed : {}),
                        ...(copy.partsPublished ? { parts: copy.partsPublished } : {}) },
           ...(reuseReport ? { reuse: reuseReport } : {}) };
}

/** R52: the observations a case document's attribution facts state a chosen level for, which C-92.12 counts as stated
 *  for a member of the same sitting (C-92.10 and C-92.11 having passed for that document). */
export const statedIn = (attr) => new Set((attr && Array.isArray(attr.stated) ? attr.stated : [])
  .filter((r) => r && r.observation && r.level && r.level !== "null").map((r) => String(r.observation)));

/** R6 after R52: the case editions to assemble once, the case commit's own complete edition and each member commit's,
 *  one per edition, the last state read of each. */
export function editionsToAssemble(completedCase, commits) {
  const byEdition = new Map();
  for (const cs of [completedCase, ...(commits || []).flatMap((c) => casesToAssemble(c.pub))])
    if (owesCaseFile(cs)) byEdition.set(`${cs.case_id ?? cs.caseId ?? ""}#${cs.edition}`, cs);
  return [...byEdition.values()];
}

