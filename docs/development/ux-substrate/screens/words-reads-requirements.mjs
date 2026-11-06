/* words-reads-requirements.mjs — ux-design R2: the keys a module's requirements name, mark by mark, for a module whose words
   are all in the stream but whose source does not read them yet. words-reads.src.mjs lists them among the module's reads;
   the ux-design suite checks each resolves through setup-words to non-empty text. Each mark's keys are as its requirement
   names them (build/requirements/<module>.md); the lane changes no wording here. */
export const REQUIREMENT_READS_BY_MARK = {
  "screens-document-beta": {
    R60: ["screen.follow.document.laws"],
    R61: ["screen.document.text.partial.one", "screen.document.reading.beingread", "screen.document.reading.firstn", "document.read.more",
      "screen.document.supporting.notwalked.pending", "screen.document.supporting.notwalked.toolarge",
      "screen.document.supporting.notwalked.unavailable", "screen.document.unsupported.ico"],
    R62: ["screen.document.held.kind"],
    R63: ["thumbnail", "maker_note", "profile", "extra_picture", "after_end", "xmp", "credentials", "other_metadata", "unreadable"]
      .map((k) => `screen.photo.dropped.${k}`),
    R64: ["screen.document.interp.label"],
    R65: ["screen.document.interp.offer"],
    R66: ["screen.document.interp.chooser.will"],
    R67: ["screen.document.interp.recorded"],
    R68: ["screen.document.interp.legend.this"],
    R72: ["screen.document.text.unsure"],
  },
};
