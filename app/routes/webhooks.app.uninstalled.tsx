import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Invalidate the store's access token so stale data isn't used if the
  // merchant reinstalls. Full data cleanup happens via SHOP_REDACT (48h later).
  try {
    const store = await db.store.findUnique({ where: { shopDomain: shop } });
    if (store) {
      await db.store.update({
        where: { id: store.id },
        data: { accessToken: null },
      });
    }
  } catch (err) {
    // Store may not exist — that's fine
    console.warn("Could not invalidate store token on uninstall:", err);
  }

  return new Response();
};
