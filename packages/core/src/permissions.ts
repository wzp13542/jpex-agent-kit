import type { Permission, Exchange } from "./types.js";
import type { ToolDef } from "./registry.js";

/**
 * Filter tools based on granted permissions.
 * Public tools (requiredPermission === null) are always included.
 * Trade/write tools are excluded if the key only has read permission.
 */
export function filterToolsByPermission(
  tools: readonly ToolDef[],
  granted: Permission[],
): ToolDef[] {
  return tools.filter(
    (t) => t.requiredPermission === null || granted.includes(t.requiredPermission),
  );
}

/**
 * Probe the exchange for granted permissions.
 * Falls back to config-declared permissions if the probe fails.
 */
export async function probePermissions(
  exchange: Exchange,
  fallback: Permission[],
): Promise<Permission[]> {
  try {
    const granted = await exchange.getGrantedPermissions();
    return granted;
  } catch {
    // fail safe: assume read-only
    return fallback.length > 0 ? ["read"] : [];
  }
}
