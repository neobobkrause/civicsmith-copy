/* Test helpers for pdf-worker's suites: a minimal PDF writer with a real xref
 * table (so pdf.js and any independent reader open it too), and the checks the
 * suites share. Not product code. */
import { createHash } from "node:crypto";
import { inflateSync, deflateSync } from "node:zlib";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

export const hex = (b) => createHash("sha256").update(b).digest("hex");
export { deflateSync };

/** A PDF from object bodies. A body is a string (latin1) or
 *  `{ dict: "<< … >>", data: Uint8Array }` for a stream with binary data, whose
 *  `/Length` is written for you. Object numbers are 1-based in order.
 *  `trailer` adds entries to the trailer dict (e.g. "/Encrypt 9 0 R"). */
export function makePdf(bodies, { trailer = "", header = "%PDF-1.7\n%\xe2\xe3\xcf\xd3\n" } = {}) {
  const parts = [Buffer.from(header, "latin1")];
  let len = parts[0].length;
  const offsets = [];
  bodies.forEach((body, i) => {
    offsets[i] = len;
    let chunk;
    if (typeof body === "string") {
      chunk = Buffer.from(localize("test-support.make-pdf.v1_0_obj_body_endobj", "{v1} 0 obj\n{body}\nendobj\n", { v1: String(i + 1), body: String(body) }), "latin1");
    } else {
      const dict = body.dict.replace(/>>\s*$/, ` /Length ${body.data.length} >>`);
      chunk = Buffer.concat([
        Buffer.from(localize("test-support.make-pdf.v1_0_obj_dict_stream", "{v1} 0 obj\n{dict}\nstream\n", { v1: String(i + 1), dict: String(dict) }), "latin1"),
        Buffer.from(body.data),
        Buffer.from("\nendstream\nendobj\n", "latin1"),
      ]);
    }
    parts.push(chunk);
    len += chunk.length;
  });
  const n = bodies.length + 1;
  let xref = `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  parts.push(Buffer.from(xref + `trailer\n<< /Size ${n} /Root 1 0 R ${trailer}>>\nstartxref\n${len}\n%%EOF\n`, "latin1"));
  return new Uint8Array(Buffer.concat(parts));
}

/** A content stream body. */
export const content = (ops) => `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`;

/** An image XObject body over raw sample bytes. */
export const image = (w, h, extra, data) =>
  ({ dict: `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} ${extra} >>`, data });

/** A one-page document: catalog 1, pages 2, page 3, content 4, then `more`
 *  objects from 5. `pageExtra` goes into the page dict, `pagesExtra` into /Pages,
 *  `res` is the /Resources body. */
export function onePage({ ops, res = "", pageExtra = "", pagesExtra = "", box = [0, 0, 612, 792], more = [], trailer = "" }) {
  return makePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [3 0 R] /Count 1 ${pagesExtra} >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [${box.join(" ")}] /Resources << ${res} >> /Contents 4 0 R ${pageExtra} >>`,
    content(ops),
    ...more,
  ], { trailer });
}

/** Read a PNG back with node's own zlib (not the subject's encoder): IHDR and the
 *  un-filtered scanlines, filter bytes removed. Only filter type 0 is accepted,
 *  and any other makes the read fail loudly. */
export function readPng(png) {
  const b = Buffer.from(png);
  if (b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("not a PNG");
  let o = 8, ihdr = null;
  const idat = [];
  while (o < b.length) {
    const n = b.readUInt32BE(o), type = b.toString("latin1", o + 4, o + 8), data = b.subarray(o + 8, o + 8 + n);
    if (type === "IHDR") ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9] };
    if (type === "IDAT") idat.push(data);
    o += 12 + n;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const comps = ihdr.colorType === 2 ? 3 : 1;
  const rowBytes = Math.ceil((ihdr.width * comps * ihdr.bitDepth) / 8);
  const samples = Buffer.alloc(rowBytes * ihdr.height);
  for (let y = 0; y < ihdr.height; y++) {
    if (raw[y * (rowBytes + 1)] !== 0) throw new Error(`PNG row ${y} uses filter ${raw[y * (rowBytes + 1)]}`);
    raw.copy(samples, y * rowBytes, y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1));
  }
  return { ...ihdr, rowBytes, samples: new Uint8Array(samples) };
}

/** Rotate a W×H grid of per-pixel values clockwise by `deg`, written from the
 *  definition (pixel (x,y) of the turned picture), independently of the subject. */
export function turn(get, w, h, deg) {
  const W = deg % 180 ? h : w, H = deg % 180 ? w : h;
  const at = (X, Y) => deg === 90 ? get(Y, h - 1 - X) : deg === 180 ? get(w - 1 - X, h - 1 - Y)
    : deg === 270 ? get(w - 1 - Y, X) : get(X, Y);
  return { W, H, at };
}

/** A tiny assertion runner. Every label names the requirement it checks. A run
 *  that ends before `done()` prints a failing tally rather than a silent one. */
export function runner(name) {
  let pass = 0, fail = 0, done = false;
  process.on("exit", () => { if (!done) console.log(`\n${name}: ${pass} passed, ${fail + 1} failed — ended before its foot`); });
  const t = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
    ok ? pass++ : fail++;
  };
  const finish = () => {
    done = true;
    console.log(`\n${name}: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  };
  return { t, finish };
}
