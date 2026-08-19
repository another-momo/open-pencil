/**
 * Fork-owned tool registration seam (rebuild/v2).
 *
 * Fork tools are defined as NEW files under this directory and listed in
 * FORK_TOOLS. The upstream registry (registry-core.ts / registry-extended.ts)
 * stays pristine; the only upstream touch point is a single spread in
 * registry.ts (registered patch P22). Precedent in upstream's own style:
 * component-catalog.ts's registerComponentCatalog.
 */
import type { ToolDef } from '#core/tools/schema'

export const FORK_TOOLS: ToolDef[] = []
