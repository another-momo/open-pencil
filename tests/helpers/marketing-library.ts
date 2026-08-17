/**
 * Test helper shim (P3: anchor / library machinery removed).
 *
 * The legacy `attachMiniLibrary` used to seed an in-memory library graph
 * with Components / Types / Profiles / References pages. After P3 the
 * marketing tool reads its type config from a brand config snapshot, not
 * a library graph — so this helper is now a no-op. Callers that still
 * import it (brief-tools, restore) get a function-shaped stub that
 * preserves the call-site contract without seeding any graph state.
 */

import type { SceneGraph } from '@open-pencil/scene-graph'

/** @deprecated Anchor / library machinery removed in P3. No-op shim. */
export function attachMiniLibrary(_graph: SceneGraph): void {
  // intentional no-op — tests no longer need a library graph to run
}

/** @deprecated No-op. */
export function ensureMiniLibrary(_graph: SceneGraph): void {
  // intentional no-op
}
