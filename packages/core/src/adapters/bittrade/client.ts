import {
  type Exchange,
  type Permission,
  type SymbolInfo,
  type Ticker,
  type TickerSummary,
  type OrderBook,
  type Kline,
  type Trade,
  type Balance,
  type AccountInfo,
  type PlaceOrderParams,
  type RetailOrderParams,
  type OrderResult,
  type Order,
  type HistoryQuery,
} from "../../types.js";
import { signRequest, HOST } from "./signer.js";
import { toHuobiOrderType, fromHuobiStatus, PERIOD_MAP } from "./mapping.js";
import { HttpClient } from "../../http-client.js";
import { RateLimiter, type RateLimitBucket } from "../../rate-limiter.js";
import { ValidationError } from "../../errors.js";

const BASE_URL = `https://${HOST}`;

function compact(params: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as Record<string, string | number | boolean>;
}

function toQuery(params: Record<string, string | number | boolean | undefined> = {}): string {
  const clean = compact(params);
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(clean)) qs.set(key, String(value));
  return qs.toString();
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

interface RawSymbol {
  "base-currency": string;
  "quote-currency": string;
  "price-precision": number;
  "amount-precision": number;
  "symbol-partition": string;
  symbol: string;
  state: string;
  "min-order-amt": number;
  "max-order-amt"?: number;
  "min-order-value"?: number;
  "api-trading"?: string;
}

interface RawOrder {
  id: string;
  "client-order-id"?: string;
  symbol: string;
  type: string;
  price?: string;
  amount: string;
  "filled-amount": string;
  state: string;
  "created-at": number;
  "updated-at": number;
}

export class BitTradeClient implements Exchange {
  readonly id = "bittrade";

  private readonly http: HttpClient;
  private accountId: string | null = null;

  constructor(
    private readonly accessKey: string,
    private readonly secret: string,
    private readonly declaredPermissions: Permission[],
    options: { timeoutMs?: number } = {},
  ) {
    this.http = new HttpClient(new RateLimiter(), options.timeoutMs ?? 15_000);
  }

  private async publicGet<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const qs = toQuery(params);
    return this.http.request<T>({
      method: "GET",
      endpoint: `GET ${path}`,
      url: `${BASE_URL}${path}${qs ? `?${qs}` : ""}`,
      bucket: "public",
    });
  }

  private async signedGet<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}, bucket: RateLimitBucket = "private"): Promise<T> {
    const qs = signRequest("GET", path, compact(params), this.accessKey, this.secret);
    return this.http.request<T>({
      method: "GET",
      endpoint: `GET ${path}`,
      url: `${BASE_URL}${path}?${qs.toString()}`,
      bucket,
    });
  }

  private async signedPost<T>(path: string, body: Record<string, unknown> = {}, bucket: RateLimitBucket = "write"): Promise<T> {
    const qs = signRequest("POST", path, {}, this.accessKey, this.secret);
    return this.http.request<T>({
      method: "POST",
      endpoint: `POST ${path}`,
      url: `${BASE_URL}${path}?${qs.toString()}`,
      body,
      bucket,
    });
  }

  private async getAccountId(): Promise<string> {
    if (this.accountId) return this.accountId;
    const accounts = await this.getAccounts();
    const spot = accounts.find((account) => account.type === "spot" && account.state === "working");
    if (!spot) throw new ValidationError("No working spot account found on BitTrade.");
    this.accountId = spot.id;
    return spot.id;
  }

  async getGrantedPermissions(): Promise<Permission[]> {
    return [...this.declaredPermissions];
  }

  async listSymbols(): Promise<SymbolInfo[]> {
    const raw = await this.publicGet<RawSymbol[]>("/v1/common/symbols");
    return raw.map((symbol) => ({
      symbol: symbol.symbol,
      baseAsset: symbol["base-currency"],
      quoteAsset: symbol["quote-currency"],
      basePrecision: symbol["amount-precision"],
      quotePrecision: symbol["price-precision"],
      minOrderSize: String(symbol["min-order-amt"]),
      status: symbol.state,
      raw: symbol,
    }));
  }

  async getCurrencies(): Promise<string[]> {
    return this.publicGet<string[]>("/v1/common/currencys");
  }

  async getSystemTime(): Promise<{ timestamp: number; iso: string }> {
    const timestamp = await this.publicGet<number>("/v1/common/timestamp");
    return { timestamp, iso: toIso(timestamp) };
  }

  async getTicker(symbol: string): Promise<Ticker> {
    type RawTicker = {
      bid: [number, number];
      ask: [number, number];
      close: number;
      open: number;
      high: number;
      low: number;
      amount: number;
      vol: number;
      ts: number;
    };
    const raw = await this.publicGet<RawTicker>("/market/detail/merged", { symbol });
    return {
      symbol,
      bestBid: String(raw.bid[0]),
      bestAsk: String(raw.ask[0]),
      lastPrice: String(raw.close),
      open24h: String(raw.open),
      high24h: String(raw.high),
      low24h: String(raw.low),
      volume24h: String(raw.amount),
      timestamp: toIso(raw.ts),
    };
  }

  async getAllTickers(): Promise<TickerSummary[]> {
    type RawSummary = {
      symbol: string;
      open: number;
      close: number;
      low: number;
      high: number;
      amount: number;
      vol: number;
      count?: number;
      ts?: number;
    };
    const raw = await this.publicGet<RawSummary[]>("/market/tickers");
    return raw.map((ticker) => ({
      symbol: ticker.symbol,
      open: String(ticker.open),
      close: String(ticker.close),
      low: String(ticker.low),
      high: String(ticker.high),
      amount: String(ticker.amount),
      volume: String(ticker.vol),
      count: ticker.count,
      timestamp: ticker.ts ? toIso(ticker.ts) : undefined,
    }));
  }

  async getOrderbook(symbol: string, depth = 20): Promise<OrderBook> {
    type RawBook = {
      bids: number[][];
      asks: number[][];
      ts: number;
    };
    const raw = await this.publicGet<RawBook>("/market/depth", {
      symbol,
      type: "step0",
      depth,
    });
    return {
      symbol,
      bids: raw.bids.map(([price, amount]) => ({ price: String(price), amount: String(amount) })),
      asks: raw.asks.map(([price, amount]) => ({ price: String(price), amount: String(amount) })),
      timestamp: toIso(raw.ts),
    };
  }

  async getKlines(symbol: string, period: string, limit = 150): Promise<Kline[]> {
    type RawKline = {
      id: number;
      open: number;
      high: number;
      low: number;
      close: number;
      amount: number;
      vol: number;
    };
    const raw = await this.publicGet<RawKline[]>("/market/history/kline", {
      symbol,
      period: PERIOD_MAP[period] ?? period,
      size: Math.min(limit, 2000),
    });
    return raw.map((kline) => ({
      timestamp: toIso(kline.id * 1000),
      open: String(kline.open),
      high: String(kline.high),
      low: String(kline.low),
      close: String(kline.close),
      volume: String(kline.vol),
    }));
  }

  async getLastTrade(symbol: string): Promise<Trade[]> {
    type RawTradeEntry = {
      id: number;
      ts: number;
      "trade-id": number;
      amount: number;
      price: number;
      direction: "buy" | "sell";
    };
    type RawTrade = {
      ts: number;
      data: RawTradeEntry[];
    };
    const raw = await this.publicGet<RawTrade>("/market/trade", { symbol });
    return raw.data.map((trade) => ({
      id: String(trade["trade-id"] ?? trade.id),
      symbol,
      price: String(trade.price),
      amount: String(trade.amount),
      side: trade.direction,
      timestamp: toIso(trade.ts),
    }));
  }

  async getRecentTrades(symbol: string, limit = 50): Promise<Trade[]> {
    type RawTradeEntry = {
      id: number;
      ts: number;
      "trade-id": number;
      amount: number;
      price: number;
      direction: "buy" | "sell";
    };
    type RawTradeBatch = {
      id: number;
      ts: number;
      data: RawTradeEntry[];
    };
    const raw = await this.publicGet<RawTradeBatch[]>("/market/history/trade", {
      symbol,
      size: Math.min(limit, 2000),
    });
    return raw.flatMap((batch) => batch.data.map((trade) => ({
      id: String(trade["trade-id"] ?? trade.id),
      symbol,
      price: String(trade.price),
      amount: String(trade.amount),
      side: trade.direction,
      timestamp: toIso(trade.ts),
    }))).slice(0, limit);
  }

  async getAccounts(): Promise<AccountInfo[]> {
    type AccountEntry = { id: string; type: string; state: string };
    const accounts = await this.signedGet<AccountEntry[]>("/v1/account/accounts");
    return accounts.map((account) => ({ ...account, id: String(account.id), raw: account }));
  }

  async getBalances(): Promise<Balance[]> {
    const accountId = await this.getAccountId();
    type RawBalance = {
      list: Array<{ currency: string; type: string; balance: string }>;
    };
    const raw = await this.signedGet<RawBalance>(`/v1/account/accounts/${accountId}/balance`);
    const map = new Map<string, { available: string; frozen: string }>();
    for (const entry of raw.list) {
      const existing = map.get(entry.currency) ?? { available: "0", frozen: "0" };
      if (entry.type === "trade") existing.available = entry.balance;
      if (entry.type === "frozen") existing.frozen = entry.balance;
      map.set(entry.currency, existing);
    }
    return Array.from(map.entries())
      .filter(([, balance]) => parseFloat(balance.available) > 0 || parseFloat(balance.frozen) > 0)
      .map(([asset, balance]) => ({ asset, ...balance }));
  }

  async placeSpotOrder(params: PlaceOrderParams): Promise<OrderResult> {
    const accountId = await this.getAccountId();
    const body: Record<string, unknown> = {
      "account-id": accountId,
      amount: params.amount,
      type: toHuobiOrderType(params.side, params.type),
      source: "api",
      symbol: params.symbol,
    };
    if (params.type === "limit" && params.price) body.price = params.price;
    if (params.clientOrderId) body["client-order-id"] = params.clientOrderId;

    const orderId = await this.signedPost<string>("/v1/order/orders/place", body);
    return {
      orderId: String(orderId),
      clientOrderId: params.clientOrderId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      price: params.price,
      amount: params.amount,
      status: "open",
      timestamp: new Date().toISOString(),
    };
  }

  async cancelOrder(_symbol: string, orderId: string): Promise<void> {
    await this.signedPost(`/v1/order/orders/${orderId}/submitcancel`);
  }

  async batchCancelOrders(orderIds: string[]): Promise<unknown> {
    return this.signedPost("/v1/order/orders/batchcancel", { "order-ids": orderIds });
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    const accountId = await this.getAccountId();
    await this.signedPost("/v1/order/orders/batchCancelOpenOrders", {
      "account-id": accountId,
      symbol,
    });
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const accountId = await this.getAccountId();
    const raw = await this.signedGet<RawOrder[]>("/v1/order/openOrders", {
      "account-id": accountId,
      symbol,
      size: 100,
    });
    return raw.map((order) => this.mapOrder(order));
  }

  async getOrder(_symbol: string, orderId: string): Promise<Order> {
    const order = await this.signedGet<RawOrder>(`/v1/order/orders/${orderId}`);
    return this.mapOrder(order);
  }

  async getOrderMatchResults(orderId: string): Promise<Trade[]> {
    type RawMatch = {
      id: string;
      symbol: string;
      price: string;
      amount: string;
      direction: "buy" | "sell";
      "created-at": number;
    };
    const raw = await this.signedGet<RawMatch[]>(`/v1/order/orders/${orderId}/matchresults`);
    return raw.map((match) => ({
      id: match.id,
      symbol: match.symbol,
      price: match.price,
      amount: match.amount,
      side: match.direction,
      timestamp: toIso(match["created-at"]),
    }));
  }

  async getOrderHistory(q: HistoryQuery): Promise<Order[]> {
    const accountId = await this.getAccountId();
    const raw = await this.signedGet<RawOrder[]>("/v1/order/orders", {
      "account-id": accountId,
      symbol: q.symbol,
      size: q.limit ?? 100,
      states: "filled,partial-canceled,canceled",
      "start-date": q.startTime,
      "end-date": q.endTime,
    });
    return raw.map((order) => this.mapOrder(order));
  }

  async getTradeHistory(q: HistoryQuery): Promise<Trade[]> {
    const accountId = await this.getAccountId();
    type RawMatch = {
      id: string;
      symbol: string;
      price: string;
      amount: string;
      direction: "buy" | "sell";
      "created-at": number;
    };
    const raw = await this.signedGet<RawMatch[]>("/v1/order/matchresults", {
      "account-id": accountId,
      symbol: q.symbol,
      size: q.limit ?? 100,
      "start-time": q.startTime,
      "end-time": q.endTime,
    });
    return raw.map((match) => ({
      id: match.id,
      symbol: match.symbol,
      price: match.price,
      amount: match.amount,
      side: match.direction,
      timestamp: toIso(match["created-at"]),
    }));
  }

  async getRetailQuote(symbol?: string): Promise<unknown> {
    return {
      websocketUrl: `wss://${HOST}/retail/ws`,
      note: "BitTrade retail quote subscription is WebSocket-only in the public API documentation.",
      subscribeOffers: { action: 1, topic: 1, symbol },
      unsubscribeOffers: { action: 2, topic: 1, symbol },
      subscribeTrades: { action: 1, topic: 2, symbol },
    };
  }

  async placeRetailOrder(params: RetailOrderParams): Promise<unknown> {
    if (!params.amount && !params.cashAmount) {
      throw new ValidationError("Either amount or cashAmount is required for retail orders.");
    }
    if (params.amount && params.cashAmount) {
      throw new ValidationError("amount and cashAmount cannot be used together for retail orders.");
    }
    return this.signedPost("/v1/retail/order/place", {
      id: params.clientOrderId,
      symbol: params.symbol,
      type: params.side === "buy" ? 1 : 2,
      amount: params.amount,
      cash_amount: params.cashAmount,
      price: params.price,
      source: 4,
      client_order_id: params.clientOrderId,
      "order-instruction": 1,
    });
  }

  async getRetailOrderHistory(query: Record<string, string | number | undefined>): Promise<unknown> {
    return this.signedGet("/v1/retail/order/list", {
      id: query.id,
      limit: query.limit,
      from: query.from,
      direct: query.direct ?? 1,
      base_currency: query.baseCurrency,
      quote_currency: query.quoteCurrency,
      symbol: query.symbol,
      order_type: query.orderType,
      state: query.state ?? 2,
    });
  }

  async getRetailMaintenanceTime(): Promise<unknown> {
    return this.publicGet("/v1/retail/maintain/time");
  }

  private mapOrder(order: RawOrder): Order {
    return {
      orderId: String(order.id),
      clientOrderId: order["client-order-id"],
      symbol: order.symbol,
      side: order.type.startsWith("buy") ? "buy" : "sell",
      type: order.type.includes("limit") ? "limit" : "market",
      price: order.price,
      amount: order.amount,
      filledAmount: order["filled-amount"],
      status: fromHuobiStatus(order.state),
      createdAt: toIso(order["created-at"]),
      updatedAt: toIso(order["updated-at"]),
    };
  }
}
