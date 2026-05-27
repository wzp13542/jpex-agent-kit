import { z } from "zod";
import { registerTool, type SkillId } from "../registry.js";

const SKILL: SkillId = "jpex-spot-portfolio";

export function registerPortfolioTools(): void {
  registerTool({
    name: "get_accounts",
    skill: SKILL,
    title: "Get Accounts",
    description: "Get BitTrade user accounts and account states.",
    input: z.object({}),
    requiredPermission: "read",
    writeOperation: false,
    handler: async (ctx) => {
      return ctx.exchange.getAccounts();
    },
  });

  registerTool({
    name: "get_balances",
    skill: SKILL,
    title: "Get Balances",
    description: "Get account balances (JPY + crypto).",
    input: z.object({}),
    requiredPermission: "read",
    writeOperation: false,
    handler: async (ctx) => {
      return ctx.exchange.getBalances();
    },
  });

  registerTool({
    name: "get_order_match_results",
    skill: SKILL,
    title: "Get Order Match Results",
    description: "Get execution details for a single order by order ID.",
    input: z.object({
      orderId: z.string().describe("Order ID"),
    }),
    requiredPermission: "read",
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getOrderMatchResults(args.orderId);
    },
  });

  registerTool({
    name: "get_open_orders",
    skill: SKILL,
    title: "Get Open Orders",
    description: "Get currently open orders. Optionally filter by symbol.",
    input: z.object({
      symbol: z.string().optional().describe("Filter by trading pair, e.g. btcjpy"),
    }),
    requiredPermission: "read",
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getOpenOrders(args.symbol);
    },
  });

  registerTool({
    name: "get_order",
    skill: SKILL,
    title: "Get Order",
    description: "Lookup a single order by ID.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
      orderId: z.string().describe("Order ID"),
    }),
    requiredPermission: "read",
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getOrder(args.symbol, args.orderId);
    },
  });

  registerTool({
    name: "get_order_history",
    skill: SKILL,
    title: "Get Order History",
    description: "Get filled/closed orders. Note: BitTrade API caps history at ~120 days.",
    input: z.object({
      symbol: z.string().optional().describe("Filter by trading pair"),
      startTime: z.string().optional().describe("Start time (ISO 8601)"),
      endTime: z.string().optional().describe("End time (ISO 8601)"),
      limit: z.number().optional().default(100).describe("Max results (default 100)"),
    }),
    requiredPermission: "read",
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getOrderHistory(args);
    },
  });

  registerTool({
    name: "get_trade_history",
    skill: SKILL,
    title: "Get Trade History",
    description: "Get executed fills. Note: BitTrade API caps history at ~120 days.",
    input: z.object({
      symbol: z.string().optional().describe("Filter by trading pair"),
      startTime: z.string().optional().describe("Start time (ISO 8601)"),
      endTime: z.string().optional().describe("End time (ISO 8601)"),
      limit: z.number().optional().default(100).describe("Max results (default 100)"),
    }),
    requiredPermission: "read",
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getTradeHistory(args);
    },
  });
}
