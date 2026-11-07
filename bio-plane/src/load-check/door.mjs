/* The plain door to a deployed copy: one HTTP request an op, the credential in its header and nowhere else (R2).
 * The gauge is the copy's own (screens-settings), read by the op the caller names. Not verified against a live
 * copy by this module's tests; they speak through a fixture door with the same shape. */
export function httpDoor({ address, gauge_op = null, fetch: f = globalThis.fetch } = {}) {
  const base = String(address ?? "").replace(/\/+$/, "");
  const call = async (op, input, { credentials } = {}) => {
    const token = typeof credentials === "string" ? credentials : credentials?.token;
    const t0 = performance.now();
    const r = await f(`${base}/api?op=${encodeURIComponent(op)}`, {
      method: "POST", body: JSON.stringify(input instanceof Object && input.bytes ? { ...input, bytes: Buffer.from(input.bytes).toString("base64") } : input ?? {}),
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    const net_ms = performance.now() - t0;
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    const timing = r.headers.get("server-timing") ?? "";
    const wait = /(?:^|,)\s*wait;dur=([\d.]+)/.exec(timing);
    return { ok: r.ok && body?.ok !== false, status: r.status, code: body?.code, body, net_ms, ...(wait ? { wait_ms: Number(wait[1]) } : {}) };
  };
  return {
    call,
    async gauge({ credentials } = {}) {
      if (!gauge_op) return null;
      const a = await call(gauge_op, {}, { credentials });
      return a.ok ? a.body : null;
    },
  };
}
