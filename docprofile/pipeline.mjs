/* The change pipeline: recognising change in LAYERS.
 *
 * RULED by Bob, 2026-07-30. Recognising change is layered, and the layers run in
 * this order because each one is cheap relative to the next and each one can
 * settle the question outright:
 *
 *   L1  WHICH STACK is this? Without that, nothing below can be trusted, because
 *       the same bytes mean different things on different stacks.
 *   L2  Is anything different AT THE BYTE LEVEL? If not, that is NOTED, not
 *       discarded: a dated first-party statement that the source is still serving
 *       what the record holds is evidence, and it is the primary contemporaneity
 *       route's raw material.
 *   L3  Is the difference NOTEWORTHY? Page state, security tokens and ad slots
 *       differ on every fetch by design. Furniture differs when the site changes,
 *       not when the document does.
 *   L4  WHAT TYPE OF CONTENT changed? A calendar is not an article is not a
 *       regulation is not a staff directory is not an agenda. This is a SEPARATE
 *       axis from the stack: a calendar served by Legistar and one served by
 *       Granicus are the same kind of thing built two ways.
 *   L5  Is the change MEANINGFUL for that type? A calendar whose window has moved
 *       a week is not a changed calendar. A staff member's title is another matter.
 *       Minutes appearing after a meeting was scheduled to occur is another again.
 *   L6  What CONNECTIONS does it imply? Referential, between related content, and
 *       temporal, across time. Different meanings, understood differently by people
 *       and their assistants, and presented differently.
 *
 * WHY LAYERS AND NOT ONE FUNCTION. The previous version conflated L1 through L4
 * inside a single monitor() and inherited a false positive from doing so: the
 * Legistar calendar's visible range is "This Month", MEASURED, so a week later
 * meetings have scrolled out of the window and a membership diff reports them as
 * REMOVED, which is the heaviest signal this system has. A meeting leaving the
 * visible window is not a public record being delisted, and no amount of care at
 * L3 could tell the difference, because the distinction is not about bytes or
 * furniture. It is about what a calendar IS.
 *
 * Each layer returns a verdict and may STOP. Nothing below runs speculatively,
 * which keeps the expensive parsing off the overwhelming majority of checks where
 * the bytes are identical or the difference is machinery.
 */
import { identify, compare, profileRecord, isMeaningful, worstSignificance } from "../site-profiles/index.mjs";
import { doctypeFor } from "./doctypes/registry.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/* Decode bytes as the reader sees them; anything that is not bytes reads as no text. */
const pipelineText = (bytes) => {
  try { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); } catch { return ""; }
};

export const LAYER = {
  STACK: "L1_stack", BYTES: "L2_bytes", NOTEWORTHY: "L3_noteworthy",
  CONTENT_TYPE: "L4_content_type", MEANING: "L5_meaning", CONNECTIONS: "L6_connections",
};

/** Run the layers over two captures of one address.
 *
 *  `before` and `after` are byte arrays; `ctx` carries the locator, the response
 *  headers, a sha256, and optionally `now` and `before_at` / `after_at` so L5 can
 *  reason about time, which a calendar and an agenda both need.
 *
 *  Always returns a result with `stopped_at`, so a reader can see how far the
 *  reasoning got and why. A verdict whose depth is invisible cannot be audited. */
export async function assess(before, after, ctx) {
  const trail = [];
  const note = (layer, said, detail) => { trail.push({ layer, said, ...(detail || {}) }); };

  /* ---- L1: which stack ---- */
  const text = pipelineText(after);
  const id = identify({ ...ctx, text });
  note(LAYER.STACK, `${id.handler.label} (${id.confidence})`,
       { handler: id.handler.key, confidence: id.confidence, signals: id.signals });
  const profile = profileRecord(id, ctx);
  const out = (v) => ({ ...v, trail, profile, stopped_at: trail[trail.length - 1].layer });

  /* A shell is settled here and nothing below applies: its bytes are stable and
     its substance is absent, so every layer beneath would answer a question about
     a document that was never captured. Only a CERTAIN shell settles it, which `identify`'s `shell` answers (site-profiles R2; R12, R41; G140):
     one framework marker on a server-rendered page is a POSSIBLE match, and a possibility
     gates nothing. The verdict gates WATCHING and never the reading of the text. */
  if (id.shell)
    return out({ verdict: "unwatchable", meaningful: null, events: [], connections: [],
                 why: id.handler.warning });

  /* ---- L2 and L3: is anything different, and is it noteworthy ----
     Both layers are the job of compare(), the L3 primitive, so the pipeline no longer
     carries its own copy of the digest logic (CONSTRUCTS Step 0 #2). compare() returns
     the verdict AND the two digest objects, so the trail can still report how much was
     normalised and where reasoning stopped. */
  const dctx = { ...ctx, text, confidence: id.confidence };
  let cmp;
  try { cmp = await compare(before, after, id.handler, dctx); }
  catch (e) {
    /* Only a caller's missing hash function or a failing one reaches here. The honest
       answer is that nothing could be compared, never a guess in either direction. */
    note(LAYER.BYTES, localize("docprofile.pipeline.the_two_captures_could_not_be_compared", "the two captures could not be compared"));
    return out({ verdict: "undetermined", meaningful: null, events: [], connections: [],
                 why: localize("docprofile.pipeline.the_two_captures_could_not", "the two captures could not be compared ({String}), so nothing is claimed", { String: String(String((e && e.message) || e)) }) });
  }
  const da = cmp.digests.before, db = cmp.digests.after;

  if (cmp.verdict === "identical") {
    note(LAYER.BYTES, "identical bytes");
    /* NOTED, per Bob, not discarded. This is the confirmation half and on a
       frequently-checked source it is the majority of all observations. */
    return out({ verdict: "identical", meaningful: false, events: [], connections: [],
                 confirmation: { kind: "identical_bytes", hash: db.identity, at: ctx.after_at || null,
                   why: localize("docprofile.pipeline.the_source_served_exactly_the", "the source served exactly the bytes the record holds") },
                 why: localize("docprofile.pipeline.the_source_is_still_serving", "the source is still serving exactly what the record holds") });
  }
  note(LAYER.BYTES, "the bytes differ", { before: da.identity.slice(0, 12), after: db.identity.slice(0, 12) });

  if (cmp.verdict === "undetermined") {
    note(LAYER.NOTEWORTHY, localize("docprofile.pipeline.cannot_say_the_stack_is_not", "cannot say: the stack is not recognised confidently enough"));
    return out({ verdict: "undetermined", meaningful: null, events: [], connections: [],
                 why: localize("docprofile.pipeline.the_document_differs_and_this", "the document differs and this kind of document is not recognised well enough to say whether the difference matters") });
  }
  if (cmp.verdict === "unchanged") {
    note(LAYER.NOTEWORTHY, "only per-render machinery differs",
         { normalised: da.mechanical_bytes });
    /* Still a confirmation, and a slightly weaker one than identical bytes: the
       substance is the same and the machinery moved, which is what this stack does
       on every response. */
    return out({ verdict: "unchanged", meaningful: false, events: [], connections: [],
                 confirmation: { kind: "same_substance", digest: db.evidentiary,
                   at: ctx.after_at || null,
                   why: localize("docprofile.pipeline.the_substance_is_the_same", "the substance is the same; only machinery this site rebuilds on every visit differs") },
                 why: localize("docprofile.pipeline.the_document_is_unchanged_only", "the document is unchanged; only machinery this site rebuilds differs") });
  }
  if (cmp.verdict === "restyled") {
    note(LAYER.NOTEWORTHY, "only the surroundings differ",
         { normalised: da.presentational_bytes });
    return out({ verdict: "restyled", meaningful: false, events: [], connections: [],
                 confirmation: { kind: "same_substance", digest: db.evidentiary, at: ctx.after_at || null,
                   why: localize("docprofile.pipeline.the_document_itself_is_unchanged_surroundings", "the document itself is unchanged; the site around it changed") },
                 why: localize("docprofile.pipeline.the_document_itself_is_unchanged_navigation", "the document itself is unchanged; something around it moved, such as navigation") });
  }
  /* cmp.verdict === "changed": the substance itself differs, so keep going. */
  note(LAYER.NOTEWORTHY, "the substance differs");

  /* ---- L4: what type of content ---- */
  let dt;
  try { dt = doctypeFor({ ...ctx, text, handler: id.handler, kind: id.kind }); }
  catch (e) {
    note(LAYER.CONTENT_TYPE, localize("docprofile.pipeline.no_content_type_could_be_decided", "no content type could be decided"));
    return out({ verdict: "changed", meaningful: null, events: [], connections: [],
                 why: localize("docprofile.pipeline.the_substance_differs_and_which", "the substance differs, and which kind of document this is could not be decided ({String}), so what changed is not described", { String: String(String((e && e.message) || e)) }) });
  }
  note(LAYER.CONTENT_TYPE, dt.type.label,
       { type: dt.type.key, confidence: dt.confidence, signals: dt.signals });
  const content_type = dt.type.key;

  /* A content type that cannot read, or cannot judge, this document: the substance
     differs (L3 said so) and nothing is claimed about what changed, in either
     direction (R13). `routine` would be a judgment nobody made. */
  const unread = (why) => {
    note(LAYER.MEANING, localize("docprofile.pipeline.nothing_is_claimed_about_the", "nothing is claimed about the content: {why}", { why: String(why) }));
    return out({ verdict: "changed", meaningful: null, events: [], connections: [], content_type,
                 why: localize("docprofile.pipeline.the_substance_differs_and_why", "the substance differs and {why}, so what changed is not described", { why: String(why) }) });
  };

  /* ---- L5: is the change meaningful FOR THAT TYPE ---- */
  if (typeof dt.type.parse !== "function" || typeof dt.type.assess !== "function")
    return unread(localize("docprofile.pipeline.the_content_type_content_type", "the {content_type} content type declares no reader", { content_type: String(content_type) }));
  const textBefore = pipelineText(before);
  const read = (t, at) => dt.type.parse({ ...ctx, text: t, handler: id.handler, at });
  let a, b, m;
  try {
    a = read(textBefore, ctx.before_at); b = read(text, ctx.after_at);
  } catch (e) {
    return unread(localize("docprofile.pipeline.its_contents_could_not_be", "its contents could not be read this time ({String})", { String: String(String((e && e.message) || e)) }));
  }
  try { m = dt.type.assess(a, b, { ...ctx, handler: id.handler }); }
  catch (e) {
    return unread(localize("docprofile.pipeline.the_content_type_reader_could", "the {content_type} reader could not compare the two readings ({String})", { content_type: String(content_type), String: String(String((e && e.message) || e)) }));
  }
  if (!m || m.meaningful === null || m.meaningful === undefined || !Array.isArray(m.events))
    return unread((m && m.why) || localize("docprofile.pipeline.the_content_type_reader_could_2", "the {content_type} reader could not say", { content_type: String(content_type) }));
  /* `meaningful` is DERIVED from the graded events here, never taken as a second fact
     a type carries beside them (R14). */
  const events = m.events;
  const meaningful = isMeaningful(events);
  note(LAYER.MEANING, m.why, { events: events.length, meaningful });

  /* ---- L6: connections ---- */
  let connections = [];
  try {
    connections = typeof dt.type.connections === "function"
      ? dt.type.connections(a, b, { ...ctx, events }) || [] : [];
  } catch (e) {
    note(LAYER.CONNECTIONS, localize("docprofile.pipeline.none_stated_the_content_type", "none stated: the {content_type} reader failed to derive them", { content_type: String(content_type) }));
    connections = [];
  }
  if (connections.length) note(LAYER.CONNECTIONS, `${connections.length} implied`);

  return out({ verdict: meaningful ? "changed" : "routine",
               meaningful, significance: worstSignificance(events),
               events, connections, content_type,
               why: m.why,
               /* Even a changed document confirms whatever DIDN'T change, and on a
                  list that is most of it. Discarding the confirmation because
                  something else moved is how the negative case gets lost. */
               confirmation: m.confirmed || null });
}
