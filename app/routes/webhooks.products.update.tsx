import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} for ${shop}`);

  const productId = (payload as { admin_graphql_api_id?: string })
    ?.admin_graphql_api_id;
  if (!productId) {
    return new Response();
  }

  const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
  if (!store) {
    return new Response();
  }

  const offers = await prisma.offer.findMany({ where: { storeId: store.id } });
  const affected = offers.filter((o) =>
    o.upsellProductIds.some(
      (id) => id === productId || id.endsWith(productId.split("/").pop() ?? ""),
    ),
  );

  if (affected.length > 0) {
    await prisma.offer.updateMany({
      where: { id: { in: affected.map((o) => o.id) } },
      data: { healthStatus: "needs_sync" },
    });
  }

  return new Response();
};
