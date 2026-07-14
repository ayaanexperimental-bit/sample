import type { AdminV2ViewId } from "./admin-v2-access";

export type AdminV2NavigationAccessProfile = {
  isOwner?: boolean;
  permissions?: string[];
};

export type AdminV2ModuleAction = {
  description: string;
  id: string;
  label: string;
  permissions?: string[];
  viewId: AdminV2ViewId;
};

export const adminV2ModuleActions: AdminV2ModuleAction[] = [
  {
    description: "KPIs, source health, and live admin signals.",
    id: "overview",
    label: "Overview",
    permissions: ["overview.view"],
    viewId: "overview"
  },
  {
    description: "Coach-wise metrics, trends, reports, and AI insight access.",
    id: "analytics",
    label: "Analytics",
    permissions: ["coach_analytics.view"],
    viewId: "coach-analytics"
  },
  {
    description: "Ranked coach performance and operational attention list.",
    id: "coaches",
    label: "Coaches",
    permissions: ["coach_analytics.top_performers"],
    viewId: "top-coaches"
  },
  {
    description: "Search, manage, preview, edit, archive, and recover sites.",
    id: "coach-sites",
    label: "Coach Sites",
    permissions: ["coach_sites.view"],
    viewId: "coach-sites"
  },
  {
    description: "Open the production Website Creator flow.",
    id: "create-site",
    label: "Create Site",
    permissions: ["website_creator.create"],
    viewId: "create-coach-site"
  },
  {
    description: "Shop purchases, payment settings, recovery, and reports.",
    id: "shop",
    label: "Shop",
    permissions: ["shop.view", "shop.payment_settings.view", "shop.reports"],
    viewId: "shop"
  },
  {
    description: "Error reports and incident review queue.",
    id: "reports",
    label: "Reports",
    permissions: ["error_reports.view"],
    viewId: "error-reports"
  },
  {
    description: "Private paid links and payment redirect settings.",
    id: "payments",
    label: "Payments",
    permissions: ["paid_masterclass.view_settings"],
    viewId: "paid-masterclass-settings"
  },
  {
    description: "Settings and support defaults.",
    id: "settings",
    label: "Settings",
    permissions: ["settings.view"],
    viewId: "settings"
  }
];

export function getAdminV2AvailableModuleActions(
  profile: AdminV2NavigationAccessProfile | null | undefined
) {
  return adminV2ModuleActions.filter((action) => canUseAdminV2ModuleAction(profile, action));
}

function canUseAdminV2ModuleAction(
  profile: AdminV2NavigationAccessProfile | null | undefined,
  action: AdminV2ModuleAction
) {
  if (profile?.isOwner) return true;
  if (action.viewId === "admin-users") return false;
  return Boolean(
    action.permissions?.some((permission) => profile?.permissions?.includes(permission))
  );
}
