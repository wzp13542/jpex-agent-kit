import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRegistry,
  getRegistry,
  registerMarketTools,
  registerPortfolioTools,
  registerRetailTools,
  registerTradeTools,
} from "../index.js";

describe("Tool coverage", () => {
  beforeEach(() => clearRegistry());

  it("registers requested BitTrade public, account, trade, and retail tools", () => {
    registerMarketTools();
    registerPortfolioTools();
    registerTradeTools();
    registerRetailTools();

    const names = getRegistry().map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "list_symbols",
      "get_currencies",
      "get_system_time",
      "get_ticker",
      "get_all_tickers",
      "get_last_trade",
      "get_recent_trades",
      "get_accounts",
      "get_balances",
      "place_spot_order",
      "batch_cancel_orders",
      "get_order_match_results",
      "get_retail_quote_subscription",
      "place_retail_order",
      "get_retail_order_history",
      "get_retail_maintenance_time",
    ]));
  });

  it("marks write tools explicitly", () => {
    registerTradeTools();
    registerRetailTools();

    const writeTools = getRegistry().filter((tool) => tool.writeOperation).map((tool) => tool.name);
    expect(writeTools).toEqual(expect.arrayContaining([
      "place_spot_order",
      "cancel_order",
      "cancel_all_orders",
      "batch_cancel_orders",
      "place_retail_order",
    ]));
  });
});
