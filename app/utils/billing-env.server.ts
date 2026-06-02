/**
 * Shopify Billing API test charges.
 * - Production: real charges (isTest: false) unless SHOPIFY_BILLING_TEST=true
 * - Development: test charges (isTest: true) unless SHOPIFY_BILLING_TEST=false
 */
export function billingIsTest(): boolean {
  const override = process.env.SHOPIFY_BILLING_TEST;
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV !== "production";
}
