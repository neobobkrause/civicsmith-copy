/* load-check's guard (R1, R2): which copy may be loaded, how hard, and that no credential leaves the door.
 *
 * A test tool, never product: nothing in a team's copy imports it (R7). Every refusal here is made before the
 * copy is asked anything, except the seed check, which reads the copy's own gauge once and loads nothing. */
import { OPS } from "../op-declarations/index.mjs";

/* the one Cloudflare account a scratch copy may live in (K4942); the rehearsal account is never used here */
export const PERMITTED_ACCOUNT = "20b533579290b9b93168345edd3b7f72";
/* what one scratch copy should take, whatever the caller asks (R2): members at once, and requests a second over all members */
export const MEMBER_CAP = 100;
export const RATE_CAP = 50;
/* the mark a copy seeded by this module carries (R2, R3) */
export const SEED_BY = "load-check";

/* a refusal: an identifier code and the fact it names, never a sentence a member reads (K3971) */
export class LoadRefusal extends Error {
  constructor(code, fact = {}) {
    super(`load-check refused: ${code}`);
    this.code = code;
    this.fact = fact;
  }
}

/* R1: refused before any request: a copy of another account, the shared test copy, or no door to speak through */
export function guardCopy(copy) {
  if (!copy || typeof copy !== "object") throw new LoadRefusal("NO_COPY");
  if (copy.account !== PERMITTED_ACCOUNT) throw new LoadRefusal("ACCOUNT_NOT_PERMITTED", { copy: nameOf(copy) });
  if (copy.shared === true) throw new LoadRefusal("SHARED_COPY", { copy: nameOf(copy) });
  if (!copy.door || typeof copy.door.call !== "function" || typeof copy.door.gauge !== "function") {
    throw new LoadRefusal("NO_DOOR", { copy: nameOf(copy) });
  }
  return copy;
}

/* R2: a copy this module did not seed is never loaded. The copy's seed record must be this module's, and the copy's
 * own gauge must name the team the seed was made for; one read, no load. */
export async function guardSeed(copy) {
  const seed = copy.seed;
  if (!seed || seed.by !== SEED_BY || typeof seed.team !== "string") throw new LoadRefusal("NOT_SEEDED_HERE", { copy: nameOf(copy) });
  const g = await copy.door.gauge({ credentials: copy.credentials });
  if (!g || g.team !== seed.team) throw new LoadRefusal("ANOTHER_TEAMS_SEED", { copy: nameOf(copy) });
  return g;
}

/* R2: a ramp clipped to the member cap (each step at most the cap, steps kept in order, repeats after clipping dropped)
 * and a rate clipped to the rate cap; what was asked and what is run are both stated */
export function clip(ramp, rate) {
  if (!Array.isArray(ramp) || !ramp.length || !ramp.every((n) => Number.isInteger(n) && n > 0)) {
    throw new LoadRefusal("BAD_RAMP");
  }
  const steps = [];
  for (const n of ramp) {
    const m = Math.min(n, MEMBER_CAP);
    if (steps[steps.length - 1] !== m) steps.push(m);
  }
  const asked = Number.isFinite(rate) && rate > 0 ? rate : RATE_CAP;
  return {
    steps, rate: Math.min(asked, RATE_CAP),
    clipped: {
      members: ramp.some((n) => n > MEMBER_CAP) ? { asked: Math.max(...ramp), cap: MEMBER_CAP } : null,
      rate: asked > RATE_CAP ? { asked, cap: RATE_CAP } : null,
    },
  };
}

/* the op an item names must be a declared op (op-declarations); its budget class defaults by what it is */
export function declaredOp(op) {
  if (typeof op !== "string" || !Object.hasOwn(OPS, op)) throw new LoadRefusal("UNDECLARED_OP", { op: String(op) });
  return OPS[op];
}

/* an answer's code, kept only when it is an identifier (a refusal's detail may be a sentence, and is never kept) */
export const codeOf = (answer) => {
  const c = answer?.code ?? answer?.body?.code;
  return typeof c === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(c) ? c : answer?.status ? `HTTP_${answer.status}` : "ERROR";
};

/* R2: every string the module writes passes here; a credential is replaced wherever it appears */
export function scrubber(credentials) {
  const secrets = secretsOf(credentials).filter((s) => s.length >= 4);
  const scrub = (s) => secrets.reduce((t, x) => t.split(x).join("[credential]"), String(s));
  const deep = (v) => (typeof v === "string" ? scrub(v) : Array.isArray(v) ? v.map(deep)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v);
  return { scrub, deep };
}
const secretsOf = (c) => (typeof c === "string" ? [c] : c && typeof c === "object" ? Object.values(c).flatMap(secretsOf) : []);

/* a logger that scrubs; the default writes nothing */
export const loggerFor = (log, scrub) => (line) => { if (typeof log === "function") log(scrub(line)); };

export const nameOf = (copy) => (typeof copy?.name === "string" ? copy.name : null);
