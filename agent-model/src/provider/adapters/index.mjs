/* agent-model (T53, R37, R43) — THE ADAPTERS THIS COPY SERVES, by `adapter_type`, and the profile versions it reads.
 * Adding a provider is one adapter here and one catalogue entry; adding a model at a supported host is an entry only. */

import { anthropicAdapter } from "./anthropic.mjs";
import { openaiAdapter } from "./openai.mjs";

export const ADAPTERS = Object.freeze({
  [anthropicAdapter.adapter_type]: anthropicAdapter,
  [openaiAdapter.adapter_type]: openaiAdapter,
});

/** The highest host-profile version each adapter reads (R37; `ai-catalogue.registerAdapterTypes`). */
export const PROFILE_VERSION = 1;
