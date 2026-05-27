import { describe, expect, it } from "vitest";
import { createExchange, listExchanges } from "../index.js";

describe("Exchange registry", () => {
  it("registers BitTrade by default", () => {
    expect(listExchanges()).toContain("bittrade");
  });

  it("creates a BitTrade exchange by id", () => {
    const exchange = createExchange("bittrade", {
      accessKey: "key",
      secret: "secret",
      permissions: ["read"],
    });
    expect(exchange.id).toBe("bittrade");
  });

  it("rejects unknown exchanges", () => {
    expect(() =>
      createExchange("unknown", {
        accessKey: "key",
        secret: "secret",
        permissions: ["read"],
      }),
    ).toThrow(/Unknown exchange/);
  });
});
