/* agent-model (T53, R33) — a server-sent-events body read as its list of JSON data frames. Shared by the adapters,
 * which assemble the frames into the provider's non-streamed answer and decode that as usual. */

/** `[{event, data}]` from an SSE text; a frame whose data is not JSON is skipped, `[DONE]` ends the list. */
export function sseFrames(text) {
  const out = [];
  for (const chunk of String(text ?? "").split(/\r?\n\r?\n/)) {
    let event = null;
    const data = [];
    for (const line of chunk.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (!data.length) continue;
    const joined = data.join("\n");
    if (joined.trim() === "[DONE]") break;
    try { out.push({ event, data: JSON.parse(joined) }); } catch { /* not a frame */ }
  }
  return out;
}

/** Whether a response is an event stream. */
export const isStream = (headers) => /text\/event-stream/i.test(String(headers?.["content-type"] ?? ""));
