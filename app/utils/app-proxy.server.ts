import crypto from "node:crypto";

/**
 * Verifies Shopify App Proxy request signature.
 * @see https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
 */
export function verifyAppProxyRequest(
  request: Request,
  apiSecret: string,
): boolean {
  const url = new URL(request.url);
  const signature = url.searchParams.get("signature");
  if (!signature || !apiSecret) {
    return false;
  }

  const params: string[] = [];
  url.searchParams.forEach((value, key) => {
    if (key !== "signature") {
      params.push(`${key}=${value}`);
    }
  });
  params.sort();
  const message = params.join("");

  const digest = crypto
    .createHmac("sha256", apiSecret)
    .update(message)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

/**
 * App proxy requests include `shop` in the query string.
 * Direct API calls in development may omit the signature.
 */
export function assertStorefrontApiAccess(request: Request): {
  ok: boolean;
  shop: string | null;
  error?: string;
} {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  const secret = process.env.SHOPIFY_API_SECRET || "";
  const hasSignature = url.searchParams.has("signature");

  if (hasSignature) {
    if (!verifyAppProxyRequest(request, secret)) {
      return { ok: false, shop, error: "Invalid app proxy signature" };
    }
    return { ok: true, shop };
  }

  // Allow unsigned only in non-production for local smoke tests
  if (process.env.NODE_ENV !== "production") {
    return { ok: true, shop };
  }

  return {
    ok: false,
    shop,
    error: "App proxy signature required",
  };
}
