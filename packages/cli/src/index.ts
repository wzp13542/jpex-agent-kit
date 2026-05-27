#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ToolDef,
  type ToolContext,
  type SkillId,
  registerMarketTools,
  registerPortfolioTools,
  registerTradeTools,
  registerRetailTools,
  getRegistry,
  clearRegistry,
  resolveConfig,
  loadConfig,
  writeConfig,
  getConfigPath,
  validateFilePermissions,
  redactConfig,
  filterToolsByPermission,
  createExchange,
  AuditLogger,
  runDiagnostics,
  toStructuredError,
} from "jpex-core";

// ── Skill → CLI group name mapping ──────────────────────────
const SKILL_GROUPS: Record<SkillId, string> = {
  "jpex-spot-market": "market",
  "jpex-spot-trade": "trade",
  "jpex-spot-portfolio": "portfolio",
  "jpex-retail": "retail",
};

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

// ── Helpers ─────────────────────────────────────────────────
interface ZodFieldShape {
  type: "string" | "number" | "boolean";
  description?: string;
  optional: boolean;
}

function getZodShape(schema: unknown): Record<string, ZodFieldShape> {
  const s = schema as { _def?: { shape?: () => Record<string, unknown> }; shape?: Record<string, unknown> };
  const shape = s._def?.shape?.() ?? s.shape ?? {};
  const result: Record<string, ZodFieldShape> = {};

  for (const [key, field] of Object.entries(shape)) {
    const f = field as {
      _def?: { typeName?: string; description?: string };
      isOptional?: () => boolean;
    };
    const typeName = f._def?.typeName ?? "";
    result[key] = {
      type: typeName.includes("Number")
        ? "number"
        : typeName.includes("Boolean")
          ? "boolean"
          : "string",
      description: f._def?.description,
      optional: f.isOptional?.() ?? false,
    };
  }
  return result;
}

function camelToKebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

export function buildCli(): Command {
  const program = new Command();
  program
    .name("jpex")
    .description("Japanese-exchange-native AI trading toolkit")
    .version("0.1.0");

  // Register all tools (no config needed for registration)
  clearRegistry();
  registerMarketTools();
  registerPortfolioTools();
  registerTradeTools();
  registerRetailTools();

  const allTools = getRegistry();

  // Always show all tools in help; filter by permission at execution time
  const groups = new Map<string, ToolDef[]>();
  for (const tool of allTools) {
    const group = SKILL_GROUPS[tool.skill];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(tool);
  }

  for (const [groupName, tools] of groups) {
    const groupCmd = program.command(groupName).description(`Tools from ${groupName}`);

    for (const tool of tools) {
      const cmd = groupCmd
        .command(tool.name)
        .description(tool.description);

      // Add --dry-run flag for write operations
      if (tool.writeOperation) {
        cmd.option("--dry-run", "Print the request without sending");
        cmd.option("--yes", "Skip confirmation prompt");
      }

      // Derive flags from zod schema
      const shape = getZodShape(tool.input);
      for (const [key, field] of Object.entries(shape)) {
        const flag = `--${camelToKebab(key)} <${key}>`;
        const desc = field.description ?? key;
        if (field.type === "string") {
          cmd.option(flag, desc);
        } else if (field.type === "number") {
          cmd.option(`--${camelToKebab(key)} <${key}>`, desc, parseFloat);
        } else if (field.type === "boolean") {
          cmd.option(`--${camelToKebab(key)}`, desc);
        }
      }

      cmd.action(async (flags: Record<string, unknown>) => {
        // Resolve config lazily — only when actually executing
        const config = resolveConfig();
        const globalOpts = program.opts<{ readOnly?: boolean }>();
        if (globalOpts.readOnly) config.safety.readOnly = true;

        // Permission check at execution time
        const allowed = filterToolsByPermission([tool], config.credentials.grantedPermissions);
        if (allowed.length === 0) {
          console.error(
            `Error: Tool "${tool.name}" requires "${tool.requiredPermission}" permission, ` +
              `but your API key only has: [${config.credentials.grantedPermissions.join(", ")}]`,
          );
          process.exit(1);
        }

        // Skill check
        if (!config.skills.includes(tool.skill)) {
          console.error(
            `Error: Skill "${tool.skill}" is not enabled. Add it to your config's skills array.`,
          );
          process.exit(1);
        }

        // Apply dry-run override
        if (flags.dryRun && tool.writeOperation) {
          config.safety.dryRun = true;
        }

        if (config.safety.readOnly && tool.writeOperation) {
          console.error(`Error: Tool "${tool.name}" is disabled because read-only mode is enabled.`);
          process.exit(1);
        }

        // Confirmation for write ops
        if (tool.writeOperation && !flags.yes && !flags.dryRun) {
          const readline = await import("node:readline");
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stderr,
          });
          const answer = await new Promise<string>((resolve) => {
            rl.question(`Execute ${tool.name}? (y/N) `, resolve);
          });
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log("Aborted.");
            process.exit(0);
          }
        }

        try {
          const exchange = createExchange(config.exchangeId, {
            accessKey: config.credentials.accessKey,
            secret: config.credentials.secret,
            permissions: config.credentials.grantedPermissions,
            timeoutMs: config.safety.timeoutMs,
          });
          const ctx: ToolContext = { exchange, config };
          const audit = new AuditLogger();
          const startedAt = Date.now();

          // Parse args through zod to apply defaults & validation
          const parsed = tool.input.parse(flags);
          const result = await tool.handler(ctx, parsed);
          if (tool.writeOperation) {
            audit.log({
              timestamp: new Date().toISOString(),
              tool: tool.name,
              args: parsed,
              ok: true,
              durationMs: Date.now() - startedAt,
              result,
            });
          }
          console.log(JSON.stringify(result, null, 2));
        } catch (err: unknown) {
          if (tool.writeOperation) {
            new AuditLogger().log({
              timestamp: new Date().toISOString(),
              tool: tool.name,
              args: flags,
              ok: false,
              durationMs: 0,
              error: toStructuredError(err, tool.name),
            });
          }
          console.error("Error:", JSON.stringify(toStructuredError(err, tool.name), null, 2));
          process.exit(1);
        }
      });
    }
  }

  // Skills flag
  program.option("--skills <skills>", "Comma-separated list of skills to load");
  program.option("--read-only", "Disable all write operations even when API key has trade permission");

  const configCmd = program.command("config").description("Manage ~/.jpex/config.json");
  configCmd.command("init").description("Create a starter config file").action(() => {
    const existing = loadConfig();
    const credentials = Object.keys(existing.credentials).length > 0 ? existing.credentials : {
      bittrade: {
        accessKey: "YOUR_API_KEY",
        secret: "YOUR_SECRET",
        grantedPermissions: ["read" as const],
      },
    };
    const config = {
      exchange: existing.exchange ?? "bittrade",
      credentials,
      safety: existing.safety,
      skills: existing.skills,
    };
    writeConfig(config);
    console.log(JSON.stringify({ ok: true, path: getConfigPath() }, null, 2));
  });

  configCmd.command("show").description("Show redacted config").action(() => {
    validateFilePermissions(getConfigPath());
    const config = loadConfig();
    console.log(JSON.stringify(redactConfig(config), null, 2));
  });

  configCmd.command("set <key> <value>").description("Set a top-level safety/config value").action((key: string, value: string) => {
    const config = loadConfig();
    if (key === "exchange") config.exchange = value;
    else if (key === "safety.readOnly") config.safety.readOnly = value === "true" || value === "1";
    else if (key === "safety.dryRun") config.safety.dryRun = value === "true" || value === "1";
    else if (key === "safety.maxOrderNotionalJpy") config.safety.maxOrderNotionalJpy = Number(value);
    else if (key === "safety.timeoutMs") config.safety.timeoutMs = Number(value);
    else if (key === "skills") config.skills = value.split(",").map((s) => s.trim()).filter(Boolean);
    else {
      console.error(`Unsupported config key: ${key}`);
      process.exit(1);
    }
    writeConfig(config);
    console.log(JSON.stringify({ ok: true, path: getConfigPath(), key }, null, 2));
  });

  program
    .command("diagnose")
    .description("Check MCP build, config, permissions, connection, and public/private endpoint availability")
    .option("--skip-network", "Skip public/private endpoint network checks")
    .option("--mcp-server <path>", "Override MCP server artifact path to check")
    .action(async (opts: { skipNetwork?: boolean; mcpServer?: string }) => {
      const report = await runDiagnostics({
        skipNetwork: opts.skipNetwork ?? false,
        mcpServerPath: opts.mcpServer,
      });
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) process.exitCode = 1;
    });

  return program;
}

// ── Main ────────────────────────────────────────────────────
const isDirectRun = !process.env.VITEST && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  buildCli().parseAsync(process.argv).catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
