"use client";

import { useSearchParams } from "next/navigation";

import { PublicCoachSitePage } from "../../components/coach/public-coach-site-page";
import { approvedCoachSites } from "../../lib/admin-coach-sites";
import { normalizeCoachTemplateThemeId } from "../../lib/coach-template-themes";

export function CoachTemplatePreviewClient() {
  const searchParams = useSearchParams();
  const selectedThemeId = normalizeCoachTemplateThemeId(searchParams.get("theme"));
  const previewSite = {
    ...approvedCoachSites[0],
    selectedThemeId
  };

  return (
    <PublicCoachSitePage
      enableTracking={false}
      forcedThemeId={selectedThemeId}
      previewMode
      site={previewSite}
    />
  );
}
