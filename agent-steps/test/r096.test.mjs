/* R085-18 (K3501) — R96 `ids` forwarded, R97 contracts built with agent-harness R12 (subjects, targets, arms), R98 each
 * usage entry's own model, R99 wallclock measured, R100 a cited address with an extent resolves by its record id.
 *
 * One check run is driven in this process over a recording plane and a model that answers as the Messages API does:
 * its plan names targets, its sub-sessions read (the first with `ids`, the others without) and report, the first two
 * citing a record with an extent and an address that names no held record. Every arm that admits has its
 * refusing or absent counterpart beside it (K874). */
import "../../bio-plane/test/sandbox.mjs";
import worker from "./shell.mjs";
import { ACCOUNT } from "./account.mjs";
import { MEANING } from "../../bio-plane/src/query.mjs";
import { MODEL_FOR_MODE, SUBSESSION_MODEL } from "../../agent-model/src/model.mjs";
import { LEVELS } from "../../agent-harness/src/harness.mjs";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass += 1; else fail += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

const AIK = "aik-" + "d".repeat(64);
const PACK_VERSION = "investigative-session@r096+0000000000000000";
const PACK = { id: "investigative-session", edition: "r096", version: PACK_VERSION,
               resident: { objective: { text: "find what the record holds" }, disclosable: [] }, disclosed: {} };
const WIDE = [{ bound: "fetches", allowed: 50 }, { bound: "subsessions", allowed: 50 },
              { bound: "wallclock", allowed: 5000000 }, { bound: "runtime", allowed: 5000 }];
const READ_LIMIT = 7; /* the limit every sub-session read asks for, to tell them from the parent's own reads */

function planeStub(rec) {
  const ok = (result) => Response.json({ ok: true, result, store: "scratch", tokenClass: "ai", version: "r096" });
  return { fetch: async (url, init) => {
    const u = new URL(url);
    const op = u.searchParams.get("op") || "";
    const body = init && typeof init.body === "string" ? JSON.parse(init.body) : null;
    rec.calls.push({ op, body, query: Object.fromEntries(u.searchParams.entries()) });
    switch (op) {
      case "whoami": return ok({ tokenClass: "ai", session: false, member: null });
      case "airun": return ok({ run: u.searchParams.get("run"), found: true, session: {
        id: u.searchParams.get("run"), mode: "check", status: "running", context: { type: "inquiry", id: "INQ-096" },
        max_passes: 1, principal: { plane: "member:ruth", claude: ACCOUNT.member, ref: ACCOUNT.member, skill: PACK_VERSION },
        state: null, budget: WIDE.map((b) => ({ ...b, consumed: 0, unit: null })) } });
      case "airunlog": return ok({ run: u.searchParams.get("run"), found: true, entries: [], limit: 200, truncated: false });
      case "agentpack": return Response.json({ ok: true, fences: [], pack: PACK, store: "scratch", tokenClass: "ai" });
      case "airunspawn": return ok({ found: true, half: "search", payload: { run: u.searchParams.get("run"),
        context: { type: "inquiry", id: "INQ-096" }, mode: "check", skill: PACK_VERSION, standard_pair: null,
        subjects: { items: [{ id: "INQ-LEG-1", extent: "¶1", kind: "leg" }] } } });
      case "meaningrows": return ok({ ok: true, arm: "leg", rows: [], scope: { documents: 3, documents_with_rows: 0, documents_without_rows: 3 }, count: 0 });
      case "basisversions": return ok({ id: u.searchParams.get("id"), versions: [], limit: 50, truncated: false });
      case "search": {
        const held = /^id:"INFO-1"$/.test(u.searchParams.get("q") || "");
        return ok({ hits: held ? [{ bundle_id: "INFO-1", source_locator: "upload:abc" }] : [] });
      }
      case "versionchain": {
        const held = u.searchParams.get("address") === "upload:abc";
        return ok({ address_norm: held ? "upload:abc" : null, total: held ? 1 : 0, truncated: false,
                    versions: held ? [{ bundle_id: "INFO-1", capture_sha: "s".repeat(8) }] : [] });
      }
      case "suggest": return ok({ wrote: true });
      case "airuntick": return ok({ run: body.run, found: true, ticked: true, status: "running",
                                    appended: (body.log || []).length, refused: [] });
      case "airunclose": return ok({ terminated: true, bound: body?.bound ?? null });
      default: return Response.json({ ok: false, error: "unknown op: " + op }, { status: 400 });
    }
  } };
}

/* The model. The plan names two targets at two levels; the sub-sessions read once each (the first with a long `ids`
   list among bad entries) and report, citing a record with an extent and, in the second, an address no record holds. */
function modelAnswer(rec) {
  let sub = 0;
  return (body) => {
    const names = (body.tools || []).map((x) => x.name);
    const last = body.messages[body.messages.length - 1];
    const answered = Array.isArray(last?.content)
      && last.content.some((b) => b.type === "tool_result" && !String(b.tool_use_id).startsWith("facts_"));
    if (names.includes("report") && !answered) {
      sub += 1;
      const ids = sub === 1 ? { ids: [...Array.from({ length: 25 }, (_, i) => `REC-${i}`), 5, ""] } : {};
      return [{ type: "tool_use", id: "q", name: "meaningrows", input: { rows: "leg", q: "", limit: READ_LIMIT, ...ids } }];
    }
    if (names.includes("report")) {
      const address = sub === 1 ? "INFO-1 ¶1" : sub === 2 ? "nothing-held#x" : null;
      return [{ type: "tool_use", id: "r", name: "report", input: address
        ? { state: "PRESENT", summary: "found it", citations: [{ address }] }
        : { state: "LOOKED_ABSENT", summary: "nothing here" } }];
    }
    const prompt = [...body.messages].reverse().map((m) => (m.role !== "user" ? "" : typeof m.content === "string"
      ? m.content : (Array.isArray(m.content) ? m.content.filter((c) => c.type === "text").map((c) => c.text).join("") : "")))
      .find((c) => /judge_/.test(c)) || "";
    const step = (/Answer by calling judge_([a-z]+)/.exec(prompt) || [])[1] || "";
    const input = step === "plan"
      ? { targets: [{ level: "meaning", target: "INFO-1 ¶1" }, { level: "content", target: "INFO-2" },
                    { level: "document" }, { level: "meaning", target: "  " }] }
      : {};
    return [{ type: "tool_use", id: "j", name: `judge_${step}`, input }];
  };
}

async function run(clock = null) {
  const rec = { calls: [], requests: [] };
  const answer = modelAnswer(rec);
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const sent = JSON.parse(init.body);
    rec.requests.push(sent);
    return Response.json({ id: "msg", type: "message", role: "assistant", content: answer(sent), stop_reason: "tool_use",
      usage: { input_tokens: 1, output_tokens: 1 } });
  };
  try {
    const res = await worker.fetch(new Request("http://agent-worker/run", { method: "POST", body: JSON.stringify({
      run_id: "RUN-r096", store: "scratch", credential: AIK, account: ACCOUNT }) }),
      { VERSION: "r096", PLANE: planeStub(rec), ...(clock ? { CLOCK: clock } : {}) });
    return { status: res.status, out: await res.json(), rec };
  } finally { globalThis.fetch = saved; }
}

const stepped = await run();
const { out, rec } = stepped;
t("ARMED: the check run completed over the model, and every level reported", [stepped.status, out.ok, out.judgement_source, out.reports_taken],
  [200, true, "model", LEVELS.length]);
const reads = rec.calls.filter((c) => c.op === "meaningrows" && Number(c.query.limit) === READ_LIMIT);

console.log("\n--- R24 · a sub-session's meaningrows call forwards ids ---");
t("R24: a tool call with ids reaches op=meaningrows with them — at most 20, each a non-empty string, others dropped",
  reads[0]?.body, { ids: Array.from({ length: 20 }, (_, i) => `REC-${i}`) });
t("R24 (control): a call without ids sends none", [reads.length, reads.slice(1).map((c) => c.body)], [LEVELS.length, [null, null, null]]);

console.log("\n--- R25 · each contract is built with agent-harness R12 ---");
const contracts = out.fanout.contracts;
t("R25: every contract carries every arm query-language's MEANING declares, in its order",
  contracts.map((c) => c.arms), LEVELS.map(() => Object.keys(MEANING)));
t("R25: the arms are read from MEANING, and it declares some", Object.keys(MEANING).length > 1, true);
t("R25: a subject the search half carries and the target the plan named for the level are both in the contract",
  contracts[0].subjects, [{ id: "INQ-LEG-1", extent: "¶1", kind: "leg" }, { id: "INFO-1", extent: "¶1", kind: "target" }]);
t("R25: the target is the level's own — another level's names its own, a level named none has the payload's alone",
  [contracts[1].subjects.map((s) => s.id), contracts[2].subjects.map((s) => s.id)], [["INQ-LEG-1", "INFO-2"], ["INQ-LEG-1"]]);
t("R25 (control): a target naming no subject is no subject",
  contracts.flatMap((c) => c.subjects).filter((s) => !String(s.id ?? "").trim()), []);
t("R25: the keys are R6's with subjects and arms after scope",
  Object.keys(contracts[0]).slice(Object.keys(contracts[0]).indexOf("scope")).slice(0, 3), ["scope", "subjects", "arms"]);

console.log("\n--- R26 (T53) · each usage entry names the entry and label its conversation answered ---");
const entries = rec.calls.filter((c) => c.op === "airuntick").flatMap((c) => c.body.usage || []);
t("R26: every entry has exactly ai-runs' tick shape {mode, entry_id, label, usage, calls}",
  [entries.length > LEVELS.length, [...new Set(entries.map((e) => Object.keys(e).join(",")))]], [true, ["mode,entry_id,label,usage,calls"]]);
t("R26 (control): converse answers no entry or label yet (agent-model's T53), so each states null, never a model named here",
  entries.filter((e) => e.entry_id !== null || e.label !== null), []);
t("R26 (control): no entry names the model of its mode", entries.filter((e) => JSON.stringify(e).includes(MODEL_FOR_MODE.check) || JSON.stringify(e).includes(SUBSESSION_MODEL)), []);

console.log("\n--- R27 · each tick carries the milliseconds since the previous one ---");
let now = 1_000_000;
const timed = await run(() => (now += 1500));
const walls = timed.rec.calls.filter((c) => c.op === "airuntick" && c.body.consume).map((c) => c.body.consume.wallclock);
t("R27: with an injected clock 1,500 ms apart, every tick carries wallclock 1500, the second included",
  [walls.length > 2, walls.every((w) => w === 1500)], [true, true]);
t("R27: the figure is the run's wallclock consumption, summed as the record will hold it",
  timed.out.budget.find((b) => b.bound === "wallclock").consumed, walls.reduce((a, b) => a + b, 0));
let back = 1_000_000;
const rewound = await run(() => (back -= 1500));
t("R27 (control): a clock that runs backwards gives no negative figure",
  rewound.rec.calls.filter((c) => c.op === "airuntick" && c.body.consume).map((c) => c.body.consume.wallclock).every((w) => w === 0), true);
t("R27 (control): without a clock, the figure is a non-negative whole number of milliseconds",
  rec.calls.filter((c) => c.op === "airuntick" && c.body.consume)
    .every((c) => Number.isInteger(c.body.consume.wallclock) && c.body.consume.wallclock >= 0), true);

console.log("\n--- R28 · a cited address with an extent resolves by its record id ---");
const searches = rec.calls.filter((c) => c.op === "search").map((c) => c.query.q);
t("R28: `<id> ¶1` is looked up by its record id, never as one string", [searches.includes('id:"INFO-1"'), searches.includes('id:"INFO-1 ¶1"')], [true, false]);
const chains = rec.calls.filter((c) => c.op === "versionchain").map((c) => c.query.address);
t("R28: the held record's version chain is read at its source address", chains.includes("upload:abc"), true);
t("R28: the re-read uses the record id", rec.calls.some((c) => c.op === "meaningrows" && Number(c.query.limit) === 1
  && JSON.stringify(c.body) === JSON.stringify({ ids: ["INFO-1"] })), true);
t("R28: a report citing `<id> ¶1` of a held record counts that document held",
  [out.holdings.documents, out.holdings.by_document?.[0]?.record_id], [1, "INFO-1"]);
t("R28 (control): an address naming no held record is read as the address it is",
  [searches.includes('id:"nothing-held"'), searches.includes('id:"nothing-held#x"'), chains.includes("nothing-held#x")], [true, true, true]);
t("R28 (control): …and holds nothing", out.holdings.documents, 1);

console.log(`\nr096: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
