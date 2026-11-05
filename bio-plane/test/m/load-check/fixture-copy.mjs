/* A scratch copy's door for load-check's tests: it answers ops in-process, grows its record from what is uploaded,
 * keeps a gauge, counts every request, and charges a cost a request. Its latency, failures and interpretation
 * ceiling are the test's to set. Not product; no other module's answer is built here (the copy is outside the
 * product's modules: it stands for a deployed Civicsmith). */
import "../../sandbox.mjs";
import { PERMITTED_ACCOUNT } from "../../../src/load-check/index.mjs";

export const CREDENTIAL = (process.env.LOAD_CHECK_TEST_CREDENTIAL ??= `lc-test-${Math.random().toString(36).slice(2, 14)}`);
export const INTERPRETATION_ACTS = ["cite", "proposalaccept"];
export const INTERPRETATION_READS = { interpretationOf: { op: "extractproposals" }, proposeParts: { op: "stepproposals" }, partsOf: { op: "proposals" } };

const pagesOf = (bytes) => (Buffer.from(bytes).toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
const isScan = (bytes) => /\/Subtype\s*\/Image/.test(Buffer.from(bytes).toString("latin1"));

export function fixtureCopy({
  account = PERMITTED_ACCOUNT, shared = false, team = "p3dev-load-team", name = "p3dev-load-1",
  latency = () => 50, fail = () => null, figure = null, onCall = null,
} = {}) {
  const state = { database_bytes: 4096, r2_bytes: 0, rows: 10, documents: 0, interpretation_rows: 0, requests: [], gauges: 0, uploads: 0 };
  const door = {
    async call(op, input, ctx) {
      state.requests.push({ op, members: ctx?.members, credential: ctx?.credentials === CREDENTIAL });
      onCall?.(op, input, ctx, state);
      const f = fail(op, ctx?.members ?? 0, state);
      if (f) return { ok: false, status: 409, code: f, body: { code: f, detail: `refused for ${CREDENTIAL}` }, net_ms: 5 };
      const base = { ok: true, status: 200, hops: 2, wait_ms: 3, net_ms: latency(op, ctx?.members ?? 0, state) };
      if (op === "captureupload") {
        const pages = pagesOf(input.bytes);
        state.uploads++;
        state.documents++;
        state.r2_bytes += input.size;
        state.database_bytes += isScan(input.bytes) ? pages * 40 : Math.round(input.size / 2);
        state.rows += pages;
        return { ...base, body: { document: `doc-${state.documents}` } };
      }
      if (op === "cite" || op === "proposalaccept") {
        if (figure !== null && state.interpretation_rows + 1 > figure) {
          return { ok: false, status: 409, code: "INTERPRETATION_CEILING", body: { code: "INTERPRETATION_CEILING", figure, held: state.interpretation_rows }, net_ms: 5 };
        }
        state.interpretation_rows++;
        state.rows++;
        state.database_bytes += 300;
        return { ...base, hold_ms: 4 };
      }
      return base;
    },
    async gauge() {
      state.gauges++;
      return { team, database_bytes: state.database_bytes, r2_bytes: state.r2_bytes, rows: state.rows, documents: state.documents };
    },
    async cost() { return state.requests.length * 0.0001; },
  };
  return { name, account, shared, credentials: CREDENTIAL, door, state };
}

/* a profile of declared ops: two screens and an act */
export const profile = (over = {}) => ({
  name: "t-profile", seed: "t", rounds: 6, think_ms: 0,
  items: {
    home: { weight: 25, reads: ["whoami", "queue"] },
    held: { weight: 10, reads: ["heldcaptures", "heldcaptures"] },
    share: { weight: 15, op: "cite", input: (ctx) => ({ document: ctx.documents[0]?.id ?? "doc-1", part: 1 }) },
    proposalsScreen: { weight: 5, reads: ["proposals"] },
  },
  ...over,
});

export const fast = { now: () => 0, sleep: async () => {} };
