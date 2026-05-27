import { describe, expect, it } from "vitest";
import { runDiagnostics, type JpexConfig, type ResolvedConfig } from "../index.js";

const config: JpexConfig = {
  exchange: "bittrade",
  credentials: {
    bittrade: {
      accessKey: "test-access-key",
      secret: "test-secret",
      grantedPermissions: ["read"],
    },
  },
  safety: {
    maxOrderNotionalJpy: 100_000,
    requireConfirmOnWrite: true,
    dryRun: false,
    readOnly: true,
    timeoutMs: 1_000,
  },
  skills: ["jpex-spot-market", "jpex-spot-portfolio"],
};

const resolvedConfig: ResolvedConfig = {
  exchangeId: "bittrade",
  credentials: config.credentials.bittrade,
  safety: config.safety,
  skills: config.skills,
};

describe("Diagnostics", () => {
  it("builds a skipped-network report without touching endpoints", async () => {
    const report = await runDiagnostics({
      skipNetwork: true,
      config,
      resolvedConfig,
      mcpServerPath: "packages/mcp/src/server.ts",
    });

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.name)).toEqual(expect.arrayContaining([
      "config.permissions",
      "config.load",
      "exchange.registry",
      "config.resolve",
      "mcp.artifact",
      "permissions.declared",
      "endpoint.public",
      "endpoint.private",
    ]));
    expect(report.checks.find((check) => check.name === "endpoint.public")?.status).toBe("skip");
    expect(report.checks.find((check) => check.name === "endpoint.private")?.status).toBe("skip");
  });
});
