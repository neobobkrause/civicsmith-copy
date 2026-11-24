/* THE MEMBER ITSELF — the HTTP surface and the one-page pipeline — in a module
 * that imports NO ENGINE.
 *
 * WHY THE ENGINE IS HANDED IN RATHER THAN IMPORTED. `tessengine.mjs` imports
 * the wasm core and the language model as WORKERS MODULE TYPES (`CompiledWasm`
 * and `Data`), which node cannot resolve, so a module that imports the engine
 * is one a node-side suite cannot load at all. With the engine (and the page
 * renderer) passed to `makeMember`, the suite drives THIS code — the same
 * expressions the worker runs — with a real renderer and a real engine under
 * workerd, and with stand-ins in node where it must reach a step no real page
 * reaches: the renderer never answers a container other than PNG once it is
 * asked to decode DCT, and never writes a PNG its reader refuses, yet R7 orders
 * both refusals and they must hold the day a route changes. `index.mjs` wires
 * the real engine in; nothing else does.
 *
 * WHAT IT DOES (CPDF-10, tier 3, the producer side). Given a capture sha, a store namespace and the pages that have
 * no text layer, it reads the captured bytes FROM R2 ITSELF (the `CAPTURES` read binding — never handed the bytes, and
 * (R27) never reading more of the object than the page needs: it hands the renderers a source that asks R2 for ranges),
 * renders ONE page to pixels through CPDF-12's renderer, runs the engine over that frame, and answers line-grain
 * regions, each carrying the image region a reader can check it against. The engine is asked which way up the frame is
 * before it reads it (R26): a page found turned is rendered again turned upright. Every page, picture or PDF page, says
 * how legible it was (R25). Whatever throws once a request is accepted is a 200 with a named reason (R28). The contract
 * is the consumer's (`ocrTextFromMember`, `bio-plane/src/extraction/pipeline.mjs`): every field below is a field the
 * plane already refuses on.
 *
 * ---- ONE PAGE PER INVOCATION, AND IT IS MEMORY THAT SAYS SO ----------------
 * CPDF-15 (MEASUREMENTS.md, 2026-09-10, on the deployed runtime): RGBA frames of
 * 33.7, 48.5 and 61.3 MB complete; a 75.7 MB frame is KILLED (`exceededMemory`,
 * reproduced). The bound is the workload size that survives, NEVER a share of
 * 128 MB (D-312: the platform's `memoryUsageBytes` reads 132–240 MB on
 * invocations it marks `success`). So a page whose frame would exceed it is
 * REFUSED BY NAME before anything is allocated, and a request naming several
 * pages is CHUNKED, never looped: whole-document invocation is UNMEASURED. The
 * plane loops over `deferred`, one invocation per page (D-606).
 *
 * ---- WHAT THIS MEMBER MAY NOT DO (fleet rules 2/3) -------------------------
 * It writes NOTHING: it holds `CAPTURES` read and no other binding (no STORE,
 * no PUBLISHED), and it calls nothing on `CAPTURES` but `.get`. And it may not
 * make the text look better than it is: no spell-correction, no dictionary
 * pass, no joining of hyphenated lines. It returns what the decoder decoded.
 */
import { renderPageToPixels, REFUSALS as RENDER_REFUSALS } from "../../pdf-worker/src/pagepixels.mjs";
import { pngToSamples, samplesToRgba } from "./pngsamples.mjs";
import { renderPictureToPixels } from "../../pdf-worker/src/picturepixels.mjs";
import { CAP, MEASURED_BY, MAX_FRAME_BYTES, NAMESPACES, PICTURE_MAX_EDGE, REFUSALS, LEGIBLE_CONFIDENCE, LEGIBLE_NOTE_BELOW, LEGIBLE_REFUSE_BELOW, chooseChunk, declaredPictureFrame, frameBytesOf, isPicture, psmFrom, sourceOfBytes, turnToUpright, QUARTER_TURNS } from "./contract.mjs";
import { statement } from "../../bio-plane/src/read-bounds.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/* The namespace set (R16) and the plane ops this member calls (none) are declared in `contract.mjs`, which imports
   no engine, so the plane's control-plane can pin both against its own gate and op table. */
export { NAMESPACES };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

/* THE CONFIDENCE FLOOR, AND WHY ITS DEFAULT IS `null` RATHER THAN A NUMBER.
 * `null` means THIS ENGINE REPORTS CONFIDENCE AND THIS RECORD HAS MEASURED NO THRESHOLD ON IT — a statement, not an
 * omission. Inventing a cutoff would put a threshold nobody measured behind the engine's number. It is settable per
 * instance (`env.OCR_CONFIDENCE_FLOOR`) so a group that HAS measured one can apply it; the discard itself is the
 * caller's (`applyConfidenceFloor`, `bio-plane/src/textchain.mjs`) and must not be copied here. */
export function floorFrom(env) {
  const raw = env && env.OCR_CONFIDENCE_FLOOR;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

/**
 * The member, over an engine and a page renderer.
 *
 * `engine` is `{ name, version, model, check() -> null | reason, transcribeFrame(rgba, w, h, {psm}) ->
 * {ok:true, regions:[{text, rect:[l,t,r,b], confidence}], grain, boxCount} | {ok:false, error, name} }`.
 * `render` is `renderPageToPixels`'s signature; it defaults to that function. `renderPicture` is
 * `renderPictureToPixels`'s (R23), the renderer of a JPEG or PNG capture; it defaults to that function.
 *
 * Returns `{ fetch, transcribeRequest, transcribeOnePage }`.
 */
export function makeMember(engine, { render = renderPageToPixels, renderPicture = renderPictureToPixels } = {}) {

  /** The frame of one render, read back to the samples the engine takes: `{refusal}` when a step of R7 refuses it, else
   *  `{meta, out}` (what the renderer said of the frame, and what the engine said of it). `turn` is the degrees clockwise
   *  the renderer is asked to turn the page by (R26); the pixels themselves go out of scope here, so a second read of the
   *  same page never holds two frames. `at.stage` names the step in progress for R28. */
  async function readFrameOf(input, page, picture, turn, { psm, at }) {
    at.stage = turn ? "render_turned" : "render";
    const rendered = picture
      ? await renderPicture(input, page, { maxEdge: PICTURE_MAX_EDGE, grey: true, prepare: true, ...(turn ? { turn } : {}) })
      : await render(input, page, { decodeDct: true, allowTextPage: true, ...(turn ? { turn } : {}) });
    if (!rendered || !rendered.ok)
      return { refusal: { ok: false, reason: "PAGE_NOT_RENDERABLE", detail: REFUSALS.PAGE_NOT_RENDERABLE,
               page, render: rendered ? { reason: rendered.reason, why: RENDER_REFUSALS[rendered.reason] || null,
                                          detail: rendered } : null } };

    /* A CONTAINER THIS MEMBER CANNOT READ IS NAMED, NOT ATTEMPTED. Since D-320 no route the renderer takes for this
       member answers anything but a PNG; the guard stays for any future route that does. */
    if (rendered.mediaType !== "image/png")
      return { refusal: { ok: false, reason: "PIXELS_UNREADABLE", detail: REFUSALS.PIXELS_UNREADABLE, page,
               route: rendered.route, mediaType: rendered.mediaType,
               why: localize("ocr-worker.member.the_route_route_hands_back", "the {route} route hands back {mediaType} bytes, and no decoder for that container is built into this member — workerd has neither a canvas nor createImageBitmap. This page is not transcribed and is not guessed at.", { route: String(rendered.route), mediaType: String(rendered.mediaType) }) } };

    /* THE FRAME BOUND, checked before anything is allocated — and only once the container has passed, so a page
       too large is refused by its true reason. The rendered frame is judged at its true size (R7.4). */
    const frame = frameBytesOf(rendered.width, rendered.height);
    if (frame > MAX_FRAME_BYTES)
      return { refusal: frameRefusal(page, rendered.width, rendered.height, frame) };

    /* R24: a picture the preparation found no text lines in (a blank wall, noise) is not handed to the engine, which
       would read marks out of it: it is answered by the no-text path, nothing boxed. */
    if (rendered.prepared && rendered.prepared.text_found === false)
      return { refusal: { ok: false, reason: "NOTHING_TRANSCRIBED", detail: REFUSALS.NOTHING_TRANSCRIBED, page,
               boxes: 0, blank: 0, unanchored: 0,
               why: localize("ocr-worker.member.the_picture_has_no_lines_of_text", "no line of text was found in this picture, so it was not given to the engine to read; there is nothing here this record could anchor.") } };

    at.stage = "png";
    const samples = await pngToSamples(rendered.bytes);
    if (!samples.ok)
      return { refusal: { ok: false, reason: "PIXELS_UNREADABLE", detail: REFUSALS.PIXELS_UNREADABLE, page,
               route: rendered.route, png: samples } };

    at.stage = "frame";
    const rgba = samplesToRgba(samples);
    /* THE SAMPLES ARE RELEASED BEFORE THE ENGINE RUNS (D-320): a decoded RGB page's samples are 25.2 MB beside a
       33.7 MB frame, in the isolate where a 75.7 MB frame was KILLED. Only their dimensions are read below. */
    samples.packed = null;
    const meta = {
      width: samples.width, height: samples.height, frame_bytes: frame, route: rendered.route,
      upright: rendered.upright, rotate_deg: rendered.rotate_deg ?? null,
      dpi: rendered.page_geometry ? rendered.page_geometry.dpi : null,
      pixels_sha256: rendered.pixels_sha256 || null,
      turned_deg: rendered.turned_deg ?? 0,   /* what the renderer says it did (pdf-pixels R48), never what it was asked */
    };
    at.stage = "engine";
    let out;
    try {
      out = await engine.transcribeFrame(rgba, samples.width, samples.height, { psm });
    } catch (e) {
      /* The real engine reports its own failures; an engine that THROWS instead is the same finding, and is
         stated rather than turned into a 500 that reads as "the member could not be reached". */
      out = { ok: false, error: String((e && e.message) || e), name: e && e.name };
    }
    if (!out || !out.ok)
      return { refusal: { ok: false, reason: "ENGINE_FAILED", detail: REFUSALS.ENGINE_FAILED, page,
               frame_bytes: frame, engine_error: out ? out.error : "the engine answered nothing",
               engine_error_name: out ? out.name : undefined } };
    return { meta, out };
  }

  /** R7.4: the refusal of a frame over the measured bound; the sentence is the row's (`statement`). */
  function frameRefusal(page, width, height, frame) {
    const st = statement("ocr", "frame_bytes", frame);
    return { ok: false, reason: "FRAME_OVER_MEASURED_BOUND", detail: REFUSALS.FRAME_OVER_MEASURED_BOUND,
             page, width, height, frame_bytes: frame, bound_bytes: st.bound,
             why: localize("limit.ocr.frame_bytes", "a {width}x{height} page needs a {frame} B RGBA frame; the largest frame MEASURED to complete on this runtime is {MAX_FRAME_BYTES} B and a 75,700,000 B frame was KILLED (CPDF-15, reproduced). This is a workload size and NOT a share of any ceiling — the platform's memory figure is not the isolate's budget (D-312). Refused rather than attempted: being killed returns no answer and no reason.", { width: String(width), height: String(height), frame: String(st.size), MAX_FRAME_BYTES: String(st.bound) }) };
  }

  /** What one reading of a frame holds: the regions the engine boxed and could anchor, the counts of those it dropped, and
   *  (R25) how legible the words were by the engine's own rating of each. */
  function judge(out) {
    const regions = [];
    let unanchored = 0, blank = 0, unrated = 0;
    for (const w of out.regions || []) {
      const text = w && w.text;
      if (!(typeof text === "string" && text.trim().length)) { blank++; continue; }
      const rect = Array.isArray(w.rect) && w.rect.length === 4 ? w.rect : null;
      if (!rect || !rect.every((n) => typeof n === "number" && Number.isFinite(n))) { unanchored++; continue; }
      /* CONFIDENCE: the fence is on the BASIS. `engine` is truthful only where the classic decoder computed the
         number; anything outside 0..1, or no number at all, is the STATED string "none" — never a substituted or
         rescaled value. */
      const c = w.confidence;
      const rated = typeof c === "number" && c >= 0 && c <= 1;
      if (!rated) unrated++;
      regions.push({ text, rect: [rect[0], rect[1], rect[2], rect[3]], confidence: rated ? { value: c, basis: "engine" } : "none" });
    }
    const boxes = Number.isInteger(out.boxCount) ? out.boxCount : (out.regions || []).length;
    /* R25: how much of its text the engine rated as read, by the engine's own rating of each word (`out.words`), for a
       picture and for a PDF page alike; an engine that gave no words states nothing. */
    let legibility = null;
    if (regions.length && Array.isArray(out.words) && out.words.length) {
      const words = out.words.length;
      const confident = out.words.filter((w) => typeof w.confidence === "number" && w.confidence >= LEGIBLE_CONFIDENCE).length;
      legibility = { words, confident_words: confident, share: Math.round((confident / words) * 100) / 100 };
    }
    /* the mean of the engine's own ratings of the words, which tells two readings of one share apart (R26's choice) */
    const rated = Array.isArray(out.words) ? out.words.filter((w) => typeof w.confidence === "number") : [];
    const rating = rated.length ? rated.reduce((a, w) => a + w.confidence, 0) / rated.length : 0;
    return { regions, unanchored, blank, unrated, boxes, legibility, rating };
  }

  /** R26: do the lines the engine boxed run up the frame (a page turned a quarter turn)? The median of their widths over
   *  their heights, over the lines of three characters or more, is under one. */
  function linesRunUp(regions) {
    const aspects = regions.filter((r) => r.text.trim().length >= 3).map((r) => (r.rect[2] - r.rect[0]) / (r.rect[3] - r.rect[1]))
      .filter(Number.isFinite).sort((a, b) => a - b);
    return aspects.length > 0 && aspects[aspects.length >> 1] < 1;
  }

  /** R26: how well a reading reads, for choosing between two of the one page: its share of words rated as read; a
   *  reading with text and no ratings scores 0, one with no text -1. */
  const refusable = (j) => !j.regions.length || (j.legibility != null && j.legibility.share < LEGIBLE_REFUSE_BELOW);
  const scoreOf = (j) => (j.legibility ? j.legibility.share : j.regions.length ? 0 : -1);
  /** R26: is reading `a` better than reading `b`? A larger share of words rated as read; at an equal share, a higher mean rating. */
  const readsBetter = (a, b) => scoreOf(a) > scoreOf(b) || (scoreOf(a) === scoreOf(b) && a.rating > b.rating);

  /** Transcribe ONE page of one capture: a pure function of the bytes, the page and the options. `bytes` is the capture
   *  whole, or (R27) a source `{size, readRange(offset, length)}` that reads only what the page needs. */
  async function transcribeOnePage(bytes, page, { psm = null, confidenceFloor = null, at = {} } = {}) {
    at.stage = "engine_check";
    const engineWhy = engine.check();
    if (engineWhy)
      return { ok: false, reason: "ENGINE_ABSENT", detail: REFUSALS.ENGINE_ABSENT, why: engineWhy };

    /* PIXELS. CPDF-12's renderer, never re-implemented: it knows which pages are image-only and which routes are
       decodable, and its refusals are passed through VERBATIM — a text layer, a vector page, a mosaic and a JBIG2
       stream are four different findings and this member collapses none of them. `decodeDct` (D-320): a DCT page is
       DECODED to pixels, upright, so `pixels_sha256` is one an independent decoder reproduces. `allowTextPage` (R30): a
       page the plane routes here has been judged to need OCR though it shows text (a folio on a scanned page), so the
       renderer never refuses it for its text layer. */
    /* R23: a capture that is a JPEG or PNG picture is a ONE-PAGE document, rendered by the picture renderer
       (pdf-pixels R42) and taken through every step below exactly as a PDF page is. Any page but 0 does not exist,
       and is named so before a pixel is made. Bytes that are neither are the page renderer's to refuse, as before.
       R24 (L26): a photograph is PREPARED (levelled, deskewed, enlarged) before the engine reads it, so the frame
       below, its size and its digest are the prepared picture's. */
    at.stage = "sniff";
    const input = bytes;
    const source = input instanceof Uint8Array ? sourceOfBytes(input) : input;
    const picture = isPicture(await source.readRange(0, 8));
    if (picture && page !== 0)
      return { ok: false, reason: "NO_SUCH_PAGE", detail: REFUSALS.NO_SUCH_PAGE, page, page_count: 1 };

    /* R7.4 (G125g): a picture's frame is judged from its header before any render, so a picture that cannot be read
       costs no decode, no preparation and no PNG buffer. */
    if (picture) {
      at.stage = "header";
      const declared = await declaredPictureFrame(source, PICTURE_MAX_EDGE);
      if (declared && declared.frame_bytes > MAX_FRAME_BYTES)
        return frameRefusal(page, declared.width, declared.height, declared.frame_bytes);
    }

    const first = await readFrameOf(input, page, picture, 0, { psm, at });
    if (first.refusal) return first.refusal;
    let chosen = { ...first, judged: judge(first.out) };
    const notes = [];

    /* R26: THE ORIENTATION. The engine was asked its orientation before it read this frame's text. A frame it cannot
       tell is read as it lies, and says so. A frame it finds turned is asked again from the renderer, turned upright,
       and the page is answered from the better reading. MEASURED: the engine's answer is exact on a full-resolution page
       and often wrong on a smaller frame (its confidence is 1 whatever it saw), and it reads a page turned a quarter turn
       almost as well as upright, by turning it inside. So a turn the engine asks for is tried when the page as it lies
       is not clearly legible, or when its lines run up the frame (a quarter-turned page), never for a page clearly legible
       with its lines across it; and it is kept when reading the turned page rates at least as many of its words as read,
       the engine's claim breaking the tie. */
    const claim = first.out.orientation;
    const tried = new Set([0]);   /* the turns this call has read the page at */
    if (!claim || !QUARTER_TURNS.includes(claim.rotation)) {
      notes.push(localize("ocr-worker.member.the_orientation_of_this_page_could_not_be_determined", "the engine could not tell which way up this page is, so it was read as it lies; if it is turned, the reading below is of a turned page."));
    } else if (claim.rotation !== 0) {
      const j = chosen.judged;
      const unclear = !j.regions.length || (j.legibility != null && j.legibility.share < LEGIBLE_NOTE_BELOW);
      const sideways = claim.rotation !== 180 && linesRunUp(j.regions);
      if (unclear || sideways) {
        const turn = turnToUpright(claim.rotation);
        tried.add(turn);
        at.stage = "orientation";
        const again = await readFrameOf(input, page, picture, turn, { psm, at });
        if (again.refusal || again.meta.turned_deg !== turn) {
          notes.push(localize("ocr-worker.member.the_orientation_of_this_page_could_not_be_determined", "the engine could not tell which way up this page is, so it was read as it lies; if it is turned, the reading below is of a turned page."));
        } else {
          const judgedAgain = judge(again.out);
          if (judgedAgain.regions.length && scoreOf(judgedAgain) >= scoreOf(j)) chosen = { ...again, judged: judgedAgain };
        }
      }
    }

    /* R26 (fix round 10, cause 7): A PAGE THAT WOULD OTHERWISE BE REFUSED IS READ A FURTHER WAY. On a sparse page (a few
       short lines) the engine's claim is the same whatever the page's turning, so the one turn it asked for may be the wrong
       one and no other was tried. A page with nothing read, or under R25's refusal floor, is read at each quarter turn not yet
       tried and the best-rated reading is kept; a page that reads is never read four ways, and an upright page whose
       claim was wrong keeps its reading (a turn is kept only when it rates strictly better). */
    if (refusable(chosen.judged)) {
      for (const turn of QUARTER_TURNS) {
        if (tried.has(turn)) continue;
        tried.add(turn);
        at.stage = "orientation_search";
        const other = await readFrameOf(input, page, picture, turn, { psm, at });
        if (other.refusal || other.meta.turned_deg !== turn) continue;
        const judgedOther = judge(other.out);
        if (judgedOther.regions.length && readsBetter(judgedOther, chosen.judged)) chosen = { ...other, judged: judgedOther };
      }
    }

    const { meta, judged } = chosen;
    const { regions, unanchored, blank, unrated, boxes, legibility } = judged;
    if (legibility && legibility.share < LEGIBLE_REFUSE_BELOW) {
      const reason = picture ? "PICTURE_NOT_LEGIBLE" : "PAGE_NOT_LEGIBLE";
      return { ok: false, reason, detail: REFUSALS[reason], page, legibility, why: REFUSALS[reason], notes };
    }
    if (!regions.length)
      return { ok: false, reason: "NOTHING_TRANSCRIBED", detail: REFUSALS.NOTHING_TRANSCRIBED, page,
               boxes, blank, unanchored, notes,
               why: localize("ocr-worker.member.the_engine_boxed_boxes_region", "the engine boxed {boxes} region(s) and none of them carried both text and a usable rectangle, so there is nothing this record could anchor. An engine that answers nothing on a page is a FINDING and not an error: CPDF-15 measured this engine returning the empty string on noise and at CPDF-11's R3 rung, which is the self-refusal that makes its clean-run figures worth anything.", { boxes: String(boxes) }) };

    /* THE REGIONS. One per LINE the engine boxed (`REGION_GRAIN` in `frame.mjs` says why line), each with the
       image region a reader can be pointed at. THE RECT'S SPACE IS STATED: pixels of the frame that was OCR'd,
       which is where the anchor is verifiable — re-render by the same route and `pixels_sha256` says whether
       they are the same pixels. A region with no text or no usable rectangle is DROPPED and COUNTED. */
    const ref = `p${page}`;
    const image = { width: meta.width, height: meta.height, route: meta.route, upright: meta.upright, rotate_deg: meta.rotate_deg,
                    pixels_sha256: meta.pixels_sha256 };
    return {
      ok: true, page,
      regions: regions.map((r) => ({ text: r.text, source: { kind: "pdf-page", ref, page, rect: r.rect, space: "image-px", image: { ...image } }, confidence: r.confidence })),
      unanchored, blank, unrated, grain: chosen.out.grain, notes,
      image: { width: meta.width, height: meta.height, frame_bytes: meta.frame_bytes,
               route: meta.route, upright: meta.upright, rotate_deg: meta.rotate_deg,
               dpi: meta.dpi, pixels_sha256: meta.pixels_sha256, turned_deg: meta.turned_deg },
      confidence_floor: confidenceFloor,
      ...(legibility ? { legibility } : {}),
      capture_kind: picture ? "picture" : "page",
    };
  }

  /** The 200 answer for a throw inside a call (R28): never a 5xx, never a thrown error; a document-level finding. */
  function unexpected(e, stage, page) {
    const error_name = String((e && e.name) || "Error"), error = String((e && e.message) || e).slice(0, 200);
    return { ok: false, reason: "UNEXPECTED_FAILURE", detail: REFUSALS.UNEXPECTED_FAILURE, page, stage, error_name, error };
  }

  /** The whole wire answer for one request, with the CHUNK RULE applied. */
  async function transcribeRequest(bytes, pages, opts = {}) {
    const { take, deferred } = chooseChunk(pages);
    if (take == null)
      return { ok: false, reason: "BAD_PAGES", detail: REFUSALS.BAD_PAGES };

    /* R28: whatever throws inside the call once the request has been accepted (the renderer, the picture renderer, the
       PNG reader, the inflater) is the finding "something failed here", answered like every other: 200, ok:false, a named
       reason, the step it happened in and the error's name. */
    const at = { stage: "start" };
    let one;
    try {
      one = await transcribeOnePage(bytes, take, { ...opts, at });
    } catch (e) {
      one = unexpected(e, at.stage, take);
    }
    const notes = [];
    if (deferred.length)
      notes.push(localize("ocr-worker.member.this_member_transcribes_one_page", "this member transcribes ONE PAGE PER INVOCATION and {length} further page(s) ({deferred}) were NOT transcribed by this call. The bound is MEMORY and it was measured by refusal: a 61.3 MB RGBA frame completes and a 75.7 MB frame is killed (CPDF-15). Whole-document invocation is UNMEASURED, so it is refused rather than assumed — call again per page. Those pages keep their markers and stay honestly unread.", { length: String(deferred.length), deferred: String(deferred.join(", ")) }));

    if (!one.ok)
      return { ok: false, reason: one.reason, detail: one.detail, page: take,
               ...(one.reason === "UNEXPECTED_FAILURE" ? { stage: one.stage, error_name: one.error_name } : {}),
               deferred, notes: notes.concat(one.notes || [], one.why ? [one.why] : []), refusal: one };

    notes.push(...one.notes);
    if (one.unanchored)
      notes.push(localize("ocr-worker.member.unanchored_region_s_the_engine", "{unanchored} region(s) the engine returned carried no usable rectangle and were dropped rather than recorded — text nobody can point at a page to verify is exactly what this path refuses to put in the record.", { unanchored: String(one.unanchored) }));
    if (one.unrated)
      notes.push(localize("ocr-worker.member.unrated_region_s_came_back", "{unrated} region(s) came back with no engine-computed confidence and are stated as 'none' rather than given a number this member would have had to invent.", { unrated: String(one.unrated) }));

    if (one.legibility && one.legibility.share < LEGIBLE_NOTE_BELOW)
      notes.push(one.capture_kind === "picture"
        ? localize("ocr-worker.member.the_picture_is_only_partly_legible", "the engine rated {confident} of the {words} words it read in this picture as read; the rest may be wrong or missing, so this reading is partial.", { confident: String(one.legibility.confident_words), words: String(one.legibility.words) })
        : localize("ocr-worker.member.this_page_is_only_partly_legible", "the engine rated {confident} of the {words} words it read on this page as read; the rest may be wrong or missing, so this reading is only partly legible.", { confident: String(one.legibility.confident_words), words: String(one.legibility.words) }));

    return {
      ok: true,
      engine: engine.name,
      version: engine.version,
      model: engine.model,
      cap: CAP,
      measured_by: MEASURED_BY,
      confidence_floor: one.confidence_floor,
      pages: [{ page: one.page, regions: one.regions }],
      /* The GRAIN is on the wire because it is the grain of a LINE in the record's text: the plane joins region
         texts with a newline. */
      grain: one.grain,
      deferred,
      image: one.image,
      ...(one.legibility ? { legibility: one.legibility } : {}),
      notes,
    };
  }

  /** R27: the captured object as the renderers take it, a source that asks R2 for the ranges the page needs and for
   *  nothing else. The first ranged read learns the object's size (`size` is the whole object's, whatever range was asked)
   *  and holds the start of the file, which the sniff of what the capture is reads from. */
  async function openCapture(CAPTURES, key) {
    const HEAD = 16;
    let first;
    try {
      first = await CAPTURES.get(key, { range: { offset: 0, length: HEAD } });
    } catch (e) {
      /* a ranged read of an object with nothing in it is refused by R2; the plain read then tells empty from absent */
      first = await CAPTURES.get(key);
      if (first && first.size !== 0) throw e;
    }
    if (!first) return null;
    const size = first.size;
    const head = size === 0 ? new Uint8Array(0) : new Uint8Array(await first.arrayBuffer());
    return {
      size,
      readRange: async (offset, length) => {
        const end = Math.min(size, offset + length);
        if (offset >= end) return new Uint8Array(0);
        if (end <= head.length) return head.subarray(offset, end);
        const part = await CAPTURES.get(key, { range: { offset, length: end - offset } });
        if (!part) throw new Error("the capture is no longer there");
        return new Uint8Array(await part.arrayBuffer());
      },
    };
  }

  async function handleTranscribe(req, env) {
    if (typeof env?.CAPTURES?.get !== "function")
      return json({ ok: false, reason: "R2_NOT_CONFIGURED", detail: REFUSALS.R2_NOT_CONFIGURED }, 503);
    /* R29: an OCR_PSM that is set and is no page-segmentation mode is refused on every call, with R5, before the body. */
    const psm = psmFrom(env);
    if (psm.set && !psm.ok)
      return json({ ok: false, reason: "BAD_PSM", detail: REFUSALS.BAD_PSM, value: psm.value }, 503);

    const body = await req.json().catch(() => null);
    const sha = typeof body?.capture_sha === "string" ? body.capture_sha.toLowerCase() : "";
    if (!/^[0-9a-f]{64}$/.test(sha))
      return json({ ok: false, reason: "BAD_SHA", detail: REFUSALS.BAD_SHA }, 400);
    if (typeof body?.store !== "string")
      return json({ ok: false, reason: "BAD_STORE", detail: REFUSALS.BAD_STORE }, 400);
    const store = body.store;
    /* D-478: a NAMED namespace that is not exactly one of NAMESPACES is refused by name, and R2 is never touched. */
    if (!NAMESPACES.includes(store))
      return json({ ok: false, reason: "NAMESPACE_UNKNOWN", detail: REFUSALS.NAMESPACE_UNKNOWN,
                    asked: store.slice(0, 80), namespaces: [...NAMESPACES] }, 400);
    const pages = Array.isArray(body?.pages) ? body.pages : null;
    if (!pages || !pages.length)
      return json({ ok: false, reason: "BAD_PAGES", detail: REFUSALS.BAD_PAGES }, 400);

    let out;
    try {
      // I1 §2: the R2 key shape `pdf-worker` reads too. READ ONLY, and (R27) only the ranges the page needs.
      const source = await openCapture(env.CAPTURES, `${store}/captures/${sha}`);
      if (!source) return json({ ok: false, reason: "NOT_FOUND", detail: REFUSALS.NOT_FOUND, capture_sha: sha, store }, 404);
      out = await transcribeRequest(source, pages, { confidenceFloor: floorFrom(env), psm: psm.mode });
    } catch (e) {
      /* R28: the read of R2 itself, the one step outside `transcribeRequest`'s own guard. */
      const { take, deferred } = chooseChunk(pages);
      const one = unexpected(e, "read", take);
      out = { ok: false, reason: one.reason, detail: one.detail, page: take, stage: one.stage, error_name: one.error_name,
              deferred, notes: [], refusal: one };
    }
    /* A pages array naming no page this member can take is a MALFORMED REQUEST (R4), and is answered as one. */
    if (!out.ok && out.reason === "BAD_PAGES") return json(out, 400);
    /* Every other refusal is a 200 carrying `ok:false`: the member ANSWERED. The plane reads the STATUS before the
       body, and "the member failed on this document" must not read as "the member could not be reached". */
    return json(out);
  }

  /* Fleet rule 4, plus the ENGINE: this member's output is graded, so which engine answered is part of which build
     answered. `engine_loaded` is asked rather than assumed — a member deployed WITHOUT its wasm part looks healthy
     until the first page. */
  function handleVersion(env) {
    const why = engine.check();
    return json({ ok: true, name: "ocr-worker", version: env?.VERSION || "0.0.0",
                  engine: engine.name, engine_version: engine.version, model: engine.model,
                  engine_loaded: why == null, ...(why ? { engine_unavailable: why } : {}) });
  }

  async function fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/+/, "");
    if (req.method === "GET" && path === "version") return handleVersion(env);
    if (req.method === "POST" && (path === "transcribe" || path === ""))
      return handleTranscribe(req, env);
    return json({ ok: false, reason: "UNKNOWN", detail: "POST /transcribe or GET /version only" }, 404);
  }

  return { fetch, transcribeRequest, transcribeOnePage };
}
