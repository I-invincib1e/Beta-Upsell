import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  deleteAllShopAppData,
  deleteAllSessionsForShop,
} from "../utils/shop-data.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  await deleteAllShopAppData(shop);
  await deleteAllSessionsForShop(shop);

  return new Response();
};
