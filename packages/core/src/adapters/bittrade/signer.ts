import crypto from "node:crypto";

/**
 * Huobi-style HMAC-SHA256 signature for BitTrade API.
 *
 * Canonical string:
 *   METHOD\nhost\npath\nsorted URL-encoded query params
 *
 * Required params:
 *   AccessKeyId, SignatureMethod=HmacSHA256, SignatureVersion=2, Timestamp (UTC, yyyy-MM-ddTHH:mm:ss)
 */

const HOST = "api-cloud.bittrade.co.jp";

function utcTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "").replace("T", "T") + "";
}

function formatUtcTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

export interface SignedParams {
  [key: string]: string | number | boolean;
}

export function signRequest(
  method: "GET" | "POST",
  path: string,
  params: SignedParams,
  accessKey: string,
  secretKey: string,
): URLSearchParams {
  const now = formatUtcTimestamp(new Date());

  const allParams: Record<string, string> = {
    AccessKeyId: accessKey,
    SignatureMethod: "HmacSHA256",
    SignatureVersion: "2",
    Timestamp: now,
  };

  for (const [k, v] of Object.entries(params)) {
    allParams[k] = String(v);
  }

  // Sort params and URL-encode
  const sortedKeys = Object.keys(allParams).sort();
  const qs = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");

  // Build canonical request
  const canonical = [method.toUpperCase(), HOST, path, qs].join("\n");

  // Sign
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(canonical)
    .digest("base64");

  // Append signature to query string
  const result = new URLSearchParams(qs);
  result.set("Signature", signature);

  return result;
}

export { HOST };
