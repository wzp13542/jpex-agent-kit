import { z } from "zod";

// ── Permissions ──────────────────────────────────────────────
export const Permission = {
  READ: "read",
  TRADE: "trade",
  WITHDRAW: "withdraw",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

// ── Exchange types ───────────────────────────────────────────
export interface SymbolInfo {
  symbol: string; // "btcjpy"
  baseAsset: string; // "btc"
  quoteAsset: string; // "jpy"
  basePrecision: number;
  quotePrecision: number;
  minOrderSize: string;
  status: string; // "trading"
  raw?: unknown;
}

export interface Ticker {
  symbol: string;
  bestBid: string;
  bestAsk: string;
  lastPrice: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  timestamp: string; // ISO 8601
}

export interface OrderBookEntry {
  price: string;
  amount: string;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: string;
}

export interface Kline {
  timestamp: string; // ISO 8601
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface Trade {
  id: string;
  symbol: string;
  price: string;
  amount: string;
  side: "buy" | "sell";
  timestamp: string;
}

export interface Balance {
  asset: string; // "btc", "jpy"
  available: string;
  frozen: string;
}

export interface PlaceOrderParams {
  symbol: string;
  side: "buy" | "sell";
  type: "limit" | "market";
  amount: string; // base-asset qty
  price?: string; // required if type=limit
  clientOrderId?: string;
}

export interface OrderResult {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: "buy" | "sell";
  type: "limit" | "market";
  price?: string;
  amount: string;
  status: string; // "open", "filled", "partial", "canceled"
  timestamp: string;
}

export interface Order {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: "buy" | "sell";
  type: "limit" | "market";
  price?: string;
  amount: string;
  filledAmount: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryQuery {
  symbol?: string;
  startTime?: string; // ISO 8601
  endTime?: string;
  limit?: number;
}

export interface AccountInfo {
  id: string;
  type: string;
  state: string;
  raw?: unknown;
}

export interface TickerSummary {
  symbol: string;
  open: string;
  close: string;
  low: string;
  high: string;
  amount: string;
  volume: string;
  count?: number;
  timestamp?: string;
}

export interface RetailOrderParams {
  symbol: string;
  side: "buy" | "sell";
  amount?: string;
  cashAmount?: string;
  price?: string;
  clientOrderId?: string;
}

// ── Exchange interface (adapter contract) ────────────────────
export interface Exchange {
  id: string; // "bittrade"
  getGrantedPermissions(): Promise<Permission[]>;
  listSymbols(): Promise<SymbolInfo[]>;
  getCurrencies(): Promise<string[]>;
  getSystemTime(): Promise<{ timestamp: number; iso: string }>;
  getTicker(symbol: string): Promise<Ticker>;
  getAllTickers(): Promise<TickerSummary[]>;
  getOrderbook(symbol: string, depth?: number): Promise<OrderBook>;
  getKlines(symbol: string, period: string, limit?: number): Promise<Kline[]>;
  getLastTrade(symbol: string): Promise<Trade[]>;
  getRecentTrades(symbol: string, limit?: number): Promise<Trade[]>;
  getAccounts(): Promise<AccountInfo[]>;
  getBalances(): Promise<Balance[]>;
  placeSpotOrder(o: PlaceOrderParams): Promise<OrderResult>;
  cancelOrder(symbol: string, orderId: string): Promise<void>;
  batchCancelOrders(orderIds: string[]): Promise<unknown>;
  cancelAllOrders(symbol: string): Promise<void>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  getOrder(symbol: string, orderId: string): Promise<Order>;
  getOrderMatchResults(orderId: string): Promise<Trade[]>;
  getOrderHistory(q: HistoryQuery): Promise<Order[]>;
  getTradeHistory(q: HistoryQuery): Promise<Trade[]>;
  getRetailQuote(symbol?: string): Promise<unknown>;
  placeRetailOrder(params: RetailOrderParams): Promise<unknown>;
  getRetailOrderHistory(query: Record<string, string | number | undefined>): Promise<unknown>;
  getRetailMaintenanceTime(): Promise<unknown>;
}
