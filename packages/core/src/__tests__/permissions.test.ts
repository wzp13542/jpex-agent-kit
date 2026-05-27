import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { registerTool, clearRegistry, type ToolDef } from "../registry.js";
import { filterToolsByPermission } from "../permissions.js";

describe("Permission Filter", () => {
  beforeEach(() => {
    clearRegistry();
  });

  const makeTool = (
    name: string,
    requiredPermission: "read" | "trade" | null,
  ): ToolDef => ({
    name,
    skill: "jpex-spot-market",
    title: name,
    description: "",
    input: z.object({}),
    requiredPermission,
    writeOperation: false,
    handler: async () => {},
  });

  it("always includes public tools (null permission)", () => {
    const tools = [makeTool("public", null)];
    expect(filterToolsByPermission(tools, [])).toHaveLength(1);
    expect(filterToolsByPermission(tools, ["read"])).toHaveLength(1);
  });

  it("includes read tools only when read is granted", () => {
    const tools = [makeTool("readable", "read")];
    expect(filterToolsByPermission(tools, [])).toHaveLength(0);
    expect(filterToolsByPermission(tools, ["read"])).toHaveLength(1);
    expect(filterToolsByPermission(tools, ["trade"])).toHaveLength(0);
  });

  it("includes trade tools only when trade is granted", () => {
    const tools = [makeTool("writable", "trade")];
    expect(filterToolsByPermission(tools, ["read"])).toHaveLength(0);
    expect(filterToolsByPermission(tools, ["trade"])).toHaveLength(1);
  });

  it("read-only key gets public + read but not trade", () => {
    const tools = [
      makeTool("public", null),
      makeTool("reader", "read"),
      makeTool("writer", "trade"),
    ];
    const result = filterToolsByPermission(tools, ["read"]);
    expect(result.map((t) => t.name)).toEqual(["public", "reader"]);
  });

  it("trade key gets all tools", () => {
    const tools = [
      makeTool("public", null),
      makeTool("reader", "read"),
      makeTool("writer", "trade"),
    ];
    const result = filterToolsByPermission(tools, ["read", "trade"]);
    expect(result.map((t) => t.name)).toEqual(["public", "reader", "writer"]);
  });
});
