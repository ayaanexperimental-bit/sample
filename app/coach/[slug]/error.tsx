"use client";

import { useEffect, useMemo } from "react";
import { useCoachSupport } from "../../../components/coach/coach-support-context";
import {
  CoachRouteErrorFallback,
  createCoachFallbackReferenceId
} from "../../../components/coach/public-coach-site-page";
import { logWebsiteError } from "../../../lib/error-reporting";

type CoachRouteErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CoachRouteErrorPage({ error, reset }: CoachRouteErrorPageProps) {
  const { site, slug } = useCoachSupport();
  const referenceId = useMemo(
    () => createCoachFallbackReferenceId(slug || error.digest || "coach"),
    [error.digest, slug]
  );

  useEffect(() => {
    void logWebsiteError({
      category: "coach_site_issue",
      coachSlug: site?.slug || slug,
      digest: error.digest,
      referenceId,
      safeMessage: "Coach page could not load properly.",
      userAction: "coach_page_render"
    });
  }, [error.digest, referenceId, site?.slug, slug]);

  return <CoachRouteErrorFallback referenceId={referenceId} reset={reset} site={site} />;
}
