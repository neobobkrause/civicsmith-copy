/* registers: the reduced copy's one form read back (register-readers R9: UTF-8, comma, LF, a field quoted only when it needs it). */

/* The reduced copy's one form (register-readers R9): UTF-8, comma, LF, a field quoted only when it needs it. A tiny streaming parser of it. */
export function reducedParser(onRecord) {
  let field = "", row = [], quoted = false, justQuoted = false, started = false;
  const endField = () => { row.push(field); field = ""; justQuoted = false; };
  const endRow = () => { endField(); const r = row; row = []; started = false; onRecord(r); };
  let pendingQuote = false;
  return {
    feed(text) {
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (pendingQuote) {
          pendingQuote = false;
          if (c === '"') { field += '"'; continue; }
          quoted = false; justQuoted = true;
        }
        if (quoted) { if (c === '"') pendingQuote = true; else field += c; continue; }
        if (c === '"' && field === "" && !justQuoted) { quoted = true; started = true; continue; }
        if (c === ",") { started = true; endField(); continue; }
        if (c === "\n") { endRow(); continue; }
        if (c === "\r") continue;
        started = true; field += c;
      }
    },
    end() { if (pendingQuote) { pendingQuote = false; quoted = false; } if (started || field !== "" || row.length) endRow(); },
  };
}


export const csvField = (v) => { const s = v == null ? "" : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
