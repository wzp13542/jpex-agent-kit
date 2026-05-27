import fs from "node:fs";
import path from "node:path";
import {
  getConfigPath,
  loadConfig,
  redactConfig,
  resolveConfig,
  validateFilePermissions,
  type JpexConfig,
  type ResolvedConfig,
} from "./keystore.js";
import { createExchange, listExchanges } from "./exchange-registry.js";
import type { Exchange } from "./types.js";
import { toStructuredError } from "./errors.js";

export type DiagnosticStatus = "pass" | "fail" | "warn" | "skip";

export interface DiagnosticCheck {
  name: string;
  status: DiagnosticStatus;
  message: string;
  details?: unknown;
}

export interface DiagnosticReport {
  ok: boolean;
  generatedAt: string;
  summary: Record<DiagnosticStatus, number>;
  checks: DiagnosticCheck[];
}

export interface DiagnosticOptions {
  skipNetwork?: boolean;
  mcpServerPath?: string;
  configPath?: string;
  config?: JpexConfig;
  resolvedConfig?: ResolvedConfig;
  exchange?: Exchange;
}

function summarize(checks: DiagnosticCheck[]): Record<DiagnosticStatus, number> {
  return checks.reduce<Record<DiagnosticStatus, number>>(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { pass: 0, fail: 0, warn: 0, skip: 0 },
  );
}

function safeError(error: unknown): unknown {
  return toStructuredError(error);
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function findMcpArtifact(explicitPath?: string): { path: string; status: "built" | "source" | "missing" } {
  const candidates = [
    explicitPath,
    path.join(process.cwd(), "packages", "mcp", "dist", "server.js"),
    path.join(process.cwd(), "packages", "mcp", "src", "server.ts"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (!fileExists(candidate)) continue;
    return {
      path: candidate,
      status: candidate.endsWith(".js") ? "built" : "source",
    };
  }

  return {
    path: path.join(process.cwd(), "packages", "mcp", "dist", "server.js"),
    status: "missing",
  };
}

function hasCredential(config: JpexConfig): boolean {
  const exchangeId = config.exchange ?? "bittrade";
  const creds = config.credentials[exchangeId];
  return Boolean(creds?.accessKey && creds.secret);
}

function createDiagnosticExchange(config: JpexConfig, resolved?: ResolvedConfig): Exchange {
  const exchangeId = resolved?.exchangeId ?? config.exchange ?? "bittrade";
  const creds = resolved?.credentials ?? config.credentials[exchangeId] ?? {
    accessKey: "diagnose-public-only",
    secret: "diagnose-public-only",
    grantedPermissions: [],
  };
  return createExchange(exchangeId, {
    accessKey: creds.accessKey,
    secret: creds.secret,
    permissions: creds.grantedPermissions,
    timeoutMs: resolved?.safety.timeoutMs ?? config.safety.timeoutMs,
  });
}

export async function runDiagnostics(options: DiagnosticOptions = {}): Promise<DiagnosticReport> {
  const checks: DiagnosticCheck[] = [];
  const configPath = options.configPath ?? getConfigPath();
  let config = options.config;
  let resolved = options.resolvedConfig;
  let exchange = options.exchange;

  try {
    validateFilePermissions(configPath);
    checks.push({
      name: "config.permissions",
      status: "pass",
      message: "Config file permissions are acceptable.",
      details: { path: configPath },
    });
  } catch (error) {
    checks.push({
      name: "config.permissions",
      status: "fail",
      message: "Config file permissions are not acceptable.",
      details: safeError(error),
    });
  }

  try {
    config ??= loadConfig();
    checks.push({
      name: "config.load",
      status: "pass",
      message: "Config loaded successfully.",
      details: redactConfig(config),
    });
  } catch (error) {
    checks.push({
      name: "config.load",
      status: "fail",
      message: "Config could not be loaded.",
      details: safeError(error),
    });
  }

  if (config) {
    checks.push({
      name: "exchange.registry",
      status: listExchanges().includes(config.exchange) ? "pass" : "fail",
      message: listExchanges().includes(config.exchange)
        ? `Exchange "${config.exchange}" is registered.`
        : `Exchange "${config.exchange}" is not registered.`,
      details: { registered: listExchanges() },
    });
  }

  try {
    resolved ??= resolveConfig(config?.exchange);
    checks.push({
      name: "config.resolve",
      status: "pass",
      message: "Credentials and safety settings resolved successfully.",
      details: {
        exchangeId: resolved.exchangeId,
        permissions: resolved.credentials.grantedPermissions,
        readOnly: resolved.safety.readOnly,
        dryRun: resolved.safety.dryRun,
        timeoutMs: resolved.safety.timeoutMs,
        skills: resolved.skills,
      },
    });
  } catch (error) {
    checks.push({
      name: "config.resolve",
      status: "fail",
      message: "Credentials could not be resolved. Private endpoints will be skipped.",
      details: safeError(error),
    });
  }

  const mcp = findMcpArtifact(options.mcpServerPath);
  checks.push({
    name: "mcp.artifact",
    status: mcp.status === "built" ? "pass" : mcp.status === "source" ? "warn" : "fail",
    message: mcp.status === "built"
      ? "MCP server build artifact exists."
      : mcp.status === "source"
        ? "MCP source exists, but built dist/server.js was not found. Run `pnpm build` before configuring an MCP client."
        : "MCP server artifact was not found. Run `pnpm build`.",
    details: { path: mcp.path },
  });

  if (!config) {
    const summary = summarize(checks);
    return {
      ok: summary.fail === 0,
      generatedAt: new Date().toISOString(),
      summary,
      checks,
    };
  }

  exchange ??= createDiagnosticExchange(config, resolved);
  checks.push({
    name: "permissions.declared",
    status: "pass",
    message: "Declared API key permissions inspected.",
    details: {
      hasCredentials: hasCredential(config),
      permissions: resolved?.credentials.grantedPermissions ?? config.credentials[config.exchange]?.grantedPermissions ?? [],
      readOnly: resolved?.safety.readOnly ?? config.safety.readOnly,
    },
  });

  if (options.skipNetwork) {
    checks.push({
      name: "endpoint.public",
      status: "skip",
      message: "Public endpoint check skipped by request.",
    });
    checks.push({
      name: "endpoint.private",
      status: "skip",
      message: "Private endpoint check skipped by request.",
    });
  } else {
    try {
      const systemTime = await exchange.getSystemTime();
      checks.push({
        name: "endpoint.public",
        status: "pass",
        message: "Public endpoint is reachable.",
        details: systemTime,
      });
    } catch (error) {
      checks.push({
        name: "endpoint.public",
        status: "fail",
        message: "Public endpoint check failed.",
        details: safeError(error),
      });
    }

    const permissions = resolved?.credentials.grantedPermissions ?? config.credentials[config.exchange]?.grantedPermissions ?? [];
    if (!hasCredential(config) && !resolved) {
      checks.push({
        name: "endpoint.private",
        status: "skip",
        message: "Private endpoint check skipped because credentials are missing.",
      });
    } else if (!permissions.includes("read")) {
      checks.push({
        name: "endpoint.private",
        status: "skip",
        message: "Private endpoint check skipped because read permission is not declared.",
        details: { permissions },
      });
    } else {
      try {
        const accounts = await exchange.getAccounts();
        checks.push({
          name: "endpoint.private",
          status: "pass",
          message: "Private read endpoint is reachable.",
          details: { accountCount: accounts.length },
        });
      } catch (error) {
        checks.push({
          name: "endpoint.private",
          status: "fail",
          message: "Private read endpoint check failed.",
          details: safeError(error),
        });
      }
    }
  }

  const summary = summarize(checks);
  return {
    ok: summary.fail === 0,
    generatedAt: new Date().toISOString(),
    summary,
    checks,
  };
}
