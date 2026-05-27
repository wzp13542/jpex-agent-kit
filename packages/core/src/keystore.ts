import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Permission } from "./types.js";
import { ConfigError } from "./errors.js";

export interface ExchangeCredentials {
  accessKey: string;
  secret: string;
  grantedPermissions: Permission[];
}

export interface SafetyConfig {
  maxOrderNotionalJpy: number;
  requireConfirmOnWrite: boolean;
  dryRun: boolean;
  readOnly: boolean;
  timeoutMs: number;
}

export interface JpexConfig {
  exchange: string;
  credentials: Record<string, ExchangeCredentials>;
  safety: SafetyConfig;
  skills: string[];
}

export interface ResolvedConfig {
  exchangeId: string;
  credentials: ExchangeCredentials;
  safety: SafetyConfig;
  skills: string[];
}

const DEFAULT_SAFETY: SafetyConfig = {
  maxOrderNotionalJpy: 100_000,
  requireConfirmOnWrite: true,
  dryRun: false,
  readOnly: false,
  timeoutMs: 15_000,
};

const DEFAULT_SKILLS = [
  "jpex-spot-market",
  "jpex-spot-trade",
  "jpex-spot-portfolio",
  "jpex-retail",
];

export function getConfigPath(): string {
  return process.env.JPEX_CONFIG || path.join(os.homedir(), ".jpex", "config.json");
}

export function validateFilePermissions(filePath: string): void {
  if (process.platform === "win32") return; // skip on Windows
  try {
    const stat = fs.statSync(filePath);
    const mode = (stat.mode & 0o777).toString(8);
    // refuse if world-readable (other has any permission)
    if (stat.mode & 0o004) {
      throw new Error(
        `Config file ${filePath} is world-readable (mode ${mode}). ` +
          `Fix with: chmod 600 ${filePath}`,
      );
    }
  } catch (e: unknown) {
    if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return; // file doesn't exist yet, that's fine
    }
    throw e;
  }
}

export function writeConfig(config: JpexConfig, filePath = getConfigPath()): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  if (process.platform !== "win32") {
    fs.chmodSync(filePath, 0o600);
  }
  validateFilePermissions(filePath);
}

export function loadConfig(): JpexConfig {
  const configPath = getConfigPath();
  validateFilePermissions(configPath);

  if (!fs.existsSync(configPath)) {
    return {
      exchange: "bittrade",
      credentials: {},
      safety: { ...DEFAULT_SAFETY },
      skills: [...DEFAULT_SKILLS],
    };
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  let parsed: Partial<JpexConfig>;
  try {
    parsed = JSON.parse(raw) as Partial<JpexConfig>;
  } catch (error) {
    throw new ConfigError(`Failed to parse config file ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    exchange: parsed.exchange ?? "bittrade",
    credentials: parsed.credentials ?? {},
    safety: { ...DEFAULT_SAFETY, ...parsed.safety },
    skills: parsed.skills ?? [...DEFAULT_SKILLS],
  };
}

export function resolveConfig(exchangeId?: string): ResolvedConfig {
  const config = loadConfig();
  const id = exchangeId ?? config.exchange ?? "bittrade";

  // Allow secret from env
  const envSecret = process.env.JPEX_BITTRADE_SECRET;
  const envKey = process.env.JPEX_BITTRADE_ACCESS_KEY;

  let creds = config.credentials[id];

  if (!creds && envKey && envSecret) {
    creds = {
      accessKey: envKey,
      secret: envSecret,
      grantedPermissions: ["read", "trade"],
    };
  }

  if (!creds) {
    throw new Error(
      `No credentials found for exchange "${id}". ` +
        `Set them in ~/.jpex/config.json or via JPEX_BITTRADE_ACCESS_KEY + JPEX_BITTRADE_SECRET env vars.`,
    );
  }

  // Allow permission override from env
  const envPerms = process.env.JPEX_PERMISSIONS;
  if (envPerms) {
    creds = {
      ...creds,
      grantedPermissions: envPerms.split(",").map((p) => p.trim()) as Permission[],
    };
  }

  const readOnly = process.env.JPEX_READ_ONLY === "1" || process.env.JPEX_READ_ONLY === "true";

  return {
    exchangeId: id,
    credentials: creds,
    safety: { ...config.safety, readOnly: readOnly || config.safety.readOnly },
    skills: config.skills,
  };
}

export function redact(value: string): string {
  if (value.length <= 6) return "****";
  return value.slice(0, 3) + "****" + value.slice(-3);
}

export function redactConfig(config: JpexConfig): JpexConfig {
  const redacted = { ...config };
  redacted.credentials = {};
  for (const [key, cred] of Object.entries(config.credentials)) {
    redacted.credentials[key] = {
      ...cred,
      accessKey: redact(cred.accessKey),
      secret: redact(cred.secret),
    };
  }
  return redacted;
}
