/* ratification — the Worker half of the two ceremonies (K3): `op=caseratify` (R2, the case document) and `op=ratify`
 * (R4–R6, a finding or its evidence), moved from `legacy-index` in T8. Each verifies everything at the control plane
 * (the fences, the signature, the gate), commits through this module's store half (`./index.mjs`, reached over the
 * Durable Object as `casedocfacts`, `casegate`, `caseratify`, `gatefacts`, `image`, `list`, `ratifygate`, `publish`,
 * `reusedparts`, `recordreuseverdicts`, `capturelimit`), and then copies the ratified bytes to the published store.
 * `op=caseratify`'s refusals before a signature exists are `./refusals.mjs`'s, the ones R18's pre-flight answers.
 *
 * Routing, authentication and the response envelope stay the control plane's. What it decided is passed in (`ctx`):
 * the caller class (`cls`), the minted agent credential (`aiCred`), whether the caller arrived through a member's own
 * session (`viaSession`) with its viewer and session row (`sessViewer`, `sessRights`), the store's name and bindings,
 * and its helpers — `json`, `doAnswer`, `storeSilent`, `storeRefusal` (when the caller hands it), `STORE_SILENT_REASON`/
 * `_DETAIL`, and a service of a module this one does not use directly: bias's gate arm (`withBiasChecks`).
 * The case container's assembly is public-read's (R6), imported; a caller may hand its own as `assembleCaseContainer`
 * (the module's tests do). `stub` is the Durable Object stub the op is scoped to. The legacy code's comments moved with
 * it. */

import { verifySshsig, ratifyStatement, caseRatifyStatement, NS_RATIFY } from "../sshsig.mjs";
import { deliveringPrincipal, delivererOf } from "../deliverer.mjs";
/* K651, K691: the case container's one assembly (public-read R6), read here rather than handed in by the door; the file
   is public-read's since publication's merge (K697). */
/* G54: public-read's recorder of a failure met before or inside the assembly (`recordCaseFileFailure`, its R6) is read from
   the same module by namespace; a caller may hand its own as `recordCaseFileFailure` (the module's tests do). */
import * as casefile from "../publication/worker.mjs";
import { parseFrontmatter, isMachineIdentity, MACHINE_CLASS_PREFIX } from "../record-grammar/index.mjs";
import { rowOf, withCaseMemberChecks } from "./checks.mjs";
import { findingFactsRefusal, findingShas, findingPublishArgs, copyFinding, reuseCheck, casesToAssemble,
         findingAnswer, statedIn, editionsToAssemble, assembleEdition, recordedFailure, failedCopy, priorOf } from "./finding.mjs";
import { machineCaseRefusal, operatorCaseRefusal, testimonyCaseRefusal, attributionUnchosenRefusal,
         attributionStaleRefusal } from "./refusals.mjs";
import { localize } from "../setup-words/index.mjs";

/* R17 (N339, N349; control-plane R23, R25, R30; K421, K444): ONE RULE FOR EVERY RELAY, the sub-reads inside a longer
   act included. A reply `doAnswer` reads as the store's OWN REFUSAL (`refused`: `ok: false` below 500, such as
   `BAD_JSON` or an unknown op) is relayed with the store's status, code and sentence, through the caller's
   `storeRefusal` when it hands one, else as the same answer composed here (`json(reply.body, reply.status)`, which is
   what `storeRefusal` answers). Only a reply that is no answer is `storeSilent(op, correlation)`, carrying the
   correlation id `doAnswer` read from the store's own internal error when it gave one. Each site asks the two in that
   order, `refused` and then `answered`, in its own two lines. */
function storeRefused(out, { json, storeRefusal }) {
  return typeof storeRefusal === "function" ? storeRefusal(out) : json(out.reply.body, out.reply.status);
}

/** The two ceremonies' dispatch (legacy-index map §4.4, moved in T18): `op=caseratify` and `op=ratify` answered with the
 *  control plane's `ctx` (the union both handlers read); any other op is not this module's, and answers null. */
export function ratificationOp(op, req, stub, ctx) {
  if (op === "caseratify") return caseRatifyOp(req, stub, ctx);
  if (op === "publishat") return publishAtOp(req, stub, ctx);
  if (op === "ratify") return ratifyOp(req, stub, ctx);
  return null;
}

  /* THE SIGNATURE, AND THE COMMIT. Same order of operations as `op=ratify`,
     deliberately: verify everything, run the catalog, then commit. What is
     different is the SUBJECT — this act commits the CASE's own assertions, out
     of the case document, which is the signature those facts had nowhere to
     move to before this item. */
export async function caseRatifyOp(req, stub, ctx) { return caseCeremony(req, stub, ctx, false); }

/** R40 (DEC-147): `op=publishat`, "Publish at…": `op=caseratify`'s payload and `at: {date, time}`, every refusal
 *  `op=caseratify` answers before its commit, byte for byte and in its order (`MALFORMED` also covering an absent `at`),
 *  and then the store half (`publishat`), which calls `publish-schedule` R1 in place of the commit and answers as it
 *  does. */
export async function publishAtOp(req, stub, ctx) { return caseCeremony(req, stub, ctx, true); }

async function caseCeremony(req, stub, ctx, later) {
  const { env, json, doAnswer, storeSilent, storeRefusal, storeName, cls, aiCred, viaSession,
          sessViewer, sessRights } = ctx;
  const assembleCaseContainer = ctx.assembleCaseContainer || casefile.assembleCaseContainer;
  const recordFailure = ctx.recordCaseFileFailure || casefile.recordCaseFileFailure;
  const relay = { json, storeRefusal };
  /* R60 (G120): a phase of the act, stated to the door's clock when the door hands one (`stateTiming(name, ms)`); a wait here is an
     await, so the time is real. */
  const stated = (name, since) => { if (typeof ctx.stateTiming === "function") ctx.stateTiming(name, Math.max(0, Date.now() - since)); };
  const tGate = Date.now();
    /* REC-123 / C-32.13: the machine fence alone, FIRST and before the payload is read (`./refusals.mjs` holds the
       refusal and its region; R18's pre-flight answers the same one). THE GUARD'S SHAPE IS REC-46's AND NOT STYLE:
       `aiCred` is resolved only for a minted agent credential (it is what makes the caller the `ai` class), and
       WHETHER the identity it acts under is a machine is asked of the ONE predicate over the stamp the plane writes
       for it — never decided here by a string comparison (the rule the old `hygiene.test.mjs` D1 held over the
       source; R2's and R18's tests drive the fence at this module's interface). The `ai` class only HERE; the
       operator's env-binding classes are refused by the fence directly below (REC-125, D-421). */
    if (aiCred && isMachineIdentity(`${MACHINE_CLASS_PREFIX}${cls}/${aiCred.tokenId}`))
      return json(machineCaseRefusal(cls), 403);
    /* REC-125 / C-32.15, D-421: see `op=ratify`'s twin region for the whole reasoning. Every caller that did not
       arrive through a member's own signed-in session — every env-binding bearer class `classify()` resolves, today
       ADMIN / MEMBER / PROBE — is refused, NAMING its class. Keyed on HOW the caller arrived and never on a list of
       token classes, so a fifth binding admitted to this op later is refused without anybody remembering this line. */
    if (!viaSession)
      return json(operatorCaseRefusal(cls), 403);
    const body = await req.json().catch(() => null);
    if (!body?.caseId || !Number.isInteger(body?.edition) || !body?.expectedSha
        || typeof body?.sig !== "string")
      return json({ ok: false, reason: "MALFORMED",
                    detail: "caseratify requires caseId, edition (integer), expectedSha, and sig "
                          + "(armored SSH signature over the case document's sha)" }, 400);
    if (later && (!body.at || typeof body.at !== "object" || Array.isArray(body.at)))
      return json({ ok: false, reason: "MALFORMED",
                    detail: "publishat requires caseId, edition (integer), expectedSha, sig (armored SSH signature over "
                          + "the case document's sha) and at ({date: YYYY-MM-DD, time: HH:MM}, in the team's time zone)" }, 400);
    /* R52: the sitting's members, `[{id, sha, signature}]`, each a finding the edition pins or evidence one rests on,
       signed by the same member in the same sitting; absent or empty is a case signed alone. */
    const sitting = body.members === undefined || body.members === null ? [] : body.members;
    if (!Array.isArray(sitting)
        || sitting.some((m) => !m || typeof m !== "object" || typeof m.id !== "string" || !m.id.trim()
                            || typeof m.sha !== "string" || !m.sha.trim() || typeof m.signature !== "string")
        || new Set(sitting.map((m) => m.id)).size !== sitting.length)
      return json({ ok: false, reason: "MALFORMED",
                    detail: "members, when given, is a list of {id, sha, signature}, each a bundle once: the finding or "
                          + "evidence id, the sha it was signed at, and the armored SSH signature over it" }, 400);

    /* R60 (fix round 10, cause 27a; K5057): the reads of a sitting's members depend on nothing the case's facts answer (a member's gate
       facts, image and known ids ask only its id and the viewer, its gate only those), so they are issued now, beside the case's own
       facts and the three reads after them, and weighed below in the old order by `weighFinding`. Reads only: a refusal that comes
       first leaves them to finish, writing nothing. */
    const sittingList = sitting.length ? doAnswer(stub.fetch(`http://do/list?viewer=${encodeURIComponent(sessViewer)}`)) : null;
    if (sittingList) sittingList.catch(() => {});
    const memberReads = readSitting(sitting, stub, ctx, { viewer: sessViewer, list: sittingList });
    const factsOut = await doAnswer(stub.fetch(
      `http://do/casedocfacts?case=${encodeURIComponent(body.caseId)}`
      + `&edition=${encodeURIComponent(String(body.edition))}`
      /* REC-130: the standing `op=casedocument` answers to, for a member's or the founder's own session (D-421): a
         member without standing in the owning project is answered NO_CASE_DOCUMENT, as for a case that does not exist. */
      + `&viewer=${encodeURIComponent(sessViewer)}`));
    /* REC-53's chokepoint, and the same judgement `op=ratify` records once for
       its whole block: BEFORE the commit a silence refuses the act outright,
       because nothing has been written and 502's sentence — nothing here is a
       statement about the record — is exactly true. */
    if (factsOut.refused) return storeRefused(factsOut, relay);
    if (!factsOut.answered) return storeSilent("caseratify/facts", factsOut.correlation);
    const facts = factsOut.result;
    if (!facts.ok) return json({ ok: false, ...facts, store: storeName, tokenClass: cls }, 404);

    /* MK-1 (A) / C-53.12, and MK-7's attribution gate, C-92.10 and C-92.11 (MEMBER-KNOWLEDGE-DESIGN.md §4.1, §4.4),
       in that order, each refused before the signature is weighed, so the answer is the same whoever signed. The
       refusals and their regions are `./refusals.mjs`'s, the ones R18's pre-flight answers. MEASURED before MK-1 built
       C-53.12 (`test/mk1-publish-probe.mjs`, path 3): a case resting on an observation naming its author RATIFIED. */
    const attr = facts.attribution || { reached: [], legacy: [], stated: [], current: [] };
    for (const refusal of [testimonyCaseRefusal(facts.doc.case_id, facts.doc.edition, attr.legacy),
                           attributionUnchosenRefusal(facts.doc.case_id, facts.doc.edition, attr),
                           attributionStaleRefusal(facts.doc.case_id, facts.doc.edition, attr)])
      if (refusal) return json({ ...refusal, store: storeName, tokenClass: cls }, 409);
    /* R60 (G120): the three reads that depend only on the document the facts answered (`casetestimony`, `caseapproval`, `casegate`) are
       issued together, and their answers weighed below in the order the refusals have always had: R35 (C-58.5), CASE_RATIFY_STALE, R49
       (APPROVAL_MISSING), NO_SIGNERS, the signature, and then the gate. Each is a read; nothing is written by any of them, so a refusal
       that comes before another's answer leaves nothing behind. */
    const [anonOut, apprOut, gateOut] = await Promise.all([
      doAnswer(stub.fetch("http://do/casetestimony", { method: "POST",
        body: JSON.stringify({ caseId: facts.doc.case_id, edition: Number(facts.doc.edition) }) })),
      doAnswer(stub.fetch("http://do/caseapproval", { method: "POST",
        body: JSON.stringify({ caseId: facts.doc.case_id, edition: Number(facts.doc.edition), docSha: facts.doc.doc_sha }) })),
      doAnswer(stub.fetch(
        `http://do/casegate?viewer=${encodeURIComponent(sessViewer)}`,
        { method: "POST", body: JSON.stringify({ caseId: facts.doc.case_id, edition: Number(facts.doc.edition),
                                                 docSha: facts.doc.doc_sha }) })),
    ]);
    /* R35 (DEC-102): C-58.5, after C-92.11 and before the signature is weighed, asked of the store half, where strength's
       corroboration read is (`casetestimony`); the refusal is the pre-flight's own. A silence refuses: nothing is written. */
    if (anonOut.refused) return storeRefused(anonOut, relay);
    if (!anonOut.answered) return storeSilent("caseratify/testimony", anonOut.correlation);
    if (anonOut.result && anonOut.result.refusal)
      return json({ ...anonOut.result.refusal, store: storeName, tokenClass: cls }, 409);

    if (facts.doc.doc_sha !== body.expectedSha)
      return json({ ok: false, reason: "CASE_RATIFY_STALE",
                    detail: localize("ratification.ops.the_case_document_has_changed", "the case document has changed since it was reviewed; read it again and re-sign"),
                    expected: facts.doc.doc_sha, got: body.expectedSha,
                    store: storeName, tokenClass: cls }, 409);
    /* R49 (T41; D60): APPROVAL_MISSING (C-58.11), after CASE_RATIFY_STALE and before the signature is weighed, asked of
       the store half, where R50's reader is registered (`caseapproval`), over the stored document's `doc_sha`. With no
       rule in force nothing is refused. A silence refuses: nothing is written. */
    if (apprOut.refused) return storeRefused(apprOut, relay);
    if (!apprOut.answered) return storeSilent("caseratify/approval", apprOut.correlation);
    if (apprOut.result && apprOut.result.refusal)
      return json({ ...apprOut.result.refusal, store: storeName, tokenClass: cls }, 409);
    /* D-57: NO_SIGNERS IS INSTANCE-WIDE and the detail must never say "for
       you" — the same sentence op=ratify carries, for the same reason. */
    if (!facts.signers.length)
      return json({ ok: false, reason: "NO_SIGNERS",
                    detail: localize("ratification.ops.no_active_registered_signing_keys", "no active registered signing keys; an admin must register a member key before anything can be ratified"),
                    store: storeName, tokenClass: cls }, 409);
    const sv = await verifySshsig(body.sig,
                                  caseRatifyStatement(facts.doc.case_id, facts.doc.edition, facts.doc.doc_sha),
                                  NS_RATIFY, facts.signers.map((s) => s.key_b64));
    if (!sv.ok)
      return json({ ok: false, reason: "SIG_" + sv.reason,
                    ...(sv.keyB64 ? { keyB64: sv.keyB64 } : {}),
                    ...(sv.detail ? { detail: sv.detail } : {}),
                    store: storeName, tokenClass: cls }, 403);
    const attestor = facts.signers.find((s) => s.key_b64 === sv.keyB64);

    /* THE CATALOG, over the bytes the signature covers and over nothing else, on this host's promotion instance,
       where this module's catalogue is registered (R8, K233): the store half re-reads the document at the
       `doc_sha` the signature was verified over and runs `runCaseGate` there (`casegate`). A silence here refuses
       the act: nothing has been written. */
    if (gateOut.refused) return storeRefused(gateOut, relay);
    if (!gateOut.answered) return storeSilent("caseratify/gate", gateOut.correlation);
    const gate = gateOut.result || {};
    if (gate.reason && !Array.isArray(gate.findings))
      return json({ ok: false, ...gate, store: storeName, tokenClass: cls }, gate.reason === "CASE_RATIFY_STALE" ? 409 : 404);
    if (!gate.ok)
      return json({ ok: false, reason: "GATE_REFUSED", gateVersion: gate.gateVersion,
                    findings: gate.findings, store: storeName, tokenClass: cls }, 409);

    /* R52: EACH MEMBER OF THE SITTING, verified as op=ratify verifies it (R4) before anything commits: under the session's
       sight, against the one key the case's signature verified against (the same signer), C-92.12 counting the
       statements of the document being signed. The first refusal is answered naming its member; nothing is written. */
    /* R60 (G120): the members are prepared together (reads only); the first refusal in the sitting's order is the one answered. */
    const preps = await Promise.all(sitting.map((m, i) =>
      weighFinding({ bundleId: m.id, expectedSha: m.sha, sig: m.signature }, ctx,
        { keys: [sv.keyB64], statedInSitting: statedIn(attr), tag: { member: m.id } }, memberReads[i])));
    const refused = preps.find((prep) => prep.response);
    if (refused) return refused.response;
    const members = preps.map((prep) => prep.prepared);

    /* REC-128 (R12): the SIGNATURE says who authorised (`attestor`, the verified key's member, null when absent and
       never the session); the SESSION ROW says who delivered (a member, or the founder, DEC-33), never the signature
       and never `sessMember`. REC-125's fence above guarantees a session here, so `sessRights` is the row. */
    const deliveredBy = deliveringPrincipal(sessRights); /* REC-128: op=caseratify */
    stated("gate", tGate);
    if (later) {
      /* R40: the store half runs R3's refusals before its commit, publication's commit's own (made and rolled back), R41
         (C-58.6), and then `publish-schedule` R1 in place of the commit; its answer is relayed as given. A silence refuses:
         whether anything was written is the store's to say, and nothing here claims it. */
      const sOut = await doAnswer(stub.fetch("http://do/publishat", {
        method: "POST", body: JSON.stringify({
          caseId: facts.doc.case_id, edition: Number(facts.doc.edition), docSha: facts.doc.doc_sha,
          sigArmored: body.sig, attestorKey: sv.keyB64, attestorMember: attestor?.member_id ?? null,
          gateVersion: gate.gateVersion, deliveredBy, at: { date: body.at.date ?? null, time: body.at.time ?? null },
          ...(members.length ? { members: members.map((f) => findingPublishArgs({ ...f, deliveredBy })) } : {}) }) }));
      if (sOut.refused) return storeRefused(sOut, relay);
      if (!sOut.answered) return storeSilent("publishat/schedule", sOut.correlation);
      const sr = sOut.result || {};
      if (!sr.ok)
        return json({ ok: false, ...(sr.reason ? sr : { reason: "PUBLISH_AT_FAILED", detail: sr }),
                      store: storeName, tokenClass: cls }, 409);
      return json({ ok: true, ...sr, gateVersion: gate.gateVersion,
                    attestor: { member: attestor?.member_id ?? null, key_b64: sv.keyB64 },
                    deliveredBy: delivererOf(deliveredBy), store: storeName, tokenClass: cls });
    }
    const tCommit = Date.now();
    const out = await doAnswer(stub.fetch("http://do/caseratify", {
      method: "POST", body: JSON.stringify({
        caseId: facts.doc.case_id, edition: Number(facts.doc.edition), docSha: facts.doc.doc_sha,
        sigArmored: body.sig, attestorKey: sv.keyB64,
        attestorMember: attestor?.member_id ?? null, gateVersion: gate.gateVersion,
        deliveredBy,
        /* R52: each member's commit, after the case's, in the same transaction */
        ...(members.length ? { members: members.map((f) => findingPublishArgs({ ...f, deliveredBy })) } : {}),
      }) }));
    if (out.refused) return storeRefused(out, relay);
    if (!out.answered) return storeSilent("caseratify/commit", out.correlation);
    const answered = out.result;
    stated("commit", tCommit);
    const { completedCase, evidenceMaterials, memberCommits, ...r } = answered || {};
    if (!answered || !r.ok)
      return json({ ok: false, ...(r.reason ? r : { reason: "CASE_PUBLISH_FAILED", detail: answered }),
                    store: storeName, tokenClass: cls }, 409);
    /* D-442 / BIO_Publication_v0_1.md §3 rule 12: a case whose every member was already ratified at
       its pin is COMPLETE at this act, and no op=ratify will come to assemble it — so it is
       assembled here, by the one function op=ratify uses. `completedCase` is the store's internal
       state and is destructured OFF the answer above, never spread into it (REC-58's pick). */
    const tCopy = Date.now();
    /* R60 (G120): the materials' copy and each member's copy touch different keys and run together. */
    const commits = Array.isArray(memberCommits) ? memberCommits : [];
    /* R60 (G120b; fix round 10, cause 27a): the members' reuse checks are reads of different bundles that need neither the copy nor the
       assembly (the verdicts they record are the finding's own), so they start with the copy and are awaited after the assembly; the
       answers stay in the sitting's order. A check still running when the copy throws is left to finish. */
    const tReuse = Date.now();
    const reuseAsk = Promise.all(commits.map((c) => reuseCheck({ env, ask: askOf(stub, doAnswer), bundleId: c.bundleId,
                                             silentReason: ctx.STORE_SILENT_REASON, silentDetail: ctx.STORE_SILENT_DETAIL })));
    reuseAsk.catch(() => {});
    let copyError = null;
    const [{ absent: materialsAbsent, ...materialsCopied }, copies] = await Promise.all([
      copyMaterialsDetailed(env, storeName, Array.isArray(evidenceMaterials) ? evidenceMaterials : []),
      /* R52: each member committed with the case is copied and re-checked as op=ratify does after its commit (R6), and
         the editions complete now (the case's own, or one its members completed) are assembled once, after every copy.
         R6, R57 (G54): the act has committed, so a member's copy that throws is stated in its answer and handed to the
         assembly (`prior`, with the materials not copied), which records the attempt; it never changes the act's answer. */
      Promise.all(commits.map(async (_, i) => {
        try { return await copyFinding(env, storeName, members[i]); }
        catch (e) { copyError ??= e; return failedCopy(e); }
      })),
    ]);
    stated("copy", tCopy);
    const tAssemble = Date.now();
    let container = null;
    const containers = new Map();
    const prior = priorOf({ missing: materialsCopied.missing, absent: materialsAbsent, copyError });
    for (const cs of editionsToAssemble(completedCase, commits)) {
      container = await assembleEdition({ assemble: assembleCaseContainer, recordFailure, env, stub, storeName, cs,
                                          via: "caseratify", prior });
      containers.set(`${cs.case_id ?? cs.caseId ?? ""}#${cs.edition}`, container);
    }
    stated("assemble", tAssemble);
    const reuseReports = await reuseAsk;
    const memberAnswers = commits.map((c, i) => {
      const own = c.pub.case ? containers.get(`${c.pub.case.case_id ?? c.pub.caseId ?? ""}#${c.pub.case.edition}`) : null;
      return findingAnswer({ bundleId: c.bundleId, expectedSha: members[i].expectedSha, pub: c.pub,
        container: own ?? null, attestorMember: members[i].attestorMember, gateVersion: members[i].gateVersion,
        deliveredBy: delivererOf(deliveredBy), copy: copies[i], reuseReport: reuseReports[i], shaCount: members[i].shas.length });
    });
    stated("reuse", tReuse);
    /* what still awaits is the last state the commits read (a member's commit completes the edition) */
    const lastState = [...commits].reverse().find((c) => Array.isArray(c.pub?.case?.awaiting));
    if (lastState) r.awaiting = lastState.pub.case.awaiting;
    return json({ ok: true, ...r, gateVersion: gate.gateVersion, materials_copied: materialsCopied,
                  ...(container ? { container } : {}),
                  /* R52: each member of the sitting, as op=ratify answers it (`members` is the roster's) */
                  ...(commits.length ? { sitting: memberAnswers } : {}),
                  attestor: { member: attestor?.member_id ?? null, key_b64: sv.keyB64 },
                  /* REC-128: who carried the signature in, beside who made it. On a
                     retry of the same signature (`existed`) the store wrote nothing,
                     so the RECORD's deliverer is the first one — read it back through
                     op=casedocument; this field is who delivered THIS request. */
                  deliveredBy: delivererOf(deliveredBy),
                  /* THE WINDOW, NAMED IN THE ANSWER RATHER THAN LEFT TO BE
                     INFERRED FROM AN EMPTY LIST. The case is committed and the
                     members still sign their own bytes, because the finding is
                     the unit of truth — the container becomes assemblable when
                     the last of them lands. */
                  next: r.awaiting?.length
                    ? localize("ratification.ops.the_case_is_committed_length", "the case is committed. {length} member finding(s) still to ratify (op=ratify): {awaiting}. This edition becomes servable as a container when the last of them lands.", { length: String(r.awaiting.length), awaiting: String(r.awaiting.join(", ")) })
                    : localize("ratification.ops.the_case_is_committed_and", "the case is committed and every member finding is already ratified at the version this case pinned{v1}", { v1: String(container && container.manifest_sha
                        ? localize("ratification.ops.so_its_container_is_assembled", ", so its container is assembled ({zip}).", { zip: String(container.zip) }) : ".") }),
                  store: storeName, tokenClass: cls });
}

/* R39 (K1316, K1317): each material the case commit held only in the evidence store (publication R57) is copied into
   the published bucket by its SHA-256, as `op=ratify` copies captures; a key already there is `present`. One the
   evidence store no longer holds, or whose copy fails, is `missing`: a re-sent op=caseratify retries it, and it never
   changes `ok`, because the edition is committed. (T37; N757; K2206) A material held `derived`, a copy carried in place of
   its original (a photo's, case-carriage R1, R11, or, T39, a member document's, its R15, held beside it), is copied the same way and counted alike, read from where case-carriage holds it
   (`obscuredCopyKey`), never from `captures/`. `items` are `{sha, held}`; a bare SHA-256 is an `evidence` one. */
export const obscuredCopyKey = (store, sha) => `${store}/obscured/${sha}`;
const sourceKey = (store, sha, held) => (held === "derived" ? obscuredCopyKey(store, sha) : `${store}/captures/${sha}`);

/** R60 (G120): how many materials are copied together. */
const COPY_GROUP = 8;

export async function copyMaterials(env, storeName, items) {
  const { absent, ...out } = await copyMaterialsDetailed(env, storeName, items);
  return out;
}

/** R39, R57 (G54): `copyMaterials`' copy, and which of the materials it could not copy the evidence store answered ABSENT
 *  (`absent`, a subset of `missing`: the read answered, and held nothing under the hash) as against a copy that failed
 *  (a read or a put that threw, which a later try may mend). Only the sweep reads the difference (it stops an edition for a
 *  material confirmed absent, never for one whose copy failed); the act's answer is `copyMaterials`'. */
export async function copyMaterialsDetailed(env, storeName, items) {
  const out = { copied: 0, present: 0, missing: [], absent: [] };
  /* R60 (G120): the materials are copied in groups of COPY_GROUP, each group's copies together; the outcomes are counted in the
     items' order, so the answer is the one a copy one at a time gave. */
  const one = async (item) => {
    const { sha, held } = typeof item === "string" ? { sha: item, held: "evidence" } : item;
    const key = `${storeName}/published/${sha}`;
    try {
      if (await env.PUBLISHED.head(key)) return { sha, state: "present" };
      const obj = await env.CAPTURES.get(sourceKey(storeName, sha, held));
      if (!obj) return { sha, state: "absent" };
      await env.PUBLISHED.put(key, obj.body, { sha256: sha });
      return { sha, state: "copied" };
    } catch { return { sha, state: "failed" }; }
  };
  for (let i = 0; i < items.length; i += COPY_GROUP)
    for (const { sha, state } of await Promise.all(items.slice(i, i + COPY_GROUP).map(one))) {
      if (state === "present") out.present++;
      else if (state === "copied") out.copied++;
      else { out.missing.push(sha); if (state === "absent") out.absent.push(sha); }
    }
  return out;
}

  /* Ratification: the act that moves a bundle into the published corpus.
     The authority is the SSHSIG over the canonical statement, verified
     against the registered active signers. WHO may carry that signature in
     is a separate question with a separate answer (REC-125, D-421): a
     signed-in member's own session and nothing else. The caller states the sha it reviewed, so
     ratification has its own CAS: nobody can ratify a revision they have
     not seen. Order of operations is deliberate: verify everything, then
     commit the published rows, then copy bytes to the published bucket.
     A failure mid-copy leaves rows that a re-ratification converges. */
export async function ratifyOp(req, stub, ctx) {
  const { env, json, doAnswer, storeSilent, storeRefusal, storeName, cls, aiCred, viaSession,
          sessViewer, sessRights, withBiasChecks, STORE_SILENT_REASON, STORE_SILENT_DETAIL } = ctx;
  const assembleCaseContainer = ctx.assembleCaseContainer || casefile.assembleCaseContainer;
  const recordFailure = ctx.recordCaseFileFailure || casefile.recordCaseFileFailure;
  const relay = { json, storeRefusal };
  const op = "ratify";
    /* DEC-49 REGION is-machine-ratify-bundle — REC-123 / C-32.12. The fence alone, first,
       for `caseratify`'s reason above. Driven: before this, an `ai` credential whose
       scope named this op, carrying a registered member's valid signature,
       PUBLISHED THE FINDING and the record named the member as its attestor. The
       guard's shape is `caseratify`'s, for REC-46's reason stated there. */
    if (aiCred && isMachineIdentity(`${MACHINE_CLASS_PREFIX}${cls}/${aiCred.tokenId}`))
      return json({ ok: false, reason: "MACHINE_CANNOT_RATIFY", ...rowOf("MACHINE_CANNOT_RATIFY"),
        op, tokenClass: cls,
        detail: localize("ratification.ops.ratifying_is_a_members_signed", "ratifying is a member's signed act. An assistant's credential may prepare the finding and may never carry the signature in, whoever's key made it (DEC-24 rule 4).") }, 403);
    /* END DEC-49 REGION is-machine-ratify-bundle */
    /* DEC-49 REGION is-operator-ratify-bundle — REC-125 / C-32.14. D-421, DECIDED by
       BOB #14 applying `BIO_Assistant_and_AI_Roles_v0_1.md` §3 rule 4 (no new
       doctrine): an ATTESTED act is performed ONLY by a named member's OWN
       AUTHENTICATED SESSION. REC-123 fenced the `ai` class above and deliberately
       left the operator's env-binding tokens open, because the AUTHORITY is the
       member's signature and those tokens were the operator's publication path as
       built. The ruling closes that: *the signature proves who AUTHORISED; the
       credential that delivers it decides WHEN the record changes, and the record
       names the actor.* A bearer token held in the hosting account is not the
       member it would name.
       THE PRECONDITION WAS MEASURED BEFORE THIS LINE WAS WRITTEN: the only surface
       that submits op=ratify is the instance page (`setup.mjs` ratifyPanel), and it
       posts with the SESSION from op=login; no kickoff, script, tool, installer or
       DIST procedure submits either op with a bearer token.
       THE PREDICATE IS HOW THE CALLER ARRIVED, NOT WHICH TOKEN IT HELD. `viaSession`
       is set only by the session lookup in the admission block; every class
       `classify()` resolves from an env binding leaves it false, so the fence covers
       ADMIN, MEMBER and PROBE today and any binding added tomorrow, and no token
       string or class list appears here to go stale. The refusal NAMES the class
       (`tokenClass`), so a caller learns which of its credentials was refused. */
    if (!viaSession)
      return json({ ok: false, reason: "OPERATOR_TOKEN_CANNOT_RATIFY",
        ...rowOf("OPERATOR_TOKEN_CANNOT_RATIFY"), op, tokenClass: cls,
        detail: localize("ratification.ops.ratifying_is_a_members_own", "ratifying is a member's own signed act, delivered through that member's own signed-in session. The credential that asked is the operator's `{cls}`-class bearer token: the signature says who authorised publication, and the credential that delivers it decides when the record changes, so a bearer token may not carry it in (D-421).", { cls: String(cls) }) }, 403);
    /* END DEC-49 REGION is-operator-ratify-bundle */
    const body = await req.json().catch(() => null);
    if (!body?.bundleId || !body?.expectedSha || typeof body?.sig !== "string")
      return json({ ok: false, reason: "MALFORMED", detail: "ratify requires bundleId, expectedSha, and sig (armored SSH signature)" }, 400);

    /* REC-53: EVERY Durable Object read in this block goes through REC-52's
       chokepoint (`doAnswer`/`storeSilent`), and not one of them keeps a local
       guard — the whole point of that item is that there is now ONE place that
       opens an envelope.

       THE ONE JUDGEMENT THIS BLOCK NEEDS, because it is the only handler in
       the file with a COMMIT in the middle of it, and it is recorded here
       rather than repeated at each site:

         - BEFORE `do/publish` commits, a silence refuses the whole act with
           `storeSilent`. Nothing has been written, the caller must ask again,
           and 502 saying "nothing here is a statement about the record" is
           exactly true.
         - AFTER it commits, a silence may NOT refuse, because a ratification
           genuinely LANDED and 502's own sentence would then be false in the
           other direction. So the post-commit sites keep the true `ok:true`
           answer and state the UNDETERMINED part IN ITS OWN FIELD.

       Every post-commit conversion is byte-identical on the wire when the
       store ANSWERS: the new fields appear only on the path that previously
       lied, so no consumer of a working instance sees anything move.
       T47-72: the reads before the commit are `prepareFinding`'s, which a sitting (R52) asks of each member, and the
       pieces after it `./finding.mjs`'s. */
    /* REC-25: ratification reads at the RATIFIER'S scope (REC-140: asked at the first read, the gate facts). */
    const ratViewer = viaSession ? sessViewer : `${MACHINE_CLASS_PREFIX}${cls}`;
    const prep = await prepareFinding({ bundleId: body.bundleId, expectedSha: body.expectedSha, sig: body.sig },
                                      stub, ctx, { viewer: ratViewer });
    if (prep.response) return prep.response;
    const f = prep.prepared;

    /* REC-128: the deliverer from the SESSION ROW, the signer from the SIGNATURE, each from its one source. */
    const deliveredBy = deliveringPrincipal(sessRights); /* REC-128: op=ratify */
    /* REC-53: THE COMMIT, and the last site that may refuse. The fallback below is reached only when the store
       ANSWERED with a result carrying no reason of its own — a description of what the store said rather than of a
       silence. */
    const pubOut = await doAnswer(stub.fetch(new Request("http://do/publish", {
      method: "POST", body: JSON.stringify(findingPublishArgs({ ...f, deliveredBy })) })));
    if (pubOut.refused) return storeRefused(pubOut, relay);
    if (!pubOut.answered) return storeSilent("ratify/publish", pubOut.correlation);
    const pub = pubOut.result;
    if (!pub?.ok)
      return json({ ok: false, ...(pub && pub.reason ? pub : { reason: "PUBLISH_FAILED", detail: pub }),
                    store: storeName, tokenClass: cls }, publishRefusalStatus(pub));

    /* R6: the ratified bytes to the published store, every part re-verified there (`copyFinding`). R57 (G54): the act has
       committed, so a copy that throws is stated in the 200 answer (`published.reason` `COPY_FAILED`) and never undoes it. */
    let copy, copyError = null;
    try { copy = await copyFinding(env, storeName, f); }
    catch (e) { copyError = e; copy = failedCopy(e); }
    /* REC-44 / DEC-34, D-442: THE CASE CONTAINER, assembled the moment the LAST member finding of an edition is
       ratified and not before, by the one function both acts that can complete an edition call; a sha several cases
       pin ratifies with no SOLE case (`pub.case` absent, IC-74), so every such edition is named in `containerCases`.
       There is NO case-level strength here and there must never be one. */
    let container = null;
    for (const cs of casesToAssemble(pub))
      /* R57 (G54): an edition this act completes is assembled once the finding's bytes are copied; when the copy threw the
         assembly is not reached and the failure is recorded for the edition (step `copy`), so the sweep owes it. */
      container = copyError
        ? await recordedFailure({ recordFailure, stub, cs, via: "ratify", step: "copy", error: copyError })
        : await assembleEdition({ assemble: assembleCaseContainer, recordFailure, env, stub, storeName, cs, via: "ratify",
                                  prior: priorOf() });
    /* CAP-4: the reuse re-fetch, post-commit, stating what it could not read (`reuseCheck`). */
    const reuseReport = await reuseCheck({ env, ask: askOf(stub, doAnswer), bundleId: body.bundleId,
                                           silentReason: STORE_SILENT_REASON, silentDetail: STORE_SILENT_DETAIL });
    return json({ ...findingAnswer({ bundleId: body.bundleId, expectedSha: body.expectedSha, pub, container,
                                     attestorMember: f.attestorMember, gateVersion: f.gateVersion,
                                     deliveredBy: delivererOf(deliveredBy), copy, reuseReport,
                                     shaCount: f.shas.length }),
                  store: storeName, tokenClass: cls }, 200);
}

/* `ask(path, init)`, a store read through the control plane's chokepoint, for `reuseCheck`. */
const askOf = (stub, doAnswer) => (path, init) => doAnswer(stub.fetch(init ? new Request(path, init) : path));

/* R5: the status of a commit's refusal. */
function publishRefusalStatus(pub) {
  return pub && (pub.reason === "EDITION_NOT_INCREMENTED" || pub.reason === "EDITION_EXISTS"
          /* CASE-2 / DEC-72: a DISAGREEMENT BETWEEN SIGNED DOCUMENTS (the case's signer and this
             member's own frozen bytes), which is what 409 says here, not a fault in this request. */
          || pub.reason === "CASE_ASSERTION_DIVERGED"
          /* REC-140: a pinned finding's authority refusals (C-57.1, and C-56.1 through REC-134's one check) — the
             REQUEST was refused, which is what 409 says; `op=caseratify` relays the same two. */
          || pub.reason === "CASE_SIGNER_NOT_AN_OWNER"
          || pub.reason === "PROJECT_ACT_NOT_A_PARTICIPANT"
          /* D-431: nothing crosses outside a ratified case (C-58.2, C-58.3) — the REQUEST was refused, 409. */
          || pub.reason === "RATIFY_FINDING_NOT_IN_A_RATIFIED_CASE"
          || pub.reason === "RATIFY_NOT_EVIDENCE_OF_A_RATIFIED_CASE") ? 409 : 500;
}

/** R4 (and R52, for each member of a sitting): the reads `op=ratify` makes before its commit for one finding, issued together
 *  and at once (fix round 10, cause 27a; K5057): its gate facts at the ratifier's scope, its image and the list of known ids
 *  (`list`: a sitting's one shared read), and, as soon as those three are in, the store-half gate over them (N417: it reads and
 *  writes nothing). Answers the asks; `weighFinding` weighs them in the act's order. A read still in flight when the act stops at
 *  an earlier refusal is left to finish: it writes nothing. */
export function readFinding({ bundleId }, stub, ctx, { viewer, list = null, batched = false }) {
  const { doAnswer } = ctx;
  const v = encodeURIComponent(viewer);
  const factsAsk = doAnswer(stub.fetch(`http://do/gatefacts?id=${encodeURIComponent(bundleId)}&viewer=${v}`));
  const imgAsk = doAnswer(stub.fetch(`http://do/image?id=${encodeURIComponent(bundleId)}&viewer=${v}`));
  const listAsk = list || doAnswer(stub.fetch(`http://do/list?viewer=${v}`));
  const readable = (out) => out && !out.refused && out.answered;
  /* the gate is asked only over answers the act would hand it; any other answer is weighed (refused or silent) before the gate's.
     `batched` (a sitting, R52): `readSitting` asks the gate for the whole sitting in one call and sets `gateAsk` itself. */
  const gateAsk = batched ? null : (async () => {
    const [factsOut, imgOut, listOut] = await Promise.all([factsAsk, imgAsk, listAsk]);
    if (!readable(factsOut) || !readable(imgOut) || !readable(listOut) || !factsOut.result?.ok) return null;
    const facts = factsOut.result;
    return doAnswer(stub.fetch(new Request("http://do/ratifygate", {
      method: "POST", body: JSON.stringify({
        bundleId, image: imgOut.result, knownIds: [...new Set((listOut.result || []).map((b) => b.bundle_id))],
        registers: facts.registers,
        /* REC-14, REC-44, REC-18: what THIS case asserted at its previous EDITION (C-21.1), what the cases beneath it
           FROZE (C-21.2), and what each basis target EARNS, from the store with the rest of the gate facts, so the gate
           and the write path judge against the same published record. Passing nothing here would blind the gate. */
        publishedRegistry: facts.publishedRegistry,
        publishedCaseRegistry: facts.publishedCaseRegistry,
        earnedRegistry: facts.earnedRegistry,
      }) })));
  })();
  for (const pending of [factsAsk, imgAsk, listAsk, gateAsk]) pending?.catch(() => {});
  return { factsAsk, imgAsk, listAsk, gateAsk };
}

/** R52 / R60 (fix round 10): the reads of a sitting, as `readFinding` makes them for each member, but the store-half gate for
 *  every member the act would gate is asked ONCE, in one `ratifygate` call (`{members: [...]}`), not once each: each member's
 *  answer is the store's answer for its own body, in the sitting's order, and a store refusal or silence is each member's. A
 *  member the act would not gate (its facts, image or list not readable, or its facts not ok) is not in the call, as before. */
export function readSitting(members, stub, ctx, { viewer, list }) {
  const { doAnswer } = ctx;
  const reads = members.map((m) => readFinding({ bundleId: m.id }, stub, ctx, { viewer, list, batched: true }));
  const readable = (out) => out && !out.refused && out.answered;
  const ready = reads.map((r) => Promise.all([r.factsAsk, r.imgAsk, list]).then(([factsOut, imgOut, listOut]) =>
    readable(factsOut) && readable(imgOut) && readable(listOut) && factsOut.result?.ok
      ? { factsOut, imgOut, listOut } : null));
  const batch = Promise.all(ready).then(async (rows) => {
    const picked = rows.flatMap((row, i) => (row ? [i] : []));
    if (!picked.length) return { picked, out: null };
    const body = { members: picked.map((i) => {
      const { factsOut, imgOut, listOut } = rows[i];
      const facts = factsOut.result;
      return { bundleId: members[i].id, image: imgOut.result,
               knownIds: [...new Set((listOut.result || []).map((b) => b.bundle_id))],
               registers: facts.registers, publishedRegistry: facts.publishedRegistry,
               publishedCaseRegistry: facts.publishedCaseRegistry, earnedRegistry: facts.earnedRegistry };
    }) };
    const out = await doAnswer(stub.fetch(new Request("http://do/ratifygate", { method: "POST", body: JSON.stringify(body) })));
    return { picked, out };
  });
  batch.catch(() => {});
  reads.forEach((r, i) => {
    r.gateAsk = batch.then(({ picked, out }) => {
      const k = picked.indexOf(i);
      return k < 0 || !out ? null : { ...out, result: out.result?.members?.[k] ?? null };
    });
    r.gateAsk.catch(() => {});
  });
  return reads;
}

/** R4 (and R52, for each member of a sitting): every check `op=ratify` makes before its commit, after the credential's fences
 *  and the payload's MALFORMED, in its order, over the reads `readFinding` started: the gate facts (R7: a hidden bundle
 *  answers as one never minted), C-58.1, C-53.10, C-53.11, C-92.12, RATIFY_STALE, NO_SIGNERS, SIG_<reason> against `keys`
 *  (every active signer's, or, in a sitting, the one key the case verified against), the image, the known ids, the store-half
 *  gate with its register, bias and case-member arms. Answers `{response}` (a refusal, a store relay or a silence, `tag` added to
 *  a refusal of the finding's own) or `{prepared}` for `findingPublishArgs`, `copyFinding` and `findingAnswer`. Writes nothing. */
export async function weighFinding({ bundleId, expectedSha, sig }, ctx,
                                   { keys = null, statedInSitting = null, tag = {} } = {}, reads) {
  const { json, storeSilent, storeRefusal, storeName, cls, withBiasChecks } = ctx;
  const relay = { json, storeRefusal };
  const refuse = (b, status) => ({ response: json({ ...b, ...tag, store: storeName, tokenClass: cls }, status) });
  const { factsAsk, imgAsk, listAsk, gateAsk } = reads;
  const factsOut = await factsAsk;
  /* A silence here once threw a TypeError on `facts.ok`; what this read answers is the GATE'S OWN FACTS, and a gate
     that cannot see the record cannot confirm anything. */
  if (factsOut.refused) return { response: storeRefused(factsOut, relay) };
  if (!factsOut.answered) return { response: storeSilent("ratify/gatefacts", factsOut.correlation) };
  const facts = factsOut.result;
  if (!facts.ok) return refuse(facts, 404);
  const early = findingFactsRefusal(facts, { bundleId, expectedSha, statedInSitting });
  if (early) return refuse(early.body, early.status);
  if (!facts.signers.length)
    return refuse({ ok: false, reason: "NO_SIGNERS",
                    detail: localize("ratification.ops.no_active_registered_signing_keys", "no active registered signing keys; an admin must register a member key before anything can be ratified") }, 409);
  const sv = await verifySshsig(sig, ratifyStatement(bundleId, expectedSha), NS_RATIFY,
                                keys || facts.signers.map((s) => s.key_b64));
  if (!sv.ok)
    return refuse({ ok: false, reason: "SIG_" + sv.reason, ...(sv.keyB64 ? { keyB64: sv.keyB64 } : {}),
                    ...(sv.detail ? { detail: sv.detail } : {}) }, 403);
  const attestor = facts.signers.find((s) => s.key_b64 === sv.keyB64);

  /* REC-53: `runGate` does `Object.entries(image || {})`, so a silence here once handed the gate an EMPTY BUNDLE. */
  const [imgOut, listOut] = await Promise.all([imgAsk, listAsk]);
  if (imgOut.refused) return { response: storeRefused(imgOut, relay) };
  if (!imgOut.answered) return { response: storeSilent("ratify/image", imgOut.correlation) };
  const image = imgOut.result;
  /* The catalog resolves references against the whole store, so it reads which identifiers exist, once. REC-53: a
     silence is refused, never handed to the gate as an empty set; once `answered`, an empty list is a real answer. */
  if (listOut.refused) return { response: storeRefused(listOut, relay) };
  if (!listOut.answered) return { response: storeSilent("ratify/list", listOut.correlation) };
  /* N417 (K691): THE GATE RUNS IN THE STORE HALF (`ratifygate`), on this host's promotion instance, so the type
     grammars later modules registered with record-core (C-2.7 among them) reach it as they reach promote's. What the
     gate reads is what this act read under the ratifier's scope, handed over whole. A store refused or silent
     here is R17's relay, never a finding about the bytes (N354, K477).
     D-556: `parted` names the parts of each whole-hash row the gate admitted as HELD IN PARTS. */
  const gateOut = await gateAsk;
  if (gateOut.refused) return { response: storeRefused(gateOut, relay) };
  if (!gateOut.answered) return { response: storeSilent("ratify/gate", gateOut.correlation) };
  const { parted, ...registerGate } = gateOut.result || {};
  const partedRows = new Map(Array.isArray(parted) ? parted : []);
  /* The C-18 register arms run after the catalogue, over the same image (provenance R42–R46, K72 (4)), and bias's
     C-26.1–C-26.7 over it too (bias R9, K146); R9: C-2.8's case-member arm joins after it over the same image. */
  const gate = withCaseMemberChecks(image, withBiasChecks(image, registerGate), parseFrontmatter);
  if (!gate.ok)
    return refuse({ ok: false, reason: "GATE_REFUSED", gateVersion: gate.gateVersion, findings: gate.findings }, 409);
  const { shas, partShaSet } = await findingShas(image, partedRows, facts.registers);
  return { prepared: { bundleId, expectedSha, sig, keyB64: sv.keyB64, attestorMember: attestor?.member_id ?? null,
                       gateVersion: gate.gateVersion, image, shas, partShaSet, partedRows } };
}

/** R4: `op=ratify`'s reads and checks for one finding, in its order (`readFinding`, then `weighFinding`). */
export function prepareFinding(args, stub, ctx, { viewer, keys = null, statedInSitting = null, tag = {}, list = null } = {}) {
  return weighFinding(args, ctx, { keys, statedInSitting, tag }, readFinding(args, stub, ctx, { viewer, list }));
}
