import { z } from "zod";
import type { Permission } from "./types.js";

export type SkillId =
  | "jpex-spot-market"
  | "jpex-spot-trade"
  | "jpex-spot-portfolio"
  | "jpex-retail";

export interface ToolDef<I = unknown, O = unknown> {
  name: string; // snake_case, e.g. "place_spot_order"
  skill: SkillId;
  title: string; // human label
  description: string; // shown to LLM & in CLI --help
  input: z.ZodType<I>; // zod schema = single source for both surfaces
  requiredPermission: Permission | null; // null = public (no key)
  writeOperation: boolean; // true = needs confirmation
  handler: (ctx: ToolContext, args: I) => Promise<O>;
}

export interface ToolContext {
  exchange: import("./types.js").Exchange;
  config: import("./keystore.js").ResolvedConfig;
}

const registry: ToolDef[] = [];

export function registerTool<I, O>(def: ToolDef<I, O>): void {
  registry.push(def as ToolDef);
}

export function getRegistry(): readonly ToolDef[] {
  return registry;
}

export function getRegistryBySkill(skill: SkillId): ToolDef[] {
  return registry.filter((t) => t.skill === skill);
}

export function getRegistryByPermission(
  granted: Permission[],
): ToolDef[] {
  return registry.filter(
    (t) => t.requiredPermission === null || granted.includes(t.requiredPermission),
  );
}

export function clearRegistry(): void {
  registry.length = 0;
}
