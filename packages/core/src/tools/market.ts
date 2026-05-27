import { z } from "zod";
import { registerTool, type SkillId } from "../registry.js";

const SKILL: SkillId = "jpex-spot-market";

export function registerMarketTools(): void {
  registerTool({
    name: "list_symbols",
    skill: SKILL,
    title: "List Symbols",
    description: "List all tradable spot pairs (e.g. btcjpy, ethjpy) with precision and minimum order size.",
    input: z.object({}),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx) => {
      return ctx.exchange.listSymbols();
    },
  });

  registerTool({
    name: "get_currencies",
    skill: SKILL,
    title: "Get Currencies",
    description: "List currencies supported by BitTrade.",
    input: z.object({}),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx) => {
      return ctx.exchange.getCurrencies();
    },
  });

  registerTool({
    name: "get_system_time",
    skill: SKILL,
    title: "Get System Time",
    description: "Get BitTrade server system timestamp in milliseconds and ISO format.",
    input: z.object({}),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx) => {
      return ctx.exchange.getSystemTime();
    },
  });

  registerTool({
    name: "get_ticker",
    skill: SKILL,
    title: "Get Ticker",
    description: "Get best bid/ask, last price, and 24h stats for a symbol.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
    }),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getTicker(args.symbol);
    },
  });

  registerTool({
    name: "get_all_tickers",
    skill: SKILL,
    title: "Get All Tickers",
    description: "Get 24h market summary for all trading pairs.",
    input: z.object({}),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx) => {
      return ctx.exchange.getAllTickers();
    },
  });

  registerTool({
    name: "get_orderbook",
    skill: SKILL,
    title: "Get Order Book",
    description: "Get order book depth for a symbol.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
      depth: z.number().optional().default(20).describe("Number of price levels (default 20)"),
    }),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getOrderbook(args.symbol, args.depth);
    },
  });

  registerTool({
    name: "get_klines",
    skill: SKILL,
    title: "Get Klines",
    description: "Get OHLCV candlestick data. Period values: 1min, 5min, 15min, 30min, 60min, 4hour, 1day, 1week, 1mon.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
      period: z.string().describe("Candle period: 1min, 5min, 15min, 30min, 60min, 4hour, 1day, 1week, 1mon"),
      limit: z.number().optional().default(150).describe("Number of candles (default 150, max 2000)"),
    }),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getKlines(args.symbol, args.period, args.limit);
    },
  });

  registerTool({
    name: "get_last_trade",
    skill: SKILL,
    title: "Get Last Trade",
    description: "Get the latest public trade tick for a symbol.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
    }),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getLastTrade(args.symbol);
    },
  });

  registerTool({
    name: "get_recent_trades",
    skill: SKILL,
    title: "Get Recent Trades",
    description: "Get recent public trades for a symbol.",
    input: z.object({
      symbol: z.string().describe("Trading pair, e.g. btcjpy"),
      limit: z.number().optional().default(50).describe("Number of trades (default 50)"),
    }),
    requiredPermission: null,
    writeOperation: false,
    handler: async (ctx, args) => {
      return ctx.exchange.getRecentTrades(args.symbol, args.limit);
    },
  });
}
