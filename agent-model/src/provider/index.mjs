/* agent-model (T53) — THE PROVIDER INTERFACE, as the Worker uses it.
 *
 * `makeProvider(deps)` binds the module's services to what the Worker hands (`catalogue`, `fetch`, `bindings`, the
 * plane's ops, the circuit handle, the clock): `turn` (R25), `converse` (R6), `capabilities` (R30), `serves` (R1),
 * `entryFor` (R55), `estimate` (R34) and `health` (R35). `registerAdapters(catalogue, profileIds)` tells
 * `ai-catalogue` at start which adapter types and profile versions this copy serves (R37), so an entry it cannot serve
 * reads `needs_newer_release` there. */

import { turn as turnWith, payerReset, REQUEST_FIELDS } from "./turn.mjs";
import { converseTurns } from "./converse.mjs";
import { capabilities as capsWith, serves as servesWith, entryFor as entryForWith, estimate as estimateWith } from "./catalogue.mjs";
import { health as healthWith } from "../health.mjs";
import { ADAPTERS, PROFILE_VERSION } from "./adapters/index.mjs";

export { REQUEST_FIELDS, payerReset, ADAPTERS };

export function makeProvider(deps = {}) {
  const cat = { catalogue: deps.catalogue, entryOffered: deps.entryOffered };
  const turn = (request) => turnWith(request, deps);
  const capabilities = (entry_id) => capsWith(entry_id, cat);
  return {
    turn,
    capabilities,
    serves: (entry_id, need) => servesWith(entry_id, need, cat),
    entryFor: (account, role, need) => entryForWith(account, role, need, cat),
    estimate: (q) => estimateWith(q, cat),
    health: (account, entry_id) => healthWith(account, entry_id, { circuit: deps.circuit, entryOf: (id) => deps.catalogue?.entryOf?.(id), now: deps.now }),
    converse: (args) => converseTurns(args, { turn: deps.turn || turn, capabilities }),
  };
}

/** R37: `ai-catalogue.registerAdapterTypes` with each adapter type this copy serves and, for each host profile the
 *  catalogue holds of that type, the profile version it reads. Answers what the catalogue answered, or null. */
export function registerAdapters(catalogue, profileIds = [], adapters = ADAPTERS) {
  try {
    const byType = Object.fromEntries(Object.keys(adapters).map((t) => [t, {}]));
    for (const id of profileIds) {
      const p = catalogue?.profileOf?.(id);
      if (p && byType[p.adapter_type]) byType[p.adapter_type][id] = PROFILE_VERSION;
    }
    const list = Object.entries(byType).filter(([, profiles]) => Object.keys(profiles).length).map(([type, profiles]) => ({ type, profiles }));
    return list.length ? catalogue.registerAdapterTypes(list) : null;
  } catch { return null; }
}
