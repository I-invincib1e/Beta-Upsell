/**
 * FunnelX Widget Type Definitions
 *
 * Each widget type has a typed config schema stored as JSON in Widget.config.
 * Use these types when reading/writing widget configs to ensure type safety.
 */

// ============================================================
// Base Types
// ============================================================

export type WidgetType =
  | "product_upsell"
  | "cross_sell"
  | "discount_timer"
  | "order_bump"
  | "bundle_offer"
  | "review_request"
  | "social_share"
  | "survey"
  | "free_shipping_bar"
  | "loyalty_points"
  | "reorder_upsell"
  | "related_collection"
  | "birthday_capture";

export type Placement =
  | "checkout"
  | "post_purchase"
  | "thank_you"
  | "order_status"
  | "product_page"
  | "cart";

export type FunnelStatus = "draft" | "active" | "paused";

export type TriggerType = "product" | "cart_value" | "collection" | "all";

export type AbTestStatus = "running" | "paused" | "concluded";

// ============================================================
// Widget Configs — Sprint 2 (Core)
// ============================================================

export interface ProductUpsellConfig {
  type: "product_upsell";
  productId: string;
  productTitle?: string;
  productImage?: string;
  variantId?: string;
  discountType: "percentage" | "fixed_amount" | "none";
  discountValue: number;
  heading: string;
  description: string;
  acceptButtonText: string;
  declineButtonText: string;
}

export interface CrossSellConfig {
  type: "cross_sell";
  productIds: string[];
  layout: "grid" | "carousel" | "list";
  maxItems: number;
  heading: string;
  description: string;
  discountType: "percentage" | "fixed_amount" | "none";
  discountValue: number;
}

export interface DiscountTimerConfig {
  type: "discount_timer";
  durationMinutes: number;
  discountCode: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  heading: string;
  urgencyText: string;
  expiredText: string;
}

export interface OrderBumpConfig {
  type: "order_bump";
  productId: string;
  productTitle?: string;
  productImage?: string;
  variantId?: string;
  checkboxLabel: string;
  description: string;
  discountType: "percentage" | "fixed_amount" | "none";
  discountValue: number;
}

// ============================================================
// Widget Configs — Sprint 3 (Depth)
// ============================================================

export interface BundleOfferConfig {
  type: "bundle_offer";
  productIds: string[];
  bundlePrice: number;
  heading: string;
  description: string;
  savingsLabel: string;
}

export interface ReviewRequestConfig {
  type: "review_request";
  heading: string;
  description: string;
  starRating: boolean;
  commentBox: boolean;
  incentiveType: "discount" | "points" | "none";
  incentiveValue: number;
}

export interface SocialShareConfig {
  type: "social_share";
  platforms: ("facebook" | "twitter" | "whatsapp" | "email")[];
  heading: string;
  description: string;
  discountCode: string;
  discountValue: number;
}

export interface SurveyConfig {
  type: "survey";
  question: string;
  answerType: "multiple_choice" | "free_text" | "rating";
  options: string[];
  heading: string;
}

export interface FreeShippingBarConfig {
  type: "free_shipping_bar";
  threshold: number;
  currency: string;
  progressText: string;
  achievedText: string;
}

// ============================================================
// Widget Configs — Sprint 4 (Power / Pro Only)
// ============================================================

export interface LoyaltyPointsConfig {
  type: "loyalty_points";
  pointsPerDollar: number;
  heading: string;
  description: string;
  smileIntegration: boolean;
}

export interface ReorderUpsellConfig {
  type: "reorder_upsell";
  heading: string;
  description: string;
  maxItems: number;
  discountType: "percentage" | "fixed_amount" | "none";
  discountValue: number;
}

export interface RelatedCollectionConfig {
  type: "related_collection";
  collectionId: string;
  collectionTitle?: string;
  maxItems: number;
  heading: string;
  layout: "grid" | "carousel";
}

export interface BirthdayCaptureConfig {
  type: "birthday_capture";
  heading: string;
  description: string;
  incentiveText: string;
  discountCode: string;
}

// ============================================================
// Union Type
// ============================================================

export type WidgetConfig =
  | ProductUpsellConfig
  | CrossSellConfig
  | DiscountTimerConfig
  | OrderBumpConfig
  | BundleOfferConfig
  | ReviewRequestConfig
  | SocialShareConfig
  | SurveyConfig
  | FreeShippingBarConfig
  | LoyaltyPointsConfig
  | ReorderUpsellConfig
  | RelatedCollectionConfig
  | BirthdayCaptureConfig;

// ============================================================
// Widget Type Metadata (for the Widget Library UI)
// ============================================================

export interface WidgetTypeMeta {
  type: WidgetType;
  label: string;
  description: string;
  icon: string; // Polaris icon name
  category: "core" | "depth" | "power";
  requiredTier: "free" | "growth" | "pro";
  availablePlacements: Placement[];
}

export const WIDGET_TYPE_REGISTRY: WidgetTypeMeta[] = [
  // Sprint 2 — Core
  {
    type: "product_upsell",
    label: "Product Upsell",
    description: "Single product recommendation with 1-click add",
    icon: "ProductIcon",
    category: "core",
    requiredTier: "free",
    availablePlacements: ["checkout", "post_purchase", "thank_you", "product_page", "cart"],
  },
  {
    type: "cross_sell",
    label: "Cross-Sell",
    description: "Complementary product suggestions",
    icon: "CollectionIcon",
    category: "core",
    requiredTier: "free",
    availablePlacements: ["checkout", "post_purchase", "thank_you", "product_page", "cart"],
  },
  {
    type: "discount_timer",
    label: "Discount Timer",
    description: "Countdown + auto-apply discount code",
    icon: "ClockIcon",
    category: "core",
    requiredTier: "free",
    availablePlacements: ["checkout", "thank_you", "product_page", "cart"],
  },
  {
    type: "order_bump",
    label: "Order Bump",
    description: "Checkbox add-on at checkout step",
    icon: "PlusCircleIcon",
    category: "core",
    requiredTier: "free",
    availablePlacements: ["checkout"],
  },
  // Sprint 3 — Depth
  {
    type: "bundle_offer",
    label: "Bundle Offer",
    description: "Buy X + Y together for a discounted price",
    icon: "InventoryIcon",
    category: "depth",
    requiredTier: "growth",
    availablePlacements: ["checkout", "product_page", "cart"],
  },
  {
    type: "review_request",
    label: "Review Request",
    description: "Post-purchase review prompt",
    icon: "StarIcon",
    category: "depth",
    requiredTier: "growth",
    availablePlacements: ["thank_you", "order_status"],
  },
  {
    type: "social_share",
    label: "Social Share",
    description: "Share order = get discount",
    icon: "ShareIcon",
    category: "depth",
    requiredTier: "growth",
    availablePlacements: ["thank_you", "order_status"],
  },
  {
    type: "survey",
    label: "Survey",
    description: "1-question post-purchase survey",
    icon: "QuestionCircleIcon",
    category: "depth",
    requiredTier: "growth",
    availablePlacements: ["thank_you", "order_status"],
  },
  {
    type: "free_shipping_bar",
    label: "Free Shipping Bar",
    description: "Progress bar toward free shipping threshold",
    icon: "DeliveryIcon",
    category: "depth",
    requiredTier: "growth",
    availablePlacements: ["checkout", "cart", "product_page"],
  },
  // Sprint 4 — Power (Pro only)
  {
    type: "loyalty_points",
    label: "Loyalty Points",
    description: "Show/award points (Smile.io compatible)",
    icon: "GiftCardIcon",
    category: "power",
    requiredTier: "pro",
    availablePlacements: ["thank_you", "order_status"],
  },
  {
    type: "reorder_upsell",
    label: "Reorder Upsell",
    description: '"Buy again" for repeat customers',
    icon: "RefreshIcon",
    category: "power",
    requiredTier: "pro",
    availablePlacements: ["thank_you", "order_status"],
  },
  {
    type: "related_collection",
    label: "Related Collection",
    description: "Collection-based recommendations",
    icon: "CollectionIcon",
    category: "power",
    requiredTier: "pro",
    availablePlacements: ["checkout", "post_purchase", "thank_you", "product_page"],
  },
  {
    type: "birthday_capture",
    label: "Birthday Capture",
    description: "Capture birthday for CRM",
    icon: "CalendarIcon",
    category: "power",
    requiredTier: "pro",
    availablePlacements: ["thank_you", "order_status"],
  },
];

// ============================================================
// Default Configs (for creating new widgets)
// ============================================================

export function getDefaultConfig(type: WidgetType): WidgetConfig {
  switch (type) {
    case "product_upsell":
      return {
        type: "product_upsell",
        productId: "",
        discountType: "percentage",
        discountValue: 10,
        heading: "Complete your order",
        description: "Add this to your order and save!",
        acceptButtonText: "Add to Order",
        declineButtonText: "No Thanks",
      };
    case "cross_sell":
      return {
        type: "cross_sell",
        productIds: [],
        layout: "carousel",
        maxItems: 3,
        heading: "You might also like",
        description: "Customers who bought this also bought:",
        discountType: "none",
        discountValue: 0,
      };
    case "discount_timer":
      return {
        type: "discount_timer",
        durationMinutes: 15,
        discountCode: "",
        discountType: "percentage",
        discountValue: 10,
        heading: "Limited Time Offer!",
        urgencyText: "This offer expires in:",
        expiredText: "This offer has expired",
      };
    case "order_bump":
      return {
        type: "order_bump",
        productId: "",
        checkboxLabel: "Add this to my order",
        description: "One-time offer — add this item at a special price!",
        discountType: "percentage",
        discountValue: 15,
      };
    case "bundle_offer":
      return {
        type: "bundle_offer",
        productIds: [],
        bundlePrice: 0,
        heading: "Better Together",
        description: "Buy these items together and save!",
        savingsLabel: "You save {amount}!",
      };
    case "review_request":
      return {
        type: "review_request",
        heading: "How was your experience?",
        description: "We'd love to hear your feedback!",
        starRating: true,
        commentBox: true,
        incentiveType: "none",
        incentiveValue: 0,
      };
    case "social_share":
      return {
        type: "social_share",
        platforms: ["facebook", "twitter", "whatsapp"],
        heading: "Share your purchase!",
        description: "Share with friends and get a discount on your next order.",
        discountCode: "",
        discountValue: 10,
      };
    case "survey":
      return {
        type: "survey",
        question: "How did you hear about us?",
        answerType: "multiple_choice",
        options: ["Social Media", "Search Engine", "Friend/Family", "Advertisement", "Other"],
        heading: "Quick Question",
      };
    case "free_shipping_bar":
      return {
        type: "free_shipping_bar",
        threshold: 50,
        currency: "USD",
        progressText: "Add {amount} more for free shipping!",
        achievedText: "🎉 You've unlocked free shipping!",
      };
    case "loyalty_points":
      return {
        type: "loyalty_points",
        pointsPerDollar: 1,
        heading: "You earned points!",
        description: "You've earned {points} points with this purchase.",
        smileIntegration: false,
      };
    case "reorder_upsell":
      return {
        type: "reorder_upsell",
        heading: "Order Again?",
        description: "Re-order your favorites with one click.",
        maxItems: 3,
        discountType: "none",
        discountValue: 0,
      };
    case "related_collection":
      return {
        type: "related_collection",
        collectionId: "",
        maxItems: 4,
        heading: "More from this collection",
        layout: "grid",
      };
    case "birthday_capture":
      return {
        type: "birthday_capture",
        heading: "When's your birthday?",
        description: "Tell us and we'll send you a special surprise!",
        incentiveText: "Get a special birthday discount!",
        discountCode: "",
      };
  }
}
