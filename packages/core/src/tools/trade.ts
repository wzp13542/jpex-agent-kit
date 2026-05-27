import { z } from "zod";
import { registerTool, type SkillId } from "../registry.js";

const SKILL: SkillId = "jpex-spot-trade";

export function registerTradeTools(): void {
  registerTool({
    name: "place_spot_order",
    skill: SKILL,
    title: "Place Spot Order",
    description:
      "Place a limit or market spot order (buy/sell). This is a write operation that requires confirmation.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
      side: z.enum(["buy", "sell"]).describe("Order side"),
      type: z.enum(["limit", "market"]).describe("Order type"),
      amount: z.string().describe("Base-asset quantity (string to avoid float error)"),
      price: z.string().optional().describe("Limit price (required if type=limit)"),
      clientOrderId: z.string().optional().describe("Client-specified order ID"),
    }),
    requiredPermission: "trade",
    writeOperation: true,
    handler: async (ctx, args) => {
      // Validate limit order has price
      if (args.type === "limit" && !args.price) {
        throw new Error("Price is required for limit orders");
      }

      // Max notional guardrail
      if (args.type === "limit" && args.price) {
        const notional = parseFloat(args.amount) * parseFloat(args.price);
        if (notional > ctx.config.safety.maxOrderNotionalJpy) {
          throw new Error(
            `Order notional (${notional.toFixed(0)} JPY) exceeds max allowed ` +
              `(${ctx.config.safety.maxOrderNotionalJpy} JPY). ` +
              `Override by increasing maxOrderNotionalJpy in config.`,
          );
        }
      }

      // Dry run: print the request without sending
      if (ctx.config.safety.dryRun) {
        return {
          dryRun: true,
          wouldSend: {
            symbol: args.symbol,
            side: args.side,
            type: args.type,
            amount: args.amount,
            price: args.price,
            clientOrderId: args.clientOrderId,
          },
          message: "Dry run — no order was placed.",
        };
      }

      return ctx.exchange.placeSpotOrder(args);
    },
  });

  registerTool({
    name: "cancel_order",
    skill: SKILL,
    title: "Cancel Order",
    description: "Cancel an open order by ID. This is a write operation that requires confirmation.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
      orderId: z.string().describe("Order ID to cancel"),
    }),
    requiredPermission: "trade",
    writeOperation: true,
    handler: async (ctx, args) => {
      if (ctx.config.safety.dryRun) {
        return {
          dryRun: true,
          wouldSend: { symbol: args.symbol, orderId: args.orderId },
          message: "Dry run — no order was cancelled.",
        };
      }
      await ctx.exchange.cancelOrder(args.symbol, args.orderId);
      return { success: true, orderId: args.orderId };
    },
  });

  registerTool({
    name: "batch_cancel_orders",
    skill: SKILL,
    title: "Batch Cancel Orders",
    description: "Cancel up to 50 open orders by order IDs. This is a write operation that requires confirmation.",
    input: z.object({
      orderIds: z.string().describe("Comma-separated order IDs to cancel, max 50"),
    }),
    requiredPermission: "trade",
    writeOperation: true,
    handler: async (ctx, args) => {
      const orderIds = args.orderIds.split(",").map((id) => id.trim()).filter(Boolean);
      if (orderIds.length === 0 || orderIds.length > 50) {
        throw new Error("orderIds must contain 1 to 50 comma-separated IDs.");
      }
      if (ctx.config.safety.dryRun) {
        return {
          dryRun: true,
          wouldSend: { orderIds },
          message: "Dry run - no orders were cancelled.",
        };
      }
      return ctx.exchange.batchCancelOrders(orderIds);
    },
  });

  registerTool({
    name: "cancel_all_orders",
    skill: SKILL,
    title: "Cancel All Orders",
    description: "Cancel all open orders for a symbol. This is a write operation that requires confirmation.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
    }),
    requiredPermission: "trade",
    writeOperation: true,
    handler: async (ctx, args) => {
      if (ctx.config.safety.dryRun) {
        return {
          dryRun: true,
          wouldSend: { symbol: args.symbol },
          message: "Dry run — no orders were cancelled.",
        };
      }
      await ctx.exchange.cancelAllOrders(args.symbol);
      return { success: true, symbol: args.symbol };
    },
  });
}
