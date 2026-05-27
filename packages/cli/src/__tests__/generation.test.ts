import { describe, expect, it } from "vitest";
import { buildCli } from "../index.js";

describe("CLI generation", () => {
  it("generates command groups from registered skills", () => {
    const cli = buildCli();
    const commandNames = cli.commands.map((command) => command.name());
    expect(commandNames).toEqual(expect.arrayContaining(["market", "trade", "portfolio", "retail", "config", "diagnose"]));
  });

  it("generates BitTrade public and write commands", () => {
    const cli = buildCli();
    const market = cli.commands.find((command) => command.name() === "market");
    const trade = cli.commands.find((command) => command.name() === "trade");
    expect(market?.commands.map((command) => command.name())).toContain("get_system_time");
    expect(trade?.commands.map((command) => command.name())).toContain("batch_cancel_orders");
  });
});
