Length: 50 lines. Last section: "Suggestions".

# image-cover: requirements

Next number: 12

## Public

### Purpose

Covers marked areas of a photo with solid colour and answers a new image carrying nothing of the original but its pixels, so a published case can carry a copy with faces and number plates obscured. It also strips an image's metadata without re-encoding it, for an image embedded in a member's document. Pure; it knows nothing of cases, storage or place.

### Provides

**`coverAreas(bytes, {areas}) → Promise of {ok:true, bytes, format, width, height, covered}` or `{ok:false, code, detail}`**
- **R1** [met] For a baseline or extended-sequential Huffman 8-bit JPEG (the set `image-codecs` R1 decodes) or an 8-bit, non-interlaced PNG: each area `[x0, y0, x1, y1]` is in the image's pixels as displayed (its EXIF orientation applied). Every JPEG block, or PNG pixel, an area touches becomes one solid colour; the cover is snapped outward to whole blocks, never inward. Outside every area, a JPEG's blocks keep their coefficients unchanged (no re-compression loss) and a PNG's pixels are unchanged. `covered` counts the blocks or pixels covered. An empty `areas` answers a copy with nothing covered (R2 still holds).
- **R2** [met] The answer carries nothing of the original but its pixels: no EXIF, XMP, IPTC, comment or other metadata segment or chunk, no thumbnail, no second image or gain map, nothing after the image's end; only the orientation is kept (as a minimal EXIF holding Orientation alone, or by writing the pixels upright), with what decides how the pixel data decodes (JFIF's APP0 without a thumbnail, Adobe's APP14 transform flag, a PNG's palette and `tRNS`), written fresh; a colour profile is not carried, so a covered face is never visible in any part of the copy.
- **R3** [met] Refusals by name, nothing answered but the refusal: `NOT_A_COVERABLE_FORMAT` (neither format, e.g. HEIC); `UNSUPPORTED_JPEG_PROCESS` (progressive, arithmetic-coded, lossless or 12-bit); `PNG_INTERLACED`; `AREA_MALFORMED` (not four integers with `x0 < x1`, `y0 < y1`); `AREA_OUTSIDE` (an area wholly outside the image); `PHOTO_TOO_LARGE` (over `COVER_MAX_BYTES`, nothing read, or declaring more pixels than `COVER_MAX_PIXELS`, nothing decoded; both exported, each quoted from `READ_BOUNDS` (`boundOf("image", "cover_bytes")`, `boundOf("image", "pixels")`, the alpha column, today's figures; the pixels figure 120,000,000 is the one every image route uses)); `TRUNCATED_IMAGE_DATA` (the data ends before the image does); `IMAGE_DATA_CORRUPT` (the data cannot be read: a bad Huffman code or table, a wrong restart marker, a PNG CRC or zlib error), its `detail` naming the fault; (fix round 9, G125c; K4831 (8)) `IMAGE_TOO_LARGE` (R10). Renaming or removing a code is a change to this requirement.
- **R4** [met] It works in the plane's isolate (128 MB): it streams, never holding a decoded frame of the whole image; its time and memory on a 12 MP and a 48 MP phone JPEG are measured in workerd by its own test and stated in the job's record.
- **R5** [met] Each answer is checked against an independent decoder (libjpeg-turbo or an equivalent reference for JPEG, a reference PNG decoder for PNG) over fixtures that carry the reference's hashes: the blocks or pixels outside every area equal the original's decode, each covered block or pixel is the cover colour, and no metadata of R2 is present; never against this module's own earlier output.

**`stripMetadata(bytes) → {ok:true, bytes, format, changed}` or `{ok:false, code, detail}`**
- **R8** [met] (T39; N806; K2315, K2333) For a JPEG of any process, a PNG (interlaced or not), a GIF, a WebP or a JP2/J2K codestream: the answer carries no segment, chunk or box R2 forbids, keeps what R2 says decides how the pixel data decodes (and the orientation, as R2 keeps it), and never re-encodes: the coded image data is byte-identical to the original's. `format` names the format read; `changed` is `false` exactly when nothing was removed, and then `bytes` equal the input. Refusals by name, nothing answered but the refusal: `NOT_A_STRIPPABLE_FORMAT` (none of these formats), `PHOTO_TOO_LARGE` (over `COVER_MAX_BYTES`, nothing read), `TRUNCATED_IMAGE_DATA`, `IMAGE_DATA_CORRUPT` (its segments, chunks or boxes cannot be walked), `ANIMATED_IMAGE` (a GIF of more than one frame, an animated PNG or an animated WebP: R2 allows one image), and (fix round 9) `IMAGE_TOO_LARGE` (R10), `detail` naming the fault. Never throws.
- **R9** [met] (T39; N806; K2315, K2333) (test) For each format of R8, including a progressive JPEG and an interlaced PNG, a reference decoder's pixels for the answer equal its pixels for the input, and no metadata R2 forbids is present in the answer; checked over fixtures carrying the reference's hashes, never against this module's own earlier output.
- **R10** [met] (fix round 9, G125c; K4831 (8)) **Declared sizes are judged before any buffer.** `coverAreas` and `stripMetadata` judge, from the headers and before any buffer is allocated, a PNG's row stride (width times bytes per pixel) against `boundOf("image", "row_stride")` (protective, proposed 8 MiB) and the number of chunks (PNG), markers (JPEG) or boxes (JP2) against `boundOf("image", "chunks")` (protective, proposed 65,536), in addition to R3's pixels. A breach is `IMAGE_TOO_LARGE` with `detail` naming the declared size and the bound; it is deterministic and final, and the isolate lives: a 70-byte PNG declaring 30,000,000 x 1 RGBA, a PNG of 1,000,000 empty IDAT chunks, a JPEG of 2,000,000 two-byte markers, the image inside an uploaded DOCX and a marked photo in a case are each refused without the allocation they asked for, and a stride or count within the bounds is processed as before.

## Private

### Uses

- `runtime-limits`: `READ_BOUNDS` and `boundOf(kind, name)` for every ceiling this module keeps (R3, R10, R11).
- `image-codecs`: `readJpegHeader` (the header and process it reads, and its refusal codes). `test-support` for tests.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R6** [met] Pure: the same bytes and areas always answer the same bytes; no clock, no randomness, no I/O, no state between calls.
- **R7** [met] No place is named in this module's code or in any refusal text.
- **R11** [met] (fix round 9, G124; K4835 (1)) No numeric literal in this module's code is a ceiling it keeps (`COVER_MAX_BYTES`, `COVER_MAX_PIXELS`, R10's stride and count): each is read from `READ_BOUNDS`, and a test reads the module's `src` and finds none.

### Satisfies

- Bob's K2315 (N806, packaged by BOB's K2333): an image embedded in a file a member uploaded leaves a published case without its metadata; R8–R9 strip it for `doc-clean`.
- DEC-180 (4) (Bob, K2108): the copy a published case carries shows the marked areas obscured; the design detail answering B97: Civicsmith obscures each marked area itself, with a solid cover, and no AI vision runs over the group's photos.

### Suggestions

- In the DCT domain: entropy-decode one MCU row at a time, set each touched block to a DC-only block (AC zero) of the cover colour, re-encode the Huffman data with the same tables (or optimal ones) and write a fresh container (SOI, the minimal APP1 if kept, DQT, SOF, DHT, SOS, data, EOI). For PNG: inflate and unfilter row by row, cover, filter and deflate (`pdf-worker/src/pagepixels.mjs`:706–831 has a PNG writer to read, not import).
- R8 walks the container and copies kept structures byte for byte: JPEG markers up to SOS, the entropy-coded data and EOI; PNG chunks; GIF blocks (dropping comment and application extensions); WebP's RIFF chunks (dropping `EXIF` and `XMP `, and clearing their flags in `VP8X`); JP2 boxes (dropping `xml `, `uuid` and similar boxes) or a J2K codestream's COM markers.
- `bio-plane/src/image-cover/` keeps it inside the plane's bundle, where `case-carriage` calls it.
