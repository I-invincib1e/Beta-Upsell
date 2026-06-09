import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Banner,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getFunnel,
  updateFunnel,
  createWidget,
  addStepToFunnel,
  removeStepFromFunnel,
  reorderSteps,
  updateStep,
} from "../utils/funnel.server";
import { getOrCreateStore } from "../utils/funnel.server";
import { getDefaultConfig } from "../types/widgets";
import type { WidgetType } from "../types/widgets";
import { FunnelCanvas } from "../components/FunnelCanvas";
import { MobilePreview } from "../components/MobilePreview";
import { useState } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const funnelId = params.id;

  if (!funnelId) {
    return json({ funnel: null, error: "Missing funnel ID" }, { status: 400 });
  }

  const funnel = await getFunnel(funnelId);

  if (!funnel) {
    return json({ funnel: null, error: "Funnel not found" }, { status: 404 });
  }

  return json({ funnel, error: null, shop: session.shop });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const funnelId = params.id as string;

  try {
    switch (intent) {
      case "add_step": {
        const placement = formData.get("placement") as string;
        const widgetType = formData.get("widgetType") as WidgetType;
        const store = await getOrCreateStore(session.shop, session.accessToken);

        // Create a new widget with default config
        const defaultConfig = getDefaultConfig(widgetType);
        const widget = await createWidget(store.id, {
          type: widgetType,
          name: `${widgetType.replace(/_/g, " ")} widget`,
          config: defaultConfig,
        });

        // Count existing steps to set position
        const funnel = await getFunnel(funnelId);
        const stepsInPlacement = (funnel?.steps || []).filter(
          (s) => s.placement === placement
        );

        await addStepToFunnel({
          funnelId,
          widgetId: widget.id,
          placement,
          position: stepsInPlacement.length,
        });

        return json({ success: true, action: "add_step" });
      }

      case "remove_step": {
        const stepId = formData.get("stepId") as string;
        await removeStepFromFunnel(stepId);
        return json({ success: true, action: "remove_step" });
      }

      case "reorder_steps": {
        const stepIds = JSON.parse(formData.get("stepIds") as string);
        await reorderSteps(funnelId, stepIds);
        return json({ success: true, action: "reorder_steps" });
      }

      case "update_step_config": {
        const stepId = formData.get("stepId") as string;
        const config = JSON.parse(formData.get("config") as string);
        await updateStep(stepId, { config });
        return json({ success: true, action: "update_step_config" });
      }

      case "update_status": {
        const status = formData.get("status") as string;
        await updateFunnel(funnelId, { status });
        return json({ success: true, action: "update_status" });
      }

      case "update_funnel": {
        const name = formData.get("name") as string | null;
        const triggerType = formData.get("triggerType") as string | null;
        const data: any = {};
        if (name) data.name = name;
        if (triggerType) data.triggerType = triggerType;
        await updateFunnel(funnelId, data);
        return json({ success: true, action: "update_funnel" });
      }

      default:
        return json({ error: `Unknown intent: ${intent}` }, { status: 400 });
    }
  } catch (error) {
    console.error(`Action error (${intent}):`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, { status: 500 });
  }
};

export default function FunnelDetail() {
  const { funnel, error } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData<any>();
  const [previewStep, setPreviewStep] = useState<any>(null);
  const isSubmitting = navigation.state === "submitting";

  if (error || !funnel) {
    return (
      <Page
        backAction={{ content: "Funnels", onAction: () => navigate("/app/funnels") }}
        title="Funnel Not Found"
      >
        <Banner title="Funnel not found" tone="critical">
          <p>{error || "This funnel does not exist or has been deleted."}</p>
        </Banner>
      </Page>
    );
  }

  const handleAddStep = (placement: string, widgetType: WidgetType) => {
    const formData = new FormData();
    formData.append("intent", "add_step");
    formData.append("placement", placement);
    formData.append("widgetType", widgetType);
    submit(formData, { method: "post" });
  };

  const handleRemoveStep = (stepId: string) => {
    if (!confirm("Remove this step from the funnel?")) return;
    const formData = new FormData();
    formData.append("intent", "remove_step");
    formData.append("stepId", stepId);
    submit(formData, { method: "post" });
  };

  const handleReorderSteps = (stepIds: string[]) => {
    const formData = new FormData();
    formData.append("intent", "reorder_steps");
    formData.append("stepIds", JSON.stringify(stepIds));
    submit(formData, { method: "post" });
  };

  const handleUpdateStepConfig = (stepId: string, config: any) => {
    const formData = new FormData();
    formData.append("intent", "update_step_config");
    formData.append("stepId", stepId);
    formData.append("config", JSON.stringify(config));
    submit(formData, { method: "post" });

    // Update preview
    const step = funnel.steps.find((s: any) => s.id === stepId);
    if (step) {
      setPreviewStep({ ...step, config });
    }
  };

  const handleStatusChange = (status: string) => {
    const formData = new FormData();
    formData.append("intent", "update_status");
    formData.append("status", status);
    submit(formData, { method: "post" });
  };

  // Transform steps for FunnelCanvas
  const canvasSteps = (funnel.steps || []).map((step: any) => ({
    id: step.id,
    placement: step.placement,
    position: step.position,
    widget: {
      id: step.widget?.id || "",
      type: step.widget?.type || "unknown",
      name: step.widget?.name || "Untitled",
      config: step.widget?.config || {},
    },
    config: step.config,
  }));

  return (
    <Page
      backAction={{ content: "Funnels", onAction: () => navigate("/app/funnels") }}
      title={funnel.name}
    >
      <TitleBar title={funnel.name} />

      {actionData?.error && (
        <div style={{ marginBottom: "16px" }}>
          <Banner title="Error" tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        </div>
      )}

      <div style={{ display: "flex", gap: "16px" }}>
        {/* Canvas — takes most of the space */}
        <div style={{ flex: 1 }}>
          <FunnelCanvas
            funnelId={funnel.id}
            funnelName={funnel.name}
            funnelStatus={funnel.status}
            steps={canvasSteps}
            onAddStep={handleAddStep}
            onRemoveStep={handleRemoveStep}
            onReorderSteps={handleReorderSteps}
            onUpdateStepConfig={handleUpdateStepConfig}
            onStatusChange={handleStatusChange}
          />
        </div>

        {/* Live Preview — side panel */}
        {previewStep && (
          <div style={{ width: "420px", flexShrink: 0 }}>
            <MobilePreview
              widgetType={previewStep.widget?.type || "product_upsell"}
              widgetConfig={{
                ...(previewStep.widget?.config || {}),
                ...(previewStep.config || {}),
              }}
              placement={previewStep.placement}
            />
          </div>
        )}
      </div>
    </Page>
  );
}
