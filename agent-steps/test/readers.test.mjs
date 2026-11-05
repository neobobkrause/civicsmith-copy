/* agent-steps — THE READERS THE SHELL SHARES, AND THE HOST (R43–R49), at the module's interface. Pure but for the host
 * arms, which drive `driveHarness` with recording hosts over the fake plane. Every arm that admits has its refusing or
 * absent counterpart beside it (K874). */
import "../../bio-plane/test/sandbox.mjs";
import { driveHarness, planeAnswer, textOnly, toolContent, droppedNote, loadableLayers, loadLayer, modelHalf,
         MEANING_ARM, RESPONSE_ID, SEGMENT_END_BY } from "../src/index.mjs";
import { MEANING } from "../../bio-plane/src/query.mjs";
import { ACCOUNT } from "./account.mjs";
import { HOST, askPlane } from "./shell.mjs";
import { world, CHECK, AIK, PACK } from "./world.mjs";
import { MEANING_ARMS } from "./plane-meaning.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
const section = (s) => console.log(`\n--- ${s} ---`);

section("R44 · a plane answer is read as one of three outcomes, by one function");
{
  const silent = { reached: false, detail: "no route" };
  t("R44: a plane that did not answer is {at, silent: asked}", planeAnswer(silent, "airun"), { at: "airun", silent });
  const refused403 = planeAnswer({ reached: true, status: 403, body: { ok: false, reason: "R1", code: "C1", check: "C-1.1" } }, "x");
  t("R44: a status other than 200 is refused: the code from the body's reason, then code; check; `plane` the whole body unchanged",
    [refused403.at, refused403.refused.code, refused403.refused.check, refused403.refused.plane], ["x", "R1", "C-1.1", { ok: false, reason: "R1", code: "C1", check: "C-1.1" }]);
  const envOk = planeAnswer({ reached: true, status: 200, body: { ok: false, code: "E2" } }, "x");
  t("R44: an envelope whose ok is not true is refused, its code taken from the envelope", [envOk.refused?.code, envOk.refused?.at], ["E2", "x"]);
  const nested = planeAnswer({ reached: true, status: 200, body: { ok: true, result: { ok: false, reason: "MEANING_ROWS_UNKNOWN_ARM", check: "C-23.2" } } }, "meaningrows");
  t("R44: a refusal inside a well-formed 200 answer (ok: true, result.ok: false) is a refusal, the inner code and check kept, never a row-less answer",
    [nested.refused?.code, nested.refused?.check, nested.result ?? null], ["MEANING_ROWS_UNKNOWN_ARM", "C-23.2", null]);
  const result = planeAnswer({ reached: true, status: 200, body: { ok: true, result: { rows: [1] } } }, "x");
  t("R44 (control): a 200 whose inner result states no ok is a result, the inner object", [result.result, result.refused ?? null, result.silent ?? null], [{ rows: [1] }, null, null]);
  const bare = planeAnswer({ reached: true, status: 200, body: { ok: true, hits: [] } }, "x");
  t("R44 (control): with no inner result the envelope is the result", bare.result, { ok: true, hits: [] });
  t("R44: it never throws, whatever it is handed", [planeAnswer({ reached: true, status: 200, body: null }, "x").at, planeAnswer({ reached: true, status: 500, body: "text" }, "x").refused?.at], ["x", "x"]);
  const asked = { reached: true, status: 200, body: { ok: true, result: { a: 1 } } };
  const before = JSON.stringify(asked);
  planeAnswer(asked, "x");
  t("R44: pure: the input is not changed", JSON.stringify(asked), before);
}

section("R45 · what a read hands the model of a file is the text the readers extracted, never its bytes");
{
  const b64 = "QUJD".repeat(80);
  const answer = { text: "the extracted text", blob: b64, url: "data:application/pdf;base64,AAAA", raw: "\u0000\u0001binary\u0002", bytes: 1234,
                   active: ["a", "b"], ints: Array.from({ length: 64 }, (_, i) => i % 256), list: ["keep", b64], short: Array.from({ length: 63 }, (_, i) => i) };
  const frozen = JSON.stringify(answer);
  const { content, dropped } = textOnly(answer);
  t("R45: a base64 run of 256 characters or more, a data URL, a binary string and a byte array of 64+ are each removed and named by path",
    dropped.map((d) => d.path).sort(), ["blob", "ints", "list[1]", "raw", "url"].sort());
  t("R45: every other value is kept as it was: text, an `active` list, a numeric `bytes`, a short integer array",
    [content.text, content.active, content.bytes, content.short.length, content.list], ["the extracted text", ["a", "b"], 1234, 63, ["keep"]]);
  t("R45: the input is never changed", JSON.stringify(answer), frozen);
  t("R45 (control): a 255-character base64-looking string is kept", textOnly({ s: "QUJD".repeat(63) + "QUJ" }).dropped, []);
  const tool = toolContent(answer);
  t("R45: toolContent hands {answer, bytes_dropped} with the drop named when something was dropped", [Object.keys(tool.content).sort(), typeof tool.content.bytes_dropped, tool.dropped.length], [["answer", "bytes_dropped"], "string", 5]);
  const clean = toolContent({ text: "x" });
  t("R45 (control): nothing dropped, the content is the answer itself and droppedNote is null", [clean.content, clean.dropped, droppedNote(clean.dropped), droppedNote(null)], [{ text: "x" }, [], null, null]);
  t("R45: droppedNote names each drop by path", [droppedNote(dropped).includes("blob"), droppedNote(dropped).includes("raw")], [true, true]);
}

section("R46 · the pack's suggestions layer is loadable only when the switch that governs the act is on");
{
  const pack = { disclosed: { other: "other text", suggestions: "suggestions text", more: "more text" } };
  t("R46: switch off: loadableLayers omits suggestions", loadableLayers(pack, false), ["other", "more"]);
  t("R46: switch on (=== true): it is among them", loadableLayers(pack, true), ["other", "suggestions", "more"]);
  t("R46: anything but === true is off", [loadableLayers(pack, "true"), loadableLayers(pack, 1), loadableLayers(pack, undefined)], [["other", "more"], ["other", "more"], ["other", "more"]]);
  const off = { pack, layers: loadableLayers(pack, false) }, on = { pack, layers: loadableLayers(pack, true) };
  const refusedOff = loadLayer(off, { name: "suggestions" });
  t("R46: loadLayer refuses suggestions when off, naming the switch, and admits it when on", [refusedOff.error, /suggestions/.test(refusedOff.content), /switch/.test(refusedOff.content), loadLayer(on, { name: "suggestions" })],
    [true, true, true, { content: "suggestions text" }]);
  t("R46: a name the pack does not hold is refused in either state", [loadLayer(off, { name: "nope" }).error, loadLayer(on, { name: "nope" }).error], [true, true]);
  t("R46 (control): every other layer is loadable in both", [loadLayer(off, { name: "other" }), loadLayer(on, { name: "more" })], [{ content: "other text" }, { content: "more text" }]);
  t("R46: a pack with no disclosed layers offers none", [loadableLayers({}, true), loadableLayers(null, true)], [[], []]);
}

section("R47 · the model half keeps the usage of each conversation until it is reported");
{
  const meter = { turns: 0 };
  const half = modelHalf({ reference: { kind: "apikey", key: "k" }, runner: null, meter, suggestions: true, traced: { trace: "t" } });
  t("R47: the half's shape: account, meter, suggestions, traced, pack null, layers and messages empty; reference and runner are gone",
    [Object.keys(half), half.account, half.meter === meter, half.suggestions, half.traced, half.pack, half.layers, half.messages, Object.keys(half).includes("reference") || Object.keys(half).includes("runner"),
     ["reference", "runner"].some((k) => k in modelHalf({ account: {}, meter, provider: { converse: async () => ({}) } }))],
    [["account", "meter", "suggestions", "traced", "pack", "layers", "messages", "spent", "drain"], null, true, true, { trace: "t" }, null, [], [], false, false]);
  const handle = { level: "member", account_id: "acct-1", entries: ["E1"] };
  t("R47: the account handle is the one handed", modelHalf({ account: handle, meter }).account === handle, true);
  t("R47: suggestions is true only when === true", [modelHalf({ suggestions: "yes" }).suggestions, modelHalf({}).suggestions, modelHalf({ suggestions: false }).suggestions], [false, false, false]);
  const label = { provider: "p", host: "h", model_version: "m-own", effort: "low", account_level: "member", owner: "member:ann" };
  half.spent({ usage: { in: 1 }, entry_id: "E1", label, model: "m-own", effort: "low", calls: 3 }, "check");
  half.spent({ usage: { in: 2 }, model: "m-old", effort: "high" }, "check");
  half.spent({ usage: { in: 3 } }, "plan");
  half.spent({}, "check");
  half.spent(null, "check");
  const drained = half.drain();
  t("R47 (T53): one entry {mode, entry_id, label, usage, calls} per conversation that states usage, its entry and label as answered; none for one that states none",
    drained, [{ mode: "check", entry_id: "E1", label, usage: { in: 1 }, calls: 3 },
              { mode: "check", entry_id: null, label: null, usage: { in: 2 }, calls: null },
              { mode: "plan", entry_id: null, label: null, usage: { in: 3 }, calls: null }]);
  t("R47: drain empties the list, and nothing outlives the half", [half.drain(), modelHalf({}).drain()], [[], []]);
  t("R47 (control): `calls` absent is null, never invented", drained[1].calls, null);
  t("R47 (control): a missing label and entry are null, never invented from the mode or a pre-T53 model and effort",
    [drained[1].entry_id, drained[1].label, drained[2].label], [null, null, null]);
  t("R47 (control): no entry carries the pre-T53 model or effort keys", drained.flatMap((e) => Object.keys(e)).filter((k) => k === "model" || k === "effort"), []);
}

section("R48 · the names the module and its shell share are declared here once");
{
  t("R48: MEANING_ARM is leg", MEANING_ARM, "leg");
  t("R48 (control): it is an arm the plane's meaning check admits, and a key of query-language's MEANING (or the plane's arm list holds it)",
    [MEANING_ARMS.includes(MEANING_ARM), Object.keys(MEANING).includes(MEANING_ARM)], [true, true]);
  t("R48: RESPONSE_ID is <action id>#<ord>", [RESPONSE_ID.exec("ACT-1#0")?.slice(1), RESPONSE_ID.exec("ACT-1#12")?.slice(1)], [["ACT-1", "0"], ["ACT-1", "12"]]);
  t("R48 (control): no ordinal, a leading-zero ordinal, a negative one and an empty id are none", ["ACT-1", "ACT-1#", "ACT-1#01", "ACT-1#-1", "#1"].map((s) => RESPONSE_ID.test(s)), [false, false, false, false, false]);
  t("R48: SEGMENT_END_BY is frozen with exactly the five names (T53; AIR28: an AI stop)", [Object.isFrozen(SEGMENT_END_BY), { ...SEGMENT_END_BY }],
    [true, { table: "the table", plane: "the plane's own exit", refusal: "a refusal", error: "an error", ai: "an AI stop" }]);
  let threw = false;
  try { SEGMENT_END_BY.extra = "x"; } catch { threw = true; }
  t("R48 (control): adding a key to SEGMENT_END_BY throws and adds nothing", [threw, "extra" in SEGMENT_END_BY], [true, false]);
}

section("R43 · the module reaches the plane, words its refusals and holds a model half only through its host");
{
  const calls = [];
  const w = world();
  const touched = [];
  const tripwire = new Proxy({}, { get(_, k) { if (k === "CLOCK") return undefined; touched.push(String(k)); return undefined; }, has(_, k) { touched.push(String(k)); return false; },
    ownKeys() { touched.push("(ownKeys)"); return []; } });
  const host = { ...HOST, askPlane: async (env, op, credential, store, query, body) => { calls.push({ op, credential, store }); return askPlane({ PLANE: { fetch: w.fetch } }, op, credential, store, query, body); } };
  const drive = await driveHarness(host, tripwire, { runId: "RUN-W", store: "scratch", credential: AIK, account: ACCOUNT, judgements: CHECK(), maxSteps: 400 });
  t("R43: every request the module made reached the plane through host.askPlane, carrying the run's credential exactly as handed, in the run's namespace",
    [calls.length > 5, calls.length === w.rec.calls.length, [...new Set(calls.map((c) => c.credential))], [...new Set(calls.map((c) => c.store))]], [true, true, [AIK], ["scratch"]]);
  t("R43 (control): env with every key but CLOCK a tripwire is never touched", [touched, drive.ended?.bound], [[], "completed"]);
  const marks = { planeSilent: { marker: "ps" }, planeRefused: { marker: "pr" }, modelSilent: { marker: "ms" }, modelRefused: { marker: "mr" }, refusal: { marker: "rf" } };
  const idHost = { askPlane: async (env, op) => (op === "airun" ? { reached: false, detail: "d" } : { reached: true, status: 200, body: { ok: true, result: {} } }),
    refusal: () => marks.refusal, planeSilent: () => marks.planeSilent, planeRefused: () => marks.planeRefused, modelSilent: () => marks.modelSilent, modelRefused: () => marks.modelRefused };
  const run = (h, opts = {}) => driveHarness(h, {}, { runId: "R", store: "scratch", credential: AIK, account: ACCOUNT, judgements: CHECK(), maxSteps: 50, ...opts });
  t("R43: a segment's refusals are the host's, by identity: a silent plane is host.planeSilent's answer", (await run(idHost)).refusal === marks.planeSilent, true);
  // fixtures-own: input the host's askPlane answer handed to my own driveHarness (a reached 403 whose body the module reads opaquely)
  const refusedHost = { ...idHost, askPlane: async (env, op) => (op === "airun" ? { reached: true, status: 403, body: { ok: false, reason: "X" } } : { reached: true, status: 200, body: { ok: true, result: {} } }) };
  t("R43: a refused read is host.planeRefused's", (await run(refusedHost)).refusal === marks.planeRefused, true);
  const noRun = { ...idHost, askPlane: async () => ({ reached: true, status: 200, body: { ok: true, result: { session: null } } }) };
  t("R43: no such run is host.refusal's, with the module's code", (await run(noRun)).refusal === marks.refusal, true);
  let refusalArgs = null;
  const spyRefusal = { ...noRun, refusal: (...a) => { refusalArgs = a; return marks.refusal; } };
  await run(spyRefusal);
  t("R43: the module words only the codes it names: refusal(code, detail, status, extra) is called with NO_SUCH_RUN, 404 and the run's id", [refusalArgs[0], refusalArgs[2], refusalArgs[3]], ["NO_SUCH_RUN", 404, { run_id: "R" }]);
  t("R43: the host is exactly six functions: the module never needs a seventh (a host of exactly the six drives a whole run)", Object.keys(HOST).sort(), ["askPlane", "modelRefused", "modelSilent", "planeRefused", "planeSilent", "refusal"]);
}

section("R49 · the module keeps no state between calls");
{
  const a = world({ session: { context: { type: "inquiry", id: "INQ-A" } } }), b = world({ session: { context: { type: "inquiry", id: "INQ-B" } } });
  const seenA = [], seenB = [];
  const hostOf = (w, seen) => ({ ...HOST, askPlane: async (env, op, credential, store, query, body) => { seen.push(op); await new Promise((r) => setTimeout(r, 0)); return askPlane({ PLANE: { fetch: w.fetch } }, op, credential, store, query, body); } });
  const opts = (run) => ({ runId: run, store: "scratch", credential: AIK, account: ACCOUNT, judgements: CHECK(), maxSteps: 400 });
  const [da, db] = await Promise.all([driveHarness(hostOf(a, seenA), {}, opts("RUN-A")), driveHarness(hostOf(b, seenB), {}, opts("RUN-B"))]);
  t("R49: two interleaved segments over two hosts see only their own requests", [seenA.length === a.rec.calls.length, seenB.length === b.rec.calls.length,
    a.rec.calls.every((c) => c.query.run === undefined || c.query.run === "RUN-A"), b.rec.calls.every((c) => c.query.run === undefined || c.query.run === "RUN-B")], [true, true, true, true]);
  t("R49: each answered its own run (targets differ)", [da.target.id, db.target.id], ["INQ-A", "INQ-B"]);
  const again = await driveHarness(hostOf(world({ session: { context: { type: "inquiry", id: "INQ-A" } } }), []), {}, opts("RUN-A"));
  t("R49 (control): a third segment after the two is as the first was: nothing carried over", [again.trace.length, again.passes, again.ended], [da.trace.length, da.passes, da.ended]);
}

console.log(`\nreaders: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
