export type AdminNavigationItem = {
  href: string;
  label: string;
};

export type AdminSummaryMetric = {
  label: string;
  tone: "attention" | "neutral" | "success" | "warning";
  value: string;
};

export type AdminTopCoach = {
  clicks: number;
  conversionRate: string;
  name: string;
  niche: string;
  publicLink: string;
  rank: number;
  trend: string;
  visits: number;
};

export type AdminFunnelStep = {
  label: string;
  value: string;
};

export type AdminFunnelOverview = {
  name: string;
  steps: AdminFunnelStep[];
};

export type AdminBreakdownItem = {
  label: string;
  note: string;
  value: string;
};

export type AdminActivityItem = {
  description: string;
  timestamp: string;
  type: string;
};

export type AdminAlertItem = {
  detail: string;
  severity: "high" | "medium" | "low";
  title: string;
};

export type AdminQuickAction = {
  href: string;
  label: string;
};

export type AdminDashboardData = {
  activities: AdminActivityItem[];
  alerts: AdminAlertItem[];
  dataNotice: string;
  deviceBreakdown: AdminBreakdownItem[];
  funnels: AdminFunnelOverview[];
  navigation: AdminNavigationItem[];
  quickActions: AdminQuickAction[];
  regionBreakdown: AdminBreakdownItem[];
  summary: AdminSummaryMetric[];
  topCoaches: AdminTopCoach[];
};

export const adminNavigation: AdminNavigationItem[] = [
  { href: "#overview", label: "Overview" },
  { href: "#paid-masterclass", label: "Paid Masterclass Analytics" },
  { href: "#coach-referral", label: "Coach Referral Analytics" },
  { href: "#coach-sites", label: "Coach Sites" },
  { href: "#create-coach-site", label: "Create Coach Site" },
  { href: "#top-performers", label: "Top Performers" },
  { href: "#masterclass-settings", label: "Masterclass Link Settings" },
  { href: "#error-reports", label: "Error Reports / Bug Reports" },
  { href: "#backup-cleanup", label: "Data Backup & Cleanup" },
  { href: "#settings", label: "Settings" }
];

export const adminDashboardData: AdminDashboardData = {
  dataNotice:
    "Only production records are shown. Empty values mean the data source has not recorded activity yet.",
  navigation: adminNavigation,
  summary: [
    { label: "Total site visits", value: "0", tone: "neutral" },
    { label: "Today's visits", value: "0", tone: "neutral" },
    { label: "Weekly visits", value: "0", tone: "neutral" },
    { label: "Monthly visits", value: "0", tone: "neutral" },
    { label: "Total coach referral sites", value: "0", tone: "neutral" },
    { label: "Active coach sites", value: "0", tone: "neutral" },
    { label: "Total register CTA clicks", value: "0", tone: "neutral" },
    { label: "Total WhatsApp clicks", value: "0", tone: "neutral" },
    { label: "Paid masterclass visits", value: "0", tone: "neutral" },
    { label: "Paid masterclass payment success", value: "0", tone: "neutral" },
    { label: "Overall click-through rate", value: "0%", tone: "neutral" },
    { label: "Recent error reports", value: "0", tone: "neutral" }
  ],
  topCoaches: [],
  funnels: [
    {
      name: "Free Coach Referral Funnel",
      steps: [
        { label: "Coach page visits", value: "0" },
        { label: "Register CTA clicks", value: "0" },
        { label: "Google Form opens", value: "0" },
        { label: "Coach-wise click-through rate", value: "0%" }
      ]
    },
    {
      name: "Paid Masterclass Funnel",
      steps: [
        { label: "Landing page visits", value: "0" },
        { label: "Register CTA clicks", value: "0" },
        { label: "Payment clicks", value: "0" },
        { label: "Payment success", value: "0" },
        { label: "Success page views", value: "0" },
        { label: "WhatsApp button clicks", value: "0" },
        { label: "Drop-off points", value: "No data available yet" }
      ]
    }
  ],
  regionBreakdown: [],
  deviceBreakdown: [],
  activities: [],
  alerts: [],
  quickActions: [
    { href: "#create-coach-site", label: "Create Coach Site" },
    { href: "#coach-referral", label: "View Coach Analytics" },
    { href: "#top-performers", label: "View Top Performers" },
    { href: "#masterclass-settings", label: "Update Masterclass Links" },
    { href: "#error-reports", label: "View Error Reports" },
    { href: "#backup-cleanup", label: "Backup Analytics" }
  ]
};
