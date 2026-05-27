import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  registerTool,
  getRegistry,
  getRegistryBySkill,
  getRegistryByPermission,
  clearRegistry,
  type ToolDef,
} from "../registry.js";

describe("Tool Registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("should start empty", () => {
    expect(getRegistry()).toHaveLength(0);
  });

  it("register and retrieve tools", () => {
    const tool: ToolDef<{ x: number }, number> = {
      name: "test_tool",
      skill: "jpex-spot-market",
      title: "Test",
      description: "A test tool",
      input: z.object({ x: z.number() }),
      requiredPermission: null,
      writeOperation: false,
      handler: async (_ctx, args) => args.x * 2,
    };
    registerTool(tool);
    expect(getRegistry()).toHaveLength(1);
    expect(getRegistry()[0].name).toBe("test_tool");
  });

  it("filter by skill", () => {
    registerTool({
      name: "a",
      skill: "jpex-spot-market",
      title: "A",
      description: "",
      input: z.object({}),
      requiredPermission: null,
      writeOperation: false,
      handler: async () => {},
    });
    registerTool({
      name: "b",
      skill: "jpex-spot-trade",
      title: "B",
      description: "",
      input: z.object({}),
      requiredPermission: "trade",
      writeOperation: true,
      handler: async () => {},
    });

    expect(getRegistryBySkill("jpex-spot-market")).toHaveLength(1);
    expect(getRegistryBySkill("jpex-spot-trade")).toHaveLength(1);
    expect(getRegistryBySkill("jpex-spot-portfolio")).toHaveLength(0);
  });

  it("filter by permission", () => {
    registerTool({
      name: "public_tool",
      skill: "jpex-spot-market",
      title: "Public",
      description: "",
      input: z.object({}),
      requiredPermission: null,
      writeOperation: false,
      handler: async () => {},
    });
    registerTool({
      name: "trade_tool",
      skill: "jpex-spot-trade",
      title: "Trade",
      description: "",
      input: z.object({}),
      requiredPermission: "trade",
      writeOperation: true,
      handler: async () => {},
    });
    registerTool({
      name: "read_tool",
      skill: "jpex-spot-portfolio",
      title: "Read",
      description: "",
      input: z.object({}),
      requiredPermission: "read",
      writeOperation: false,
      handler: async () => {},
    });

    // Read-only key sees public + read tools only
    const readTools = getRegistryByPermission(["read"]);
    expect(readTools.map((t) => t.name)).toEqual(["public_tool", "read_tool"]);

    // Trade key sees all
    const tradeTools = getRegistryByPermission(["read", "trade"]);
    expect(tradeTools.map((t) => t.name)).toEqual([
      "public_tool",
      "trade_tool",
      "read_tool",
    ]);

    // No key sees only public
    const noKeyTools = getRegistryByPermission([]);
    expect(noKeyTools.map((t) => t.name)).toEqual(["public_tool"]);
  });

  it("clearRegistry removes all tools", () => {
    registerTool({
      name: "temp",
      skill: "jpex-spot-market",
      title: "Temp",
      description: "",
      input: z.object({}),
      requiredPermission: null,
      writeOperation: false,
      handler: async () => {},
    });
    expect(getRegistry()).toHaveLength(1);
    clearRegistry();
    expect(getRegistry()).toHaveLength(0);
  });
});
