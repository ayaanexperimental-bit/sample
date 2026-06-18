"use client";

import { PublicCoachSitePage } from "../../components/coach/public-coach-site-page";
import { approvedCoachSites } from "../../lib/admin-coach-sites";
import { DEFAULT_COACH_TEMPLATE_THEME_ID } from "../../lib/coach-template-themes";

export function CoachTemplatePreviewClient() {
  const previewSite = {
    ...approvedCoachSites[0],
    selectedThemeId: DEFAULT_COACH_TEMPLATE_THEME_ID
  };

  return (
    <PublicCoachSitePage
      enableTracking={false}
      previewMode
      site={previewSite}
    />
  );
}
