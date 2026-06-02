import { describe, it, expect } from "vitest";
import { verifyAppProxyRequest } from "./app-proxy.server";

describe("verifyAppProxyRequest", () => {
  it("returns false without signature", () => {
    const request = new Request("https://example.com/api/offers?shop=test.myshopify.com");
    expect(verifyAppProxyRequest(request, "secret")).toBe(false);
  });
});
