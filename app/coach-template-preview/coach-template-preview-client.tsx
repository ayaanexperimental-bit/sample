"use client";

import { useSearchParams } from "next/navigation";

import { PublicCoachSitePage } from "../../components/coach/public-coach-site-page";
import { demoCoachSites } from "../../lib/admin-coach-sites";
import { normalizeCoachTemplateThemeId } from "../../lib/coach-template-themes";

export function CoachTemplatePreviewClient() {
  const searchParams = useSearchParams();
  const selectedThemeId = normalizeCoachTemplateThemeId(searchParams.get("theme"));
  const sampleSite = {
    ...demoCoachSites[0],
    googleFormUrl: "https://docs.google.com/forms/d/e/sample-preview/viewform",
    selectedThemeId
  };

  return (
    <PublicCoachSitePage
      enableTracking={false}
      forcedThemeId={selectedThemeId}
      previewMode
      site={sampleSite}
    />
  );
}
