/**
 * MobilePreview — Live side-by-side preview panel
 *
 * Shows a mock preview of how the widget will appear on mobile/desktop.
 * Sprint 2 MVP: static mockup based on widget config.
 * Future: iframe with actual extension rendering.
 */

import { Card, BlockStack, InlineStack, Text, Button, Badge, Select } from "@shopify/polaris";
import { useState } from "react";

interface MobilePreviewProps {
  widgetType: string;
  widgetConfig: any;
  placement: string;
}

export function MobilePreview({ widgetType, widgetConfig, placement }: MobilePreviewProps) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingMd">Preview</Text>
          <InlineStack gap="200">
            <Button
              variant={device === "mobile" ? "primary" : "plain"}
              onClick={() => setDevice("mobile")}
              size="slim"
            >
              📱 Mobile
            </Button>
            <Button
              variant={device === "desktop" ? "primary" : "plain"}
              onClick={() => setDevice("desktop")}
              size="slim"
            >
              🖥️ Desktop
            </Button>
          </InlineStack>
        </InlineStack>

        {/* Preview Frame */}
        <div
          style={{
            width: device === "mobile" ? "375px" : "100%",
            maxWidth: "100%",
            margin: "0 auto",
            border: "1px solid var(--p-color-border)",
            borderRadius: "12px",
            overflow: "hidden",
            backgroundColor: "#f8f9fa",
            transition: "width 0.3s ease",
          }}
        >
          {/* Status Bar Mock */}
          <div
            style={{
              padding: "8px 16px",
              backgroundColor: "#1a1a2e",
              color: "#fff",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>9:41</span>
            <span>
              {placement.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
            <span>100%🔋</span>
          </div>

          {/* Widget Preview */}
          <div style={{ padding: "16px" }}>
            {widgetType === "product_upsell" && (
              <ProductUpsellPreview config={widgetConfig} />
            )}
            {widgetType === "discount_timer" && (
              <DiscountTimerPreview config={widgetConfig} />
            )}
            {widgetType === "cross_sell" && (
              <CrossSellPreview config={widgetConfig} />
            )}
            {widgetType === "order_bump" && (
              <OrderBumpPreview config={widgetConfig} />
            )}
            {widgetType === "bundle_offer" && (
              <BundleOfferPreview config={widgetConfig} />
            )}
            {widgetType === "review_request" && (
              <ReviewRequestPreview config={widgetConfig} />
            )}
            {widgetType === "free_shipping_bar" && (
              <FreeShippingBarPreview config={widgetConfig} />
            )}
            {widgetType === "social_share" && (
              <SocialSharePreview config={widgetConfig} />
            )}
            {widgetType === "survey" && (
              <SurveyPreview config={widgetConfig} />
            )}
            {!["product_upsell", "discount_timer", "cross_sell", "order_bump",
              "bundle_offer", "review_request", "free_shipping_bar", "social_share", "survey"
            ].includes(widgetType) && (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                Preview for "{widgetType.replace(/_/g, " ")}" coming soon
              </div>
            )}
          </div>
        </div>
      </BlockStack>
    </Card>
  );
}

// ============================================================
// Widget Preview Components
// ============================================================

function ProductUpsellPreview({ config }: { config: any }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "16px",
        backgroundColor: "#fff",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
        {config.heading || "Complete your order"}
      </div>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <div
          style={{
            width: "60px",
            height: "60px",
            backgroundColor: "#f3f4f6",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
          }}
        >
          🛍️
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 500 }}>
            {config.productTitle || "Product Name"}
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            {config.description || "Add this to your order and save!"}
          </div>
          {config.discountType !== "none" && config.discountValue > 0 && (
            <div
              style={{
                fontSize: "12px",
                color: "#16a34a",
                fontWeight: 600,
                marginTop: "2px",
              }}
            >
              Save {config.discountType === "percentage" ? `${config.discountValue}%` : `$${config.discountValue}`}!
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "default",
          }}
        >
          {config.acceptButtonText || "Add to Order"}
        </button>
        <button
          style={{
            padding: "8px 12px",
            background: "transparent",
            color: "#6b7280",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "13px",
            cursor: "default",
          }}
        >
          {config.declineButtonText || "No Thanks"}
        </button>
      </div>
    </div>
  );
}

function DiscountTimerPreview({ config }: { config: any }) {
  return (
    <div
      style={{
        border: "1px solid #fbbf24",
        borderRadius: "8px",
        padding: "16px",
        backgroundColor: "#fffbeb",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
        {config.heading || "Limited Time Offer!"}
      </div>
      <div style={{ fontSize: "12px", color: "#92400e", marginBottom: "12px" }}>
        {config.urgencyText || "This offer expires in:"}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        {["00", String(config.durationMinutes || 15).padStart(2, "0"), "00"].map(
          (val, i) => (
            <div
              key={i}
              style={{
                background: "#1a1a2e",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: "6px",
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            >
              {val}
            </div>
          )
        )}
      </div>
      <div style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600 }}>
        {config.discountType === "percentage"
          ? `${config.discountValue}% OFF`
          : `$${config.discountValue} OFF`}
        {config.discountCode && ` — Code: ${config.discountCode}`}
      </div>
    </div>
  );
}

function CrossSellPreview({ config }: { config: any }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "16px",
        backgroundColor: "#fff",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
        {config.heading || "You might also like"}
      </div>
      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "12px" }}>
        {config.description || "Customers who bought this also bought:"}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {[1, 2, 3].slice(0, config.maxItems || 3).map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              backgroundColor: "#f9fafb",
              borderRadius: "6px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "#e5e7eb",
                borderRadius: "4px",
                margin: "0 auto 8px",
              }}
            />
            <div style={{ fontSize: "11px", color: "#374151" }}>Product {i}</div>
            <div style={{ fontSize: "11px", color: "#6b7280" }}>$29.99</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderBumpPreview({ config }: { config: any }) {
  return (
    <div
      style={{
        border: "2px dashed #6366f1",
        borderRadius: "8px",
        padding: "16px",
        backgroundColor: "rgba(99, 102, 241, 0.03)",
      }}
    >
      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
        <input
          type="checkbox"
          style={{ marginTop: "2px", accentColor: "#6366f1" }}
          readOnly
        />
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600 }}>
            {config.checkboxLabel || "Add this to my order"}
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
            {config.description || "One-time offer — add this item at a special price!"}
          </div>
          {config.discountType !== "none" && config.discountValue > 0 && (
            <div
              style={{
                fontSize: "12px",
                color: "#16a34a",
                fontWeight: 600,
                marginTop: "4px",
              }}
            >
              Save {config.discountType === "percentage" ? `${config.discountValue}%` : `$${config.discountValue}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sprint 3 Preview Components
// ============================================================

function BundleOfferPreview({ config }: { config: any }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", backgroundColor: "#fff" }}>
      <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
        {config.heading || "Bundle & Save"}
      </div>
      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "12px" }}>
        {config.description || "Get everything you need in one bundle"}
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ width: "50px", height: "50px", backgroundColor: "#f3f4f6", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", border: "2px solid #6366f1" }}>📦</div>
        ))}
        {config.showSavingsBadge !== false && config.discountValue > 0 && (
          <div style={{ backgroundColor: "#dc2626", color: "#fff", padding: "4px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, alignSelf: "flex-start" }}>
            Save {config.discountType === "percentage" ? `${config.discountValue}%` : `$${config.discountValue}`}
          </div>
        )}
      </div>
      <button style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "default" }}>
        {config.bundleLabel || "Add Bundle to Cart"}
      </button>
    </div>
  );
}

function ReviewRequestPreview({ config }: { config: any }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", backgroundColor: "#fff", textAlign: "center" }}>
      <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
        {config.heading || "How was your experience?"}
      </div>
      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "12px" }}>
        {config.description || "We'd love to hear your feedback!"}
      </div>
      {config.showStarRating !== false && (
        <div style={{ fontSize: "28px", marginBottom: "12px", letterSpacing: "4px" }}>
          ⭐⭐⭐⭐⭐
        </div>
      )}
      <button style={{ padding: "8px 24px", background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "default" }}>
        Submit Review
      </button>
    </div>
  );
}

function FreeShippingBarPreview({ config }: { config: any }) {
  const threshold = config.threshold || 50;
  const remaining = (threshold * 0.4).toFixed(2); // Mock 60% progress
  const pct = 60;
  const belowMsg = (config.belowMessage || "Add {remaining} more for free shipping!").replace("{remaining}", `$${remaining}`);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", backgroundColor: config.bgColor || "#f8f9fa" }}>
      <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", textAlign: "center" }}>
        🚚 {belowMsg}
      </div>
      <div style={{ height: "8px", borderRadius: "4px", backgroundColor: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "4px", background: `linear-gradient(90deg, ${config.barColor || "#6366f1"}, #8b5cf6)`, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: "11px", color: "#6b7280", textAlign: "center", marginTop: "4px" }}>
        ${(threshold - parseFloat(remaining)).toFixed(2)} / ${threshold.toFixed(2)}
      </div>
    </div>
  );
}

function SocialSharePreview({ config }: { config: any }) {
  const platforms = [
    config.showFacebook !== false && "📘",
    config.showTwitter !== false && "🐦",
    config.showWhatsApp !== false && "💬",
    config.showEmail !== false && "📧",
    config.showCopyLink !== false && "🔗",
  ].filter(Boolean);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", backgroundColor: "#fff", textAlign: "center" }}>
      <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
        {config.heading || "Share your purchase!"}
      </div>
      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "12px" }}>
        {config.description || "Let your friends know about this great find"}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "8px" }}>
        {platforms.map((icon, i) => (
          <div key={i} style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", cursor: "default" }}>{icon}</div>
        ))}
      </div>
      {config.rewardCode && (
        <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>Share & get code: {config.rewardCode}</div>
      )}
    </div>
  );
}

function SurveyPreview({ config }: { config: any }) {
  const questionType = config.questionType || "multiple_choice";
  const options = (config.options || "Option A\nOption B\nOption C").split("\n").filter(Boolean);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", backgroundColor: "#fff" }}>
      <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
        {config.question || "Quick question for you!"}
      </div>
      {questionType === "multiple_choice" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
          {options.map((opt: string, i: number) => (
            <label key={i} style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px", borderRadius: "6px", border: "1px solid #e5e7eb", cursor: "default", fontSize: "13px" }}>
              <input type="radio" name="survey" readOnly style={{ accentColor: "#6366f1" }} />
              {opt}
            </label>
          ))}
        </div>
      )}
      {questionType === "rating" && (
        <div style={{ display: "flex", justifyContent: "center", gap: "4px", marginBottom: "12px", fontSize: "24px" }}>
          {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ cursor: "default", opacity: 0.3 }}>⭐</span>)}
        </div>
      )}
      {questionType === "nps" && (
        <div style={{ display: "flex", justifyContent: "center", gap: "4px", marginBottom: "12px" }}>
          {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
            <div key={n} style={{ width: "24px", height: "24px", borderRadius: "4px", border: "1px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", cursor: "default" }}>{n}</div>
          ))}
        </div>
      )}
      {questionType === "free_text" && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ width: "100%", height: "60px", border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "#f9fafb" }} />
        </div>
      )}
      <button style={{ width: "100%", padding: "8px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "default" }}>
        Submit
      </button>
      {config.allowSkip !== false && (
        <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#6b7280", cursor: "default" }}>Skip</div>
      )}
    </div>
  );
}
