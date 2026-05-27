#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, type ZodObject, type ZodRawShape } from "zod";
import {
  type ToolDef,
  type ToolContext,
  registerMarketTools,
  registerPortfolioTools,
  registerTradeTools,
  registerRetailTools,
  getRegistry,
  clearRegistry,
  resolveConfig,
  filterToolsByPermission,
  createExchange,
  AuditLogger,
  ReadOnlyError,
  toStructuredError,
} from "jpex-core";

function buildContext(): ToolContext {
  const config = resolveConfig();
  const exchange = createExchange(config.exchangeId, {
    accessKey: config.credentials.accessKey,
    secret: config.credentials.secret,
    permissions: config.credentials.grantedPermissions,
    timeoutMs: config.safety.timeoutMs,
  });
  return { exchange, config };
}

function getZodShape(schema: z.ZodType): ZodRawShape {
  // Extract the raw shape from a ZodObject
  if (schema instanceof z.ZodObject) {
    return schema.shape;
  }
  // Fallback: empty shape
  return {};
}

function createServer(): McpServer {
  const server = new McpServer({
    name: "jpex-trade-mcp",
    version: "0.1.0",
  });

  // Register all tools
  clearRegistry();
  registerMarketTools();
  registerPortfolioTools();
  registerTradeTools();
  registerRetailTools();

  const allTools = getRegistry();
  const config = resolveConfig();

  // Filter by permissions
  const allowedTools = filterToolsByPermission(allTools, config.credentials.grantedPermissions);
  const readFiltered = config.safety.readOnly ? allowedTools.filter((t) => !t.writeOperation) : allowedTools;

  // Filter by skills if configured
  const enabledSkills = new Set(config.skills);
  const toolsToRegister = readFiltered.filter((t) => enabledSkills.has(t.skill));

  for (const tool of toolsToRegister) {
    registerMcpTool(server, tool);
  }

  return server;
}

function registerMcpTool(server: McpServer, tool: ToolDef): void {
  const shape = getZodShape(tool.input);

  server.tool(
    tool.name,
    tool.description,
    shape,
    async (params: Record<string, unknown>) => {
      const ctx = buildContext();
      const startedAt = Date.now();
      const audit = new AuditLogger();

      try {
        if (ctx.config.safety.readOnly && tool.writeOperation) {
          throw new ReadOnlyError(tool.name);
        }
        // Validate params through zod
        const validated = tool.input.parse(params);
        const result = await tool.handler(ctx, validated);
        if (tool.writeOperation) {
          audit.log({
            timestamp: new Date().toISOString(),
            tool: tool.name,
            args: validated,
            ok: true,
            durationMs: Date.now() - startedAt,
            result,
          });
        }

        // Redact any sensitive data from output
        const safeResult = redactSensitive(result);
        const structured = {
          tool: tool.name,
          ok: true,
          data: safeResult,
          timestamp: new Date().toISOString(),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          structuredContent: structured,
        };
      } catch (error: unknown) {
        const structured = redactSensitive(toStructuredError(error, tool.name));
        if (tool.writeOperation) {
          audit.log({
            timestamp: new Date().toISOString(),
            tool: tool.name,
            args: params,
            ok: false,
            durationMs: Date.now() - startedAt,
            error: structured,
          });
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured as Record<string, unknown>,
          isError: true,
        };
      }
    },
  );
}

function redactSensitive(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj
      .replace(/access[_-]?key[:\s]*\S+/gi, "access_key: [REDACTED]")
      .replace(/secret[:\s]*\S+/gi, "secret: [REDACTED]");
  }
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/secret|accesskey|apikey/i.test(k)) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = redactSensitive(v);
      }
    }
    return result;
  }
  return obj;
}

async function main(): Promise<void> {
  if (process.argv.includes("--read-only")) {
    process.env.JPEX_READ_ONLY = "true";
  }
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("jpex-trade-mcp server started on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
