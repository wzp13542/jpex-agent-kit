import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (/secret|access|api[_-]?key|signature/i.test(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitive(inner);
      }
    }
    return result;
  }
  return value;
}

export interface AuditEntry {
  timestamp: string;
  tool: string;
  args: unknown;
  ok: boolean;
  durationMs: number;
  result?: unknown;
  error?: unknown;
}

export class AuditLogger {
  constructor(private readonly logPath = process.env.JPEX_AUDIT_LOG ?? path.join(os.homedir(), ".jpex", "audit.log")) {}

  log(entry: AuditEntry): void {
    const dir = path.dirname(this.logPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      this.logPath,
      `${JSON.stringify(redactSensitive(entry))}\n`,
      "utf-8",
    );
  }
}
