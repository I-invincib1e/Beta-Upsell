import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  deleteAllShopAppData,
  exportCustomerData,
} from "../utils/shop-data.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, payload, shop } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      const shopDomain =
        (payload as { shop_domain?: string }).shop_domain ?? shop;
      const customer = (payload as { customer?: { id?: number | string } })
        .customer;
      const customerId = customer?.id != null ? String(customer.id) : null;

      if (shopDomain && customerId) {
        const exportPayload = await exportCustomerData(shopDomain, customerId);
        // Shopify requires apps to provide this data to the merchant; structured log for audit.
        console.log(
          "GDPR customers/data_request export",
          JSON.stringify(exportPayload),
        );
      } else {
        console.log("GDPR customers/data_request: missing shop or customer id", {
          shopDomain,
          customerId,
        });
      }
      break;
    }
    case "CUSTOMERS_REDACT": {
      const shopDomain =
        (payload as { shop_domain?: string }).shop_domain ?? shop;
      const customer = (payload as { customer?: { id?: number | string } })
        .customer;

      if (customer?.id != null && shopDomain) {
        const customerId = String(customer.id);
        const store = await prisma.store.findUnique({ where: { shopDomain } });
        if (store) {
          await prisma.offerEvent.updateMany({
            where: { storeId: store.id, customerId },
            data: {
              customerId: null,
              orderId: null,
              sessionData: {},
            },
          });
        }
        console.log("GDPR customers/redact completed", { shopDomain, customerId });
      }
      break;
    }
    case "SHOP_REDACT": {
      const shopDomain =
        (payload as { shop_domain?: string }).shop_domain ?? shop;
      if (shopDomain) {
        await deleteAllShopAppData(shopDomain);
        console.log("GDPR shop/redact completed", { shopDomain });
      }
      break;
    }
    default:
      console.log("Unhandled GDPR webhook topic:", topic);
  }

  return new Response("OK", { status: 200 });
};
