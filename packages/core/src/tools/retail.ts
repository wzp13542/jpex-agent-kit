import { z } from "zod";
import { registerTool, type SkillId } from "../registry.js";

const SKILL: SkillId = "jpex-retail";

export function registerRetailTools(): void {
  registerTool({
    name: "get_retail_quote_subscription",
    skill: SKILL,
    title: "Get Retail Quote Subscription",
    description: "Return BitTrade retail WebSocket subscription details for offer prices and retail trades.",
    input: z.object({
      symbol: z.string().optional().describe("Optional trading pair, e.g. btcjpy"),
    }),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx, args) => ctx.exchange.getRetailQuote(args.symbol),
  });

  registerTool({
    name: "place_retail_order",
    skill: SKILL,
    title: "Place Retail Order",
    description: "Place a BitTrade retail buy/sell order. This is a write operation that requires confirmation.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
      side: z.enum(["buy", "sell"]).describe("Retail order side"),
      amount: z.string().optional().describe("Crypto amount. Mutually exclusive with cashAmount."),
      cashAmount: z.string().optional().describe("JPY cash amount. Mutually exclusive with amount."),
      price: z.string().describe("Retail quoted price"),
      clientOrderId: z.string().optional().describe("Retail quote ID/client order ID"),
    }),
    requiredPermission: "trade",
    writeOperation: true,
    handler: async (ctx, args) => {
      if (ctx.config.safety.dryRun) {
        return { dryRun: true, wouldSend: args, message: "Dry run - no retail order was placed." };
      }
      return ctx.exchange.placeRetailOrder(args);
    },
  });

  registerTool({
    name: "get_retail_order_history",
    skill: SKILL,
    title: "Get Retail Order History",
    description: "Query BitTrade retail order history.",
    input: z.object({
      id: z.string().optional().describe("Retail order ID"),
      limit: z.number().optional().default(10).describe("Max results, default 10, max 100"),
      from: z.string().optional().describe("Pagination start ID"),
      direct: z.number().optional().default(1).describe("1=next, 2=previous"),
      baseCurrency: z.string().optional().describe("Base currency"),
      quoteCurrency: z.string().optional().describe("Quote currency"),
      symbol: z.string().optional().describe("Trading pair"),
      orderType: z.number().optional().describe("1=buy, 2=sell"),
      state: z.number().optional().default(2).describe("1=in progress, 2=filled, 3=unfilled"),
    }),
    requiredPermission: "read",
    writeOperation: false,
    handler: async (ctx, args) => ctx.exchange.getRetailOrderHistory(args),
  });

  registerTool({
    name: "get_retail_maintenance_time",
    skill: SKILL,
    title: "Get Retail Maintenance Time",
    description: "Get BitTrade retail maintenance window and state.",
    input: z.object({}),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx) => ctx.exchange.getRetailMaintenanceTime(),
  });
}
