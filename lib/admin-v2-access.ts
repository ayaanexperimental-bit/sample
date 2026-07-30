import type { ReactNode } from "react";

export type AdminV2AccessProfileClient = {
  displayName?: string;
  email: string;
  isOwner?: boolean;
  modules?: string[];
  permissions?: string[];
  role?: string;
  roleKey?: string;
};

export type AdminV2ViewId =
  | "admin-users"
  | "backup-cleanup"
  | "coach-analytics"
  | "coach-sites"
  | "create-coach-site"
  | "error-reports"
  | "overview"
  | "paid-masterclass-settings"
  | "settings"
  | "shop"
  | "top-coaches";

export type AdminV2CoachSiteFocus = {
  coachId?: string;
  coachSlug?: string;
  siteId?: string;
};

export type AdminV2ShellProps = {
  adminAccess?: AdminV2AccessProfileClient | null;
  csrfToken: string;
  dashboardAddon?: ReactNode;
  onActiveViewChange?: (
    viewId: AdminV2ViewId,
    coachSiteFocus?: AdminV2CoachSiteFocus | null
  ) => void;
  onLogout: () => void;
  requestedCoachSiteFocus?: AdminV2CoachSiteFocus | null;
  requestedView?: AdminV2ViewId;
  sessionEmail?: string;
};

export type AdminV2ActionActivityStatus = "error" | "success" | "working";

export type AdminV2ActionActivity = {
  detail: string;
  id: string;
  label: string;
  status: AdminV2ActionActivityStatus;
  timestamp: string;
};

export type AdminV2ActionActivityInput = Omit<AdminV2ActionActivity, "id" | "timestamp">;

export type AdminV2NavItem = {
  description: string;
  id: AdminV2ViewId;
  label: string;
};

export type AdminV2NavSection = {
  id: string;
  items: AdminV2NavItem[];
  label: string;
};

export const adminV2NavSections: AdminV2NavSection[] = [
  {
    id: "admin-v2-workflow",
    label: "Admin V2",
    items: [
      { id: "overview", label: "Overview", description: "Key metrics and alerts" },
      { id: "coach-analytics", label: "Analytics", description: "Coach-wise metrics" },
      { id: "top-coaches", label: "Coaches", description: "Performance roster" },
      { id: "coach-sites", label: "Coach Sites", description: "Referral sites + paid filter" },
      { id: "create-coach-site", label: "Create Site", description: "Draft, preview, publish" },
      { id: "shop", label: "Shop", description: "Website purchases" },
      { id: "error-reports", label: "Reports", description: "Recent issues" },
      {
        id: "paid-masterclass-settings",
        label: "Payments",
        description: "Links and redirects"
      },
      { id: "backup-cleanup", label: "Backup/Cleanup", description: "Retention controls" },
      { id: "settings", label: "Settings", description: "Security and users" },
      { id: "admin-users", label: "Admin Users", description: "Owner role controls" }
    ]
  }
];

export const adminV2ViewTitles: Record<AdminV2ViewId, string> = {
  "admin-users": "Admin Users",
  "backup-cleanup": "Backup & Cleanup",
  "coach-analytics": "Analytics",
  "coach-sites": "Coach Sites",
  "create-coach-site": "Create Site",
  "error-reports": "Reports",
  overview: "Admin Overview",
  "paid-masterclass-settings": "Payments",
  settings: "Settings",
  shop: "Shop",
  "top-coaches": "Coaches"
};

export const adminV2ViewSubtitles: Record<AdminV2ViewId, string> = {
  "admin-users": "Invite administrators and manage roles, permissions, and account lifecycle.",
  "backup-cleanup": "Review retention health and run bounded backup or cleanup controls.",
  "coach-analytics":
    "Compare coach-level traffic, funnel signals, audiences, and source freshness.",
  "coach-sites": "Search, review, preview, edit, publish, archive, or restore coach websites.",
  "create-coach-site":
    "Create or update a coach website through a verified draft, preview, and publish flow.",
  "error-reports":
    "Investigate active issues, update status, and retain a traceable support record.",
  overview:
    "Review current performance, operational risk, and the next actions that need attention.",
  "paid-masterclass-settings": "Maintain paid-entry links and protected redirect destinations.",
  settings: "Maintain support defaults, protected controls, and permission-aware configuration.",
  shop: "Manage website purchases, payment handoffs, recovery, and operational exports.",
  "top-coaches": "Find the strongest performers and inspect the evidence behind each ranking."
};

export const adminV2ViewPermissionById: Record<AdminV2ViewId, string> = {
  "admin-users": "admin_users.manage",
  "backup-cleanup": "backup_cleanup.view",
  "coach-analytics": "coach_analytics.view",
  "coach-sites": "coach_sites.view",
  "create-coach-site": "website_creator.create",
  "error-reports": "error_reports.view",
  overview: "overview.view",
  "paid-masterclass-settings": "paid_masterclass.view_settings",
  settings: "settings.view",
  shop: "shop.view",
  "top-coaches": "coach_analytics.top_performers"
};

export const adminV2MergedNavViews = new Set<AdminV2ViewId>(["admin-users", "backup-cleanup"]);

export function hasAdminV2Permission(
  profile: AdminV2AccessProfileClient | null | undefined,
  permission: string
) {
  return Boolean(profile?.isOwner || profile?.permissions?.includes(permission));
}

export function canAccessAdminV2View(
  profile: AdminV2AccessProfileClient | null | undefined,
  viewId: AdminV2ViewId
) {
  if (viewId === "admin-users") return Boolean(profile?.isOwner);
  return hasAdminV2Permission(profile, adminV2ViewPermissionById[viewId]);
}
