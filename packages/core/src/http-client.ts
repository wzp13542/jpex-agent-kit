import { BitTradeApiError, HttpError, NetworkError } from "./errors.js";
import { RateLimiter, type RateLimitBucket } from "./rate-limiter.js";

interface BitTradeStatusEnvelope<T> {
  status?: string;
  data?: T;
  ts?: number;
  "err-code"?: string;
  "err-msg"?: string;
  err_code?: string;
  err_msg?: string;
}

interface BitTradeRetailEnvelope<T> {
  code?: number;
  data?: T;
  message?: string | null;
  success?: boolean;
}

export interface HttpRequestOptions {
  method: "GET" | "POST";
  url: string;
  endpoint: string;
  body?: unknown;
  bucket: RateLimitBucket;
}

export class HttpClient {
  constructor(
    private readonly rateLimiter: RateLimiter,
    private readonly timeoutMs = 15_000,
  ) {}

  async request<T>(options: HttpRequestOptions): Promise<T> {
    await this.rateLimiter.take(options.bucket);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.method === "POST"
          ? { "Content-Type": "application/json", "Accept-Language": "ja-JP" }
          : { "Content-Type": "application/x-www-form-urlencoded", "Accept-Language": "ja-JP" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      const text = await response.text();
      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status}: ${response.statusText}`, {
          code: String(response.status),
          endpoint: options.endpoint,
        });
      }

      let json: unknown;
      try {
        json = text.length === 0 ? null : JSON.parse(text);
      } catch {
        throw new NetworkError("Failed to parse BitTrade JSON response.", {
          code: "INVALID_JSON",
          endpoint: options.endpoint,
        });
      }

      return unwrapBitTradeResponse<T>(json, options.endpoint);
    } catch (error: unknown) {
      if (error instanceof BitTradeApiError || error instanceof HttpError || error instanceof NetworkError) {
        throw error;
      }
      const message = error instanceof Error && error.name === "AbortError"
        ? `Request timed out after ${this.timeoutMs}ms.`
        : error instanceof Error ? error.message : String(error);
      throw new NetworkError(message, { endpoint: options.endpoint });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function unwrapBitTradeResponse<T>(json: unknown, endpoint = "unknown"): T {
  if (json && typeof json === "object") {
    const obj = json as BitTradeStatusEnvelope<T> & BitTradeRetailEnvelope<T>;
    const errCode = obj["err-code"] ?? obj.err_code;
    const errMsg = obj["err-msg"] ?? obj.err_msg;

    if (obj.status === "error" || errCode) {
      throw new BitTradeApiError(errMsg ?? "BitTrade API returned an error.", {
        code: errCode,
        endpoint,
      });
    }

    if (obj.success === false) {
      throw new BitTradeApiError(obj.message ?? "BitTrade retail API returned an error.", {
        code: obj.code === undefined ? undefined : String(obj.code),
        endpoint,
      });
    }

    if ("data" in obj) {
      return obj.data as T;
    }
  }

  return json as T;
}
