import { describe, expect, it } from "vitest";
import { fromHuobiStatus, toHuobiOrderType } from "../adapters/bittrade/mapping.js";

describe("BitTrade mapping fixtures", () => {
  it("maps order type to Huobi-style BitTrade order types", () => {
    expect(toHuobiOrderType("buy", "limit")).toBe("buy-limit");
    expect(toHuobiOrderType("sell", "market")).toBe("sell-market");
  });

  it("maps BitTrade order states to normalized states", () => {
    expect(fromHuobiStatus("submitted")).toBe("open");
    expect(fromHuobiStatus("partial-filled")).toBe("partial");
    expect(fromHuobiStatus("partial-canceled")).toBe("canceled");
    expect(fromHuobiStatus("filled")).toBe("filled");
  });
});
