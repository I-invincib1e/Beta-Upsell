import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { enforceFreePlanLimits } from "../utils/plan-enforcement.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
  if (!store) {
    return new Response();
  }

  const sub = (payload as { app_subscription?: { status?: string; admin_graphql_api_id?: string } })
    ?.app_subscription;

  const status = sub?.status?.toUpperCase();
  const isActive = status === "ACTIVE";
  const plan = isActive ? "pro" : "free";

  await prisma.store.update({
    where: { shopDomain: shop },
    data: {
      plan,
      billingStatus: isActive ? "active" : "cancelled",
      shopifySubscriptionId: sub?.admin_graphql_api_id ?? store.shopifySubscriptionId,
    },
  });

  if (plan === "free") {
    await enforceFreePlanLimits(store.id);
  }

  return new Response();
};
