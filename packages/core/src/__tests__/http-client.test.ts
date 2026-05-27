import { describe, expect, it } from "vitest";
import { BitTradeApiError, unwrapBitTradeResponse } from "../index.js";

describe("BitTrade response mapping", () => {
  it("unwraps status/data envelopes", () => {
    expect(unwrapBitTradeResponse<{ id: number }>({ status: "ok", data: { id: 1 } })).toEqual({ id: 1 });
  });

  it("turns BitTrade API errors into structured errors", () => {
    expect(() =>
      unwrapBitTradeResponse({
        status: "error",
        "err-code": "bad-request",
        "err-msg": "invalid symbol",
      }, "GET /market/detail/merged"),
    ).toThrow(BitTradeApiError);

    try {
      unwrapBitTradeResponse({
        status: "error",
        "err-code": "bad-request",
        "err-msg": "invalid symbol",
      }, "GET /market/detail/merged");
    } catch (error) {
      expect(error).toMatchObject({
        type: "BitTradeApiError",
        code: "bad-request",
        endpoint: "GET /market/detail/merged",
        message: "invalid symbol",
      });
    }
  });

  it("turns retail success=false responses into API errors", () => {
    expect(() =>
      unwrapBitTradeResponse({ success: false, code: 400, message: "retail order failed" }, "POST /v1/retail/order/place"),
    ).toThrow(BitTradeApiError);
  });
});
