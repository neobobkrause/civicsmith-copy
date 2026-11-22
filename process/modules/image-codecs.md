Length: 62 lines. Last section: "Suggestions".

# image-codecs: requirements

Next number: 14

## Public

### Purpose

Pure image decoders: an image stream's bytes to samples, pixel-exact against an independent reference decoder, or a declared refusal. It knows nothing of PDF, storage or place; PNG it reads as an input (R10) and writes none.

### Provides

**`decodeBaselineJpeg(d, {rotate, expectComps, colorTransform}) → samples`, `readJpegHeader(d)`, `colourTransformOf(h)`, `DctRefusal`** (`dctdecode.mjs`)
- **R1** [met] Decodes a baseline or extended-sequential Huffman, 8-bit JPEG to 8-bit samples bit-exact with libjpeg (ISLOW IDCT, fancy chroma upsampling, fixed-point YCbCr, libjpeg's colour-transform rule, which `colourTransformOf` states for a header). Anything else throws a `DctRefusal` carrying its own `code` and a `detail` that says why (which process, which sampling, where the data ran out); `pdf-pixels` maps each code to its own reasons. (T38; N782, K2179) `readJpegHeader(d)` answers the frame's header with its Huffman tables: `hts.dc[i]` and `hts.ac[i]` for each table id `i`, each `{maxcode, valptr, mincode, symbols, fast, FAST}` as R1's decoding reads them, the fields' types and lengths stated by a test that pins them; `image-cover` reads them (its R1), so changing that shape is a change to this requirement. (T44; N868; K2702) `decodeBaselineJpeg` converts colour row by row from the subsampled planes, as libjpeg's context rows do, never holding a full-size upsampled chroma plane beside its output; its output is unchanged, bit-exact with libjpeg (R6). Its live set at 4:2:0 is at most about 4.5 bytes per pixel (PDF-PIXELS #4 J2), and the job measures and records it for 4:2:0, 4:2:2, 4:4:4 and grey.

**`ccittDecode(data, {K, columns, rows, byteAlign}) → packed 1-bit rows`** (`ccittdecode.mjs`)
- **R2** [met] Decodes CCITT Group 3 one-dimensional (`K = 0`) and Group 4 (`K < 0`) data to packed 1-bit rows, one per decoded row. Mixed mode (`K > 0`) is refused. A stream that cannot be read is refused; a stream ending early returns the rows decoded, so the caller can see fewer rows than it declared.

**`decodeJbig2(data, globals) → samples`, `JBIG2_REFUSES`, `Jbig2Refusal`** (`jbig2decode.mjs`)
- **R3** [met] Decodes JBIG2 embedded streams, with their `JBIG2Globals`: at least generic and generic-refinement regions, symbol-dictionary and text regions, MMR/Huffman and arithmetic coding; pattern and halftone regions where built (K43). What it cannot decode throws a `Jbig2Refusal`: an unsupported feature as code `UNSUPPORTED` whose `detail.feature` is a key of `JBIG2_REFUSES` (the segment type), and damaged or short data under the codec's own codes. (Fix round 9, G132l (d)) A region taller than its data is refused under the damaged-or-short-data code, as R5's overrun detection finds it; rows are never invented to fill it.

**`decodeJpx(d) → samples`, `JPX_REFUSES`, `JpxRefusal`** (`jpxdecode.mjs`)
- **R4** [met] Decodes a JPEG 2000 codestream or JP2 file. What it cannot decode throws a `JpxRefusal`: an unsupported feature as code `UNSUPPORTED` whose `detail.feature` is a key of `JPX_REFUSES`, and damaged or short data under the codec's own codes. A decode whose working set would pass the memory bound is refused `IMAGE_TOO_LARGE` (R12) before any allocation, with the working set, the bound and the image's size in `detail` (N34); the `JPX_REFUSES` key "an image past the memory bound" is retired by this (R7). (Fix round 9, G125b) The precinct and tile objects a codestream's header implies are counted against the table's retained-objects bound before the object table is built, so a ~170-byte codestream cannot cost a gigabyte.

**`MqDecoder`, `mqContexts(n)`** (`mq.mjs`)
- **R5** [met] The MQ arithmetic decoder (ITU-T T.88 Annex E, T.800 Annex C) shared by R3 and R4: the same bytes and context states decode the same decisions as the standard's reference procedure. (Fix round 9, G132l (d)) Running past the end of the data is detected as the bytes are consumed, not after the region is built: a decode that has consumed more than the data holds stops with the short-data refusal of its codec.

**All codecs**
- **R6** [met] Each decode is checked pixel-exact against a named independent decoder over fixtures that carry the raw stream and the reference's hash (libjpeg-turbo for R1, jbig2dec for R3, OpenJPEG for R4, Pillow over PngSuite for R10 (T43); CCITT against the page fixtures' reference hashes), never against this module's own earlier output.
- **R7** [met] Every `UNSUPPORTED` refusal's feature is a key of that codec's declared set (`PNG_REFUSES` for R10, T43), and every key is reachable; renaming or removing a key, or a refusal code, is a change to this requirement.

- **R10** [met] (T43; N853b; K2611, K2691) `decodePng(bytes) → Promise<samples>`, `PNG_REFUSES`, `PngRefusal` (`pngdecode.mjs`): colour types 0, 2, 3, 4 and 6 at every legal depth, filters 0–4, IDAT inflated by `DecompressionStream("deflate")`, to 8-bit samples (alpha composited over white, 16-bit to its high byte, a palette expanded). An interlaced image is `UNSUPPORTED` with a `PNG_REFUSES` key; a frame over the memory bound, judged from the header before allocation, is `IMAGE_TOO_LARGE` (R12, fix round 9); damaged or short data is refused under the codec's own codes. Pixel-exact against Pillow over PngSuite (R6).
- **R11** [met] (T44; N868; K2701, K2702) `decodeBaselineJpegRows(d, {expectComps, colorTransform, onRows})` decodes the same JPEGs as R1, with the same refusals (`DctRefusal`, the same codes and details), one MCU row at a time, top to bottom, never rotating. It hands each strip's finished 8-bit rows to `onRows(rows, y0, count)` in order; joined, they equal R1's output with `rotate: 0`, byte for byte, for every sampling R1 decodes. It holds no full-size plane: its live set is the input, one MCU row of coefficients and samples per component with the context rows, and the strip being handed over; the job states that bound and measures it. (K2737, wording) `rows` is a `Uint8Array` of `count` rows, each `width × comps` bytes, interleaved as R1's samples with `rotate: 0`, `y0` the first row's index in the unrotated frame; the decoder may reuse `rows` once `onRows` returns.
- **R12** [met] (fix round 9, G125a, G125b; K4831 (8), K4834) **Declared sizes are judged before any allocation.** Each decoder (JPEG, CCITT, JBIG2, JPX, PNG) judges what the header or its parameters declare — width, height, components, bit depth, row stride, region and page dimensions, tile, precinct and chunk counts — against `READ_BOUNDS` (`boundOf("image", "pixels")`, the existing `COVER_MAX_PIXELS` 120,000,000; `"edge"` 65,535; `"row_stride"` 8 MiB; the retained-objects bound for JPX objects, 250,000 proposed, BOB confirming for JPX) before any buffer or table is allocated and before any data is decoded. A breach is the refusal code `IMAGE_TOO_LARGE`, in the codec's own refusal class (`DctRefusal`, `Jbig2Refusal`, `JpxRefusal`, `PngRefusal`, and CCITT's refusal), its `detail` giving the declared size and the bound; it is deterministic and final, never `transient`, and nothing above the stated figure is allocated (an 8 KB CCITT stream declaring 60,000 x 60,000; a 330-byte JPEG declaring 60,000 x 60,000; a JBIG2 declaring 16,000 x 16,000 from 20 bytes; a JPX of 2,000 x 2,000 with 2 x 2 precincts and 10 bytes of data: each refused from the header, one decode call made). A file within the bounds decodes as before.

## Private

### Uses
- `runtime-limits`: `READ_BOUNDS` and `boundOf(kind, name)` for every ceiling a decoder keeps (R4, R10, R12, R13).
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R8** [met] Pure: the same bytes and options always answer the same way; no clock, no randomness, no I/O, no state carried between calls.
- **R9** [met] No place is named in this module's code or in any refusal text; it holds no jurisdiction data.
- **R13** [met] (fix round 9, G124; K4835 (1)) No numeric literal in this module's code is a ceiling it keeps: each (R4, R10, R12) is read from `READ_BOUNDS`, and a test reads the module's `src` and finds none.

### Satisfies

- `BIO_Content_Framework_v0_10.md` §16, "The non-text path, in three tiers": the pixel decode tier 3 reads through.
- `docs/development/EXTRACTION-BREADTH-DESIGN.md` §6 (D-320, the DCT decoder).

### Suggestions

- The CCITT decoder is today in `pagepixels.mjs` (about lines 696–931: its tables, `BitReader`, `readRun`, `b1`, `b2`, `ccittDecode`); the split job moves it to `ccittdecode.mjs`, leaving `getBit`/`setBit` with rotation in `pdf-pixels`, which imports `ccittDecode` from here.
- The fixtures under `pdf-worker/test/fixtures/` already hold each raw stream and its reference hash (`stream_b64`/`globals_b64` with `jbig2dec_sha256`; `data_b64` with `opj_sha256`; the DCT variants likewise): direct decoder tests in `pdf-worker/test/codecs/` can be written from them.

---

**Status (fix round 9)** · Last changed T51 fix round 9 (BOB; K4831, K4834, K4837: R3, R4, R5, R10 amended; R12, R13 new; marked not yet met T51).
