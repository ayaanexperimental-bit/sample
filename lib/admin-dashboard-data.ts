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
  demoNotice: string;
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

// TODO: Replace this demo data with database-backed analytics, coach sites, error reports,
// audit logs, and backup/cleanup services after the persistence model is approved.
export const adminDashboardData: AdminDashboardData = {
  demoNotice:
    "Demo/sample data only. Connect analytics events, coach site persistence, error reports, and backup logs before treating these numbers as production data.",
  navigation: adminNavigation,
  summary: [
    { label: "Total site visits", value: "12,840", tone: "neutral" },
    { label: "Today's visits", value: "186", tone: "success" },
    { label: "Weekly visits", value: "1,284", tone: "neutral" },
    { label: "Monthly visits", value: "5,920", tone: "neutral" },
    { label: "Total coach referral sites", value: "24", tone: "neutral" },
    { label: "Active coach sites", value: "18", tone: "success" },
    { label: "Total register button clicks", value: "2,146", tone: "neutral" },
    { label: "Total WhatsApp clicks", value: "798", tone: "neutral" },
    { label: "Paid masterclass visits", value: "3,412", tone: "neutral" },
    { label: "Paid masterclass conversions", value: "286", tone: "success" },
    { label: "Overall conversion rate", value: "16.7%", tone: "success" },
    { label: "Recent error reports", value: "3", tone: "warning" }
  ],
  topCoaches: [
    {
      rank: 1,
      name: "Gyana Ranjan",
      niche: "PCOS / Women Wellness",
      publicLink: "/gyana",
      visits: 4210,
      clicks: 738,
      conversionRate: "17.5%",
      trend: "+18% weekly"
    },
    {
      rank: 2,
      name: "Sample Coach A",
      niche: "Weight Loss",
      publicLink: "/coach/sample-a",
      visits: 2980,
      clicks: 511,
      conversionRate: "17.1%",
      trend: "+11% weekly"
    },
    {
      rank: 3,
      name: "Sample Coach B",
      niche: "Diabetes Lifestyle",
      publicLink: "/coach/sample-b",
      visits: 2240,
      clicks: 346,
      conversionRate: "15.4%",
      trend: "+8% weekly"
    }
  ],
  funnels: [
    {
      name: "Free Coach Referral Funnel",
      steps: [
        { label: "Coach page visits", value: "8,420" },
        { label: "Register button clicks", value: "1,492" },
        { label: "Google Form link clicks", value: "1,492" },
        { label: "Coach-wise conversion rate", value: "17.7%" }
      ]
    },
    {
      name: "Paid Masterclass Funnel",
      steps: [
        { label: "Landing page visits", value: "3,412" },
        { label: "Register button clicks", value: "914" },
        { label: "Payment clicks", value: "508" },
        { label: "Payment success", value: "286" },
        { label: "Success page views", value: "271" },
        { label: "WhatsApp button clicks", value: "246" },
        { label: "Drop-off points", value: "Payment to success page" }
      ]
    }
  ],
  regionBreakdown: [
    { label: "Bhubaneswar", value: "2,940 visits", note: "Strongest paid funnel activity" },
    { label: "Cuttack", value: "1,730 visits", note: "High coach referral engagement" },
    { label: "Kolkata", value: "1,210 visits", note: "Growing weekly traffic" },
    { label: "Delhi NCR", value: "980 visits", note: "Mixed paid and free funnel traffic" }
  ],
  deviceBreakdown: [
    { label: "Mobile", value: "78%", note: "Best converting device type" },
    { label: "Desktop", value: "16%", note: "Higher paid page reading time" },
    { label: "Tablet", value: "6%", note: "Low volume, stable conversion" }
  ],
  activities: [
    {
      type: "coach_site_published",
      description: "Sample coach site published",
      timestamp: "Today, 10:20"
    },
    {
      type: "register_click",
      description: "Register button clicked from Gyana referral page",
      timestamp: "Today, 09:54"
    },
    {
      type: "whatsapp_join_click",
      description: "Paid success WhatsApp button clicked",
      timestamp: "Today, 09:12"
    },
    {
      type: "error_report_created",
      description: "Missing Google Form link report created for a paused sample site",
      timestamp: "Yesterday, 18:40"
    },
    {
      type: "admin_action_logged",
      description: "Admin login verified with email OTP",
      timestamp: "Yesterday, 17:22"
    }
  ],
  alerts: [
    {
      title: "Missing Google Form link",
      detail: "One sample coach site needs a register destination before publishing.",
      severity: "high"
    },
    {
      title: "Paused coach site",
      detail: "Two sample coach sites are paused and should keep stable public links.",
      severity: "medium"
    },
    {
      title: "Recent error reports",
      detail: "Three sample reports need admin review before they are marked fixed.",
      severity: "medium"
    },
    {
      title: "Coach sites with zero activity",
      detail: "Four sample sites need traffic review or sharing follow-up.",
      severity: "low"
    }
  ],
  quickActions: [
    { href: "#create-coach-site", label: "Create Coach Site" },
    { href: "#coach-referral", label: "View Coach Analytics" },
    { href: "#top-performers", label: "View Top Performers" },
    { href: "#masterclass-settings", label: "Update Masterclass Links" },
    { href: "#error-reports", label: "View Error Reports" },
    { href: "#backup-cleanup", label: "Backup Analytics" }
  ]
};
