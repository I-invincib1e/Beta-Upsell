import { describe, it, expect, afterEach } from "vitest";
import { billingIsTest } from "./billing-env.server";

describe("billingIsTest", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("returns false in production by default", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SHOPIFY_BILLING_TEST;
    expect(billingIsTest()).toBe(false);
  });

  it("returns true in development by default", () => {
    process.env.NODE_ENV = "development";
    delete process.env.SHOPIFY_BILLING_TEST;
    expect(billingIsTest()).toBe(true);
  });

  it("respects SHOPIFY_BILLING_TEST override", () => {
    process.env.NODE_ENV = "production";
    process.env.SHOPIFY_BILLING_TEST = "true";
    expect(billingIsTest()).toBe(true);
  });
});
