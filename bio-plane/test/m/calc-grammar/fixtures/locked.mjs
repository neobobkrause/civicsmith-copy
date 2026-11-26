/* Run under `--disallow-code-generation-from-strings`: loads calc-grammar, then forbids every module load, clock,
   randomness source and network call, and runs the battery. Prints its answers as JSON. */
import * as nodeModule from "node:module";

/** A resolve hook's next step. @typedef {(spec: string, ctx: unknown) => unknown} NextResolve */
/** A resolve hook. @typedef {(spec: string, ctx: unknown, next: NextResolve) => unknown} ResolveHook */
/** Node's `module.registerHooks`, which the tool's description of Node leaves out. @typedef {(hooks: { resolve: ResolveHook }) => unknown} RegisterHooks */
/** @param {unknown} f @returns {f is RegisterHooks} */
const isRegisterHooks = (f) => typeof f === "function";
/** A `new Date(...)`'s arguments, as Date's constructor takes them. @typedef {[] | [string | number | Date] | [number, number, number?, number?, number?, number?, number?]} DateArgs */

const registerHooks = "registerHooks" in nodeModule ? nodeModule.registerHooks : undefined;
if (!isRegisterHooks(registerHooks)) throw new TypeError("node:module has no registerHooks");
/** @type {string[]} */
const late = [];
let sealed = false;
registerHooks({ resolve(spec, ctx, next) { if (sealed) late.push(spec); return next(spec, ctx); } });
const c = await import("../../../../src/calc-grammar/index.mjs");
const { battery } = await import("./battery.mjs");
sealed = true;
/** @param {string} name @returns {() => never} */
const forbid = (name) => () => { throw new Error(`calc-grammar read ${name}`); };
const RealDate = Date;
// A Date built from stated values is arithmetic; one built from nothing, or Date() or Date.now(), reads the clock.
globalThis.Date = new Proxy(RealDate, { construct: (T, /** @type {DateArgs} */ args) => (args.length === 0 ? forbid("the clock (new Date())")()
  // One argument or several, the same spread: each form of Date's constructor told apart for the checker.
  : args.length === 1 ? new T(...args) : new T(...args)),
  apply: forbid("the clock (Date())") });
globalThis.Date.now = forbid("the clock (Date.now)");
Math.random = forbid("Math.random");
performance.now = forbid("performance.now");
globalThis.fetch = forbid("the network (fetch)");
crypto.getRandomValues = forbid("crypto.getRandomValues");
let evalBlocked = false;
try { (0, eval)("1"); } catch { evalBlocked = true; }
const answers = battery(c);
process.stdout.write(JSON.stringify({ answers, late, evalBlocked }));
