export type AnalyticsFunnelType = "free_guest_link" | "paid_masterclass";

export type AnalyticsEventName =
  | "coach_google_form_click"
  | "coach_register_click"
  | "coach_register_missing_link"
  | "coach_site_archived"
  | "coach_site_created"
  | "coach_site_paused"
  | "coach_site_published"
  | "coach_site_removed"
  | "coach_site_resumed"
  | "coach_site_updated"
  | "coach_site_view"
  | "coach_video_play"
  | "coach_whatsapp_click"
  | "paid_landing_view"
  | "paid_payment_click"
  | "paid_register_click"
  | "paid_whatsapp_click"
  | "payment_initiated"
  | "payment_success"
  | "success_page_view";

export type AnalyticsDeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export type AnalyticsMetricSummary = {
  coachId: string;
  coachSlug: string;
  dailyVisits: number;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  funnelId: string;
  funnelType: AnalyticsFunnelType;
  lastActivity: string;
  monthlyVisits: number;
  paymentButtonClicks: number;
  paymentInitiated: number;
  paymentSuccess: number;
  region: string;
  registerClicks: number;
  source: string;
  successPageViews: number;
  totalVisits: number;
  videoPlays: number;
  weeklyVisits: number;
  whatsappClicks: number;
};

export const ANALYTICS_EVENT_NAMES = new Set<AnalyticsEventName>([
  "coach_google_form_click",
  "coach_register_click",
  "coach_register_missing_link",
  "coach_site_archived",
  "coach_site_created",
  "coach_site_paused",
  "coach_site_published",
  "coach_site_removed",
  "coach_site_resumed",
  "coach_site_updated",
  "coach_site_view",
  "coach_video_play",
  "coach_whatsapp_click",
  "paid_landing_view",
  "paid_payment_click",
  "paid_register_click",
  "paid_whatsapp_click",
  "payment_initiated",
  "payment_success",
  "success_page_view"
]);

