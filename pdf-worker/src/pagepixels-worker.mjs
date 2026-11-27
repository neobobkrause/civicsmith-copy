/* A throwaway entry point that exists so `pagepixels.mjs` can be driven INSIDE
 * WORKERD rather than only in node. The placement question CPDF-12 answers is
 * "does this run in the runtime a fleet member actually runs in", and a module
 * that passes in node has answered a different question — CPDF-5 paid for that
 * distinction when pdf.js threw `Math.sumPrecise is not a function` on node and
 * ran clean on workerd.
 *
 * It is NOT the member's surface: `pdf-worker/src/index.mjs` declares the fleet
 * surface, and adding a route there is a change to I6 that belongs with the
 * CPDF-10 item that will consume the pixels, not with the measurement that
 * establishes they exist. This file is imported only by the `--workerd` arm of
 * `pagepixels-corpus.probe.mjs`; the suites' workerd arms bundle their own entry.
 */
import { renderPageToPixels } from "./pagepixels.mjs";

export default {
  /** @param {{ url: string, arrayBuffer: () => Promise<ArrayBuffer> }} request the request workerd hands its entry */
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/render") return new Response("not found", { status: 404 });
    const page = Number(url.searchParams.get("page") ?? "0");
    const bytes = new Uint8Array(await request.arrayBuffer());
    let r;
    try {
      r = await renderPageToPixels(bytes, page);
    } catch (e) {
      return Response.json({ ok: false, reason: "THREW", message: String(e instanceof Error ? e.message || e : e) }, { status: 500 });
    }
    if (!r.ok) return Response.json(r);
    if (url.searchParams.get("raw") === "1") {
      return new Response(r.bytes, { headers: { "content-type": r.mediaType } });
    }
    // A digest rather than the bytes: the point of the workerd arm is that the
    // decode HAPPENED there, and a digest is checkable against the node run
    // while a megabyte of pixels through the harness is not.
    const d = await crypto.subtle.digest("SHA-256", r.bytes);
    return Response.json({
      ok: true, route: r.route, mediaType: r.mediaType, width: r.width, height: r.height,
      bytes: r.bytes.length,
      sha256: [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""),
      pixels_sha256: r.pixels_sha256 ?? null,
      source: r.source, page_geometry: r.page_geometry,
    });
  },
};
