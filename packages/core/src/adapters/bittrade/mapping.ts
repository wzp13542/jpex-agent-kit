/**
 * BitTrade (Huobi-style) symbol and order type mapping.
 */

// Huobi order type: "buy-limit", "sell-limit", "buy-market", "sell-market"
export function toHuobiOrderType(side: "buy" | "sell", type: "limit" | "market"): string {
  return `${side}-${type}`;
}

export function fromHuobiStatus(status: string): string {
  switch (status) {
    case "partial-filled":
      return "partial";
    case "filled":
      return "filled";
    case "partial-canceled":
      return "canceled";
    case "canceled":
      return "canceled";
    case "submitted":
      return "open";
    case "open":
      return "open";
    default:
      return status;
  }
}

// Huobi kline period mapping
export const PERIOD_MAP: Record<string, string> = {
  "1min": "1min",
  "5min": "5min",
  "15min": "15min",
  "30min": "30min",
  "60min": "60min",
  "1hour": "60min",
  "4hour": "4hour",
  "1day": "1day",
  "1week": "1week",
  "1mon": "1mon",
};
