import { describe, it, expect } from "vitest";
import { signRequest } from "../adapters/bittrade/signer.js";

describe("BitTrade HMAC Signer", () => {
  it("should produce a valid URLSearchParams with Signature", () => {
    const params = signRequest(
      "GET",
      "/v1/common/symbols",
      {},
      "test-access-key",
      "test-secret-key",
    );

    expect(params.get("AccessKeyId")).toBe("test-access-key");
    expect(params.get("SignatureMethod")).toBe("HmacSHA256");
    expect(params.get("SignatureVersion")).toBe("2");
    expect(params.get("Timestamp")).toBeTruthy();
    expect(params.get("Signature")).toBeTruthy();
  });

  it("should produce different signatures for different secrets", () => {
    const sig1 = signRequest("GET", "/v1/test", {}, "key", "secret1");
    const sig2 = signRequest("GET", "/v1/test", {}, "key", "secret2");
    expect(sig1.get("Signature")).not.toBe(sig2.get("Signature"));
  });

  it("should produce different signatures for different methods", () => {
    const sig1 = signRequest("GET", "/v1/test", {}, "key", "secret");
    const sig2 = signRequest("POST", "/v1/test", {}, "key", "secret");
    expect(sig1.get("Signature")).not.toBe(sig2.get("Signature"));
  });

  it("should include custom params in signature", () => {
    const params = signRequest(
      "GET",
      "/v1/order/orders",
      { symbol: "btcjpy", size: 100 },
      "key",
      "secret",
    );
    expect(params.get("symbol")).toBe("btcjpy");
    expect(params.get("size")).toBe("100");
  });
});
